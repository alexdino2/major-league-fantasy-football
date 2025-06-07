const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config();

async function scrapeHistoryData() {
  try {
    // Read cookies from file
    const cookies = fs.readFileSync(path.join(process.cwd(), 'data', 'cookies.txt'), 'utf-8')
      .split('\n')
      .filter(line => line.trim())
      .map(line => {
        const [name, value, domain] = line.split('\t');
        // Only include cookies from CBS Sports domains
        if (domain && (domain.includes('cbssports.com') || domain.includes('mlffatl.football.cbssports.com'))) {
          return `${name}=${value}`;
        }
        return null;
      })
      .filter(Boolean)
      .join('; ');

    console.log('Using cookies:', cookies);

    // Fetch the history page with the cookies
    const historyResponse = await axios.get('https://mlffatl.football.cbssports.com/history', {
      headers: {
        'Cookie': cookies,
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      }
    });

    const historyHtml = historyResponse.data;

    // Save the HTML for debugging
    fs.writeFileSync(path.join(process.cwd(), 'data', 'history-debug.html'), historyHtml);

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