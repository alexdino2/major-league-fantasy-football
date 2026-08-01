/**
 * MLFF auction analysis: five-year look at draft spend by team and position
 * versus the fantasy points those purchases returned and the points the teams
 * actually scored.
 *
 * Inputs  (data/yearly-stats):
 *   draft_results_<year>.csv  Team, POS, Player, Salary, ELIG, Total FPTS, Active FPTS
 *   standings_<year>.csv      division blocks of TEAM,W,L,T,PCT,PF,PA,WKS
 *   weekly_results_<year>.csv week, away_team, home_team, away_result, home_result
 *
 * Outputs (data/analysis): a set of tidy CSVs, one per question.
 *
 * Notes on the source data:
 *   - POS is the draft slot (RES = bench) in 2021-2023 and the real position in
 *     2024-2025, so ELIG is the only position field that means the same thing
 *     every year. All position splits here use ELIG.
 *   - Total FPTS is the player's full-season total; Active FPTS is what he
 *     scored while in the drafting team's starting lineup. Active FPTS is only
 *     populated for 2021-2023.
 */

const fs = require('fs');
const path = require('path');

const YEARS = [2021, 2022, 2023, 2024, 2025];
const POSITIONS = ['RB', 'WR', 'QB', 'TE', 'K', 'DST'];
const CAP = 300;

const statsDir = path.join(process.cwd(), 'data', 'yearly-stats');
const outDir = path.join(process.cwd(), 'data', 'analysis');

// --- csv helpers -----------------------------------------------------------

function parseCSV(text) {
  const rows = [];
  let row = [];
  let cur = '';
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"') {
        if (text[i + 1] === '"') { cur += '"'; i++; } else { quoted = false; }
      } else cur += c;
    } else if (c === '"') quoted = true;
    else if (c === ',') { row.push(cur); cur = ''; }
    else if (c === '\n') { row.push(cur); rows.push(row); row = []; cur = ''; }
    else if (c !== '\r') cur += c;
  }
  if (cur !== '' || row.length) { row.push(cur); rows.push(row); }
  return rows.filter((r) => r.some((c) => c !== ''));
}

function readRows(file) {
  const rows = parseCSV(fs.readFileSync(path.join(statsDir, file), 'utf8'));
  const header = rows[0];
  return rows.slice(1).map((r) => Object.fromEntries(header.map((h, i) => [h, r[i]])));
}

function writeCSV(name, header, rows) {
  const esc = (v) => {
    const s = v === null || v === undefined ? '' : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const body = [header.join(','), ...rows.map((r) => r.map(esc).join(','))].join('\n');
  fs.writeFileSync(path.join(outDir, name), body + '\n');
  console.log(`  wrote data/analysis/${name} (${rows.length} rows)`);
}

const round = (n, d = 1) => (Number.isFinite(n) ? Number(n.toFixed(d)) : '');

// --- normalisation ---------------------------------------------------------

// Team names are upper-cased in 2021-2024 and title-cased in 2025.
const TEAM_NAMES = {
  'MUNICH COWBOYS': 'Munich Cowboys',
  'DONORA DRAGONS': 'Donora Dragons',
  'MASTERS OF DISASTER': 'Masters of Disaster',
  'LEEDS UNITED': 'Leeds United',
  'HOMERS HEROES': 'Homers Heroes',
  'ROCK STARS': 'Rock Stars',
  GENERALS: 'Generals',
  'LA LOSERS': 'LA Losers',
  'EGYPTIAN MAGICIANS': 'Egyptian Magicians',
  'KENTUCKY FOOTBALL CLUB': 'Kentucky Football Club',
  RELEGATORS: 'Relegators',
};

const team = (raw) => TEAM_NAMES[raw.trim().toUpperCase()] || raw.trim();

// "Ezekiel Elliott RB • LAC" -> "Ezekiel Elliott". The NFL team suffix in the
// source is the player's team as of the scrape, not as of that season.
const playerName = (raw) => raw.split('•')[0].replace(/\s+(QB|RB|WR|TE|K|DST)\s*$/, '').trim();

// --- load ------------------------------------------------------------------

function loadDraft(year) {
  return readRows(`draft_results_${year}.csv`).map((r) => ({
    year,
    team: team(r.Team),
    slot: r.POS,
    player: playerName(r.Player),
    salary: Number(r.Salary) || 0,
    pos: (r.ELIG || '').trim().toUpperCase(),
    totalPts: r['Total FPTS'] === '' ? null : Number(r['Total FPTS']),
    activePts: r['Active FPTS'] === '' ? null : Number(r['Active FPTS']),
  }));
}

function loadStandings(year) {
  const lines = fs.readFileSync(path.join(statsDir, `standings_${year}.csv`), 'utf8').split('\n');
  const out = {};
  for (const line of lines) {
    const p = line.split(',');
    if (p.length < 8 || p[0] === 'TEAM' || p[0].includes('DIVISION')) continue;
    const [name, w, l, t, pct, pf, pa] = p;
    if (Number.isNaN(Number(pf))) continue;
    out[team(name)] = {
      w: Number(w), l: Number(l), t: Number(t), pct: Number(pct),
      pf: Number(pf), pa: Number(pa),
    };
  }
  return out;
}

// Standings PF counts regular season only; the weekly file also carries the
// playoff and consolation weeks, which is the fair denominator when asking how
// much of a team's scoring its draft produced.
function loadSeasonPoints(year) {
  const rows = readRows(`weekly_results_${year}.csv`);
  const out = {};
  for (const r of rows) {
    for (const [side, res] of [[r.away_team, r.away_result], [r.home_team, r.home_result]]) {
      const t = team(side);
      if (!t || t === 'TBA') continue;
      out[t] = (out[t] || 0) + (Number(res) || 0);
    }
  }
  return out;
}

const draft = {};
const standings = {};
const seasonPoints = {};
for (const y of YEARS) {
  draft[y] = loadDraft(y);
  standings[y] = loadStandings(y);
  seasonPoints[y] = loadSeasonPoints(y);
}
const allPicks = YEARS.flatMap((y) => draft[y]);

// Years whose draft file actually carries player points. Derived rather than
// hardcoded so that back-filling a season's FPTS widens the analysis on the
// next run with no code change.
const SCORED_YEARS = YEARS.filter((y) => draft[y].some((p) => p.totalPts !== null));
if (!SCORED_YEARS.length) throw new Error('No draft file contains player FPTS.');
console.log(`Spend analysis: ${YEARS.join(', ')}`);
console.log(`Points analysis: ${SCORED_YEARS.join(', ')} (${SCORED_YEARS.length * 160} roster spots)\n`);

fs.mkdirSync(outDir, { recursive: true });

// --- stats helpers ---------------------------------------------------------

const sum = (a) => a.reduce((x, y) => x + y, 0);
const mean = (a) => (a.length ? sum(a) / a.length : NaN);
function median(a) {
  if (!a.length) return NaN;
  const s = [...a].sort((x, y) => x - y);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}
function pearson(xs, ys) {
  const n = xs.length;
  if (n < 3) return NaN;
  const mx = mean(xs);
  const my = mean(ys);
  const cov = sum(xs.map((x, i) => (x - mx) * (ys[i] - my)));
  const vx = Math.sqrt(sum(xs.map((x) => (x - mx) ** 2)));
  const vy = Math.sqrt(sum(ys.map((y) => (y - my) ** 2)));
  return cov / (vx * vy);
}

// ===========================================================================
// 1. League-wide spend by position and year
// ===========================================================================
{
  const rows = [];
  for (const y of YEARS) {
    const picks = draft[y];
    const total = sum(picks.map((p) => p.salary));
    for (const pos of POSITIONS) {
      const at = picks.filter((p) => p.pos === pos);
      const spend = sum(at.map((p) => p.salary));
      rows.push([
        y, pos, at.length, spend,
        round((spend / total) * 100),
        round(spend / 10),          // per team
        round(spend / at.length),   // per player
        median(at.map((p) => p.salary)),
        Math.max(...at.map((p) => p.salary)),
        at.filter((p) => p.salary <= 2).length,
      ]);
    }
  }
  writeCSV('league_spend_by_position.csv',
    ['Year', 'Pos', 'Players', 'TotalSpend', 'PctOfLeagueCap', 'SpendPerTeam', 'AvgPrice', 'MedianPrice', 'MaxPrice', 'MinPriceBuys'],
    rows);
}

// ===========================================================================
// 2. Spend by team by position (per year, and the five-year average)
// ===========================================================================
{
  const rows = [];
  for (const y of YEARS) {
    for (const t of [...new Set(draft[y].map((p) => p.team))].sort()) {
      const picks = draft[y].filter((p) => p.team === t);
      const spent = sum(picks.map((p) => p.salary));
      const rec = standings[y][t] || {};
      const row = [y, t, spent, CAP - spent];
      for (const pos of POSITIONS) {
        const at = picks.filter((p) => p.pos === pos);
        row.push(sum(at.map((p) => p.salary)), at.length);
      }
      row.push(rec.pf ?? '', rec.w ?? '', rec.l ?? '', rec.pct ?? '');
      rows.push(row);
    }
  }
  const header = ['Year', 'Team', 'TotalSpend', 'Unspent'];
  for (const pos of POSITIONS) header.push(`${pos}_Spend`, `${pos}_Count`);
  header.push('PointsFor', 'W', 'L', 'Pct');
  writeCSV('team_spend_by_position.csv', header, rows);

  // five-year average allocation per franchise
  const avgRows = [];
  const teams = [...new Set(allPicks.map((p) => p.team))].sort();
  for (const t of teams) {
    const years = YEARS.filter((y) => draft[y].some((p) => p.team === t));
    const row = [t, years.length];
    for (const pos of POSITIONS) {
      const per = years.map((y) => sum(draft[y].filter((p) => p.team === t && p.pos === pos).map((p) => p.salary)));
      row.push(round(mean(per)), round((mean(per) / CAP) * 100));
    }
    const pfs = years.map((y) => standings[y][t]?.pf).filter(Number.isFinite);
    const ws = years.map((y) => standings[y][t]?.w).filter(Number.isFinite);
    const ls = years.map((y) => standings[y][t]?.l).filter(Number.isFinite);
    row.push(round(mean(pfs)), round(mean(ws), 1), round(mean(ls), 1));
    avgRows.push(row);
  }
  avgRows.sort((a, b) => b[b.length - 3] - a[a.length - 3]);
  const avgHeader = ['Team', 'Seasons'];
  for (const pos of POSITIONS) avgHeader.push(`${pos}_AvgSpend`, `${pos}_PctOfCap`);
  avgHeader.push('AvgPointsFor', 'AvgW', 'AvgL');
  writeCSV('team_avg_allocation_2021_2025.csv', avgHeader, avgRows);
}

// ===========================================================================
// 3. Return on spend by position (2021-2023, the years with player points)
// ===========================================================================
{
  const rows = [];
  for (const y of [...SCORED_YEARS, 'ALL']) {
    const picks = (y === 'ALL' ? SCORED_YEARS : [y]).flatMap((yy) => draft[yy]);
    for (const pos of POSITIONS) {
      const at = picks.filter((p) => p.pos === pos && p.totalPts !== null);
      if (!at.length) continue;
      const spend = sum(at.map((p) => p.salary));
      const total = sum(at.map((p) => p.totalPts));
      const active = sum(at.map((p) => p.activePts));
      rows.push([
        y, pos, at.length, spend, round(spend / at.length),
        round(total), round(total / at.length),
        round(active), round(active / at.length),
        round(total / spend, 2),
        round(active / spend, 2),
        round((active / total) * 100),
        round(pearson(at.map((p) => p.salary), at.map((p) => p.totalPts)), 2),
      ]);
    }
  }
  writeCSV('position_return_on_spend.csv',
    ['Year', 'Pos', 'Players', 'Spend', 'AvgPrice', 'TotalFPTS', 'AvgTotalFPTS', 'ActiveFPTS', 'AvgActiveFPTS',
      'TotalPtsPerDollar', 'ActivePtsPerDollar', 'PctOfPtsCaptured', 'Corr_Price_vs_Points'],
    rows);
}

// ===========================================================================
// 4. Return by price tier within each position
// ===========================================================================
{
  const TIERS = [
    ['$1-2 (min bid)', 1, 2],
    ['$3-9', 3, 9],
    ['$10-24', 10, 24],
    ['$25-49', 25, 49],
    ['$50-69', 50, 69],
    ['$70+', 70, Infinity],
  ];
  const rows = [];
  const scored = SCORED_YEARS.flatMap((y) => draft[y]).filter((p) => p.totalPts !== null);
  for (const pos of POSITIONS) {
    for (const [label, lo, hi] of TIERS) {
      const at = scored.filter((p) => p.pos === pos && p.salary >= lo && p.salary <= hi);
      if (!at.length) continue;
      const spend = sum(at.map((p) => p.salary));
      const pts = at.map((p) => p.totalPts);
      // a "hit" returns at least the position's league-average points per dollar
      const posAvgPPD = sum(scored.filter((p) => p.pos === pos).map((p) => p.totalPts))
        / sum(scored.filter((p) => p.pos === pos).map((p) => p.salary));
      const hits = at.filter((p) => p.totalPts / p.salary >= posAvgPPD).length;
      rows.push([
        pos, label, at.length, round(spend / at.length),
        round(mean(pts)), round(median(pts)),
        round(mean(pts) / (spend / at.length), 2),
        round(mean(at.map((p) => p.activePts))),
        round((hits / at.length) * 100),
      ]);
    }
  }
  writeCSV('price_tier_return.csv',
    ['Pos', 'PriceTier', 'Players', 'AvgPrice', 'AvgTotalFPTS', 'MedianTotalFPTS', 'PtsPerDollar', 'AvgActiveFPTS', 'HitRatePct'],
    rows);
}

// ===========================================================================
// 5. Team outcomes: what the draft bought vs what the team actually scored
// ===========================================================================
{
  const rows = [];
  for (const y of SCORED_YEARS) {
    for (const t of [...new Set(draft[y].map((p) => p.team))].sort()) {
      const picks = draft[y].filter((p) => p.team === t);
      const rec = standings[y][t] || {};
      const total = sum(picks.map((p) => p.totalPts || 0));
      const active = sum(picks.map((p) => p.activePts || 0));
      const allWeeks = seasonPoints[y][t];
      rows.push([
        y, t, sum(picks.map((p) => p.salary)),
        round(total), round(active), rec.pf ?? '', round(allWeeks),
        allWeeks ? round((active / allWeeks) * 100) : '',
        round(active / sum(picks.map((p) => p.salary)), 2),
        rec.w ?? '', rec.l ?? '', rec.pct ?? '',
      ]);
    }
  }
  writeCSV('team_draft_capture.csv',
    ['Year', 'Team', 'Spend', 'DraftedTotalFPTS', 'DraftedActiveFPTS', 'RegSeasonPointsFor',
      'AllWeeksPoints', 'PctOfTeamPtsFromDraft', 'ActivePtsPerDollar', 'W', 'L', 'Pct'],
    rows);
}

// ===========================================================================
// 6. Does allocation predict results? Correlations across team-seasons
// ===========================================================================
{
  const obs = [];
  for (const y of YEARS) {
    for (const t of [...new Set(draft[y].map((p) => p.team))]) {
      const picks = draft[y].filter((p) => p.team === t);
      const rec = standings[y][t];
      if (!rec) continue;
      const o = { year: y, team: t, pf: rec.pf, w: rec.w + 0.5 * (rec.t || 0), pct: rec.pct };
      for (const pos of POSITIONS) o[pos] = sum(picks.filter((p) => p.pos === pos).map((p) => p.salary));
      o.TOP3 = sum([...picks].sort((a, b) => b.salary - a.salary).slice(0, 3).map((p) => p.salary));
      o.STARS = sum(picks.filter((p) => p.salary >= 50).map((p) => p.salary));
      o.DEPTH = picks.filter((p) => p.salary >= 10).length;
      obs.push(o);
    }
  }
  // League scoring drifts year to year, so compare each team against its own
  // season: z-score every variable within the year before correlating.
  const z = (key) => {
    const out = [];
    for (const y of YEARS) {
      const grp = obs.filter((o) => o.year === y);
      const m = mean(grp.map((o) => o[key]));
      const sd = Math.sqrt(mean(grp.map((o) => (o[key] - m) ** 2)));
      grp.forEach((o) => out.push(sd ? (o[key] - m) / sd : 0));
    }
    return out;
  };

  const vars = [...POSITIONS, 'TOP3', 'STARS', 'DEPTH'];
  const zpf = z('pf');
  const zw = z('w');
  const rows = vars.map((v) => {
    const zv = z(v);
    return [
      v,
      obs.length,
      round(pearson(obs.map((o) => o[v]), obs.map((o) => o.pf)), 3),
      round(pearson(zv, zpf), 3),
      round(pearson(zv, zw), 3),
    ];
  });
  writeCSV('allocation_vs_results_correlation.csv',
    ['SpendVariable', 'TeamSeasons', 'Corr_vs_PointsFor_raw', 'Corr_vs_PointsFor_zByYear', 'Corr_vs_Wins_zByYear'],
    rows);
}

// ===========================================================================
// 7. Best and worst buys, 2021-2023
// ===========================================================================
{
  const scored = SCORED_YEARS.flatMap((y) => draft[y]).filter((p) => p.totalPts !== null && p.salary >= 1);
  const withPPD = scored.map((p) => ({ ...p, ppd: p.totalPts / p.salary }));

  const bargains = withPPD.filter((p) => p.totalPts >= 100).sort((a, b) => b.ppd - a.ppd).slice(0, 25);
  writeCSV('best_buys.csv',
    ['Year', 'Team', 'Player', 'Pos', 'Salary', 'TotalFPTS', 'ActiveFPTS', 'PtsPerDollar'],
    bargains.map((p) => [p.year, p.team, p.player, p.pos, p.salary, p.totalPts, p.activePts, round(p.ppd, 1)]));

  const busts = withPPD.filter((p) => p.salary >= 30).sort((a, b) => a.ppd - b.ppd).slice(0, 25);
  writeCSV('worst_buys.csv',
    ['Year', 'Team', 'Player', 'Pos', 'Salary', 'TotalFPTS', 'ActiveFPTS', 'PtsPerDollar'],
    busts.map((p) => [p.year, p.team, p.player, p.pos, p.salary, p.totalPts, p.activePts, round(p.ppd, 2)]));

  // how the biggest buys of each auction fared
  const rows = [];
  for (const y of SCORED_YEARS) {
    const ranked = [...draft[y]].filter((p) => p.totalPts !== null).sort((a, b) => b.salary - a.salary);
    [[1, 10], [11, 20], [21, 30], [31, 50], [51, 100], [101, 160]].forEach(([lo, hi]) => {
      const grp = ranked.slice(lo - 1, hi);
      if (!grp.length) return;
      rows.push([y, `#${lo}-${hi} most expensive`, grp.length,
        round(mean(grp.map((p) => p.salary))),
        round(mean(grp.map((p) => p.totalPts))),
        round(mean(grp.map((p) => p.activePts))),
        round(mean(grp.map((p) => p.totalPts)) / mean(grp.map((p) => p.salary)), 2)]);
    });
  }
  writeCSV('spend_rank_return.csv',
    ['Year', 'Group', 'Players', 'AvgPrice', 'AvgTotalFPTS', 'AvgActiveFPTS', 'PtsPerDollar'], rows);
}

// ===========================================================================
// 8. Positional scarcity: points above replacement per dollar
// ===========================================================================
{
  // Starting lineup is 1 QB, 2 RB, 3 WR, 1 TE, 1 K, 1 DST (from the 2021-2023
  // draft slots), so with 10 teams the replacement level for each position is
  // the (10 x starters + 1)-th best drafted player at that position.
  const STARTERS = { QB: 1, RB: 2, WR: 3, TE: 1, K: 1, DST: 1 };
  const rows = [];
  for (const y of SCORED_YEARS) {
    for (const pos of POSITIONS) {
      const at = draft[y].filter((p) => p.pos === pos && p.totalPts !== null)
        .sort((a, b) => b.totalPts - a.totalPts);
      const slots = STARTERS[pos] * 10;
      const repIdx = Math.min(slots, at.length - 1);
      const replacement = at[repIdx].totalPts;
      const starters = at.slice(0, slots);
      const par = sum(starters.map((p) => p.totalPts - replacement));
      const spend = sum(starters.map((p) => p.salary));
      // With only ~10 kickers and ~10 defenses drafted for 10 slots, the
      // "next man up" is the worst drafted one rather than a genuine waiver
      // option, so replacement level - and therefore PAR - is not meaningful.
      const reliable = at.length >= slots + 4;
      rows.push([y, pos, slots, at.length, round(replacement),
        round(mean(starters.map((p) => p.totalPts))), round(par), spend,
        reliable ? round(par / spend, 2) : '', round(spend / slots),
        reliable ? 'yes' : 'no (draft pool ~= starter slots)']);
    }
  }
  writeCSV('positional_scarcity.csv',
    ['Year', 'Pos', 'StarterSlots', 'PlayersDrafted', 'ReplacementFPTS', 'AvgStarterFPTS',
      'PointsAboveReplacement', 'StarterSpend', 'PARPerDollar', 'AvgStarterPrice', 'ReplacementLevelMeaningful'],
    rows);
}

// ===========================================================================
// 9. Marginal value: what the money above a $1-2 roster spot actually buys
// ===========================================================================
{
  const TIERS = [['$3-9', 3, 9], ['$10-24', 10, 24], ['$25-49', 25, 49], ['$50-69', 50, 69], ['$70+', 70, Infinity]];
  const scored = SCORED_YEARS.flatMap((y) => draft[y]).filter((p) => p.totalPts !== null);
  const rows = [];
  for (const pos of POSITIONS) {
    const base = scored.filter((p) => p.pos === pos && p.salary <= 2);
    if (base.length < 5) continue;
    const basePts = mean(base.map((p) => p.totalPts));
    const basePrice = mean(base.map((p) => p.salary));
    for (const [label, lo, hi] of TIERS) {
      const at = scored.filter((p) => p.pos === pos && p.salary >= lo && p.salary <= hi);
      if (at.length < 3) continue;
      const price = mean(at.map((p) => p.salary));
      const pts = mean(at.map((p) => p.totalPts));
      rows.push([pos, label, at.length, round(price), round(pts), round(basePts),
        round(pts - basePts), round(price - basePrice),
        round((pts - basePts) / (price - basePrice), 2)]);
    }
  }
  rows.sort((a, b) => b[8] - a[8]);
  writeCSV('marginal_value_over_min_bid.csv',
    ['Pos', 'PriceTier', 'Players', 'AvgPrice', 'AvgTotalFPTS', 'MinBidBaselineFPTS',
      'ExtraPoints', 'ExtraDollars', 'ExtraPointsPerExtraDollar'], rows);
}

// ===========================================================================
// 10. Which franchises actually draft well
// ===========================================================================
{
  const rows = [];
  const teams = [...new Set(SCORED_YEARS.flatMap((y) => draft[y]).map((p) => p.team))].sort();
  for (const t of teams) {
    const yrs = SCORED_YEARS.filter((y) => draft[y].some((p) => p.team === t));
    const picks = yrs.flatMap((y) => draft[y].filter((p) => p.team === t));
    const spend = sum(picks.map((p) => p.salary));
    const capture = yrs.map((y) => {
      const a = sum(draft[y].filter((p) => p.team === t).map((p) => p.activePts || 0));
      return (a / seasonPoints[y][t]) * 100;
    });
    rows.push([t, yrs.length, spend,
      round(sum(picks.map((p) => p.totalPts))), round(sum(picks.map((p) => p.activePts))),
      round(sum(picks.map((p) => p.totalPts)) / spend, 2),
      round(sum(picks.map((p) => p.activePts)) / spend, 2),
      round(mean(capture)),
      round(mean(yrs.map((y) => standings[y][t].pf))),
      round(mean(yrs.map((y) => standings[y][t].w)), 1)]);
  }
  rows.sort((a, b) => b[6] - a[6]);
  writeCSV('team_draft_efficiency.csv',
    ['Team', 'Seasons', 'Spend', 'DraftedTotalFPTS', 'DraftedActiveFPTS',
      'TotalPtsPerDollar', 'ActivePtsPerDollar', 'AvgPctOfPtsFromDraft', 'AvgPointsFor', 'AvgW'],
    rows);

  // does drafting efficiently translate into wins?
  const obs = [];
  for (const y of SCORED_YEARS) {
    for (const t of [...new Set(draft[y].map((p) => p.team))]) {
      const picks = draft[y].filter((p) => p.team === t);
      const rec = standings[y][t];
      if (!rec) continue;
      obs.push({
        capture: (sum(picks.map((p) => p.activePts || 0)) / seasonPoints[y][t]) * 100,
        activePPD: sum(picks.map((p) => p.activePts || 0)) / sum(picks.map((p) => p.salary)),
        totalPPD: sum(picks.map((p) => p.totalPts || 0)) / sum(picks.map((p) => p.salary)),
        pf: rec.pf,
        w: rec.w + 0.5 * (rec.t || 0),
      });
    }
  }
  writeCSV('draft_efficiency_vs_results.csv',
    ['Metric', 'TeamSeasons', 'Corr_vs_PointsFor', 'Corr_vs_Wins'],
    [['PctOfTeamPtsFromDraft', 'ActiveFPTSPerDollar', 'TotalFPTSPerDollar']].flat().map((k) => {
      const key = { PctOfTeamPtsFromDraft: 'capture', ActiveFPTSPerDollar: 'activePPD', TotalFPTSPerDollar: 'totalPPD' }[k];
      return [k, obs.length,
        round(pearson(obs.map((o) => o[key]), obs.map((o) => o.pf)), 3),
        round(pearson(obs.map((o) => o[key]), obs.map((o) => o.w)), 3)];
    }));
}

console.log('\nDone.');
