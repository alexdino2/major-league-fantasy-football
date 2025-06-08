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

async function scrapePlayoffBrackets() {
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
        // Scrape playoff bracket data with updated selectors
        const bracketData = await page.evaluate(() => {
          const bracket = document.querySelector('#cardConainerId .playoffBracketCardData #playoffBracket');
          if (!bracket) return [];
          const matchups = Array.from(bracket.querySelectorAll('.manualMatchup'));
          // Log the number of matchups found
          console.log('Number of matchups found:', matchups.length);
          return matchups.map(matchup => {
            const id = matchup.id;
            const round = matchup.closest('.roundContainer') ? 1 : '';
            const topTeamDiv = matchup.querySelector('.teamContainer.topTeam');
            const bottomTeamDiv = matchup.querySelector('.teamContainer.bottomTeam');
            const topTeam = topTeamDiv ? (topTeamDiv.querySelector('.text.topText.teamTextRound1')?.innerText || '') : '';
            const topScore = topTeamDiv ? (topTeamDiv.querySelector('.score.topScore')?.innerText || '') : '';
            const bottomTeam = bottomTeamDiv ? (bottomTeamDiv.querySelector('.text.bottomText.teamTextRound1')?.innerText || '') : '';
            const bottomScore = bottomTeamDiv ? (bottomTeamDiv.querySelector('.score.bottomScore')?.innerText || '') : '';
            return { round, matchup_id: id, top_team: topTeam, top_score: topScore, bottom_team: bottomTeam, bottom_score: bottomScore };
          });
        });
        console.log(`Found ${bracketData.length} matchups for year ${year}`);
        if (bracketData.length > 0) {
          const csvHeader = 'round,matchup_id,top_team,top_score,bottom_team,bottom_score';
          const csvRows = bracketData.map(row => [row.round, row.matchup_id, `"${row.top_team}"`, row.top_score, `"${row.bottom_team}"`, row.bottom_score].join(','));
          const csv = [csvHeader, ...csvRows].join('\n');
          fs.writeFileSync(
            path.join(yearlyStatsDir, `playoff_bracket_${year}.csv`),
            csv
          );
          console.log(`Saved playoff bracket for ${year}`);
        } else {
          console.log(`No playoff bracket data found for ${year}`);
        }
        await sleep(1000);
      } catch (yearError) {
        console.error(`Error processing year ${year}:`, yearError);
        continue;
      }
    }
    console.log('\nScraping completed successfully!');
  } catch (error) {
    console.error('Error scraping playoff brackets:', error);
    throw error;
  } finally {
    await browser.close();
  }
}

(async function main() {
  try {
    await scrapePlayoffBrackets();
  } catch (error) {
    console.error('Failed to scrape playoff brackets:', error);
    process.exit(1);
  }
})(); 