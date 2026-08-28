// MLFF 2026 auction cheatsheet: turn FantasyPros ECR into draft-day dollar values
// for our $300 / 10-team auction, priced in our own TD-heavy, non-PPR scoring.
//
//   pnpm build-auction-cheatsheet            # writes docs/auction-cheatsheet-2026.md
//   pnpm build-auction-cheatsheet --stdout   # print instead of writing
//
// Method
//   1. Project each player's MLFF season points from his FantasyPros positional
//      ECR rank, read off the *actual* MLFF points-scored-at-each-finish-rank
//      curve (2021-2025, our scoring). ECR rank = projected finish rank.
//   2. Value = points over replacement (VORP), converted to dollars by splitting
//      the whole room's money ($3,000) across every positive-VORP player.
//   3. "Market" = the going rate our league has actually paid at that positional
//      price rank over the last five auctions.
//   4. Strategy tilts, all documented below: a TD-variance haircut on WR, a
//      goal-line premium on the backs who actually score, and a hard cap on
//      K/DST (flat, streamable, high floor -> VORP overstates them).
//
// The curves come straight from scripts/lib/auction-data.js so this file always
// agrees with docs/auction-position-analysis.md.

const fs = require('fs');
const path = require('path');
const {
  POSITIONS, STARTERS, TEAMS, BUDGET, ROSTER_SIZE,
  loadPlayerPool, loadDraft, pointsAtRank, mean
} = require('./lib/auction-data');

const YEARS = [2021, 2022, 2023, 2024, 2025];
const ECR_DIR = path.join(process.cwd(), 'data', 'fantasypros-ecr-2026');

// --- MLFF scoring, straight from the Sleeper league (id 1389281969950441472) ---
// Non-PPR, TD-heavy. The two numbers that drive everything: a rush/rec TD is 6
// points, and a yard is worth 0.04 (1 per 25). A 1-yard plunge outscores 149
// rushing yards. Passing is 1 per 60 yds + 4 per TD, and INTs cost nothing.
const SCORING_NOTE = {
  ppr: 0, rushRecYd: 0.04, passYd: 1 / 60, rushRecTD: 6, passTD: 4,
  intPenalty: 0, fumblePenalty: 0
};

// ---------------------------------------------------------------------------
// 1. Empirical MLFF curves (recomputed from the raw league data every run)
// ---------------------------------------------------------------------------
function buildCurves() {
  const seasons = YEARS.map(year => {
    const pool = loadPlayerPool(year);
    const draft = loadDraft(year, pool);
    const byPos = {};
    draft.forEach(p => { (byPos[p.pos] = byPos[p.pos] || []).push(p); });
    Object.values(byPos).forEach(ps => {
      ps.sort((a, b) => b.salary - a.salary || (a.finishRank || 999) - (b.finishRank || 999));
      ps.forEach((p, i) => { p.priceRank = i + 1; });
    });
    const drafted = {};
    const replacement = {};
    POSITIONS.forEach(pos => {
      drafted[pos] = (byPos[pos] || []).length;
      const vals = [];
      for (let r = drafted[pos] + 1; r <= drafted[pos] + 5; r++) vals.push(pointsAtRank(pool, pos, r));
      replacement[pos] = mean(vals);
    });
    return { year, pool, draft, byPos, drafted, replacement };
  });

  const curves = {};
  POSITIONS.forEach(pos => {
    const pts = [];
    for (let r = 1; r <= 70; r++) pts.push(mean(seasons.map(s => pointsAtRank(s.pool, pos, r))));
    const picks = seasons.flatMap(s => s.byPos[pos] || []);
    const maxPR = Math.max(...picks.map(p => p.priceRank));
    const rate = [];
    for (let pr = 1; pr <= Math.min(maxPR, 60); pr++) {
      const g = picks.filter(p => Math.abs(p.priceRank - pr) <= 1);
      rate.push(mean(g.map(p => p.salary)));
    }
    curves[pos] = {
      pointsAtRank: pts,
      goingRate: rate,
      replacement: mean(seasons.map(s => s.replacement[pos])),
      draftedPerYear: mean(seasons.map(s => s.drafted[pos])),
      leagueSpendPerTeam: mean(seasons.map(s => (s.byPos[pos] || []).reduce((a, p) => a + p.salary, 0) / TEAMS))
    };
  });
  return curves;
}

function interp(arr, x) {
  if (x <= 1) return arr[0];
  if (x >= arr.length) return arr[arr.length - 1];
  const lo = Math.floor(x);
  const frac = x - lo;
  return arr[lo - 1] + ((arr[lo] ?? arr[lo - 1]) - arr[lo - 1]) * frac;
}

// ---------------------------------------------------------------------------
// 2. Strategy tilts
// ---------------------------------------------------------------------------

// WR points in this league are mostly TD points, and TDs are the noisiest thing
// a receiver does. Three WR slots and a non-PPR floor mean a paid-up receiver
// busts a manager's week far more often than a running back does. We shave WR
// value and put the money on backs. (This is the same conclusion the five-year
// study reached; the haircut just makes the room's WR prices someone else's
// problem.)
const WR_TD_VARIANCE_HAIRCUT = 0.85;

// Goal-line premium. A back who gets the ball on the 1 is worth more than his
// yardage says, because a TD is 6 and a yard is 0.04. Multipliers are seeded
// from FantasyPros' projected rushing TDs for the top of the board and role for
// the rest: heavy-workload / short-yardage backs up, pure passing-down backs flat.
const GOAL_LINE_PREMIUM = {
  'Derrick Henry': 1.22, 'Jonathan Taylor': 1.20, 'Josh Jacobs': 1.20, 'Kyren Williams': 1.20,
  'Jahmyr Gibbs': 1.15, 'James Cook III': 1.15, 'Joe Mixon': 1.15, 'Isiah Pacheco': 1.12,
  'Chase Brown': 1.12, 'Javonte Williams': 1.12, 'Kenneth Walker III': 1.12,
  'Bijan Robinson': 1.10, 'Saquon Barkley': 1.10, 'Chuba Hubbard': 1.10, 'James Conner': 1.12,
  'Alvin Kamara': 1.10, 'Tony Pollard': 1.10, 'Najee Harris': 1.10,
  'Christian McCaffrey': 1.08, "D'Andre Swift": 1.08, 'Omarion Hampton': 1.08, 'Bucky Irving': 1.08,
  'TreVeyon Henderson': 1.08, 'Rhamondre Stevenson': 1.08, 'Tank Bigsby': 1.08, 'Braelon Allen': 1.08,
  'Jordan Mason': 1.08, 'Quinshon Judkins': 1.08,
  'Aaron Jones': 1.05, 'RJ Harvey': 1.05, 'Jaylen Warren': 1.05, 'Trey Benson': 1.05
};

// K and DST: the position is nearly flat (a replacement kicker already scores
// ~126, a replacement DST ~87), so the VORP dollars are a mirage. They are
// streamable all year. Cap the whole board at a couple of bucks.
const FLAT_CAP = { K: [3, 2, 2], DST: [3, 2, 2] }; // ranks 1, 2, 3+ -> then $1

// ---------------------------------------------------------------------------
// 3. Value model
// ---------------------------------------------------------------------------
function valueBoard(curves) {
  const board = {};
  POSITIONS.forEach(pos => {
    const players = JSON.parse(fs.readFileSync(path.join(ECR_DIR, `${pos}.json`), 'utf-8'));
    const c = curves[pos];
    players.forEach(p => {
      p.projPts = round1(interp(c.pointsAtRank, p.posRank));
      p.vorp = Math.max(0, round1(p.projPts - c.replacement));
      p.market = p.posRank <= c.goingRate.length ? round1(interp(c.goingRate, p.posRank)) : 1;
      if (p.market < 1) p.market = 1;
      let mult = 1;
      if (pos === 'WR') mult = WR_TD_VARIANCE_HAIRCUT;
      if (pos === 'RB') { p.goalLine = GOAL_LINE_PREMIUM[p.name] || 1; mult = p.goalLine; }
      p.adjVorp = round1(p.vorp * mult);
    });
    board[pos] = players;
  });

  // Dollars per adjusted VORP point: split the whole room's discretionary money
  // across every positive-VORP player. $1 floor per rostered slot.
  const all = POSITIONS.flatMap(pos => board[pos]).filter(p => p.adjVorp > 0);
  const totalV = all.reduce((a, p) => a + p.adjVorp, 0);
  const discretionary = TEAMS * BUDGET - TEAMS * ROSTER_SIZE;
  const rate = discretionary / totalV;

  POSITIONS.forEach(pos => board[pos].forEach(p => {
    let v = p.adjVorp > 0 ? Math.max(1, Math.round(1 + p.adjVorp * rate)) : 1;
    if (FLAT_CAP[pos]) {
      const cap = FLAT_CAP[pos][Math.min(p.posRank - 1, FLAT_CAP[pos].length - 1)] ?? 1;
      v = Math.min(v, cap);
    }
    p.value = v;
    p.edge = Math.round(p.value - p.market);
  }));

  return { board, rate, totalV };
}

const round1 = x => Math.round(x * 10) / 10;
const money = x => `$${Math.round(x)}`;

// ---------------------------------------------------------------------------
// 4. Report
// ---------------------------------------------------------------------------
function tierTag(pos, p) {
  if (pos === 'K' || pos === 'DST') return p.posRank <= 4 ? 'Stream #1-4' : 'Skip';
  // A goal-line back near the top is an anchor you deliberately pay up for - one
  // of these wins your week, so "market overpays the flat VORP" is not "avoid".
  if (pos === 'RB' && p.goalLine > 1 && p.posRank <= 8) return 'ANCHOR';
  if (p.edge >= 6) return 'VALUE';
  if (p.edge >= -3) return 'Fair';
  return 'Fade';
}

function buildReport(curves, model) {
  const { board } = model;
  const out = [];
  const push = (...l) => out.push(...l);
  const meta = JSON.parse(fs.readFileSync(path.join(ECR_DIR, '_meta.json'), 'utf-8'));

  push('# MLFF 2026 Auction Cheatsheet');
  push('');
  push(`10 teams · $300 cap · 16-man rosters · start 1 QB / 2 RB / 3 WR / 1 TE / 1 K / 1 DEF.`);
  push('');
  push(`Rankings: FantasyPros Expert Consensus (Standard / non-PPR), ${meta.positions.RB.experts}+ experts, pulled ${meta.fetched}. ` +
    `Prices in **our** scoring, calibrated on our last five auctions (2021-2025).`);
  push('');
  push('## How to read it');
  push('');
  push('- **Val** = what the player is worth to you in our scoring (points over replacement, whole room\'s money split across the board). This is your **walk-away price** - happily pay less, never chase past it.');
  push('- **Mkt** = what our league has actually paid at that positional price rank the last five years. The gap between Val and Mkt is your edge.');
  push('- **VALUE** = Val is at/above Mkt, you can win him at a profit. **Fade** = the room overpays him; only buy if he falls to your Val.');
  push('');
  push('## Why this board looks different from a normal cheatsheet');
  push('');
  push('Our scoring is non-PPR and brutally TD-heavy: a rushing or receiving TD is **6**, a yard is **0.04** (1 point per 25), a pass yard is 1 per 60, and there is **no penalty for interceptions or fumbles**. Re-scored in our rules, roughly **55-60% of an elite back\'s points are TDs** - against ~35% in standard scoring. Three things fall out of that:');
  push('');
  push('1. **Running backs are the whole game.** They carry the ball at the goal line, and the goal line is where the points are. We spend up here.');
  push('2. **Wide receivers are a coin flip.** Take away the catch points and a WR\'s week is mostly "did he score." That variance, times three starting slots, is why we buy receivers in bulk from the bargain bin instead of paying up for one.');
  push('3. **Quarterbacks are underpriced, dual-threat QBs doubly so.** Four points a passing TD, six a rushing TD, rushing yards at the RB rate, and zero cost for a pick. A running quarterback is a cheat code the room habitually under-bids.');
  push('');

  // Budget blueprint
  push('## The $300 plan');
  push('');
  push('One workable split. The point is the shape, not the pennies: load RB, stack cheap WR, get a dual-threat QB or wait, pay a dollar for the rest.');
  push('');
  push('| Pos | $ | Bodies | Where |');
  push('|---|---|---|---|');
  push('| QB | $50 | 1 (+$1 dart) | One top-6 dual-threat, **or** punt to a $10-20 arm and move the $ to RB |');
  push('| RB | $150 | 4-5 | One $55-65 goal-line anchor, one $35-45 starter, two-three $12-25 value backs |');
  push('| WR | $60 | 5-6 | All from the $8-18 tier - three startable bodies most weeks, no single overpay |');
  push('| TE | $6 | 1-2 | One $4-8 value TE, stream the rest |');
  push('| K | $2 | 1 | Best kicker at $2-3, no more |');
  push('| DEF | $2 | 1 | Same |');
  push('| Bench darts | ~$28 | 3-4 | $1-4 upside RB/WR lottery tickets |');
  push('| **Total** | **~$300** | **16** | |');
  push('');
  push('Anchor discipline: pick **one or two** players you will actually pay up for (a goal-line RB, a dual-threat QB) and win them. Everything else you buy at or below the Val column, or you walk.');
  push('');

  // Position tables
  const shown = { QB: 20, RB: 40, WR: 45, TE: 20, K: 8, DST: 8 };
  const blurb = {
    QB: 'You only start one, and the room habitually lets top-10 arms go for a handful of dollars - so the big "Val" numbers below are worth far more than you will actually pay. That IS the edge: land a top-tier runner (Burrow/Allen/Jackson/Hurts/Daniels) for real money, **or** wait and steal a value arm near the Mkt price. The only trap is the $25-40 "second-tier" QB who costs like a starter and finishes like a streamer. There is no wrong end to shop, only the middle.',
    RB: 'Where the auction is won. Pay up for a goal-line anchor, add a second every-down back, then mine the $12-25 tier for volume. The 🎯 backs get the short-yardage and red-zone work that our scoring pays for.',
    WR: 'Do not pay up. Every receiver above ~$20 is a Fade in our rules. The plan is five or six bodies from the $8-18 band - three of them will be startable in any given week, and you did not sink $60 into one boom/bust play.',
    TE: 'Punt it. One value TE in the $4-8 range and a $1 backup. The elite TEs are fine players and a bad use of TD-heavy dollars.',
    K: 'Flat and streamable. Best available for $2-3, never more.',
    DST: 'Flat and streamable. A top unit for $2-3, then stream matchups.'
  };
  const posTitle = { QB: 'Quarterbacks', RB: 'Running Backs', WR: 'Wide Receivers', TE: 'Tight Ends', K: 'Kickers', DST: 'Defenses' };

  POSITIONS.forEach(pos => {
    push(`## ${posTitle[pos]}`);
    push('');
    push(blurb[pos]);
    push('');
    push(`| ${pos} | Player | Tm | Bye | Val | Mkt | Edge | Call |`);
    push('|---|---|---|---|---|---|---|---|');
    board[pos].slice(0, shown[pos]).forEach(p => {
      const name = pos === 'RB' && p.goalLine > 1 ? `${p.name} 🎯` : p.name;
      const edge = p.edge >= 0 ? `+${p.edge}` : `${p.edge}`;
      push(`| ${p.pos}${p.posRank} | ${name} | ${p.team} | ${p.bye || '-'} | **${money(p.value)}** | ${money(p.market)} | ${edge} | ${tierTag(pos, p)} |`);
    });
    push('');
  });

  push('## Fine print');
  push('');
  push('- Val projects each player to finish exactly at his ECR rank, then reads our real points-scored-at-that-rank from 2021-2025. Ranks are consensus; treat one-dollar differences as noise and the tiers as the signal.');
  push('- 🎯 marks a goal-line premium already baked into Val. WR Val already carries a 15% TD-variance haircut. K/DST are capped because the position is flat - do not let the "edge" column talk you into a $15 kicker.');
  push('- The market column assumes the room bids the way it has for five years. If someone else has also read the study and stops overpaying for receivers, the WR bargains dry up - watch the room, not just the sheet.');
  push('- Full five-year methodology and the position-by-position study: `docs/auction-position-analysis.md`.');
  push('');
  return out.join('\n');
}

// ---------------------------------------------------------------------------
function main() {
  const curves = buildCurves();
  const model = valueBoard(curves);
  const report = buildReport(curves, model);

  if (process.argv.includes('--json')) {
    const outFile = path.join(process.cwd(), 'data', 'auction-cheatsheet-2026.json');
    fs.writeFileSync(outFile, JSON.stringify({ generatedAt: new Date().toISOString(), board: model.board }, null, 1));
    console.log(`Wrote ${path.relative(process.cwd(), outFile)}`);
  }
  if (process.argv.includes('--stdout')) {
    process.stdout.write(report);
    return;
  }
  const outDir = path.join(process.cwd(), 'docs');
  fs.mkdirSync(outDir, { recursive: true });
  const outFile = path.join(outDir, 'auction-cheatsheet-2026.md');
  fs.writeFileSync(outFile, report);
  console.log(`Wrote ${path.relative(process.cwd(), outFile)}`);
}

main();
