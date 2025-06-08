const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');
const readline = require('readline');

dotenv.config({ path: '.env.local' });

const dataDir = path.join(process.cwd(), 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir);
}
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

async function scrapeRecordBooks() {
  const browser = await puppeteer.launch({
    headless: false,
    defaultViewport: null,
    args: ['--start-maximized']
  });

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
    await page.type('input[name="email"]', process.env.CBS_SPORTS_EMAIL);
    await page.type('input[name="password"]', process.env.CBS_SPORTS_PASSWORD);
    console.log('Clicking submit...');
    await page.waitForSelector('button[type="submit"]', { visible: true });
    await page.click('button[type="submit"]');
    console.log('Waiting for navigation...');
    await page.waitForNavigation({ waitUntil: 'networkidle0', timeout: 60000 });
    await waitForUserInput('Please solve any captcha if present, then press Enter to continue...');

    const currentYear = new Date().getFullYear();
    for (let year = 2000; year <= currentYear; year++) {
      console.log(`\nProcessing year ${year}...`);
      try {
        const yearUrl = `https://mlffatl.football.cbssports.com/history/year-by-year/${year}`;
        console.log(`Navigating to ${yearUrl}...`);
        const response = await page.goto(yearUrl, {
          waitUntil: 'networkidle0',
          timeout: 60000
        });
        if (response.url().includes('login')) {
          console.log('Got redirected to login page. Please log in again...');
          await waitForUserInput('Press Enter after logging in...');
          continue;
        }
        await sleep(2000);
        // Scrape record book data
        const recordBookData = await page.evaluate(() => {
          const table = document.querySelector('#cardConainerId > div.cardData.leagueRecordBookCardData > table.data4');
          if (!table) return [];
          const rows = Array.from(table.querySelectorAll('tr')).slice(2); // skip title and label rows
          return rows.map(row => {
            const cells = row.querySelectorAll('td');
            if (cells.length < 3) return null;
            const record = cells[0].innerText.trim();
            const team = cells[1].innerText.trim();
            const value = cells[2].innerText.trim();
            return { record, team, value };
          }).filter(Boolean);
        });
        if (recordBookData.length > 0) {
          const csvHeader = 'record,team,value';
          const csvRows = recordBookData.map(row =>
            [`"${row.record.replace(/"/g, '""')}"`, `"${row.team.replace(/"/g, '""')}"`, row.value].join(',')
          );
          const csv = [csvHeader, ...csvRows].join('\n');
          fs.writeFileSync(
            path.join(yearlyStatsDir, `record_book_${year}.csv`),
            csv
          );
          console.log(`Saved record book for ${year}`);
        } else {
          console.log(`No record book data found for ${year}`);
        }
        await sleep(1000);
      } catch (yearError) {
        console.error(`Error processing year ${year}:`, yearError);
        continue;
      }
    }
    console.log('\nScraping completed successfully!');
  } catch (error) {
    console.error('Error scraping record books:', error);
    throw error;
  } finally {
    await browser.close();
  }
}

(async function main() {
  try {
    await scrapeRecordBooks();
  } catch (error) {
    console.error('Failed to scrape record books:', error);
    process.exit(1);
  }
})(); 