const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');
const { spawn } = require('child_process');
const http = require('http');

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
const DEBUG_PORT = Number(process.env.CBS_CHROME_DEBUG_PORT || 9222);
const CHROME_BIN =
  process.env.CBS_CHROME_BIN ||
  ['/opt/google/chrome/chrome', '/usr/bin/google-chrome-stable', '/usr/bin/google-chrome']
    .find(p => fs.existsSync(p));
const USER_DATA_DIR =
  process.env.CBS_CHROME_PROFILE ||
  path.join(dataDir, '.chrome-cbs-system-profile');

const draftUrls = [
  { year: 2024, url: 'https://mlffatl.football.cbssports.com/draft/results/2024:Pre-season:MLFF%20AUCTION3/' },
  { year: 2025, url: 'https://mlffatl.football.cbssports.com/draft/results/2025:Pre-season:Pre-season/' }
];

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function httpGetJson(url, timeoutMs = 2000) {
  return new Promise((resolve, reject) => {
    const req = http.get(url, res => {
      let data = '';
      res.on('data', c => (data += c));
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(e);
        }
      });
    });
    req.on('error', reject);
    req.setTimeout(timeoutMs, () => {
      req.destroy(new Error('timeout'));
    });
  });
}

async function waitForDebugger(port, timeoutMs = 30000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const version = await httpGetJson(`http://127.0.0.1:${port}/json/version`);
      if (version && version.webSocketDebuggerUrl) return version;
    } catch {}
    await sleep(500);
  }
  throw new Error(`Chrome remote debugging on port ${port} did not become ready`);
}

function startSystemChrome() {
  if (!CHROME_BIN) {
    throw new Error('Could not find Google Chrome binary');
  }
  if (!fs.existsSync(USER_DATA_DIR)) {
    fs.mkdirSync(USER_DATA_DIR, { recursive: true });
  }
  console.log(`Launching Google Chrome: ${CHROME_BIN}`);
  console.log(`Profile: ${USER_DATA_DIR}`);
  console.log(`Remote debugging port: ${DEBUG_PORT}`);

  const child = spawn(
    CHROME_BIN,
    [
      `--remote-debugging-port=${DEBUG_PORT}`,
      `--user-data-dir=${USER_DATA_DIR}`,
      '--no-first-run',
      '--no-default-browser-check',
      '--disable-dev-shm-usage',
      '--no-sandbox',
      '--window-size=1400,900',
      '--window-position=40,40',
      'https://www.cbssports.com/login'
    ],
    {
      stdio: 'ignore',
      detached: true,
      env: { ...process.env, DISPLAY: process.env.DISPLAY || ':1' }
    }
  );
  child.unref();
  return child;
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

async function findLeaguePage(browser) {
  const pages = await browser.pages();
  for (const p of pages) {
    const url = p.url();
    if (url.includes('mlffatl.football.cbssports.com') && !url.includes('login')) {
      return p;
    }
  }
  // Also check targets (popups / new windows)
  for (const t of browser.targets()) {
    const url = t.url();
    if (url.includes('mlffatl.football.cbssports.com') && !url.includes('login')) {
      const p = await t.page();
      if (p) return p;
    }
  }
  return null;
}

async function waitForManualLogin(browser, page, timeoutMs = Number(process.env.CBS_LOGIN_TIMEOUT_MS || 60 * 60 * 1000)) {
  const start = Date.now();
  let lastUrl = '';
  const statusPath = path.join(dataDir, 'cbs-login-status.txt');
  const signalPath = path.join(dataDir, 'cbs-login-done.flag');
  if (fs.existsSync(signalPath)) fs.unlinkSync(signalPath);

  console.log('\n========================================');
  console.log('MANUAL LOGIN REQUIRED');
  console.log('========================================');
  console.log('Use the normal Google Chrome window on the desktop');
  console.log('(title bar says "Google Chrome" — not "Chrome for Testing").');
  if (email) console.log(`Username/email hint: ${email}`);
  console.log('1. Log into CBS Sports (email/password or Google).');
  console.log('2. Solve any captcha.');
  console.log('3. Open https://mlffatl.football.cbssports.com/');
  console.log('4. This script detects the league URL and continues.');
  console.log(`   Waiting up to ${Math.round(timeoutMs / 60000)} minutes...`);
  console.log(`   Optional signal file: ${signalPath}`);
  console.log('========================================\n');
  fs.writeFileSync(statusPath, 'waiting_for_login\n');

  while (Date.now() - start < timeoutMs) {
    // Prefer any open tab already on the league
    const leaguePage = await findLeaguePage(browser);
    if (leaguePage) {
      const url = leaguePage.url();
      console.log(`Detected league tab: ${url}`);
      fs.writeFileSync(statusPath, `logged_in\nurl=${url}\n`);
      return leaguePage;
    }

    const url = page.url();
    if (url !== lastUrl) {
      console.log(`[login-wait] tracked tab URL: ${url}`);
      lastUrl = url;
      fs.writeFileSync(statusPath, `waiting_for_login\nurl=${url}\n`);
    }

    if (url.includes('mlffatl.football.cbssports.com') && !url.includes('login')) {
      console.log('Tracked tab is on league — login successful.');
      fs.writeFileSync(statusPath, `logged_in\nurl=${url}\n`);
      return page;
    }

    if (fs.existsSync(signalPath)) {
      console.log('Detected cbs-login-done.flag — probing league...');
      try { fs.unlinkSync(signalPath); } catch {}
      try {
        await page.bringToFront().catch(() => null);
        const probe = await page.goto('https://mlffatl.football.cbssports.com/', {
          waitUntil: 'networkidle0',
          timeout: 45000
        });
        const probeUrl = probe ? probe.url() : page.url();
        console.log(`[login-wait] league probe -> ${probeUrl}`);
        if (!probeUrl.includes('login')) {
          fs.writeFileSync(statusPath, `logged_in\nurl=${probeUrl}\n`);
          return page;
        }
        console.log('Probe still redirected to login.');
      } catch (e) {
        console.log(`[login-wait] probe error: ${e.message}`);
      }
    }

    await sleep(2500);
  }
  throw new Error('Timed out waiting for manual CBS login.');
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
  fs.writeFileSync(path.join(yearlyStatsDir, `draft_results_${year}.csv`), [csvHeader, ...csvRows].join('\n'));
  const withFpts = draftResults.rows.filter(r => r.TotalFPTS).length;
  console.log(`Saved draft results for ${year} (${withFpts}/${draftResults.rows.length} with Total FPTS)`);
  return { year, count: draftResults.rows.length, withFpts };
}

async function scrapeDraftResults() {
  startSystemChrome();
  await waitForDebugger(DEBUG_PORT);
  const browser = await puppeteer.connect({
    browserURL: `http://127.0.0.1:${DEBUG_PORT}`,
    defaultViewport: null
  });

  try {
    let page = (await browser.pages())[0] || await browser.newPage();

    // Pre-fill credentials on login page when possible (do not submit).
    try {
      if (page.url().includes('login') || page.url() === 'about:blank') {
        await page.goto('https://www.cbssports.com/login', {
          waitUntil: 'networkidle0',
          timeout: 60000
        });
      }
      await page.waitForSelector('input[name="email"]', { visible: true, timeout: 20000 });
      if (email && password) {
        await page.click('input[name="email"]', { clickCount: 3 });
        await page.type('input[name="email"]', email, { delay: 15 });
        await page.click('input[name="password"]', { clickCount: 3 });
        await page.type('input[name="password"]', password, { delay: 15 });
        console.log('Pre-filled username/password in Google Chrome. Solve captcha and click Continue.');
      }
    } catch (e) {
      console.log(`Pre-fill skipped: ${e.message}`);
    }

    page = await waitForManualLogin(browser, page);
    await saveCookies(page);

    const summaries = [];
    for (const { year, url } of draftUrls) {
      try {
        summaries.push(await scrapeYear(page, year, url));
      } catch (yearError) {
        console.error(`Error processing year ${year}:`, yearError);
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
    try {
      browser.disconnect();
    } catch {}
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
