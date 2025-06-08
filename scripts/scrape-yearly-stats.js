const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');
const readline = require('readline');

// Load environment variables from .env.local
dotenv.config({ path: '.env.local' });

// Create data directory if it doesn't exist
const dataDir = path.join(process.cwd(), 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir);
}

// Create yearly-stats directory if it doesn't exist
const yearlyStatsDir = path.join(dataDir, 'yearly-stats');
if (!fs.existsSync(yearlyStatsDir)) {
  fs.mkdirSync(yearlyStatsDir);
}

async function waitForUserInput(message) {
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

async function scrapeYearlyStats() {
  const browser = await puppeteer.launch({
    headless: false,
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

    // Wait for user to solve any captcha
    await waitForUserInput('Please solve any captcha if present, then press Enter to continue...');

    // Get the current year
    const currentYear = new Date().getFullYear();
    
    // Iterate through years from 2000 to current year
    for (let year = 2000; year <= currentYear; year++) {
      console.log(`\nProcessing year ${year}...`);

      try {
        // Navigate directly to the year's page
        const yearUrl = `https://mlffatl.football.cbssports.com/history/year-by-year/${year}`;
        console.log(`Navigating to ${yearUrl}...`);
        
        const response = await page.goto(yearUrl, {
          waitUntil: 'networkidle0',
          timeout: 60000
        });

        // Check if we got redirected to login page
        if (response.url().includes('login')) {
          console.log('Got redirected to login page. Please log in again...');
          await waitForUserInput('Press Enter after logging in...');
          continue; // Retry this year
        }

        // Wait for the page to load
        await sleep(2000);

        // Debug: Log all table elements on the page
        const tableDebug = await page.evaluate(() => {
          const tables = document.querySelectorAll('table');
          return Array.from(tables).map(table => ({
            id: table.id,
            className: table.className,
            parentId: table.parentElement?.id,
            parentClassName: table.parentElement?.className
          }));
        });
        console.log('Found tables:', tableDebug);

        // Extract final standings
        const standings = await page.evaluate(() => {
          // Try multiple possible selectors
          const selectors = [
            '#cardConainerId > div.cardData.finalStandingsCardData > table',
            '.finalStandingsCardData table',
            'table.finalStandings',
            'table[class*="standings"]'
          ];

          let table = null;
          for (const selector of selectors) {
            table = document.querySelector(selector);
            if (table) break;
          }

          if (!table) {
            console.log('Standings table not found with any selector');
            return null;
          }

          const rows = Array.from(table.querySelectorAll('tr'));
          return rows.map(row => {
            const cells = Array.from(row.querySelectorAll('td, th'));
            return cells.map(cell => cell.innerText.trim());
          });
        });

        // Extract record book
        const recordBook = await page.evaluate(() => {
          // Try multiple possible selectors
          const selectors = [
            '.record-book-table',
            'table[class*="record"]',
            'table[class*="stats"]'
          ];

          let tables = [];
          for (const selector of selectors) {
            const found = document.querySelectorAll(selector);
            if (found.length > 0) {
              tables = found;
              break;
            }
          }

          if (!tables.length) {
            console.log('Record book tables not found with any selector');
            return null;
          }

          const records = [];
          tables.forEach(table => {
            const rows = Array.from(table.querySelectorAll('tr'));
            rows.forEach(row => {
              const cells = Array.from(row.querySelectorAll('td, th'));
              records.push(cells.map(cell => cell.innerText.trim()));
            });
          });
          return records;
        });

        // Save standings to CSV
        if (standings) {
          const standingsCsv = standings.map(row => row.join(',')).join('\n');
          fs.writeFileSync(
            path.join(yearlyStatsDir, `standings_${year}.csv`),
            standingsCsv
          );
          console.log(`Saved standings for ${year}`);
        } else {
          console.log(`No standings data found for ${year}`);
        }

        // Save record book to CSV
        if (recordBook) {
          const recordBookCsv = recordBook.map(row => row.join(',')).join('\n');
          fs.writeFileSync(
            path.join(yearlyStatsDir, `recordbook_${year}.csv`),
            recordBookCsv
          );
          console.log(`Saved record book for ${year}`);
        } else {
          console.log(`No record book data found for ${year}`);
        }

        // Add a small delay between years
        await sleep(1000);
      } catch (yearError) {
        console.error(`Error processing year ${year}:`, yearError);
        // Continue with next year
        continue;
      }
    }

    console.log('\nScraping completed successfully!');
  } catch (error) {
    console.error('Error scraping yearly stats:', error);
    throw error;
  } finally {
    await browser.close();
  }
}

// Run the scraper
(async function main() {
  try {
    await scrapeYearlyStats();
  } catch (error) {
    console.error('Failed to scrape yearly stats:', error);
    process.exit(1);
  }
})(); 