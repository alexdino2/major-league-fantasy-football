const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');
const readline = require('readline');

dotenv.config({ path: '.env.local' });

// Accept a few spellings so the credentials work whether they came from
// .env.local or from environment settings named something shorter.
const CBS_EMAIL = process.env.CBS_SPORTS_EMAIL || process.env.CBS_EMAIL || process.env.cbslogin || process.env.CBSLOGIN;
const CBS_PASSWORD = process.env.CBS_SPORTS_PASSWORD || process.env.CBS_PASSWORD || process.env.cbspw || process.env.CBSPW;

const dataDir = path.join(process.cwd(), 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir);
}
const yearlyStatsDir = path.join(dataDir, 'yearly-stats');
if (!fs.existsSync(yearlyStatsDir)) {
  fs.mkdirSync(yearlyStatsDir);
}

const ALL_DRAFT_URLS = [
  { year: 2024, url: 'https://mlffatl.football.cbssports.com/draft/results/2024:Pre-season:MLFF%20AUCTION3/' },
  { year: 2025, url: 'https://mlffatl.football.cbssports.com/draft/results/2025:Pre-season:Pre-season/' }
];

// `node scripts/scrape-draft-results.js 2024` limits the run to those years.
const requestedYears = process.argv.slice(2).map(Number).filter(Boolean);
const draftUrls = requestedYears.length
  ? ALL_DRAFT_URLS.filter(d => requestedYears.includes(d.year))
  : ALL_DRAFT_URLS;

// Interactive by default (so a human can clear a captcha), automatic when
// there is no terminal attached - e.g. running inside a container or CI.
const INTERACTIVE = process.stdin.isTTY && process.env.CBS_NONINTERACTIVE !== '1';
const HEADLESS = process.env.CBS_HEADLESS
  ? process.env.CBS_HEADLESS === '1'
  : !INTERACTIVE;

const debugDir = path.join(dataDir, 'scrape-debug');

async function waitForUserInput(message) {
  if (!INTERACTIVE) {
    console.log(`(non-interactive: skipping "${message.trim()}")`);
    return;
  }
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  return new Promise(resolve => {
    rl.question(message, () => {
      rl.close();
      resolve();
    });
  });
}

// When a headless run hits a captcha or an unexpected page there is nobody to
// look at the screen, so leave behind enough to diagnose it afterwards.
async function dumpPage(page, label) {
  fs.mkdirSync(debugDir, { recursive: true });
  const stem = path.join(debugDir, label);
  try {
    await page.screenshot({ path: `${stem}.png`, fullPage: true });
    fs.writeFileSync(`${stem}.html`, await page.content());
    console.log(`  wrote data/scrape-debug/${label}.{png,html}`);
  } catch (e) {
    console.log(`  could not capture debug output: ${e.message}`);
  }
}

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function scrapeDraftResults() {
  if (!CBS_EMAIL || !CBS_PASSWORD) {
    throw new Error(
      'CBS credentials must be set (env or .env.local): CBS_SPORTS_EMAIL/CBS_SPORTS_PASSWORD, ' +
      'or cbslogin/cbspw. The MLFF league pages are private, so there is no unauthenticated fallback.'
    );
  }
  console.log(`Years: ${draftUrls.map(d => d.year).join(', ')}`);
  console.log(`Mode: ${HEADLESS ? 'headless' : 'headed'}, ${INTERACTIVE ? 'interactive' : 'non-interactive'}\n`);

  const browser = await puppeteer.launch({
    headless: HEADLESS,
    defaultViewport: HEADLESS ? { width: 1440, height: 1200 } : null,
    executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
    args: HEADLESS
      ? ['--no-sandbox', '--disable-dev-shm-usage']
      : ['--start-maximized']
  });

  const scraped = [];
  try {
    const page = await browser.newPage();
    console.log('Navigating to login page...');
    await page.goto('https://www.cbssports.com/login', {
      waitUntil: 'networkidle0',
      timeout: 60000
    });
    console.log('Waiting for login form...');
    await page.waitForSelector('input[name="email"]', { visible: true });
    await page.waitForSelector('input[name="password"]', { visible: true });
    console.log('Entering credentials...');
    await page.type('input[name="email"]', CBS_EMAIL);
    await page.type('input[name="password"]', CBS_PASSWORD);
    console.log('Clicking submit...');
    await page.waitForSelector('button[type="submit"]', { visible: true });
    await page.click('button[type="submit"]');
    console.log('Waiting for navigation...');
    await page.waitForNavigation({ waitUntil: 'networkidle0', timeout: 60000 });
    await waitForUserInput('Please solve any captcha if present, then press Enter to continue...');

    if (page.url().includes('/login')) {
      await dumpPage(page, 'login-failed');
      throw new Error(
        `Still on the login page after submitting credentials (${page.url()}). ` +
        'This is usually a captcha or a rejected password - see data/scrape-debug/login-failed.png.'
      );
    }
    console.log(`Logged in (now at ${page.url()})`);

    for (const { year, url } of draftUrls) {
      console.log(`\nProcessing year ${year}...`);
      try {
        console.log(`Navigating to ${url}...`);
        const response = await page.goto(url, {
          waitUntil: 'networkidle0',
          timeout: 60000
        });
        if (response.url().includes('login')) {
          console.log('Got redirected to login page - the session did not stick.');
          await dumpPage(page, `redirected-${year}`);
          await waitForUserInput('Press Enter after logging in...');
          continue;
        }
        await sleep(2000);
        // Scrape draft results data, robustly associating team names
        const draftResults = await page.evaluate((year) => {
          const table = document.querySelector('#container > div:nth-child(6) > div:nth-child(2) > div > div.box-Rg.box-white > table.data.borderTop');
          if (!table) return [];
          const rows = Array.from(table.querySelectorAll('tr')).slice(1); // skip header
          let currentTeam = null;
          let firstTeam = null;
          const results = [];
          rows.forEach((row, idx) => {
            const cells = row.querySelectorAll('td');
            if (!cells || cells.length === 0) return;
            // If this row is a team name row (e.g., only one cell spanning all columns)
            if (cells.length === 1 && cells[0]) {
              currentTeam = cells[0].innerText ? cells[0].innerText.trim() : '';
              if (!firstTeam && currentTeam) firstTeam = currentTeam;
              return;
            }
            // If this is a player row
            if (cells.length >= 4 && cells[0] && cells[1] && cells[2] && cells[3]) {
              // If currentTeam is not set, try to look up for a previous row with a single cell
              if (!currentTeam) {
                // Look backwards for a team name row
                for (let back = idx - 1; back >= 0; back--) {
                  const prevCells = rows[back].querySelectorAll('td');
                  if (prevCells.length === 1 && prevCells[0] && prevCells[0].innerText) {
                    currentTeam = prevCells[0].innerText.trim();
                    break;
                  }
                }
                // If still not found, use the first team found in the table
                if (!currentTeam && firstTeam) currentTeam = firstTeam;
              }
              const POS = cells[0].innerText ? cells[0].innerText.trim() : '';
              const Player = cells[1].innerText ? cells[1].innerText.trim() : '';
              const Salary = cells[2].innerText ? cells[2].innerText.trim() : '';
              const ELIG = cells[3].innerText ? cells[3].innerText.trim() : '';
              // FPTS columns may not exist for all years
              let TotalFPTS = null, ActiveFPTS = null;
              if (cells.length > 4 && cells[4]) {
                TotalFPTS = cells[4].innerText ? cells[4].innerText.trim() : null;
              }
              if (cells.length > 5 && cells[5]) {
                ActiveFPTS = cells[5].innerText ? cells[5].innerText.trim() : null;
              }
              // CBS did not publish per-player fantasy points on the draft
              // results page before 2021, so there is nothing to read there.
              // (2024 used to be excluded here too, which is why that season's
              // FPTS columns came back empty even though CBS has them.)
              if (year < 2021) {
                TotalFPTS = null;
                ActiveFPTS = null;
              }
              results.push({
                Team: currentTeam || '',
                POS,
                Player,
                Salary,
                ELIG,
                TotalFPTS,
                ActiveFPTS
              });
            }
          });
          return results;
        }, year);
        if (draftResults.length > 0) {
          const csvHeader = 'Team,POS,Player,Salary,ELIG,Total FPTS,Active FPTS';
          const csvRows = draftResults.map(row =>
            [`"${row.Team.replace(/"/g, '""')}"`, row.POS, `"${row.Player.replace(/"/g, '""')}"`, row.Salary, row.ELIG, row.TotalFPTS ?? '', row.ActiveFPTS ?? ''].join(',')
          );
          const csv = [csvHeader, ...csvRows].join('\n');
          fs.writeFileSync(
            path.join(yearlyStatsDir, `draft_results_${year}.csv`),
            csv
          );
          // The whole point of re-running is the points columns, so say plainly
          // whether they arrived rather than just reporting row counts.
          const withPoints = draftResults.filter(r => r.TotalFPTS).length;
          console.log(`Saved ${draftResults.length} rows for ${year}; ${withPoints} have Total FPTS`);
          if (!withPoints) {
            console.log(`  WARNING: no fantasy points for ${year}. If the season is complete, ` +
                        'the draft results page may still be showing its pre-season view.');
            await dumpPage(page, `no-points-${year}`);
          }
          scraped.push({ year, rows: draftResults.length, withPoints });
        } else {
          console.log(`No draft results data found for ${year} - page layout may have changed`);
          await dumpPage(page, `no-table-${year}`);
          scraped.push({ year, rows: 0, withPoints: 0 });
        }
        await sleep(1000);
      } catch (yearError) {
        console.error(`Error processing year ${year}:`, yearError);
        continue;
      }
    }
    console.log('\nSummary:');
    for (const s of scraped) {
      console.log(`  ${s.year}: ${s.rows} rows, ${s.withPoints} with points`);
    }
    if (scraped.some(s => s.withPoints)) {
      console.log('\nNext: node scripts/auction-analysis.js');
    }
  } catch (error) {
    console.error('Error scraping draft results:', error);
    throw error;
  } finally {
    await browser.close();
  }
}

(async function main() {
  try {
    await scrapeDraftResults();
  } catch (error) {
    console.error('Failed to scrape draft results:', error);
    process.exit(1);
  }
})(); 