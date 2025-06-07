const fs = require('fs');
const cheerio = require('cheerio');

const html = fs.readFileSync('data/history-raw.html', 'utf-8');
const $ = cheerio.load(html);

/**
 * @param {string} tableSelector
 * @returns {string[][]}
 */
function extractTableRows(tableSelector: any) {
  return $(tableSelector)
    .find('tr')
    .toArray()
    .slice(1) // skip header
    .map((row: any) =>
      $(row)
        .find('td')
        .toArray()
        .map((cell: any) => $(cell).text().trim())
    );
}

// 1. Most Championships
const mostChampionships = extractTableRows('.mostChampionshipsCardData table');
const mostChampionshipsJson = mostChampionships.map((row: any) => ({
  team: row[0],
  titles: Number(row[1]),
  years: row[2]?.split(',').map((y: any) => y.trim()).filter(Boolean) || []
}));
fs.writeFileSync('data/most-championships.json', JSON.stringify(mostChampionshipsJson, null, 2));

// 2. All-time Standings
const allTimeStandings = extractTableRows('.alltimeStandingsCardData table');
const allTimeStandingsJson = allTimeStandings.map((row: any) => ({
  team: row[0],
  w: Number(row[1]),
  l: Number(row[2]),
  t: Number(row[3]),
  pct: Number(row[4]),
  pf: Number(row[5]),
  pa: Number(row[6]),
  managers: row[7]
}));
fs.writeFileSync('data/all-time-standings.json', JSON.stringify(allTimeStandingsJson, null, 2));

// 3. League Champions by Year
const leagueChampions = extractTableRows('.leagueChampionsCardData table');
const leagueChampionsJson = leagueChampions.map((row: any) => ({
  year: row[0],
  team: row[1]
}));
fs.writeFileSync('data/league-champions.json', JSON.stringify(leagueChampionsJson, null, 2));

// 4. Most Consistent
const mostConsistent = extractTableRows('.mostConsistentCardData table');
const mostConsistentJson = mostConsistent.map((row: any) => ({
  team: row[0],
  avgFinish: Number(row[1]),
  avgPtsPerYear: Number(row[2])
}));
fs.writeFileSync('data/most-consistent.json', JSON.stringify(mostConsistentJson, null, 2));

console.log('Extracted all tables to JSON!'); 