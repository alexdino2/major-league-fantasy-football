// Logs in to CBS Sports once and saves the session for the scraper scripts.
//
// Run this on a machine with a display: `pnpm cbs-login`. A browser window
// opens on the CBS login page with the credentials pre-filled where available.
// Finish the login yourself — including the reCAPTCHA challenge — then come back
// to the terminal and press Enter to save the session.

const puppeteer = require('puppeteer');
const dotenv = require('dotenv');
const readline = require('readline');

const { applySession, extraChromiumArgs, getCredentials, getSessionPath, isSessionValid, loadSession, saveSession } = require('./cbs-session');

dotenv.config({ path: '.env.local' });

async function waitForUserInput(message) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise(resolve => {
    rl.question(message, () => {
      rl.close();
      resolve();
    });
  });
}

async function login() {
  if (!process.stdin.isTTY) {
    console.error('cbs-login needs an interactive terminal and a display to solve the captcha.');
    process.exit(1);
  }

  const browser = await puppeteer.launch({
    headless: false,
    defaultViewport: null,
    args: ['--start-maximized', ...extraChromiumArgs()]
  });

  try {
    const page = await browser.newPage();

    // Reusing an existing session keeps an already-good login from being thrown
    // away, and lets this script double as a "is my session still alive?" check.
    const existing = loadSession();
    if (existing) {
      await applySession(browser, existing);
      if (await isSessionValid(page)) {
        console.log(`Saved session at ${getSessionPath()} is still valid — nothing to do.`);
        return;
      }
      console.log('Saved session is no longer valid, logging in again...');
    }

    console.log('Opening the CBS login page...');
    await page.goto('https://www.cbssports.com/login', { waitUntil: 'networkidle0', timeout: 60000 });

    const { email, password } = getCredentials();
    if (email && password) {
      console.log('Pre-filling credentials...');
      await page.waitForSelector('input[name="email"]', { visible: true });
      await page.waitForSelector('input[name="password"]', { visible: true });
      await page.type('input[name="email"]', email);
      await page.type('input[name="password"]', password);
    } else {
      console.log('No credentials in the environment — enter them in the browser window.');
    }

    await waitForUserInput('Complete the login in the browser (including the captcha), then press Enter...');

    if (!(await isSessionValid(page))) {
      console.error('Still not logged in. Nothing was saved — finish the login and run this again.');
      process.exitCode = 1;
      return;
    }

    const { path: savedPath, count } = await saveSession(browser);
    console.log(`Saved ${count} cookies to ${savedPath}`);
    console.log('You can now run `pnpm scrape-draft-results` without logging in again.');
  } finally {
    await browser.close();
  }
}

(async function main() {
  try {
    await login();
  } catch (error) {
    console.error('Failed to save CBS session:', error);
    process.exit(1);
  }
})();
