// Scrapes season Total FPTS from CBS stats-main and fills draft_results_{year}.csv.
//
// Usage:
//   pnpm scrape-player-fpts              # 2021-2025
//   pnpm scrape-player-fpts 2024 2025    # selected years
//
// Requires a saved session from `pnpm cbs-login`.

const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

const {
  applySession,
  extraChromiumArgs,
  getSessionPath,
  isSessionValid,
  loadSession
} = require('./cbs-session');

dotenv.config({ path: '.env.local' });

const yearlyStatsDir = path.join(process.cwd(), 'data', 'yearly-stats');
const positions = ['QB', 'RB', 'WR', 'TE', 'K', 'DST'];
const defaultYears = [2021, 2022, 2023, 2024, 2025];

const requestedYears = process.argv.slice(2).map(Number).filter(year => Number.isInteger(year));
const years = requestedYears.length > 0 ? requestedYears : defaultYears;

const savedSession = loadSession();
if (!savedSession) {
  console.error('No saved CBS session. Run `pnpm cbs-login` first.');
  process.exit(1);
}

const headless = process.env.HEADLESS ? process.env.HEADLESS !== 'false' : true;

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function statsUrl(year, position, { startRow = 1, sortCol = null } = {}) {
  const base = `https://mlffatl.football.cbssports.com/stats/stats-main/all:${position}/${year}:f/scoring/stats`;
  // CBS uses a leading ":param" query style for sort controls.
  if (sortCol == null && startRow <= 1) return base;
  if (sortCol == null) return `${base}?start_row=${startRow}`;
  if (startRow <= 1) return `${base}?:sort_dir=1&:sort_col=${sortCol}`;
  return `${base}?:sort_dir=1&:sort_col=${sortCol}&start_row=${startRow}`;
}

// Match draft/stats rows even when the NFL team suffix has changed.
function playerKey(playerText) {
  return String(playerText || '')
    .replace(/\s*•\s*[A-Z]{2,3}\s*$/, '')
    .replace(/\s*•\s*$/, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function parseCsv(content) {
  const lines = content.replace(/^\uFEFF/, '').split(/\r?\n/).filter(line => line.length > 0);
  if (lines.length === 0) return { headers: [], rows: [] };

  const parseLine = line => {
    const values = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (ch === ',' && !inQuotes) {
        values.push(current);
        current = '';
      } else {
        current += ch;
      }
    }
    values.push(current);
    return values;
  };

  const headers = parseLine(lines[0]);
  const rows = lines.slice(1).map(line => {
    const values = parseLine(line);
    const row = {};
    headers.forEach((header, index) => {
      row[header] = values[index] ?? '';
    });
    return row;
  });
  return { headers, rows };
}

function toCsv(headers, rows) {
  const formatRow = row => headers.map(header => {
    const text = String(row[header] ?? '');
    if (header === 'Team' || header === 'Player' || /[",\n\r]/.test(text)) {
      return `"${text.replace(/"/g, '""')}"`;
    }
    return text;
  }).join(',');

  return [headers.join(','), ...rows.map(formatRow)].join('\n') + '\n';
}

async function scrapePage(page, url) {
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 90000 });
  if (page.url().includes('login')) {
    throw new Error('Redirected to login — session expired. Run `pnpm cbs-login`.');
  }
  await page.waitForSelector('table.data', { timeout: 30000 });
  // Give the stats table a moment to finish swapping rows after pagination.
  await sleep(1200);

  return page.evaluate(() => {
    const table = document.querySelector('table.data');
    if (!table) return { players: [], startRows: [], sortCol: null, firstPlayer: '' };

    const players = [];
    for (const row of table.querySelectorAll('tr')) {
      const cells = Array.from(row.cells).map(cell => cell.innerText.trim().replace(/\s+/g, ' '));
      const player = cells.find(cell => /\b(QB|RB|WR|TE|K|DST)\s*•/.test(cell));
      if (!player) continue;

      const totalRaw = cells[cells.length - 1];
      const avgRaw = cells[cells.length - 2];
      const total = totalRaw && totalRaw !== '-' ? totalRaw : '';
      const avg = avgRaw && avgRaw !== '-' ? avgRaw : '';
      const posMatch = player.match(/\b(QB|RB|WR|TE|K|DST)\b/);
      players.push({
        Player: player,
        POS: posMatch ? posMatch[1] : '',
        'Total FPTS': total,
        'Avg FPTS': avg
      });
    }

    const reportPath = location.pathname;
    const totalSort = Array.from(document.querySelectorAll('a[href*="sort_col"]'))
      .find(anchor => anchor.textContent.trim().toLowerCase() === 'total' && new URL(anchor.href).pathname === reportPath);
    const sortCol = totalSort
      ? Number(String(totalSort.href).match(/:sort_col=(\d+)/)?.[1] || '')
      : null;

    const startRows = [...new Set(
      Array.from(document.querySelectorAll('a[href*="start_row="]'))
        .filter(anchor => {
          try {
            return new URL(anchor.href).pathname === reportPath;
          } catch {
            return false;
          }
        })
        .map(anchor => Number(String(anchor.href).match(/start_row=(\d+)/)?.[1]))
        .filter(n => Number.isInteger(n) && n > 0)
    )].sort((a, b) => a - b);

    return {
      players,
      startRows,
      sortCol: Number.isInteger(sortCol) ? sortCol : null,
      firstPlayer: players[0]?.Player || ''
    };
  });
}

async function scrapePosition(page, year, position) {
  const byKey = new Map();
  const visited = new Set();

  // First load discovers the Total FPTS sort column (differs for DST vs skill positions).
  const initial = await scrapePage(page, statsUrl(year, position));
  const sortCol = initial.sortCol;
  if (sortCol == null) {
    console.warn(`    Could not find Total sort column for ${position}; using unsorted pages`);
  }

  const queue = [1, ...(initial.startRows || [])];

  while (queue.length > 0) {
    const startRow = queue.shift();
    if (visited.has(startRow)) continue;
    visited.add(startRow);

    const useInitial = sortCol == null && startRow === 1;
    const { players, startRows, firstPlayer } = useInitial
      ? initial
      : await scrapePage(page, statsUrl(year, position, { startRow, sortCol }));

    for (const next of startRows || []) {
      if (!visited.has(next)) queue.push(next);
    }

    const before = byKey.size;
    for (const row of players) {
      const key = playerKey(row.Player);
      if (!key) continue;
      if (!byKey.has(key)) byKey.set(key, row);
    }

    console.log(
      `    start_row=${startRow}: ${players.length} players` +
      ` (+${byKey.size - before} new, unique ${byKey.size})` +
      (firstPlayer ? ` first=${firstPlayer}` : '')
    );
  }

  return byKey;
}

async function scrapeYear(page, year) {
  const byKey = new Map();

  for (const position of positions) {
    console.log(`  ${position}...`);
    const positionPlayers = await scrapePosition(page, year, position);
    for (const [key, row] of positionPlayers) {
      if (!byKey.has(key)) byKey.set(key, row);
    }
    await sleep(500);
  }

  return [...byKey.values()].sort((a, b) => {
    const aPts = parseFloat(a['Total FPTS']) || 0;
    const bPts = parseFloat(b['Total FPTS']) || 0;
    return bPts - aPts;
  });
}

function writePlayerStats(year, players) {
  const headers = ['Player', 'POS', 'Total FPTS', 'Avg FPTS'];
  const outPath = path.join(yearlyStatsDir, `player_fpts_${year}.csv`);
  fs.writeFileSync(outPath, toCsv(headers, players));
  console.log(`  Wrote ${players.length} players to ${outPath}`);
  return outPath;
}

function enrichDraftResults(year, players) {
  const draftPath = path.join(yearlyStatsDir, `draft_results_${year}.csv`);
  if (!fs.existsSync(draftPath)) {
    console.warn(`  Draft file not found, skipping enrich: ${draftPath}`);
    return;
  }

  const lookup = new Map(players.map(player => [playerKey(player.Player), player]));
  const { headers, rows } = parseCsv(fs.readFileSync(draftPath, 'utf8'));

  if (!headers.includes('Total FPTS')) headers.push('Total FPTS');
  if (!headers.includes('Active FPTS')) headers.push('Active FPTS');

  let matched = 0;
  let missing = 0;
  const missingNames = [];
  for (const row of rows) {
    const stats = lookup.get(playerKey(row.Player || ''));
    if (stats && stats['Total FPTS'] !== '') {
      row['Total FPTS'] = stats['Total FPTS'];
      matched++;
    } else if (!(row['Total FPTS'] || '').toString().trim()) {
      missing++;
      missingNames.push(row.Player);
    } else {
      // Keep any pre-existing draft-page FPTS when stats-main has no row
      // (common for retired players dropped from the current CBS player pool).
      matched++;
    }
  }

  fs.writeFileSync(draftPath, toCsv(headers, rows));
  console.log(`  Updated ${draftPath}: filled/kept ${matched}, still empty ${missing}`);
  if (missingNames.length > 0) {
    console.log(`  Still empty: ${missingNames.join(' | ')}`);
  }
}

async function main() {
  fs.mkdirSync(yearlyStatsDir, { recursive: true });

  const browser = await puppeteer.launch({
    headless,
    defaultViewport: { width: 1440, height: 900 },
    args: extraChromiumArgs()
  });

  try {
    const page = await browser.newPage();
    // Stats pages pull a lot of ad/tracking noise; blocking it makes pagination reliable.
    await page.setRequestInterception(true);
    page.on('request', request => {
      const type = request.resourceType();
      if (type === 'image' || type === 'media' || type === 'font') {
        request.abort();
      } else {
        request.continue();
      }
    });

    console.log(`Reusing saved CBS session from ${getSessionPath()}...`);
    await applySession(browser, savedSession);
    if (!(await isSessionValid(page))) {
      throw new Error('Saved session is no longer valid. Run `pnpm cbs-login`.');
    }
    console.log('Saved session accepted.');

    for (const year of years) {
      console.log(`\nScraping ${year} FPTS from stats-main...`);
      const players = await scrapeYear(page, year);
      if (players.length === 0) {
        console.warn(`  No players found for ${year}`);
        continue;
      }
      writePlayerStats(year, players);
      enrichDraftResults(year, players);
      await sleep(1000);
    }

    console.log('\nDone.');
  } finally {
    await browser.close();
  }
}

main().catch(error => {
  console.error('Failed to scrape player FPTS:', error);
  process.exit(1);
});
