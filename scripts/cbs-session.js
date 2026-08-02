// Shared CBS Sports session handling for the scraper scripts.
//
// CBS puts reCAPTCHA Enterprise in front of the login form, so an automated
// login only works where a human can solve the challenge. Instead of logging in
// on every run, log in once with `pnpm cbs-login` and reuse the saved cookies.

const fs = require('fs');
const path = require('path');

// Holds live authentication cookies, so it is gitignored and written user-only.
const sessionPath = process.env.CBS_SESSION_PATH || path.join(process.cwd(), 'data', 'cbs-session.json');

// A logged-out browser hitting a league page lands back on the CBS login form.
const sessionProbeUrl = 'https://mlffatl.football.cbssports.com/';

function getCredentials() {
  return {
    email: process.env.CBS_SPORTS_EMAIL || process.env.cbslogin,
    password: process.env.CBS_SPORTS_PASSWORD || process.env.cbspw
  };
}

// Extra Chromium flags for sandboxed or proxied environments, e.g.
// PUPPETEER_EXTRA_ARGS="--no-sandbox --proxy-server=http://127.0.0.1:8080"
function extraChromiumArgs() {
  return (process.env.PUPPETEER_EXTRA_ARGS || '').split(' ').filter(Boolean);
}

function getSessionPath() {
  return sessionPath;
}

// Returns the saved cookies, or null when there is no usable session on disk.
function loadSession() {
  if (!fs.existsSync(sessionPath)) return null;

  let cookies;
  try {
    cookies = JSON.parse(fs.readFileSync(sessionPath, 'utf8'));
  } catch (error) {
    console.warn(`Ignoring unreadable session file ${sessionPath}: ${error.message}`);
    return null;
  }
  if (!Array.isArray(cookies) || cookies.length === 0) return null;

  // `expires` is a unix timestamp in seconds; -1 marks a session cookie, which
  // stays valid for as long as the browser that receives it is open.
  const now = Date.now() / 1000;
  const unexpired = cookies.filter(cookie => !cookie.expires || cookie.expires === -1 || cookie.expires > now);
  if (unexpired.length === 0) {
    console.warn(`Saved session at ${sessionPath} has fully expired.`);
    return null;
  }
  return unexpired;
}

async function applySession(browser, cookies) {
  await browser.setCookie(...cookies);
}

// Keeps only CBS cookies: the rest is third-party ad tracking that carries no
// authentication and would otherwise bloat the file.
async function saveSession(browser) {
  const cookies = (await browser.cookies()).filter(cookie => (cookie.domain || '').includes('cbssports.com'));
  if (cookies.length === 0) {
    throw new Error('No cbssports.com cookies to save — the browser does not appear to be logged in.');
  }
  fs.mkdirSync(path.dirname(sessionPath), { recursive: true });
  fs.writeFileSync(sessionPath, JSON.stringify(cookies, null, 2), { mode: 0o600 });
  // writeFileSync only applies `mode` when it creates the file, so an existing
  // session file would keep whatever permissions it already had.
  fs.chmodSync(sessionPath, 0o600);
  return { path: sessionPath, count: cookies.length };
}

// Navigating to a league page is the cheapest way to tell a live session from a
// stale one: CBS redirects to the login form when the cookies no longer work.
async function isSessionValid(page) {
  try {
    const response = await page.goto(sessionProbeUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
    return !response.url().includes('login');
  } catch (error) {
    console.warn(`Could not verify saved session: ${error.message}`);
    return false;
  }
}

module.exports = {
  applySession,
  extraChromiumArgs,
  getCredentials,
  getSessionPath,
  isSessionValid,
  loadSession,
  saveSession
};
