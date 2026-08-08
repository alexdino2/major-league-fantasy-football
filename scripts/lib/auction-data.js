// Shared loaders for MLFF auction analysis.
//
// Data sources (data/yearly-stats):
//   draft_results_{year}.csv  Team, POS, Player, Salary, ELIG, Total FPTS, Active FPTS
//   player_fpts_{year}.csv    Player, POS, Total FPTS, Avg FPTS  (full league-wide player pool)
//
// "Total FPTS" is the player's own season scoring total, not a fantasy team's
// score. "Active FPTS" is the slice of that total earned while the player was
// in a starting lineup; it only exists for 2021-2023.

const fs = require('fs');
const path = require('path');

const yearlyStatsDir = path.join(process.cwd(), 'data', 'yearly-stats');

const POSITIONS = ['QB', 'RB', 'WR', 'TE', 'K', 'DST'];

// Starting lineup, confirmed from the POS column of 2021-2023 draft results
// (every team started exactly this, with 7 reserves filling out a 16-man roster).
const STARTERS = { QB: 1, RB: 2, WR: 3, TE: 1, K: 1, DST: 1 };
const TEAMS = 10;
const ROSTER_SIZE = 16;
const BUDGET = 300;
// Fantasy weeks in a season; also the cap on games played for availability math.
const SEASON_WEEKS = 17;

function parseCsv(content) {
  const lines = content.replace(/^﻿/, '').split(/\r?\n/).filter(line => line.length > 0);
  if (lines.length === 0) return [];

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
    return values.map(value => value.trim());
  };

  const headers = parseLine(lines[0]);
  return lines.slice(1).map(line => {
    const values = parseLine(line);
    const row = {};
    headers.forEach((header, i) => {
      row[header] = values[i] === undefined ? '' : values[i];
    });
    return row;
  });
}

function readCsv(file) {
  const full = path.join(yearlyStatsDir, file);
  if (!fs.existsSync(full)) return null;
  return parseCsv(fs.readFileSync(full, 'utf-8'));
}

// Team suffixes drift between scrapes (CBS shows a player's current NFL team),
// so match on name + position only.
function playerKey(playerText) {
  return String(playerText || '')
    .replace(/\s*•\s*[A-Z]{2,3}\s*$/, '')
    .replace(/\s*•\s*$/, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function num(value) {
  if (value === '' || value === null || value === undefined) return null;
  const parsed = Number(String(value).replace(/,/g, ''));
  return Number.isFinite(parsed) ? parsed : null;
}

// The full scoring pool for a season, ranked within each position. This is what
// makes "what does the 12th best RB actually score" answerable.
//
// player_fpts_{year}.csv is a snapshot of the current CBS player universe with
// that season's stats attached, so players who have since retired are absent.
// Drafted players missing from the snapshot are folded back in before ranking,
// otherwise every rank in the older seasons comes out flattering.
function loadPlayerPool(year) {
  const rows = readCsv(`player_fpts_${year}.csv`);
  if (!rows) return null;

  const byPosition = {};
  POSITIONS.forEach(pos => (byPosition[pos] = []));

  rows.forEach(row => {
    const pos = row.POS;
    if (!byPosition[pos]) return;
    const points = num(row['Total FPTS']);
    if (points === null) return;
    // Games played is not published directly, but total / per-game average
    // recovers it exactly (it lands on a whole number for every row).
    const average = num(row['Avg FPTS']);
    const games = average > 0 ? Math.min(SEASON_WEEKS, Math.round(points / average)) : null;
    byPosition[pos].push({ key: playerKey(row.Player), player: row.Player, points, games });
  });

  const seen = new Set();
  POSITIONS.forEach(pos => byPosition[pos].forEach(entry => seen.add(`${pos}|${entry.key}`)));

  const draftRows = readCsv(`draft_results_${year}.csv`) || [];
  const restored = [];
  draftRows.forEach(row => {
    const pos = row.ELIG || row.POS;
    if (!byPosition[pos]) return;
    const key = playerKey(row.Player);
    if (seen.has(`${pos}|${key}`)) return;
    const points = num(row['Total FPTS']);
    if (points === null) return;
    seen.add(`${pos}|${key}`);
    const entry = { key, player: row.Player, points, games: null, restored: true };
    byPosition[pos].push(entry);
    restored.push({ pos, entry });
  });

  // Restored players come from the draft export, which carries no per-game
  // average, so games played has to be imputed from comparable scorers.
  restored.forEach(({ pos, entry }) => {
    const neighbours = byPosition[pos]
      .filter(other => other.games !== null && Math.abs(other.points - entry.points) <= Math.max(5, entry.points * 0.1))
      .map(other => other.games)
      .sort((a, b) => a - b);
    entry.games = neighbours.length
      ? neighbours[Math.floor(neighbours.length / 2)]
      : SEASON_WEEKS;
    entry.gamesImputed = true;
  });

  const index = new Map();
  POSITIONS.forEach(pos => {
    byPosition[pos].sort((a, b) => b.points - a.points);
    byPosition[pos].forEach((entry, i) => {
      entry.rank = i + 1;
      index.set(`${pos}|${entry.key}`, entry);
    });
  });

  return { year, byPosition, index };
}

// Points scored by the player finishing at a given positional rank.
function pointsAtRank(pool, pos, rank) {
  const list = pool.byPosition[pos];
  if (!list || list.length === 0) return 0;
  const entry = list[Math.min(Math.max(rank, 1), list.length) - 1];
  return entry.points;
}

// Average points across a rank band, e.g. ranks 21-26 at QB.
function pointsOverRange(pool, pos, from, to) {
  const values = [];
  for (let rank = from; rank <= to; rank++) values.push(pointsAtRank(pool, pos, rank));
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

function loadDraft(year, pool) {
  const rows = readCsv(`draft_results_${year}.csv`);
  if (!rows) return null;

  return rows.map(row => {
    const pos = row.ELIG || row.POS;
    const key = playerKey(row.Player);
    const poolEntry = pool ? pool.index.get(`${pos}|${key}`) : null;
    const totalFromDraft = num(row['Total FPTS']);
    const points = poolEntry ? poolEntry.points : totalFromDraft;

    return {
      year,
      team: row.Team || '(unnamed)',
      slot: row.POS,          // starter slot or RES; only meaningful for 2021-2023
      pos,                    // position eligibility
      player: row.Player,
      key,
      salary: num(row.Salary) || 0,
      points: points === null ? 0 : points,
      hasPoints: points !== null,
      finishRank: poolEntry ? poolEntry.rank : null,
      games: poolEntry ? poolEntry.games : null,
      pointsPerGame: poolEntry && poolEntry.games ? poolEntry.points / poolEntry.games : null,
      activePoints: num(row['Active FPTS'])
    };
  });
}

function mean(values) {
  if (values.length === 0) return 0;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

function median(values) {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function correlation(xs, ys) {
  const n = xs.length;
  if (n < 3) return null;
  const mx = mean(xs);
  const my = mean(ys);
  let num = 0;
  let dx = 0;
  let dy = 0;
  for (let i = 0; i < n; i++) {
    num += (xs[i] - mx) * (ys[i] - my);
    dx += (xs[i] - mx) ** 2;
    dy += (ys[i] - my) ** 2;
  }
  if (dx === 0 || dy === 0) return null;
  return num / Math.sqrt(dx * dy);
}

// standings_{year}.csv interleaves division banners with per-division tables,
// so it needs its own reader rather than the generic CSV path.
function loadStandings(year) {
  const full = path.join(yearlyStatsDir, `standings_${year}.csv`);
  if (!fs.existsSync(full)) return null;
  const lines = fs.readFileSync(full, 'utf-8').split(/\r?\n/).filter(Boolean);
  const out = {};
  lines.forEach(line => {
    const parts = line.split(',').map(v => v.trim());
    if (parts.length < 8 || parts[0] === 'TEAM' || !/^\d/.test(parts[1] || '')) return;
    out[normalizeTeam(parts[0])] = {
      team: parts[0],
      wins: Number(parts[1]),
      losses: Number(parts[2]),
      ties: Number(parts[3]),
      pct: Number(parts[4]),
      pointsFor: Number(parts[5]),
      pointsAgainst: Number(parts[6])
    };
  });
  return out;
}

// Franchise renames: Donora Dragons became the Relegators, Italian Stallions
// became the Munich Cowboys. The 2024/2025 draft exports lost one team label,
// and Munich is the only franchise otherwise missing from those files.
function normalizeTeam(name) {
  const key = String(name || '').toUpperCase().replace(/[^A-Z]/g, '');
  if (key === '' ) return 'MUNICHCOWBOYS';
  if (key === 'DONORADRAGONS') return 'RELEGATORS';
  if (key === 'ITALIANSTALLIONS') return 'MUNICHCOWBOYS';
  return key;
}

module.exports = {
  BUDGET,
  POSITIONS,
  ROSTER_SIZE,
  SEASON_WEEKS,
  STARTERS,
  TEAMS,
  correlation,
  loadDraft,
  loadStandings,
  loadPlayerPool,
  mean,
  median,
  normalizeTeam,
  playerKey,
  pointsAtRank,
  pointsOverRange,
  readCsv,
  yearlyStatsDir
};
