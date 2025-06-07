const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

// Load environment variables from .env.local
dotenv.config({ path: '.env.local' });

// Debug: print all CBS_ environment variables
console.log('Loaded CBS_ env variables:', Object.keys(process.env).filter(k => k.startsWith('CBS_')).reduce((obj, k) => { (obj as any)[k] = process.env[k]; return obj; }, {}));

interface HistoryData {
  champions: Array<{
    year: number;
    team: string;
    owner: string;
    record: string;
  }>;
  records: Array<{
    category: string;
    holder: string;
    value: string;
    year: number;
  }>;
  milestones: Array<{
    year: number;
    description: string;
  }>;
}

const defaultData: HistoryData = {
  champions: [],
  records: [],
  milestones: []
};

async function scrapeCBSHistory() {
  const email = process.env.CBS_SPORTS_EMAIL;
  const password = process.env.CBS_SPORTS_PASSWORD;
  const leagueUrl = process.env.CBS_LEAGUE_URL;

  if (!email || !password || !leagueUrl) {
    console.error('Missing required environment variables. Please set CBS_SPORTS_EMAIL, CBS_SPORTS_PASSWORD, and CBS_LEAGUE_URL in your .env.local file.');
    console.log('Creating default history.json file...');
    saveDefaultData();
    return;
  }

  const browser = await puppeteer.launch({
    headless: false,
    defaultViewport: null,
  });

  try {
    const page = await browser.newPage();
    
    console.log('Navigating to CBS Sports login page...');
    await page.goto('https://www.cbssports.com/login?product_abbrev=mgmt&xurl=https%3A%2F%2Fmlffatl.football.cbssports.com%2F&master_product=41007');
    
    console.log('Filling login credentials...');
    await page.waitForSelector('input[id="name"]');
    await page.type('input[id="name"]', email);
    await page.waitForSelector('input[id="«Rhb98uulb»-form-item"]');
    await page.type('input[id="«Rhb98uulb»-form-item"]', password);
    
    console.log('Clicking login button...');
    await page.waitForSelector('body > div.pt-8.mobile-max\\:pt-24.flex.items-center.flex-col.gap-50.mobile-max\\:gap-300.overflow-auto > div > div.p-6.pt-0.px-0.w-full.flex.flex-col.gap-150.pb-0 > form > div.pt-150 > button');
    await page.click('body > div.pt-8.mobile-max\\:pt-24.flex.items-center.flex-col.gap-50.mobile-max\\:gap-300.overflow-auto > div > div.p-6.pt-0.px-0.w-full.flex.flex-col.gap-150.pb-0 > form > div.pt-150 > button');
    
    console.log('Waiting for login success page...');
    await page.waitForNavigation({ waitUntil: 'networkidle0' });
    
    console.log('Navigating to main website page...');
    await page.goto('https://mlffatl.football.cbssports.com/');
    
    console.log('Waiting for page to load...');
    await page.waitForSelector('.league-history', { timeout: 10000 }).catch(() => {
      console.log('Could not find .league-history selector, trying alternative selectors...');
    });
    
    console.log('Extracting champions data...');
    const champions = await page.evaluate(() => {
      const championElements = document.querySelectorAll('.champion-entry, .championship-history tr');
      return Array.from(championElements).map(el => ({
        year: parseInt(el.querySelector('.year, td:nth-child(1)')?.textContent || '0'),
        team: el.querySelector('.team-name, td:nth-child(2)')?.textContent || '',
        owner: el.querySelector('.owner-name, td:nth-child(3)')?.textContent || '',
        record: el.querySelector('.record, td:nth-child(4)')?.textContent || '',
      }));
    });
    
    console.log('Extracting records data...');
    const records = await page.evaluate(() => {
      const recordElements = document.querySelectorAll('.record-entry, .league-records tr');
      return Array.from(recordElements).map(el => ({
        category: el.querySelector('.category, td:nth-child(1)')?.textContent || '',
        holder: el.querySelector('.holder, td:nth-child(2)')?.textContent || '',
        value: el.querySelector('.value, td:nth-child(3)')?.textContent || '',
        year: parseInt(el.querySelector('.year, td:nth-child(4)')?.textContent || '0'),
      }));
    });
    
    console.log('Extracting milestones data...');
    const milestones = await page.evaluate(() => {
      const milestoneElements = document.querySelectorAll('.milestone-entry, .league-milestones tr');
      return Array.from(milestoneElements).map(el => ({
        year: parseInt(el.querySelector('.year, td:nth-child(1)')?.textContent || '0'),
        description: el.querySelector('.description, td:nth-child(2)')?.textContent || '',
      }));
    });
    
    const historyData: HistoryData = {
      champions,
      records,
      milestones,
    };
    
    saveHistoryData(historyData);
    
  } catch (error) {
    console.error('Error scraping CBS Sports:', error);
    console.log('Creating default history.json file...');
    saveDefaultData();
  } finally {
    await browser.close();
  }
}

function saveHistoryData(data: HistoryData) {
  const dataDir = path.join(process.cwd(), 'data');
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir);
  }
  
  fs.writeFileSync(
    path.join(dataDir, 'history.json'),
    JSON.stringify(data, null, 2)
  );
  
  console.log('Successfully saved history data to data/history.json');
}

function saveDefaultData() {
  saveHistoryData(defaultData);
}

scrapeCBSHistory().catch(console.error); 