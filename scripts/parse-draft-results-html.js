/**
 * Turn a saved CBS draft-results page into data/yearly-stats/draft_results_<year>.csv.
 *
 * The scraper in scrape-draft-results.js needs a logged-in browser, which is not
 * always available (headless containers, captchas, expired sessions). This does
 * the same extraction offline: log in yourself, save the page, run this.
 *
 *   1. Open the draft results page in a browser where you're logged in, e.g.
 *      https://mlffatl.football.cbssports.com/draft/results/2025:Pre-season:Pre-season/
 *   2. Save it as data/raw/draft_2025.html ("Web page, HTML only" is enough).
 *   3. node scripts/parse-draft-results-html.js 2025
 *
 * With no year arguments it parses every data/raw/draft_<year>.html it finds.
 *
 * The table is located by its header text rather than by a CSS path, so a
 * layout tweak on CBS's side does not silently produce an empty file.
 */

const fs = require('fs');
const path = require('path');
const cheerio = require('cheerio');

const rawDir = path.join(process.cwd(), 'data', 'raw');
const outDir = path.join(process.cwd(), 'data', 'yearly-stats');

const COLUMNS = ['POS', 'Player', 'Salary', 'ELIG', 'Total FPTS', 'Active FPTS'];

function findDraftTable($) {
  let match = null;
  $('table').each((_, el) => {
    if (match) return;
    const headers = $(el).find('tr').first().find('th, td')
      .map((__, c) => $(c).text().trim().toLowerCase()).get();
    const hasPlayer = headers.some((h) => h === 'player');
    const hasSalary = headers.some((h) => h.includes('salary') || h === '$');
    if (hasPlayer && hasSalary) match = { el, headers };
  });
  return match;
}

function parse(year) {
  const file = path.join(rawDir, `draft_${year}.html`);
  if (!fs.existsSync(file)) {
    console.log(`  ${year}: no data/raw/draft_${year}.html - skipping`);
    return null;
  }
  const $ = cheerio.load(fs.readFileSync(file, 'utf8'));
  const found = findDraftTable($);
  if (!found) {
    console.log(`  ${year}: no table with Player + Salary headers found in ${path.basename(file)}`);
    return null;
  }
  console.log(`  ${year}: header row -> ${found.headers.join(' | ')}`);

  // Column order has shifted between seasons, so map by header name and fall
  // back to CBS's usual order when a header is missing.
  const idx = {};
  COLUMNS.forEach((name) => {
    const i = found.headers.findIndex((h) => h === name.toLowerCase());
    if (i >= 0) idx[name] = i;
  });
  if (idx.Player === undefined) {
    COLUMNS.forEach((name, i) => { if (idx[name] === undefined) idx[name] = i; });
  }

  const rows = [];
  let currentTeam = null;
  $(found.el).find('tr').slice(1).each((_, tr) => {
    const cells = $(tr).find('td');
    // A single-cell row is a team banner separating that team's picks.
    if (cells.length === 1) {
      const t = $(cells[0]).text().trim();
      if (t) currentTeam = t;
      return;
    }
    if (cells.length < 4) return;
    const cell = (name) => {
      const i = idx[name];
      return i === undefined || !cells[i] ? '' : $(cells[i]).text().replace(/\s+/g, ' ').trim();
    };
    const player = cell('Player');
    if (!player || player.toLowerCase() === 'player') return;
    rows.push({
      Team: currentTeam || '',
      POS: cell('POS'),
      Player: player,
      Salary: cell('Salary').replace(/^\$/, ''),
      ELIG: cell('ELIG'),
      'Total FPTS': cell('Total FPTS'),
      'Active FPTS': cell('Active FPTS'),
    });
  });

  if (!rows.length) {
    console.log(`  ${year}: table found but no player rows parsed`);
    return null;
  }

  const q = (v) => `"${String(v).replace(/"/g, '""')}"`;
  const csv = [
    'Team,POS,Player,Salary,ELIG,Total FPTS,Active FPTS',
    ...rows.map((r) => [q(r.Team), r.POS, q(r.Player), r.Salary, r.ELIG, r['Total FPTS'], r['Active FPTS']].join(',')),
  ].join('\n');

  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, `draft_results_${year}.csv`), csv + '\n');

  const withPoints = rows.filter((r) => r['Total FPTS']).length;
  const teams = new Set(rows.map((r) => r.Team)).size;
  console.log(`  ${year}: wrote ${rows.length} rows across ${teams} teams; ${withPoints} have Total FPTS`);
  if (!withPoints) {
    console.log(`  ${year}: WARNING - no fantasy points. If the season is over, the saved page ` +
                'may have been the pre-season view of the draft results.');
  }
  return { year, rows: rows.length, withPoints };
}

const years = process.argv.slice(2).map(Number).filter(Boolean);
const targets = years.length
  ? years
  : (fs.existsSync(rawDir) ? fs.readdirSync(rawDir) : [])
      .map((f) => (f.match(/^draft_(\d{4})\.html$/) || [])[1])
      .filter(Boolean).map(Number).sort();

if (!targets.length) {
  console.error(`No years given and no data/raw/draft_<year>.html files found.\n` +
                `Save the CBS draft results page there first - see the header of this script.`);
  process.exit(1);
}

console.log(`Parsing: ${targets.join(', ')}`);
const done = targets.map(parse).filter(Boolean);
if (done.some((d) => d.withPoints)) console.log('\nNext: node scripts/auction-analysis.js');
