const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env' });

const email = process.env.CBS_SPORTS_EMAIL || process.env.user || process.env.USER_EMAIL;
const password = process.env.CBS_SPORTS_PASSWORD || process.env.pw || process.env.PASSWORD;

const dataDir = path.join(process.cwd(), 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir);
}
const yearlyStatsDir = path.join(dataDir, 'yearly-stats');
if (!fs.existsSync(yearlyStatsDir)) {
  fs.mkdirSync(yearlyStatsDir);
}

const COOKIES_PATH = path.join(dataDir, 'cbs-session-cookies.json');
const USER_DATA_DIR = path.join(dataDir, '.chrome-cbs-profile');

const draftUrls = [
  { year: 2024, url: 'https://mlffatl.football.cbssports.com/draft/results/2024:Pre-season:MLFF%20AUCTION3/' },
  { year: 2025, url: 'https://mlffatl.football.cbssports.com/draft/results/2025:Pre-season:Pre-season/' }
];

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function looksLoggedIn(url) {
  if (!url) return false;
  if (url.includes('/login')) return false;
  // League pages after auth
  return (
    url.includes('mlffatl.football.cbssports.com') ||
    url.includes('cbssports.com/fantasy') ||
    url.includes('cbssports.com/home') ||
    url.includes('cbssports.com/?') ||
    /cbssports\.com\/?$/.test(url.split('?')[0])
  );
}

async function waitForManualLogin(page, timeoutMs = Number(process.env.CBS_LOGIN_TIMEOUT_MS || 60 * 60 * 1000)) {
  const start = Date.now();
  let lastUrl = '';
  console.log('\n========================================');
  console.log('MANUAL LOGIN REQUIRED');
  console.log('========================================');
  console.log('1. In the Chrome window on the desktop, log into CBS Sports.');
  if (email) {
    console.log(`   Username/email hint: ${email}`);
  }
  console.log('2. Solve any captcha if shown.');
  console.log('3. After you are logged in, open the league (or stay on any non-login CBS page).');
  console.log('   Tip: go to https://mlffatl.football.cbssports.com/');
  console.log('4. This script will detect the session and continue automatically.');
  console.log(`   Waiting up to ${Math.round(timeoutMs / 60000)} minutes...`);
  console.log('========================================\n');

  // Drop a status file the agent/user can peek at
  const statusPath = path.join(dataDir, 'cbs-login-status.txt');
  fs.writeFileSync(statusPath, 'waiting_for_login\n');

  while (Date.now() - start < timeoutMs) {
    const url = page.url();
    if (url !== lastUrl) {
      console.log(`[login-wait] current URL: ${url}`);
      lastUrl = url;
      fs.writeFileSync(statusPath, `waiting_for_login\nurl=${url}\n`);
    }

    // Strong signal: can reach the league without redirect to login
    if (url.includes('mlffatl.football.cbssports.com') && !url.includes('login')) {
      console.log('Detected league URL — login looks successful.');
      fs.writeFileSync(statusPath, `logged_in\nurl=${url}\n`);
      return true;
    }

    // Soft signal: left the login page on cbssports
    if (!url.includes('/login') && url.includes('cbssports.com')) {
      // Probe the league to confirm cookies work
      try {
        const probe = await page.goto(
          'https://mlffatl.football.cbssports.com/',
          { waitUntil: 'networkidle0', timeout: 30000 }
        );
        const probeUrl = probe ? probe.url() : page.url();
        console.log(`[login-wait] league probe -> ${probeUrl}`);
        if (!probeUrl.includes('login')) {
          console.log('League probe succeeded — login confirmed.');
          fs.writeFileSync(statusPath, `logged_in\nurl=${probeUrl}\n`);
          return true;
        }
        // Still redirected; send user back to login if needed
        if (page.url().includes('login')) {
          // stay; user still needs to finish login
        } else {
          await page.goto('https://www.cbssports.com/login', {
            waitUntil: 'domcontentloaded',
            timeout: 30000
          }).catch(() => null);
        }
      } catch (e) {
        console.log(`[login-wait] probe error: ${e.message}`);
      }
    }

    await sleep(2500);
  }

  fs.writeFileSync(statusPath, 'timeout\n');
  throw new Error('Timed out waiting for manual CBS login.');
}

async function saveCookies(page) {
  const cookies = await page.cookies(
    'https://www.cbssports.com',
    'https://mlffatl.football.cbssports.com'
  );
  fs.writeFileSync(COOKIES_PATH, JSON.stringify(cookies, null, 2));
  console.log(`Saved ${cookies.length} cookies to ${COOKIES_PATH}`);
  return cookies;
}

async function loadCookiesIfPresent(page) {
  if (!fs.existsSync(COOKIES_PATH)) return false;
  try {
    const cookies = JSON.parse(fs.readFileSync(COOKIES_PATH, 'utf8'));
    if (!Array.isArray(cookies) || cookies.length === 0) return false;
    await page.setCookie(...cookies);
    console.log(`Loaded ${cookies.length} cookies from ${COOKIES_PATH}`);
    return true;
  } catch (e) {
    console.log(`Could not load saved cookies: ${e.message}`);
    return false;
  }
}

async function scrapeYear(page, year, url) {
  console.log(`\nProcessing year ${year}...`);
  console.log(`Navigating to ${url}...`);
  const response = await page.goto(url, {
    waitUntil: 'networkidle0',
    timeout: 60000
  });
  const finalUrl = response ? response.url() : page.url();
  if (finalUrl.includes('login')) {
    throw new Error(`Redirected to login while fetching ${year} draft results. Session expired.`);
  }
  await sleep(2000);

  const draftResults = await page.evaluate((year) => {
    const table =
      document.querySelector('#container > div:nth-child(6) > div:nth-child(2) > div > div.box-Rg.box-white > table.data.borderTop') ||
      document.querySelector('table.data.borderTop') ||
      document.querySelector('table.data');
    if (!table) return { rows: [], header: null };

    const headerCells = Array.from(table.querySelectorAll('tr')[0]?.querySelectorAll('th,td') || [])
      .map(c => (c.innerText || '').trim());
    const rows = Array.from(table.querySelectorAll('tr')).slice(1);
    let currentTeam = null;
    let firstTeam = null;
    const results = [];

    rows.forEach((row, idx) => {
      const cells = row.querySelectorAll('td');
      if (!cells || cells.length === 0) return;
      if (cells.length === 1 && cells[0]) {
        currentTeam = cells[0].innerText ? cells[0].innerText.trim() : '';
        if (!firstTeam && currentTeam) firstTeam = currentTeam;
        return;
      }
      if (cells.length >= 4 && cells[0] && cells[1] && cells[2] && cells[3]) {
        if (!currentTeam) {
          for (let back = idx - 1; back >= 0; back--) {
            const prevCells = rows[back].querySelectorAll('td');
            if (prevCells.length === 1 && prevCells[0] && prevCells[0].innerText) {
              currentTeam = prevCells[0].innerText.trim();
              break;
            }
          }
          if (!currentTeam && firstTeam) currentTeam = firstTeam;
        }
        const POS = cells[0].innerText ? cells[0].innerText.trim() : '';
        const Player = cells[1].innerText ? cells[1].innerText.trim() : '';
        const Salary = cells[2].innerText ? cells[2].innerText.trim() : '';
        const ELIG = cells[3].innerText ? cells[3].innerText.trim() : '';
        let TotalFPTS = null, ActiveFPTS = null;
        if (cells.length > 4 && cells[4]) {
          TotalFPTS = cells[4].innerText ? cells[4].innerText.trim() : null;
        }
        if (cells.length > 5 && cells[5]) {
          ActiveFPTS = cells[5].innerText ? cells[5].innerText.trim() : null;
        }
        // FPTS columns only exist from 2021 onward on CBS draft results
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
    return { rows: results, header: headerCells };
  }, year);

  console.log(`Header for ${year}:`, draftResults.header);
  console.log(`Parsed ${draftResults.rows.length} players for ${year}`);

  if (draftResults.rows.length === 0) {
    const title = await page.title();
    console.log(`No draft results data found for ${year}. Page title: ${title}`);
    fs.writeFileSync(path.join(dataDir, `draft-debug-${year}.html`), await page.content());
    return { year, count: 0, withFpts: 0 };
  }

  const csvHeader = 'Team,POS,Player,Salary,ELIG,Total FPTS,Active FPTS';
  const csvRows = draftResults.rows.map(row =>
    [`"${row.Team.replace(/"/g, '""')}"`, row.POS, `"${row.Player.replace(/"/g, '""')}"`, row.Salary, row.ELIG, row.TotalFPTS ?? '', row.ActiveFPTS ?? ''].join(',')
  );
  const csv = [csvHeader, ...csvRows].join('\n');
  fs.writeFileSync(path.join(yearlyStatsDir, `draft_results_${year}.csv`), csv);
  const withFpts = draftResults.rows.filter(r => r.TotalFPTS).length;
  console.log(`Saved draft results for ${year} (${withFpts}/${draftResults.rows.length} with Total FPTS)`);
  return { year, count: draftResults.rows.length, withFpts };
}

async function scrapeDraftResults() {
  if (!fs.existsSync(USER_DATA_DIR)) {
    fs.mkdirSync(USER_DATA_DIR, { recursive: true });
  }

  const browser = await puppeteer.launch({
    headless: false,
    defaultViewport: { width: 1400, height: 900 },
    userDataDir: USER_DATA_DIR,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--window-size=1400,900',
      '--disable-blink-features=AutomationControlled'
    ]
  });

  try {
    const page = await browser.newPage();
    await page.setUserAgent(
      'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
    );

    // Try existing session first (cookies file or chrome profile)
    const hadCookies = await loadCookiesIfPresent(page);
    let loggedIn = false;

    if (hadCookies) {
      console.log('Probing saved session against league home...');
      try {
        await page.goto('https://mlffatl.football.cbssports.com/', {
          waitUntil: 'networkidle0',
          timeout: 45000
        });
        if (!page.url().includes('login')) {
          loggedIn = true;
          console.log('Saved session is still valid.');
        } else {
          console.log('Saved session expired.');
        }
      } catch (e) {
        console.log(`Session probe failed: ${e.message}`);
      }
    }

    if (!loggedIn) {
      // Open login page; optionally pre-fill credentials but do NOT auto-submit
      // (reCAPTCHA must be completed by a human).
      console.log('Opening CBS login page for manual sign-in...');
      await page.goto('https://www.cbssports.com/login', {
        waitUntil: 'networkidle0',
        timeout: 60000
      });
      await page.waitForSelector('input[name="email"]', { visible: true, timeout: 30000 }).catch(() => null);

      if (email && password) {
        try {
          await page.click('input[name="email"]', { clickCount: 3 });
          await page.type('input[name="email"]', email, { delay: 15 });
          await page.click('input[name="password"]', { clickCount: 3 });
          await page.type('input[name="password"]', password, { delay: 15 });
          console.log('Pre-filled username/password. Please solve captcha and click Continue.');
        } catch (e) {
          console.log(`Could not pre-fill credentials: ${e.message}`);
        }
      }

      await waitForManualLogin(page);
      await saveCookies(page);
    } else {
      await saveCookies(page);
    }

    const summaries = [];
    for (const { year, url } of draftUrls) {
      try {
        summaries.push(await scrapeYear(page, year, url));
      } catch (yearError) {
        console.error(`Error processing year ${year}:`, yearError);
        // One retry after re-saving cookies / brief pause
        await sleep(2000);
        try {
          summaries.push(await scrapeYear(page, year, url));
        } catch (retryError) {
          console.error(`Retry failed for ${year}:`, retryError.message);
        }
      }
    }

    console.log('\nScraping completed.');
    for (const s of summaries) {
      console.log(`  ${s.year}: ${s.withFpts}/${s.count} players with Total FPTS`);
    }
    fs.writeFileSync(
      path.join(dataDir, 'cbs-login-status.txt'),
      `scrape_done\n${summaries.map(s => `${s.year}:${s.withFpts}/${s.count}`).join('\n')}\n`
    );
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
