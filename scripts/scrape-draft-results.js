const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');
const readline = require('readline');

const { applySession, extraChromiumArgs, getCredentials, getSessionPath, isSessionValid, loadSession, saveSession } = require('./cbs-session');

dotenv.config({ path: '.env.local' });

const dataDir = path.join(process.cwd(), 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir);
}
const yearlyStatsDir = path.join(dataDir, 'yearly-stats');
if (!fs.existsSync(yearlyStatsDir)) {
  fs.mkdirSync(yearlyStatsDir);
}

const allDraftUrls = [
  { year: 2024, url: 'https://mlffatl.football.cbssports.com/draft/results/2024:Pre-season:MLFF%20AUCTION3/' },
  { year: 2025, url: 'https://mlffatl.football.cbssports.com/draft/results/2025:Pre-season:Pre-season/' }
];

// Years may be passed on the command line, e.g. `pnpm scrape-draft-results 2024 2025`.
// With no arguments every known year is scraped.
const requestedYears = process.argv.slice(2).map(Number).filter(year => Number.isInteger(year));
const unknownYears = requestedYears.filter(year => !allDraftUrls.some(entry => entry.year === year));
if (unknownYears.length > 0) {
  console.error(`No draft URL configured for: ${unknownYears.join(', ')}`);
  console.error(`Known years: ${allDraftUrls.map(entry => entry.year).join(', ')}`);
  process.exit(1);
}
const draftUrls = requestedYears.length > 0
  ? allDraftUrls.filter(entry => requestedYears.includes(entry.year))
  : allDraftUrls;

const savedSession = loadSession();
const { email, password } = getCredentials();
// A saved session skips the login form entirely, so credentials are only needed
// when there is no session to reuse.
if (!savedSession && (!email || !password)) {
  console.error('Missing CBS credentials. Set CBS_SPORTS_EMAIL and CBS_SPORTS_PASSWORD in .env.local,');
  console.error('or save a session once with `pnpm cbs-login`.');
  process.exit(1);
}

// The captcha step needs a real browser window, but CI and container runs have no
// display and no TTY, so fall back to headless there.
const interactive = Boolean(process.stdin.isTTY);
const headless = process.env.HEADLESS ? process.env.HEADLESS !== 'false' : !interactive;

async function waitForUserInput(message) {
  if (!interactive) {
    console.log(`Skipping prompt (no TTY): ${message}`);
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

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Reuses the session saved by `pnpm cbs-login` when there is one, and otherwise
// logs in from scratch. CBS guards the login form with reCAPTCHA Enterprise, so
// the fallback only gets through where a human can solve the challenge.
async function establishSession(browser, page) {
  if (savedSession) {
    console.log(`Reusing saved CBS session from ${getSessionPath()}...`);
    await applySession(browser, savedSession);
    if (await isSessionValid(page)) {
      console.log('Saved session accepted.');
      return;
    }
    console.log('Saved session is no longer valid, falling back to logging in.');
  }

  if (!email || !password) {
    throw new Error('No valid session and no credentials to log in with. Run `pnpm cbs-login`.');
  }

  console.log('Navigating to login page...');
  await page.goto('https://www.cbssports.com/login', {
    waitUntil: 'networkidle0',
    timeout: 60000
  });
  console.log('Waiting for login form...');
  await page.waitForSelector('input[name="email"]', { visible: true });
  await page.waitForSelector('input[name="password"]', { visible: true });
  console.log('Entering credentials...');
  await page.type('input[name="email"]', email);
  await page.type('input[name="password"]', password);
  console.log('Clicking submit...');
  await page.waitForSelector('button[type="submit"]', { visible: true });
  await page.click('button[type="submit"]');
  console.log('Waiting for navigation...');
  await page.waitForNavigation({ waitUntil: 'networkidle0', timeout: 60000 }).catch(error => {
    // A captcha challenge keeps the page put, so let the prompt below handle it
    // rather than failing the whole run here.
    console.log(`No navigation after submit (${error.message}).`);
  });
  await waitForUserInput('Please solve any captcha if present, then press Enter to continue...');

  if (!(await isSessionValid(page))) {
    throw new Error('Login did not complete — CBS still redirects to the login page. Run `pnpm cbs-login` on a machine with a display.');
  }

  // Save the fresh login so the next run can skip all of this.
  try {
    const { path: savedPath, count } = await saveSession(browser);
    console.log(`Saved ${count} cookies to ${savedPath}`);
  } catch (error) {
    console.warn(`Could not save session: ${error.message}`);
  }
}

async function scrapeDraftResults() {
  const browser = await puppeteer.launch({
    headless,
    defaultViewport: headless ? { width: 1920, height: 1080 } : null,
    args: ['--start-maximized', ...extraChromiumArgs()]
  });

  try {
    const page = await browser.newPage();
    await establishSession(browser, page);

    for (const { year, url } of draftUrls) {
      console.log(`\nProcessing year ${year}...`);
      try {
        console.log(`Navigating to ${url}...`);
        const response = await page.goto(url, {
          waitUntil: 'networkidle0',
          timeout: 60000
        });
        if (response.url().includes('login')) {
          console.log('Got redirected to login page. Please log in again...');
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
              // For years before 2021 and 2024, set FPTS columns to null
              if (year < 2021 || year === 2024) {
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
          console.log(`Saved draft results for ${year}`);
        } else {
          console.log(`No draft results data found for ${year}`);
        }
        await sleep(1000);
      } catch (yearError) {
        console.error(`Error processing year ${year}:`, yearError);
        continue;
      }
    }
    console.log('\nScraping completed successfully!');
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