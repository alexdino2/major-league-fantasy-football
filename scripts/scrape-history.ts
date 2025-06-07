const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

/**
 * @typedef {Object} Champion
 * @property {number} year
 * @property {string} team
 * @property {string} manager
 * @property {string} record
 *
 * @typedef {Object} Record
 * @property {string} category
 * @property {string} record
 * @property {string} holder
 * @property {string} year
 *
 * @typedef {Object} Milestone
 * @property {number} year
 * @property {string} event
 * @property {string} description
 *
 * @typedef {Object} HistoryData
 * @property {Champion[]} champions
 * @property {Record[]} records
 * @property {Milestone[]} milestones
 */

/**
 * @returns {Promise<HistoryData>}
 */
async function scrapeHistoryData() {
  try {
    // First, get the login page to get any necessary cookies/tokens
    const loginPage = await axios.get('https://mlffatl.football.cbssports.com/login', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      }
    });
    
    const $ = cheerio.load(loginPage.data);
    const csrfToken = $('input[name="csrf_token"]').val() || '';

    // Perform login
    const loginResponse = await axios.post('https://mlffatl.football.cbssports.com/login', {
      email: process.env.CBS_SPORTS_EMAIL,
      password: process.env.CBS_SPORTS_PASSWORD,
      csrf_token: csrfToken
    }, {
      headers: {
        'Cookie': loginPage.headers['set-cookie']?.join('; '),
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      maxRedirects: 5
    });

    // Now fetch the history page
    const historyResponse = await axios.get('https://mlffatl.football.cbssports.com/history', {
      headers: {
        'Cookie': loginResponse.headers['set-cookie']?.join('; '),
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      }
    });

    const historyHtml = historyResponse.data;
    const $history = cheerio.load(historyHtml);

    // Parse the champions data
    const champions = $history('.championship-history tr').map((_, row) => {
      const cells = $history(row).find('td');
      return {
        year: parseInt($history(cells[0]).text().trim()),
        team: $history(cells[1]).text().trim(),
        manager: $history(cells[2]).text().trim(),
        record: $history(cells[3]).text().trim()
      };
    }).get();

    // Parse the records data
    const records = $history('.league-records tr').map((_, row) => {
      const cells = $history(row).find('td');
      return {
        category: $history(cells[0]).text().trim(),
        record: $history(cells[1]).text().trim(),
        holder: $history(cells[2]).text().trim(),
        year: $history(cells[3]).text().trim()
      };
    }).get();

    // Parse the milestones data
    const milestones = $history('.league-milestones tr').map((_, row) => {
      const cells = $history(row).find('td');
      return {
        year: parseInt($history(cells[0]).text().trim()),
        event: $history(cells[1]).text().trim(),
        description: $history(cells[2]).text().trim()
      };
    }).get();

    return {
      champions,
      records,
      milestones
    };
  } catch (error) {
    console.error('Error scraping history data:', error);
    throw error;
  }
}

// Main execution
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