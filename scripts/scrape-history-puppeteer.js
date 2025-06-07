const puppeteer = require('puppeteer');
const cheerio = require('cheerio');
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');
const readline = require('readline');

// Load environment variables from .env.local
dotenv.config({ path: '.env.local' });

async function scrapeHistoryData() {
  const browser = await puppeteer.launch({
    headless: false, // Set to false to see the browser
    defaultViewport: null,
    args: ['--start-maximized']
  });

  try {
    const page = await browser.newPage();

    // Navigate to the login page
    console.log('Navigating to login page...');
    await page.goto('https://www.cbssports.com/login', {
      waitUntil: 'networkidle0',
      timeout: 60000
    });

    // Wait for the login form to be visible
    console.log('Waiting for login form...');
    await page.waitForSelector('input[name="email"]', { visible: true });
    await page.waitForSelector('input[name="password"]', { visible: true });

    // Type in the credentials
    console.log('Entering credentials...');
    await page.type('input[name="email"]', process.env.CBS_SPORTS_EMAIL);
    await page.type('input[name="password"]', process.env.CBS_SPORTS_PASSWORD);

    // Wait for the submit button to be visible and click it
    console.log('Clicking submit...');
    await page.waitForSelector('button[type="submit"]', { visible: true });
    await page.click('button[type="submit"]');

    // Wait for navigation to complete
    console.log('Waiting for navigation...');
    await page.waitForNavigation({ waitUntil: 'networkidle0', timeout: 60000 });

    // Log the current URL to help with debugging
    const currentUrl = page.url();
    console.log('Current URL:', currentUrl);

    // Prompt user to manually navigate to the history page
    console.log('\nPlease manually navigate to the history page in the browser: https://mlffatl.football.cbssports.com/history');
    console.log('Handle any popups or modals, then press Enter in the terminal to continue...');

    // Wait for user input
    await new Promise(resolve => {
      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
      });
      rl.question('Press Enter to continue...', () => {
        rl.close();
        resolve();
      });
    });

    // Save the raw HTML content for debugging immediately after user input
    const htmlContent = await page.content();
    fs.writeFileSync('data/history-raw.html', htmlContent);
    console.log('Raw HTML content saved to data/history-raw.html');
    // Optionally, exit here if you only want the raw HTML
    await browser.close();
    return;
  } catch (error) {
    console.error('Error scraping history data:', error);
    throw error;
  }
}

(async function main() {
  try {
    const data = await scrapeHistoryData();
    
    // Create the data directory if it doesn't exist
    const dataDir = path.join(process.cwd(), 'data');
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir);
    }

    // Save the data to a JSON file
    fs.writeFileSync(
      path.join(dataDir, 'history.json'),
      JSON.stringify(data, null, 2)
    );

    console.log('Successfully scraped and saved history data!');
  } catch (error) {
    console.error('Failed to scrape history data:', error);
    process.exit(1);
  }
})(); 