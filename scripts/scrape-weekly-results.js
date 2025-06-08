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

async function scrapeWeeklyResults() {
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
        // Scrape week-by-week data
        const weeklyResults = await page.evaluate(() => {
          const resultsRoot = document.querySelector('#cardConainerId > div.cardData.resultsPeriodByPeriodCardData');
          if (!resultsRoot) return [];
          const weekDivs = Array.from(resultsRoot.querySelectorAll('div.tableResultsPeriodByPeriod'));
          const allWeeks = [];
          weekDivs.forEach((weekDiv, i) => {
            const weekNum = i + 1;
            const table = weekDiv.querySelector('table.data4');
            if (!table) return;
            const rows = Array.from(table.querySelectorAll('tr')).slice(1); // skip label row
            rows.forEach(row => {
              const cells = row.querySelectorAll('td');
              if (cells.length < 3) return;
              // Some rows may be empty
              const away_team = cells[0].innerText.trim();
              const home_team = cells[1].innerText.trim();
              const results = cells[2].innerText.trim().split(' - ');
              let away_result = '', home_result = '';
              if (results.length === 2) {
                away_result = results[0];
                home_result = results[1];
              } else {
                away_result = results[0];
              }
              allWeeks.push({
                week: weekNum,
                away_team,
                home_team,
                away_result,
                home_result
              });
            });
          });
          return allWeeks;
        });
        if (weeklyResults.length > 0) {
          const csvHeader = 'week,away_team,home_team,away_result,home_result';
          const csvRows = weeklyResults.map(row =>
            [row.week, `"${row.away_team.replace(/"/g, '""')}"`, `"${row.home_team.replace(/"/g, '""')}"`, row.away_result, row.home_result].join(',')
          );
          const csv = [csvHeader, ...csvRows].join('\n');
          fs.writeFileSync(
            path.join(yearlyStatsDir, `weekly_results_${year}.csv`),
            csv
          );
          console.log(`Saved weekly results for ${year}`);
        } else {
          console.log(`No weekly results data found for ${year}`);
        }
        await sleep(1000);
      } catch (yearError) {
        console.error(`Error processing year ${year}:`, yearError);
        continue;
      }
    }
    console.log('\nScraping completed successfully!');
  } catch (error) {
    console.error('Error scraping weekly results:', error);
    throw error;
  } finally {
    await browser.close();
  }
}

(async function main() {
  try {
    await scrapeWeeklyResults();
  } catch (error) {
    console.error('Failed to scrape weekly results:', error);
    process.exit(1);
  }
})(); 