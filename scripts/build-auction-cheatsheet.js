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
    // A pick "busts" when it returns below replacement. Bust rate by price rank
    // is our empirical predictability signal (section below).
    draft.forEach(p => { p.vorp = p.points - replacement[p.pos]; });
    return { year, pool, draft, byPos, drafted, replacement };
  });

  const lastYear = Math.max(...YEARS);
  const lastSeason = seasons.find(s => s.year === lastYear);

  const curves = {};
  POSITIONS.forEach(pos => {
    const pts = [];
    for (let r = 1; r <= 90; r++) pts.push(mean(seasons.map(s => pointsAtRank(s.pool, pos, r))));
    const picks = seasons.flatMap(s => s.byPos[pos] || []);
    const maxPR = Math.max(...picks.map(p => p.priceRank));
    const rate = [];
    const bust = [];
    for (let pr = 1; pr <= Math.min(maxPR, 60); pr++) {
      const g = picks.filter(p => Math.abs(p.priceRank - pr) <= 1);
      rate.push(mean(g.map(p => p.salary)));
      // Bust rate uses a wider +/-2 window: it is noisier than price, so it wants
      // more samples, but we keep enough resolution to see the QB4-6 trap and the
      // safe RB3-6 pocket rather than smoothing them away.
      const gb = picks.filter(p => Math.abs(p.priceRank - pr) <= 2);
      bust.push(gb.length ? gb.filter(p => p.vorp <= 0).length / gb.length : null);
    }
    // Last year's actual winning bid at each positional price rank (n=1, exact).
    // This is "what the Nth-most-expensive <pos> went for in the most recent
    // auction", so it sits next to the five-year average as a freshness check.
    const lastPicks = (lastSeason.byPos[pos] || []).slice().sort((a, b) => a.priceRank - b.priceRank);
    const lastRate = lastPicks.map(p => p.salary);
    curves[pos] = {
      pointsAtRank: pts,
      goingRate: rate,
      lastYearRate: lastRate,
      bustRate: bust,
      replacement: mean(seasons.map(s => s.replacement[pos])),
      draftedPerYear: mean(seasons.map(s => s.drafted[pos])),
      draftCount: Math.round(mean(seasons.map(s => s.drafted[pos]))),
      leagueSpendPerTeam: mean(seasons.map(s => (s.byPos[pos] || []).reduce((a, p) => a + p.salary, 0) / TEAMS))
    };
  });
  curves._lastYear = lastYear;
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
// 2. Value model: why it is not linear
// ---------------------------------------------------------------------------
//
// Raw points-over-replacement, split by dollars, gives a nearly straight line -
// every rank a few dollars cheaper than the one above. That is wrong twice over.
//
//   (a) Baseline. You start ONE QB and ONE TE, so the alternative to an elite
//       one is a streamer, not the 20th-best guy. Pricing QB/TE over the
//       last startable body (not deep replacement) makes those positions
//       collapse after the top few - elite or punt. RB (2 slots) and WR (3)
//       get a deep baseline, so their bench depth keeps real value.
//   (b) Predictability. A dollar buys certainty, and certainty is not constant.
//       Season BUST RATE by position and price rank (our five years) is the
//       signal: QB1-3 never bust while the QB4-6 tier busts a quarter of the
//       time; the safest RBs are 3-6, not 1-2; TE is a coin flip after the top
//       two. We weight each player's edge by how reliably that slot has paid.
//   Plus a week-to-week CONSISTENCY factor per position - a receiver's night is
//   mostly "did he score", so WR points swing hardest game to game.
//
// The result is convex: a steep, reliable top; a discounted risky middle; a
// long cheap tail - the shape an auction actually takes.

// Baseline rank each player is measured against. Single-start positions use the
// streamable-starter rank (collapse); multi-start positions use deep replacement.
const BASELINE_RANK = { QB: 13, RB: 46, WR: 56, TE: 13, K: 11, DST: 11 };

// Week-to-week consistency. Backs carry the ball and quarterbacks throw it every
// possession; a receiver's fantasy night is mostly whether he found the end
// zone, so WR production swings hardest game to game. This discounts a position's
// whole board for that swing - the WR reduction the league's TD-heavy scoring
// demands, now a predictability statement rather than a flat haircut.
const CONSISTENCY = { QB: 1.0, RB: 1.0, WR: 0.75, TE: 0.90, K: 1.0, DST: 1.0 };

// Convexity of the price curve (how much the reliable elite is worth over the
// middle) and how hard predictability bites. The steep top mostly comes from the
// baseline choice above; these just shape it.
const GAMMA = 1.0;   // curve convexity on top of the baseline
const BETA = 1.4;    // predictability weight (bust rate)
const MAX_VALUE = 90; // never price one player past ~30% of a $300 budget

// Sleeper's own season projections, re-scored in our rules (see
// data/sleeper-projections-2026.json). Two jobs: a data-driven goal-line signal
// (its projected rushing / receiving TDs) and a second opinion to diff against
// the FantasyPros consensus.
const SLEEPER = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'data', 'sleeper-projections-2026.json'), 'utf-8'));
function sleeperKey(pos, name) {
  const n = name.toLowerCase().replace(/[.'']/g, '').replace(/-/g, ' ')
    .replace(/\b(jr|sr|ii|iii|iv|v)\b/g, '').replace(/\s+/g, ' ').trim();
  return `${pos}|${n}`;
}

// Goal-line / red-zone star. Flags the players Sleeper projects for an
// outsized share of the scoring plays our rules pay for: RBs with the
// short-yardage carries, WRs who are the red-zone target, QBs who run it in
// themselves. A TD is 6 and a yard is 0.04, so this is where the money is.
function isStar(pos, s) {
  if (!s) return false;
  if (pos === 'RB') return s.rushTd >= 8 || (s.rushTd >= 6 && s.tdShare >= 0.55);
  if (pos === 'WR') return s.recTd >= 8 || (s.tdShare >= 0.55 && s.rec >= 45);
  if (pos === 'QB') return s.rushTd >= 5;
  return false;
}

// The goal-line premium on RB value, scaled straight off Sleeper's projected
// rushing TDs rather than a hand-kept list. A back projected for 12 rushing
// scores is worth more than his yardage says; one projected for 5 is not.
// Tapered at RB1-2, who are already priced at the ceiling - the premium does its
// real work lifting the mid-tier short-yardage backs the room lets go cheap.
function goalLinePremium(rushTd, posRank) {
  const gl = Math.min(1.24, 1 + Math.max(0, rushTd - 5) * 0.032);
  return posRank <= 2 ? 1 + (gl - 1) * 0.5 : gl;
}

// K and DST: the position is nearly flat (a replacement kicker already scores
// ~126, a replacement DST ~87) and streamable all year. Cap the whole board at a
// couple of bucks - the reliability math would otherwise chase a mirage.
const FLAT_CAP = { K: [3, 2, 2], DST: [3, 2, 2] }; // ranks 1, 2, 3+ -> then $1

function reliabilityAt(curve, rank) {
  const b = curve.bustRate;
  const bust = rank <= b.length ? (interp(b, rank) ?? 0.5) : Math.min(0.65, b[b.length - 1] ?? 0.5);
  return Math.max(0.05, 1 - bust);
}

// ---------------------------------------------------------------------------
// 3. Value model
// ---------------------------------------------------------------------------
function valueBoard(curves) {
  const board = {};
  POSITIONS.forEach(pos => {
    const players = JSON.parse(fs.readFileSync(path.join(ECR_DIR, `${pos}.json`), 'utf-8'));
    const c = curves[pos];
    const baseline = c.pointsAtRank[BASELINE_RANK[pos] - 1];
    players.forEach(p => {
      p.projPts = round1(interp(c.pointsAtRank, p.posRank));
      // Value over the last body you would actually start/roster at the position.
      p.raw = Math.max(0, round1(p.projPts - baseline));
      p.reliability = round1(reliabilityAt(c, p.posRank));
      p.market = p.posRank <= c.goingRate.length ? round1(interp(c.goingRate, p.posRank)) : 1;
      if (p.market < 1) p.market = 1;
      p.lastYr = p.posRank <= c.lastYearRate.length ? Math.round(c.lastYearRate[p.posRank - 1]) : null;

      // Sleeper's second opinion: its projected rank in our scoring, the gap to
      // FantasyPros' rank (positive = Sleeper is lower on him than FP), and the
      // goal-line / red-zone star.
      const s = SLEEPER[sleeperKey(pos, p.name)] || null;
      p.sleeper = s ? { rank: s.slrank, pts: s.pts, rushTd: s.rushTd, recTd: s.recTd, passTd: s.passTd, tdShare: s.tdShare } : null;
      p.slGap = s ? s.slrank - p.posRank : null;
      p.star = isStar(pos, s);

      let gl = 1;
      if (pos === 'RB') {
        gl = s ? goalLinePremium(s.rushTd, p.posRank) : 1;
        p.goalLine = gl;
      }
      p.rostered = p.posRank <= c.draftCount;
      p.units = (p.rostered && p.raw > 0)
        ? Math.pow(p.raw, GAMMA) * Math.pow(p.reliability, BETA) * CONSISTENCY[pos] * gl
        : 0;
    });
    board[pos] = players;
  });

  // Split the room's money across the players who actually get drafted, not the
  // whole free-agent pool. Each rostered slot floors at $1.
  const roster = POSITIONS.flatMap(pos => board[pos]).filter(p => p.rostered);
  const totalU = roster.reduce((a, p) => a + p.units, 0);
  const discretionary = TEAMS * BUDGET - roster.length;
  const rate = discretionary / totalU;

  POSITIONS.forEach(pos => board[pos].forEach(p => {
    let v = p.rostered ? (p.units > 0 ? Math.max(1, Math.round(1 + p.units * rate)) : 1) : 1;
    if (FLAT_CAP[pos]) {
      const cap = FLAT_CAP[pos][Math.min(p.posRank - 1, FLAT_CAP[pos].length - 1)] ?? 1;
      v = Math.min(v, cap);
    }
    p.value = Math.min(v, MAX_VALUE);
    p.edge = Math.round(p.value - p.market);
  }));

  return { board, rate, totalU };
}

const round1 = x => Math.round(x * 10) / 10;
const money = x => `$${Math.round(x)}`;

// ---------------------------------------------------------------------------
// 4. Report
// ---------------------------------------------------------------------------
function tierTag(pos, p) {
  if (pos === 'K' || pos === 'DST') return p.posRank <= 4 ? 'Stream #1-4' : 'Skip';
  // Anchors are the players you deliberately pay up to win: the reliable elite QB,
  // and the top goal-line backs whose short-yardage role our scoring rewards.
  if (pos === 'QB' && p.value >= 45) return 'ANCHOR';
  if (pos === 'RB' && p.star && p.posRank <= 8) return 'ANCHOR';
  if (p.edge >= 3) return 'VALUE';
  if (p.edge <= -8) return 'Fade';
  return 'Fair';
}

function buildReport(curves, model) {
  const { board } = model;
  const out = [];
  const push = (...l) => out.push(...l);
  const meta = JSON.parse(fs.readFileSync(path.join(ECR_DIR, '_meta.json'), 'utf-8'));
  const lastYear = curves._lastYear;

  push('# MLFF 2026 Auction Cheatsheet');
  push('');
  push(`10 teams · $300 cap · 16-man rosters · start 1 QB / 2 RB / 3 WR / 1 TE / 1 K / 1 DEF.`);
  push('');
  push(`Rankings: FantasyPros Expert Consensus (Standard / non-PPR), ${meta.positions.RB.experts}+ experts, pulled ${meta.fetched}, ` +
    `cross-checked against Sleeper's own projections. Prices in **our** scoring, calibrated on our last five auctions (2021-2025).`);
  push('');
  push('## How to read it');
  push('');
  push('- **Val** = what the player is worth to you in our scoring - your **walk-away price**. It is *not* a straight line down the ranks: it prices each player over the last body you would actually start at his position, then weights that edge by how **reliably** the slot has paid and how much a position swings week to week. Studs and safe positions get a premium; the risky middle gets discounted; the tail flattens to a dollar. Happily pay less than Val, never chase past it.');
  push('- **Mkt (5yr)** = what our league has paid at that positional price rank averaged over the last five auctions. The gap between Val and Mkt is your edge.');
  push(`- **'${String(lastYear).slice(2)} @rank** = the exact winning bid at that same positional price rank in **last year's (${lastYear}) auction** - one data point, so it is noisier than the five-year average but tells you where the room landed most recently.`);
  push('- **VALUE** = Val is at/above Mkt, you can win him at a profit. **Fade** = the room overpays him; only buy if he falls to your Val.');
  push('- **★** = Sleeper projects an *inordinate* share of the plays our scoring pays for - goal-line carries (RB), red-zone targets (WR), or designed QB runs. For a back or a running QB that is a reliability boost; for a receiver it is where the points come from **and** the source of the week-to-week swing, so a star is a reason to like the ceiling, not to overpay.');
  push(`- **Sleeper** = the player's projected positional rank in Sleeper's own numbers (re-scored in our rules). \`(FP +n)\` means FantasyPros ranks him n spots higher than Sleeper does; \`(SL +n)\` means Sleeper is the higher one. **Bold** marks a disagreement of 4+ spots - a FantasyPros darling Sleeper is cold on (verify before paying up) or a Sleeper value the ADP-following room may let slide.`);
  push('');
  push('## Why this board looks different from a normal cheatsheet');
  push('');
  push('Our scoring is non-PPR and brutally TD-heavy: a rushing or receiving TD is **6**, a yard is **0.04** (1 point per 25), a pass yard is 1 per 60, and there is **no penalty for interceptions or fumbles**. Re-scored in our rules, roughly **55-60% of an elite back\'s points are TDs** - against ~35% in standard scoring. Three things fall out of that:');
  push('');
  push('1. **Running backs are the whole game.** They carry the ball at the goal line, and the goal line is where the points are. We spend up here.');
  push('2. **Wide receivers are a coin flip.** Take away the catch points and a WR\'s week is mostly "did he score." That variance, times three starting slots, is why we buy receivers in bulk from the bargain bin instead of paying up for one.');
  push('3. **Quarterbacks are underpriced, dual-threat QBs doubly so.** Four points a passing TD, six a rushing TD, rushing yards at the RB rate, and zero cost for a pick. A running quarterback is a cheat code the room habitually under-bids.');
  push('');
  push('And the values are **not linear**. Two facts about our five years bend the curve, and they are the thing most cheatsheets get wrong:');
  push('');
  push('- **You only start one QB and one TE.** So the alternative to an elite one is a streamer, not the 20th-best guy - which means those positions should **collapse after the top few** (elite or punt), not slope gently down. RB and WR start two and three, so their depth stays worth real money.');
  push('- **Predictability is not constant.** Bust rate by position and price rank is the tell: the top three QBs never bust while the next tier (roughly QB4-6) busts a quarter of the time; the *safest* backs are RB3-6, not the two most expensive; tight end is a coin flip after the top two. A dollar buys certainty, so we pay up where the slot has reliably paid and discount the murky middle. That is why the drop from one rank to the next is a cliff in some places and a shrug in others.');
  push('');

  // Budget blueprint
  push('## The $300 plan');
  push('');
  push('One workable split. The point is the shape, not the pennies: load RB, stack cheap WR, get a dual-threat QB or wait, pay a dollar for the rest.');
  push('');
  push('| Pos | $ | Bodies | Where |');
  push('|---|---|---|---|');
  push('| QB | $50 | 1 (+$1 dart) | A top-2 anchor if you want the ceiling, **or** the $16-25 value arm (QB7-9) and move the $ to RB |');
  push('| RB | $150 | 4-5 | One $75-90 goal-line anchor, one $50-60 starter, two-three $30-50 ★ value backs |');
  push('| WR | $60 | 5-6 | Skip the $30+ names; five or six bodies from the ~$12-25 tier - startable most weeks, no single overpay |');
  push('| TE | $6 | 1-2 | One $8-14 value TE, stream the rest |');
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
    QB: 'You only start one, so the board is bimodal, not a slope: the top two (Burrow, Allen) are the only arms that never bust and they carry a real anchor price. The next tier (roughly QB4-6) is the trap - starter money for a slot that busts a quarter of the time. Then it falls off a cliff to the value arms (QB7-9) the room lets go cheap, and a pile of $1 streamers. Buy an anchor, or buy the cliff. Never the trap.',
    RB: 'Where the auction is won. Pay up for a goal-line anchor, add a second every-down back, then mine the $30-50 ★ tier for backs with short-yardage work. Note the safest tier historically is RB3-6, not the two priciest - and a goal-line back two rounds later can outscore a pass-catcher ranked above him.',
    WR: 'Do not pay up. Non-PPR plus 6-point TDs make a receiver\'s week a coin flip, so every name over ~$30 is a Fade here even though the room pays up. The plan is five or six bodies from the ~$12-25 tier - three will be startable in any given week, and you never sank $60 into one boom/bust play.',
    TE: 'Punt it. One value TE in the $8-14 range and a $1 backup. After the top two it is a coin flip (a third of TE3-6 busts), so the elite TEs are fine players and a bad use of TD-heavy dollars.',
    K: 'Flat and streamable. Best available for $2-3, never more.',
    DST: 'Flat and streamable. A top unit for $2-3, then stream matchups.'
  };
  const posTitle = { QB: 'Quarterbacks', RB: 'Running Backs', WR: 'Wide Receivers', TE: 'Tight Ends', K: 'Kickers', DST: 'Defenses' };

  POSITIONS.forEach(pos => {
    push(`## ${posTitle[pos]}`);
    push('');
    push(blurb[pos]);
    push('');
    push(`| ${pos} | Player | Tm | Bye | Val | Mkt (5yr) | '${String(lastYear).slice(2)} @rank | Edge | Sleeper | Call |`);
    push('|---|---|---|---|---|---|---|---|---|---|');
    board[pos].slice(0, shown[pos]).forEach(p => {
      const name = p.star ? `${p.name} ★` : p.name;
      const edge = p.edge >= 0 ? `+${p.edge}` : `${p.edge}`;
      const ly = p.lastYr == null ? '-' : money(p.lastYr);
      // Sleeper's projected positional rank + the disagreement with FP. A big gap
      // is the interesting cell: **bold** where they differ by 4+ spots.
      let sleeper = '-';
      if (p.sleeper) {
        const g = p.slGap;
        const tag = g > 0 ? ` (FP +${g})` : g < 0 ? ` (SL +${-g})` : '';
        sleeper = `${pos}${p.sleeper.rank}${tag}`;
        if (Math.abs(g) >= 4) sleeper = `**${sleeper}**`;
      }
      push(`| ${p.pos}${p.posRank} | ${name} | ${p.team} | ${p.bye || '-'} | **${money(p.value)}** | ${money(p.market)} | ${ly} | ${edge} | ${sleeper} | ${tierTag(pos, p)} |`);
    });
    push('');
  });

  push('## Fine print');
  push('');
  push('- **How Val is built.** Project each player to finish at his ECR rank; read our real points-scored-at-that-rank from 2021-2025; subtract the last startable body at the position (QB/TE the streamer line, RB/WR deep replacement); weight by reliability (1 minus that slot\'s five-year bust rate) and by a position consistency factor; split the room\'s $3,000 across everyone who gets drafted. Ranks are consensus - treat one-dollar differences as noise and the tiers and cliffs as the signal.');
  push('- **★ and the goal-line premium.** Stars come from Sleeper\'s projected TDs (rush TDs for RB/QB, receiving TDs for WR). For running backs that same projection scales a goal-line premium baked into Val - a back projected for twelve rushing scores is worth more than his yardage says - tapered at the two backs already priced at the ceiling. WR stars do **not** raise Val: the position keeps its week-to-week consistency discount, because red-zone receivers are exactly the boom/bust play. No single Val exceeds ~30% of budget. K/DST are capped because the position is flat - do not let a big "edge" talk you into a $15 kicker.');
  push('- **The Sleeper column** re-scores Sleeper\'s season projections in our rules and ranks them, then diffs against FantasyPros. It is a second opinion, not a tiebreaker - when they disagree by 4+ spots, that is a flag to look closer, not an instruction. Where both agree, lean in.');
  push('- The Mkt columns assume the room bids the way it has for five years. If someone else has also read the study and stops overpaying for receivers, the WR bargains dry up - watch the room, not just the sheet.');
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
