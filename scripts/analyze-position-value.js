// MLFF auction analysis: what each position is worth, what the league pays for
// it, and how to split a $300 budget.
//
//   pnpm analyze-position-value            # writes docs/auction-position-analysis.md
//   pnpm analyze-position-value --stdout    # print instead of writing
//
// Method notes
//   - "Total FPTS" is the player's own season scoring total. It is NOT a fantasy
//     team's weekly score, so roster totals here will not match a team's PF.
//   - "Active FPTS" (2021-2023 only) is the slice of a player's total earned
//     while in a starting lineup; it is used only to sanity-check leakage.
//   - Everything is measured against *price rank* (the Nth most expensive player
//     at a position in that year's auction), because that is the one thing you
//     actually know while bidding.

const fs = require('fs');
const path = require('path');
const {
  BUDGET,
  POSITIONS,
  ROSTER_SIZE,
  SEASON_WEEKS,
  STARTERS,
  TEAMS,
  correlation,
  loadDraft,
  loadPlayerPool,
  loadStandings,
  mean,
  median,
  normalizeTeam,
  pointsAtRank,
  pointsOverRange
} = require('./lib/auction-data');

const YEARS = [2021, 2022, 2023, 2024, 2025];
const STARTER_SLOTS = Object.values(STARTERS).reduce((a, b) => a + b, 0);
const BENCH_SLOTS = ROSTER_SIZE - STARTER_SLOTS;

// ---------------------------------------------------------------------------
// Load
// ---------------------------------------------------------------------------

function loadSeasons() {
  return YEARS.map(year => {
    const pool = loadPlayerPool(year);
    const draft = loadDraft(year, pool);
    const standings = loadStandings(year);

    // Price rank: 1 = most expensive at that position that year. Ties break by
    // finish so the ordering is deterministic.
    const byPosition = {};
    draft.forEach(pick => {
      (byPosition[pick.pos] = byPosition[pick.pos] || []).push(pick);
    });
    Object.values(byPosition).forEach(picks => {
      picks.sort((a, b) => b.salary - a.salary || (a.finishRank || 999) - (b.finishRank || 999));
      picks.forEach((pick, i) => {
        pick.priceRank = i + 1;
      });
    });

    // Replacement level = what you get for free. With D players drafted at a
    // position, the best undrafted player is D+1; average the next five to keep
    // one outlier from setting the baseline.
    const drafted = {};
    const replacement = {};
    POSITIONS.forEach(pos => {
      drafted[pos] = (byPosition[pos] || []).length;
      replacement[pos] = pointsOverRange(pool, pos, drafted[pos] + 1, drafted[pos] + 5);
    });

    draft.forEach(pick => {
      pick.vorp = pick.points - replacement[pick.pos];
    });

    return { year, pool, draft, byPosition, standings, drafted, replacement };
  });
}

// ---------------------------------------------------------------------------
// Curves
// ---------------------------------------------------------------------------

// Expected cost and points at each price rank, pooled across seasons. A +/-1
// rank window widens each cell from 5 observations to 15 without blurring the
// steep top of the market much.
function priceRankCurve(seasons, pos, window = 1) {
  const picks = seasons.flatMap(s => s.byPosition[pos] || []);
  const maxRank = Math.max(...picks.map(p => p.priceRank));
  const curve = [];
  for (let rank = 1; rank <= maxRank; rank++) {
    const group = picks.filter(p => Math.abs(p.priceRank - rank) <= window);
    const exact = picks.filter(p => p.priceRank === rank);
    curve.push({
      rank,
      n: exact.length,
      cost: mean(group.map(p => p.salary)),
      exactCost: mean(exact.map(p => p.salary)),
      points: mean(group.map(p => p.points)),
      vorp: mean(group.map(p => p.vorp)),
      medianFinish: median(exact.map(p => p.finishRank).filter(Boolean)),
      bustRate: group.filter(p => p.vorp <= 0).length / group.length
    });
  }
  return curve;
}

// Pool Adjacent Violators: the smallest adjustment to the observed curve that
// makes expected points non-increasing as price rank rises. Cheap tiers are thin
// and noisy; without this the optimizer chases a $1 WR that happened to hit.
function isotonicDecreasing(values, weights) {
  const blocks = values.map((value, i) => ({ sum: value * weights[i], weight: weights[i], size: 1 }));
  for (let i = 1; i < blocks.length; i++) {
    while (i > 0 && blocks[i - 1].sum / blocks[i - 1].weight < blocks[i].sum / blocks[i].weight) {
      blocks[i - 1].sum += blocks[i].sum;
      blocks[i - 1].weight += blocks[i].weight;
      blocks[i - 1].size += blocks[i].size;
      blocks.splice(i, 1);
      i--;
    }
  }
  const out = [];
  blocks.forEach(block => {
    for (let i = 0; i < block.size; i++) out.push(block.sum / block.weight);
  });
  return out;
}

function withIsotonic(curve) {
  const smoothed = isotonicDecreasing(curve.map(c => c.points), curve.map(c => Math.max(c.n, 1)));
  return curve.map((c, i) => ({ ...c, isoPoints: smoothed[i] }));
}

// ---------------------------------------------------------------------------
// Roster plans: buying depth and starting whoever hits
// ---------------------------------------------------------------------------

// Price bands used to describe a purchase plan. Coarse enough that each band
// holds several players in every season.
const BANDS = {
  QB: [[1, 2], [3, 6], [7, 13], [14, 21]],
  RB: [[1, 2], [3, 6], [7, 13], [14, 22], [23, 35], [36, 47]],
  WR: [[1, 2], [3, 6], [7, 13], [14, 22], [23, 35], [36, 59]],
  TE: [[1, 2], [3, 6], [7, 15]],
  K: [[1, 2], [3, 11]],
  DST: [[1, 2], [3, 11]]
};

// Extra bodies a position may carry beyond its starting slots.
//
// K and DST are held to one apiece and TE to two. The Active FPTS data shows
// all three get churned off waivers during the season, and the model cannot see
// that churn - it only knows what was bought on draft day. Left uncapped it
// stockpiles cheap tight ends for a few points a season, which no manager would
// actually carry to week 17.
const MAX_EXTRA = { QB: 3, RB: 4, WR: 4, TE: 1, K: 0, DST: 0 };

const PLAN_SAMPLES = 250;

// Deterministic RNG so a rerun of the report produces the same numbers.
function makeRandom(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

// How much of the best-case lineup a manager actually captured, measured from
// 2021-2023 Active FPTS: the fraction of the top-N-by-hindsight total that
// really landed in a starting lineup. Depth only pays if you start the right
// player, and this is the observed rate at which the league does that.
function captureRates(seasons) {
  const rates = {};
  POSITIONS.forEach(pos => {
    const ceilings = [];
    const actuals = [];
    seasons.forEach(season => {
      const teams = {};
      season.draft.forEach(pick => {
        if (pick.activePoints === null) return;
        (teams[pick.team] = teams[pick.team] || []).push(pick);
      });
      Object.values(teams).forEach(picks => {
        const group = picks.filter(p => p.pos === pos);
        if (group.length === 0) return;
        const sorted = group.map(p => p.points).sort((a, b) => b - a);
        ceilings.push(sorted.slice(0, STARTERS[pos]).reduce((a, b) => a + b, 0));
        actuals.push(group.reduce((sum, p) => sum + p.activePoints, 0));
      });
    });
    // K and DST are streamed all season, so their drafted-player capture rate
    // measures churn rather than lineup skill; hold them at parity.
    rates[pos] = pos === 'K' || pos === 'DST'
      ? 1
      : Math.min(1, mean(actuals) / mean(ceilings));
  });
  return rates;
}

// Draw k distinct items without replacement.
function sample(items, k, random) {
  const pool = [...items];
  const out = [];
  for (let i = 0; i < k; i++) {
    const index = Math.floor(random() * pool.length);
    out.push(pool.splice(index, 1)[0]);
  }
  return out;
}

// Every way to split n purchases across a position's price bands.
function bandPlans(bandCount, n) {
  const out = [];
  const build = (index, left, current) => {
    if (index === bandCount) {
      if (left === 0) out.push([...current]);
      return;
    }
    for (let take = 0; take <= left; take++) {
      current.push(take);
      build(index + 1, left - take, current);
      current.pop();
    }
  };
  build(0, n, []);
  return out;
}

// Score a purchase plan against the real auctions, week by week.
//
// A season total hides the thing that makes depth worth buying: a player who
// misses six games contributes nothing in those six weeks, and the slot still
// has to be filled. So each drawn player is available in a given week with
// probability (games played / 17), the best available fill the starting slots at
// their per-game rate, and any slot left empty falls back to a waiver pickup at
// replacement level. That is what makes a third RB worth money and a third TE
// not: the RB slot bleeds 7 points a week when it goes unfilled, the TE slot
// bleeds a fraction of a point.
function evaluatePlan(seasons, pos, counts, capture, random, samples = PLAN_SAMPLES) {
  const bands = BANDS[pos];
  const slots = STARTERS[pos];
  let costTotal = 0;
  let skilledTotal = 0;
  let randomTotal = 0;
  let weight = 0;
  // Reused across draws so the hot loop allocates nothing.
  const maxPlayers = counts.reduce((a, b) => a + b, 0);
  const perGame = new Float64Array(maxPlayers);
  const availability = new Float64Array(maxPlayers);

  seasons.forEach(season => {
    const picks = season.byPosition[pos] || [];
    const pools = bands.map(([lo, hi]) => picks.filter(p => p.priceRank >= lo && p.priceRank <= hi));
    if (pools.some((pool, i) => pool.length < counts[i])) return;

    // A streamed free agent, per week.
    const waiverPerWeek = season.replacement[pos] / SEASON_WEEKS;

    for (let draw = 0; draw < samples; draw++) {
      const chosen = [];
      pools.forEach((pool, i) => {
        if (counts[i] > 0) chosen.push(...sample(pool, counts[i], random));
      });
      costTotal += chosen.reduce((sum, p) => sum + p.salary, 0);

      // Rank once by per-game rate: you generally know which of your own players
      // is better, even if you cannot know which will outscore the other in a
      // given week.
      chosen.sort((a, b) => (b.pointsPerGame || 0) - (a.pointsPerGame || 0));
      const size = chosen.length;
      for (let i = 0; i < size; i++) {
        perGame[i] = chosen[i].pointsPerGame || 0;
        availability[i] = (chosen[i].games === null ? SEASON_WEEKS : chosen[i].games) / SEASON_WEEKS;
      }

      let skilled = 0;
      let noSkill = 0;
      for (let week = 0; week < SEASON_WEEKS; week++) {
        // One pass over the roster in talent order: the first `slots` available
        // players start, and the rest of the pass only tallies the no-skill mean.
        let started = 0;
        let availableCount = 0;
        let availableSum = 0;
        for (let i = 0; i < size; i++) {
          if (random() >= availability[i]) continue;
          availableCount++;
          availableSum += perGame[i] > waiverPerWeek ? perGame[i] : waiverPerWeek;
          if (started < slots) {
            // A rostered player who is worse than the wire does not get started;
            // the manager streams instead. This is why a fourth tight end is not
            // worth a roster spot: the wire already offers that option for free.
            skilled += perGame[i] > waiverPerWeek ? perGame[i] : waiverPerWeek;
            started++;
          }
        }
        skilled += (slots - started) * waiverPerWeek;

        // No-skill floor: fill the slots from whoever is available, at random.
        const usable = availableCount < slots ? availableCount : slots;
        if (usable > 0) noSkill += (availableSum / availableCount) * usable;
        noSkill += (slots - usable) * waiverPerWeek;
      }
      skilledTotal += skilled;
      randomTotal += noSkill;
      weight++;
    }
  });

  if (weight === 0) return null;
  const skilled = skilledTotal / weight;
  const noSkill = randomTotal / weight;
  return {
    pos,
    counts,
    players: counts.reduce((a, b) => a + b, 0),
    cost: costTotal / weight,
    hindsight: skilled,
    noSkill,
    // Depth is only worth the share of the upside a manager actually converts.
    points: noSkill + capture * (skilled - noSkill)
  };
}

function planOptions(seasons, pos, capture) {
  const slots = STARTERS[pos];
  const random = makeRandom(0x5eed + pos.length * 7919);
  const options = [];
  for (let n = slots; n <= slots + MAX_EXTRA[pos]; n++) {
    bandPlans(BANDS[pos].length, n).forEach(counts => {
      const evaluated = evaluatePlan(seasons, pos, counts, capture, random);
      if (evaluated) options.push(evaluated);
    });
  }
  // Keep the frontier: for each (players, rounded cost) keep the best points.
  const best = new Map();
  options.forEach(option => {
    const key = `${option.players}|${Math.round(option.cost)}`;
    if (!best.has(key) || best.get(key).points < option.points) best.set(key, option);
  });
  return [...best.values()];
}

// 2-D knapsack over dollars and roster spots. Bench spots are not free points,
// they are extra draws at a position, so they belong in the same optimization.
function optimizeRoster(seasons, capture) {
  const NEG = -Infinity;
  const spots = ROSTER_SIZE;
  let dp = Array.from({ length: spots + 1 }, () => new Float64Array(BUDGET + 1).fill(NEG));
  dp[0][0] = 0;
  // One back-pointer table per position, so the winning plan can be replayed.
  const traces = [];

  POSITIONS.forEach(pos => {
    const options = planOptions(seasons, pos, capture[pos]);
    const next = Array.from({ length: spots + 1 }, () => new Float64Array(BUDGET + 1).fill(NEG));
    const trace = Array.from({ length: spots + 1 }, () => Array.from({ length: BUDGET + 1 }, () => null));
    for (let s = 0; s <= spots; s++) {
      for (let c = 0; c <= BUDGET; c++) {
        if (dp[s][c] === NEG) continue;
        options.forEach(option => {
          const cost = Math.max(option.players, Math.round(option.cost));
          const s2 = s + option.players;
          const c2 = c + cost;
          if (s2 > spots || c2 > BUDGET) return;
          const value = dp[s][c] + option.points;
          if (value > next[s2][c2]) {
            next[s2][c2] = value;
            trace[s2][c2] = { prev: [s, c], option, cost };
          }
        });
      }
    }
    dp = next;
    traces.push(trace);
  });

  let bestCost = 0;
  for (let c = 0; c <= BUDGET; c++) if (dp[spots][c] > dp[spots][bestCost]) bestCost = c;

  const allocation = [];
  let s = spots;
  let c = bestCost;
  for (let i = traces.length - 1; i >= 0; i--) {
    const node = traces[i][s][c];
    if (!node) break;
    allocation.unshift({ ...node.option, roundedCost: node.cost });
    [s, c] = node.prev;
  }
  return { spend: bestCost, points: dp[spots][bestCost], allocation };
}

// ---------------------------------------------------------------------------
// Budget optimizer (starters only)
// ---------------------------------------------------------------------------

// Multi-choice knapsack. Each position contributes exactly as many players as it
// has starting slots, each from a distinct price rank; the bench is held out at a
// flat reserve because bench points do not score.
function bestByPosition(curve, slots, budget, pointsKey) {
  // dp[k][cost] = best points using k players costing exactly <= cost
  const NEG = -Infinity;
  let dp = Array.from({ length: slots + 1 }, () => new Float64Array(budget + 1).fill(NEG));
  let pick = Array.from({ length: slots + 1 }, () => Array.from({ length: budget + 1 }, () => null));
  dp[0].fill(0);

  curve.forEach(entry => {
    const cost = Math.max(1, Math.round(entry.cost));
    const value = entry[pointsKey];
    for (let k = slots; k >= 1; k--) {
      for (let c = budget; c >= cost; c--) {
        const candidate = dp[k - 1][c - cost];
        if (candidate === NEG) continue;
        if (candidate + value > dp[k][c]) {
          dp[k][c] = candidate + value;
          pick[k][c] = { rank: entry.rank, cost, prev: c - cost };
        }
      }
    }
  });

  // Best-at-or-under each cost, with the choice list recoverable.
  const out = [];
  for (let c = 0; c <= budget; c++) {
    let best = NEG;
    let bestCost = 0;
    for (let cc = 0; cc <= c; cc++) {
      if (dp[slots][cc] > best) {
        best = dp[slots][cc];
        bestCost = cc;
      }
    }
    const ranks = [];
    let k = slots;
    let cursor = bestCost;
    while (k > 0 && pick[k][cursor]) {
      ranks.push(pick[k][cursor].rank);
      cursor = pick[k][cursor].prev;
      k--;
    }
    out.push({ cost: c, spend: bestCost, points: best === NEG ? 0 : best, ranks: ranks.reverse() });
  }
  return out;
}

function optimizeBudget(curves, pointsKey, benchReserve) {
  const budget = BUDGET - benchReserve;
  const tables = {};
  POSITIONS.forEach(pos => {
    tables[pos] = bestByPosition(curves[pos], STARTERS[pos], budget, pointsKey);
  });

  // Combine positions with a second knapsack over the same dollar axis.
  let dp = new Float64Array(budget + 1).fill(-Infinity);
  dp[0] = 0;
  let trace = Array.from({ length: budget + 1 }, () => []);

  POSITIONS.forEach(pos => {
    const next = new Float64Array(budget + 1).fill(-Infinity);
    const nextTrace = Array.from({ length: budget + 1 }, () => []);
    for (let used = 0; used <= budget; used++) {
      if (dp[used] === -Infinity) continue;
      for (let spend = 0; spend + used <= budget; spend++) {
        const option = tables[pos][spend];
        if (option.points === 0 && option.ranks.length === 0) continue;
        if (option.spend !== spend) continue; // only exact frontier points
        const total = dp[used] + option.points;
        if (total > next[used + spend]) {
          next[used + spend] = total;
          nextTrace[used + spend] = [...trace[used], { pos, spend, points: option.points, ranks: option.ranks }];
        }
      }
    }
    dp = next;
    trace = nextTrace;
  });

  let bestCost = 0;
  for (let c = 0; c <= budget; c++) if (dp[c] > dp[bestCost]) bestCost = c;
  return { spend: bestCost, points: dp[bestCost], allocation: trace[bestCost], benchReserve };
}

// ---------------------------------------------------------------------------
// Cheap-dart math
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Report
// ---------------------------------------------------------------------------

const fmt = (value, digits = 0) => (Number.isFinite(value) ? value.toFixed(digits) : '-');
const money = value => `$${fmt(value, 0)}`;

// Marginal value of the Nth body at a position, starters held fixed and extras
// bought from the cheapest band. This is the table that answers "how many RBs?".
function depthCurveFor(seasons, capture) {
  const shape = {
    QB: { base: [1, 0, 0, 0], extra: 3 },
    RB: { base: [0, 1, 1, 0, 0, 0], extra: 4 },
    WR: { base: [0, 0, 0, 0, 3, 0], extra: 4 },
    TE: { base: [0, 0, 1], extra: 2 }
  };
  const rows = [];
  Object.entries(shape).forEach(([pos, { base, extra }]) => {
    const cheapest = base.length - 1;
    let previous = null;
    for (let n = 0; n <= extra; n++) {
      const counts = [...base];
      counts[cheapest] += n;
      // Headline table, so it gets a heavier sample than the optimizer sweep.
      const evaluated = evaluatePlan(seasons, pos, counts, capture[pos], makeRandom(0xd3f7), 4000);
      if (!evaluated) continue;
      if (previous) {
        rows.push({
          pos,
          from: previous.players,
          to: evaluated.players,
          cost: evaluated.cost - previous.cost,
          points: evaluated.points - previous.points
        });
      }
      previous = evaluated;
    }
  });
  return rows;
}

// Each position priced as "buy the top" against "buy the cheap end, two deep".
function puntComparisonFor(seasons, capture) {
  const shape = {
    QB: { payBand: 0, puntBand: 3 },
    RB: { payBand: 1, puntBand: 4 },
    WR: { payBand: 1, puntBand: 4 },
    TE: { payBand: 0, puntBand: 2 }
  };
  const rows = [];
  Object.entries(shape).forEach(([pos, { payBand, puntBand }]) => {
    const slots = STARTERS[pos];
    const label = (band, count) => `${count}x ${pos}${BANDS[pos][band][0]}-${BANDS[pos][band][1]}`;

    const payCounts = BANDS[pos].map((_, i) => (i === payBand ? slots : 0));
    const puntCounts = BANDS[pos].map((_, i) => (i === puntBand ? slots + 2 : 0));
    const pay = evaluatePlan(seasons, pos, payCounts, capture[pos], makeRandom(0xb1d), 4000);
    const punt = evaluatePlan(seasons, pos, puntCounts, capture[pos], makeRandom(0xb1d), 4000);
    if (!pay || !punt) return;
    rows.push({
      pos,
      payLabel: label(payBand, slots),
      payCost: pay.cost,
      payPoints: pay.points,
      puntLabel: label(puntBand, slots + 2),
      puntCost: punt.cost,
      puntPoints: punt.points
    });
  });
  return rows;
}

function buildReport(seasons, curves, capture, rosterPlan, holdouts, champions, depthCurve, puntComparison) {
  const out = [];
  const push = (...lines) => out.push(...lines);

  const allPicks = seasons.flatMap(s => s.draft);
  const leagueAvg = {};
  POSITIONS.forEach(pos => {
    leagueAvg[pos] = mean(seasons.map(s => (s.byPosition[pos] || []).reduce((sum, p) => sum + p.salary, 0) / TEAMS));
  });

  push('# MLFF Auction: Position Value & $300 Budget Plan');
  push('');
  push(`Seasons analyzed: ${YEARS[0]}-${YEARS[YEARS.length - 1]} (${seasons.length} auctions, ${allPicks.length} roster spots, ${TEAMS} teams, $${BUDGET} cap, ${ROSTER_SIZE}-man rosters).`);
  push('');
  push(`Starting lineup: ${Object.entries(STARTERS).map(([pos, n]) => `${n} ${pos}`).join(', ')} (${STARTER_SLOTS} starters, ${BENCH_SLOTS} bench).`);
  push('');
  push('Points below are each **player\'s** season scoring total, not a fantasy team\'s score.');
  push('');
  push('## Summary');
  push('');
  const summaryRows = POSITIONS.map(pos => {
    const plan = rosterPlan.allocation.find(a => a.pos === pos);
    return { pos, plan };
  });
  push(`| Pos | League pays | This plan pays | Bodies | Where |`);
  push('|---|---|---|---|---|');
  summaryRows.forEach(({ pos, plan }) => {
    const label = plan
      ? plan.counts.map((count, i) => (count ? `${count}x ${pos}${BANDS[pos][i][0]}-${BANDS[pos][i][1]}` : null)).filter(Boolean).join(' + ')
      : '-';
    push(`| ${pos} | ${money(leagueAvg[pos])} | **${money(plan ? plan.roundedCost : 0)}** | ${plan ? plan.players : 0} | ${label} |`);
  });
  push('');
  push('Four things drive that split:');
  push('');
  push('1. **The league spends 80% of its money on RB and WR, and the top of the WR market has not paid for it.** The two most expensive receivers each year cost $81 on average and returned 93 points - a median finish of WR15. Receivers bought in the WR23-35 band cost about $12 each, and buying seven of them fields three starters every week for $82 total.');
  push('2. **QB is the widest gap between best and replacement of any position (165 points), and the market underpays it.** The elite QB costs $63 and is the only expensive tier in the league that clears its own price. The QBs priced 3rd through 6th are the trap: $38 for a median QB12 finish, which is worse than what a $10 quarterback returns.');
  push('3. **Depth is bought at the position with the most slots, not the most bodies.** Three WR slots break far more often than one QB slot, which is why the fourth and fifth receiver are worth 8-9 points each while a backup quarterback behind an elite starter is worth slightly less than nothing.');
  push('4. **If you do not buy the elite QB, punt the position entirely rather than shopping in the middle.** Three $1-3 quarterbacks return 216 points for $4; one $38 quarterback returns 205. A $1-3 QB finished top-10 in every one of the five seasons - Stafford, Cousins, Burrow, Purdy, Goff, Daniels, Maye, Williams.');
  push('');

  // --- 1. Scarcity -----------------------------------------------------------
  push('## 1. What each position is actually worth');
  push('');
  push('Points scored by the player finishing at each positional rank, averaged over the five seasons:');
  push('');
  push('| Pos | #1 | #3 | #5 | #10 | #15 | #20 | #30 | #45 | Replacement (first undrafted) |');
  push('|---|---|---|---|---|---|---|---|---|---|');
  POSITIONS.forEach(pos => {
    const at = rank => mean(seasons.map(s => pointsAtRank(s.pool, pos, rank)));
    const repl = mean(seasons.map(s => s.replacement[pos]));
    push(`| ${pos} | ${fmt(at(1))} | ${fmt(at(3))} | ${fmt(at(5))} | ${fmt(at(10))} | ${fmt(at(15))} | ${fmt(at(20))} | ${fmt(at(30))} | ${fmt(at(45))} | ${fmt(repl)} (${pos}${fmt(mean(seasons.map(s => s.drafted[pos])) + 1)}) |`);
  });
  push('');
  push('The number that drives everything is the last column. Two positions have a floor near zero and two have a floor near the ceiling:');
  push('');
  push('| Pos | Elite (#1) | Replacement | Points a stud buys you | Drafted per year |');
  push('|---|---|---|---|---|');
  const scarcity = POSITIONS.map(pos => {
    const elite = mean(seasons.map(s => pointsAtRank(s.pool, pos, 1)));
    const repl = mean(seasons.map(s => s.replacement[pos]));
    return { pos, elite, repl, gap: elite - repl, drafted: mean(seasons.map(s => s.drafted[pos])) };
  }).sort((a, b) => b.gap - a.gap);
  scarcity.forEach(row => {
    push(`| ${row.pos} | ${fmt(row.elite)} | ${fmt(row.repl)} | **${fmt(row.gap)}** | ${fmt(row.drafted)} |`);
  });
  push('');

  // --- 2. What the league pays ----------------------------------------------
  push('## 2. What the league actually pays');
  push('');
  push('Average spend per team, per position:');
  push('');
  push(`| Year | ${POSITIONS.join(' | ')} |`);
  push(`|---|${POSITIONS.map(() => '---').join('|')}|`);
  YEARS.forEach(year => {
    const season = seasons.find(s => s.year === year);
    const cells = POSITIONS.map(pos => {
      const spend = (season.byPosition[pos] || []).reduce((sum, p) => sum + p.salary, 0) / TEAMS;
      return `${money(spend)} (${fmt((spend / BUDGET) * 100)}%)`;
    });
    push(`| ${year} | ${cells.join(' | ')} |`);
  });
  push(`| **Avg** | ${POSITIONS.map(pos => `**${money(leagueAvg[pos])} (${fmt((leagueAvg[pos] / BUDGET) * 100)}%)**`).join(' | ')} |`);
  push('');

  // --- 3. Return by price tier ----------------------------------------------
  push('## 3. Return by price tier');
  push('');
  push('Price rank = the Nth most expensive player at that position in that auction. This is the only thing you know while bidding, so it is the unit that matters.');
  push('');
  POSITIONS.forEach(pos => {
    const picks = seasons.flatMap(s => s.byPosition[pos] || []);
    const maxRank = Math.max(...picks.map(p => p.priceRank));
    const bands = [[1, 2], [3, 4], [5, 6], [7, 9], [10, 13], [14, 17], [18, 23], [24, 30], [31, 40], [41, 60]]
      .filter(([lo]) => lo <= maxRank);
    push(`**${pos}**`);
    push('');
    push('| Price rank | n | Avg cost | Avg points | Median finish | Pts over replacement | Pts per $ over $1 | Bust rate |');
    push('|---|---|---|---|---|---|---|---|');
    bands.forEach(([lo, hi]) => {
      const group = picks.filter(p => p.priceRank >= lo && p.priceRank <= hi);
      if (group.length === 0) return;
      const cost = mean(group.map(p => p.salary));
      const vorp = mean(group.map(p => p.vorp));
      const finishes = group.map(p => p.finishRank).filter(Boolean);
      push(
        `| ${pos}${lo}-${hi} | ${group.length} | ${money(cost)} | ${fmt(mean(group.map(p => p.points)))} | ` +
        `${pos}${fmt(median(finishes))} | ${fmt(vorp)} | ${fmt(vorp / Math.max(cost - 1, 0.5), 1)} | ` +
        `${fmt(100 * (group.filter(p => p.vorp <= 0).length / group.length))}% |`
      );
    });
    push('');
  });

  // --- 4. Dead money ---------------------------------------------------------
  push('## 4. Where the money dies');
  push('');
  push('Each position\'s price curve against what it returned. "Surplus" is points over replacement minus what those points cost at the league\'s own average rate.');
  push('');
  const dollarsPerPoint = (() => {
    const totalSpend = allPicks.reduce((sum, p) => sum + p.salary, 0);
    const totalVorp = allPicks.reduce((sum, p) => sum + Math.max(p.vorp, 0), 0);
    return totalSpend / totalVorp;
  })();
  push(`League-wide, a point over replacement costs **${money(dollarsPerPoint * 10)} per 10 points**. Measured against that rate:`);
  push('');
  push('| Pos | Price rank | Avg cost | Pts over replacement | Fair cost at league rate | Surplus / (deficit) |');
  push('|---|---|---|---|---|---|');
  const deadMoney = [];
  POSITIONS.forEach(pos => {
    const picks = seasons.flatMap(s => s.byPosition[pos] || []);
    const maxRank = Math.max(...picks.map(p => p.priceRank));
    [[1, 2], [3, 6], [7, 13], [14, 22], [23, 35], [36, 60]].filter(([lo]) => lo <= maxRank).forEach(([lo, hi]) => {
      const group = picks.filter(p => p.priceRank >= lo && p.priceRank <= hi);
      if (group.length === 0) return;
      const cost = mean(group.map(p => p.salary));
      const vorp = mean(group.map(p => p.vorp));
      const fair = Math.max(vorp, 0) * dollarsPerPoint;
      deadMoney.push({ pos, band: `${pos}${lo}-${hi}`, cost, vorp, fair, surplus: fair - cost });
    });
  });
  deadMoney.sort((a, b) => a.surplus - b.surplus);
  deadMoney.forEach(row => {
    push(`| ${row.pos} | ${row.band} | ${money(row.cost)} | ${fmt(row.vorp)} | ${money(row.fair)} | ${row.surplus < 0 ? `**(${money(-row.surplus)})**` : `+${money(row.surplus)}`} |`);
  });
  push('');

  // --- 5. Cheap darts --------------------------------------------------------
  push('## 5. Paying up versus punting');
  push('');
  push(`Each position priced two ways, scored on the same week-by-week model as section 6: buy your starters at the top of the market, or buy two extra bodies from the cheap end and rotate whoever is healthy. Points are what the position's starting slots actually produce across a ${SEASON_WEEKS}-week season.`);
  push('');
  push('| Pos | Pay up | Cost | Points | Punt | Cost | Points | Cost of the upgrade |');
  push('|---|---|---|---|---|---|---|---|');
  puntComparison.forEach(row => {
    push(
      `| ${row.pos} | ${row.payLabel} | ${money(row.payCost)} | ${fmt(row.payPoints)} | ${row.puntLabel} | ` +
      `${money(row.puntCost)} | ${fmt(row.puntPoints)} | ${money(row.payCost - row.puntCost)} for ${row.payPoints - row.puntPoints >= 0 ? '+' : ''}${fmt(row.payPoints - row.puntPoints)} |`
    );
  });
  push('');
  push('QB is the one position where paying up survives contact with the alternative, and even there the upgrade is the most expensive point-per-dollar on the board. At WR the punt simply wins.');
  push('');

  // --- 6. Optimal budget -----------------------------------------------------
  push('## 6. Ideal $300 budget');
  push('');
  push(`### 6a. Starters only (${STARTER_SLOTS} slots, ${money(BUDGET - BENCH_SLOTS)}, ${money(BENCH_SLOTS)} held back for $1 bench filler)`);
  push('');
  const iso = optimizeBudget(curves, 'isoPoints', BENCH_SLOTS);
  const raw = optimizeBudget(curves, 'points', BENCH_SLOTS);
  push('The **conservative** column smooths each position\'s price curve so expected points never rise as price falls (isotonic fit) - it will not chase a cheap tier that happened to hit. The **raw** column uses the observed averages as-is. They agree on the shape, which is the point of running both.');
  push('');
  push('| Pos | Slots | Conservative $ | Target price ranks | Raw $ | Target price ranks | League average $ |');
  push('|---|---|---|---|---|---|---|');
  POSITIONS.forEach(pos => {
    const isoRow = iso.allocation.find(a => a.pos === pos) || { spend: 0, ranks: [] };
    const rawRow = raw.allocation.find(a => a.pos === pos) || { spend: 0, ranks: [] };
    const label = ranks => (ranks.length ? ranks.map(r => `${pos}${r}`).join(', ') : '-');
    push(`| ${pos} | ${STARTERS[pos]} | **${money(isoRow.spend)}** | ${label(isoRow.ranks)} | ${money(rawRow.spend)} | ${label(rawRow.ranks)} | ${money(leagueAvg[pos])} |`);
  });
  push(`| **Starters** | ${STARTER_SLOTS} | **${money(iso.spend)}** | | ${money(raw.spend)} | | ${money(Object.values(leagueAvg).reduce((a, b) => a + b, 0) - BENCH_SLOTS)} |`);
  push(`| Bench | ${BENCH_SLOTS} | ${money(BENCH_SLOTS)} | $1 darts | ${money(BENCH_SLOTS)} | $1 darts | |`);
  push('');

  push(`### 6b. Whole roster (${ROSTER_SIZE} spots, ${money(BUDGET)})`);
  push('');
  push(`The bench is not filler - it is insurance, and whether it is worth buying depends on how often the starter in front of it is missing. This run optimizes all sixteen spots at once and scores every plan week by week: each drawn player is available in a given week with probability (games played / ${SEASON_WEEKS}), the best available fill the starting slots at their per-game rate, and any slot left open falls back to a waiver pickup at replacement level. A rostered player who is worse than the wire never gets started.`);
  push('');
  push(`Depth is credited at the rate the league actually converts it. Comparing Active FPTS against each roster's best-case lineup over 2021-2023, managers captured ${POSITIONS.filter(p => p !== 'K' && p !== 'DST').map(p => `${fmt(100 * capture[p])}% at ${p}`).join(', ')}. An extra body is only worth the share of its upside you actually start.`);
  push('');
  push('What each additional body is worth, holding the starters fixed and adding from the cheapest band:');
  push('');
  push('| Pos | Bodies | Marginal cost | Marginal points |');
  push('|---|---|---|---|');
  depthCurve.forEach(row => {
    push(`| ${row.pos} | ${row.from} -> ${row.to} | ${money(row.cost)} | ${row.points >= 0 ? '+' : ''}${fmt(row.points, 1)} |`);
  });
  push('');
  push('Those numbers are the honest scale of the bench question: single digits per season against a roster that scores over a thousand. The first spare receiver is worth real points because three WR slots break more often than one; a third quarterback behind an elite starter is worth less than nothing, because it is a roster spot spent on someone who will not play. Everything in between is close enough to zero that roster feel should win the argument.');
  push('');
  push('| Pos | Players | $ | Where to buy them | Expected starter points |');
  push('|---|---|---|---|---|');
  rosterPlan.allocation.forEach(plan => {
    const label = plan.counts
      .map((count, i) => (count ? `${count}x ${plan.pos}${BANDS[plan.pos][i][0]}-${BANDS[plan.pos][i][1]}` : null))
      .filter(Boolean)
      .join(' + ');
    push(`| ${plan.pos} | ${plan.players} | **${money(plan.roundedCost)}** | ${label} | ${fmt(plan.points)} |`);
  });
  push(`| **Total** | ${rosterPlan.allocation.reduce((sum, p) => sum + p.players, 0)} | **${money(rosterPlan.spend)}** | | **${fmt(rosterPlan.points)}** |`);
  push('');
  push('For reference, the league\'s own average allocation run through the same evaluator:');
  push('');
  push(`| Pos | ${POSITIONS.join(' | ')} |`);
  push(`|---|${POSITIONS.map(() => '---').join('|')}|`);
  push(`| Optimizer | ${POSITIONS.map(pos => money((rosterPlan.allocation.find(a => a.pos === pos) || {}).roundedCost || 0)).join(' | ')} |`);
  push(`| League average | ${POSITIONS.map(pos => money(leagueAvg[pos])).join(' | ')} |`);
  push(`| Difference | ${POSITIONS.map(pos => {
    const diff = ((rosterPlan.allocation.find(a => a.pos === pos) || {}).roundedCost || 0) - leagueAvg[pos];
    return diff >= 0 ? `+${money(diff)}` : `-${money(-diff)}`;
  }).join(' | ')} |`);
  push('');

  push('### 6c. Does the plan hold up out of sample?');
  push('');
  push('Each row refits the optimizer with one season removed, so that season never informs the plan built for it.');
  push('');
  push(`| Season held out | ${POSITIONS.join(' | ')} |`);
  push(`|---|${POSITIONS.map(() => '---').join('|')}|`);
  holdouts.forEach(({ year, plan }) => {
    push(`| ${year} | ${POSITIONS.map(pos => {
      const row = plan.allocation.find(a => a.pos === pos);
      return row ? `${money(row.roundedCost)} (${row.players})` : '-';
    }).join(' | ')} |`);
  });
  push('');

  // --- 7. Target list --------------------------------------------------------
  push('## 7. Draft-day target list');
  push('');
  push('Price rank translated back into dollars, so it is usable while bidding. "Going rate" is the range of winning bids that landed in each band across the five auctions.');
  push('');
  push('| Buy | Price rank | Going rate | Avg points | Median finish | Verdict |');
  push('|---|---|---|---|---|---|');
  const targets = [
    { pos: 'QB', lo: 1, hi: 2, verdict: 'Buy, but only the top of the market. The gap to a replacement QB is the biggest at any position.' },
    { pos: 'QB', lo: 14, hi: 21, verdict: 'The punt. Three of these return 216 points for $4. Buy them only if you lose QB1-2 - behind an elite starter a backup QB is worth less than the roster spot.' },
    { pos: 'QB', lo: 3, hi: 6, verdict: 'Avoid. Costs like a starter, finishes like a streamer.' },
    { pos: 'RB', lo: 3, hi: 6, verdict: 'Buy both starters here. Best points-per-dollar of any expensive tier.' },
    { pos: 'RB', lo: 1, hi: 2, verdict: 'Avoid. Same money, worse return, and the two worst busts of the five years.' },
    { pos: 'RB', lo: 14, hi: 22, verdict: 'Avoid. The middle class returns barely more than the $5 tier.' },
    { pos: 'RB', lo: 23, hi: 35, verdict: 'Buy one or two behind your starters. Same points as the $28 tier at a quarter the price.' },
    { pos: 'WR', lo: 23, hi: 35, verdict: 'Buy five to seven. This is the whole WR plan - three slots break often, so bodies here are the best-value depth on the board.' },
    { pos: 'WR', lo: 1, hi: 2, verdict: 'Avoid. The single largest overpay in the league.' },
    { pos: 'WR', lo: 14, hi: 22, verdict: 'Avoid. Costs double the WR23-35 tier for fewer points.' },
    { pos: 'TE', lo: 7, hi: 15, verdict: 'Buy two. The second is worth 6 points, the third only 4 - and you would stream over him by October anyway.' },
    { pos: 'TE', lo: 1, hi: 2, verdict: 'Avoid unless it goes cheap. Worst points-per-dollar of any tier over $20.' },
    { pos: 'K', lo: 1, hi: 2, verdict: 'Buy. Costs $4 and is the only place a few dollars still moves the needle.' },
    { pos: 'DST', lo: 1, hi: 2, verdict: 'Buy. Same logic, $3.' }
  ];
  targets.forEach(target => {
    const group = seasons.flatMap(s => (s.byPosition[target.pos] || [])
      .filter(p => p.priceRank >= target.lo && p.priceRank <= target.hi));
    const salaries = group.map(p => p.salary);
    const finishes = group.map(p => p.finishRank).filter(Boolean);
    const verb = target.verdict.startsWith('Avoid') ? 'Avoid' : 'Target';
    push(
      `| ${verb} | **${target.pos}${target.lo}-${target.hi}** | ${money(Math.min(...salaries))}-${money(Math.max(...salaries))} ` +
      `(avg ${money(mean(salaries))}) | ${fmt(mean(group.map(p => p.points)))} | ${target.pos}${fmt(median(finishes))} | ${target.verdict} |`
    );
  });
  push('');

  // --- 8. Sanity checks ------------------------------------------------------
  push('## 8. Sanity checks and caveats');
  push('');
  const teamRecords = [];
  seasons.forEach(season => {
    const teams = {};
    season.draft.forEach(pick => {
      const key = normalizeTeam(pick.team === '(unnamed)' ? '' : pick.team);
      (teams[key] = teams[key] || []).push(pick);
    });
    Object.entries(teams).forEach(([key, picks]) => {
      const standing = season.standings ? season.standings[key] : null;
      if (!standing) return;
      const spend = {};
      POSITIONS.forEach(pos => {
        spend[pos] = picks.filter(p => p.pos === pos).reduce((sum, p) => sum + p.salary, 0);
      });
      const active = picks.every(p => p.activePoints !== null)
        ? picks.reduce((sum, p) => sum + p.activePoints, 0)
        : null;
      teamRecords.push({
        year: season.year,
        team: key,
        spend,
        wins: standing.wins + 0.5 * standing.ties,
        pointsFor: standing.pointsFor,
        rosterPoints: picks.reduce((sum, p) => sum + p.points, 0),
        rosterVorp: picks.reduce((sum, p) => sum + p.vorp, 0),
        active
      });
    });
  });

  push('Champions did not share a blueprint. Title-winning draft-day allocations, 2021-2025:');
  push('');
  push(`| Year | Champion | ${POSITIONS.join(' | ')} |`);
  push(`|---|---|${POSITIONS.map(() => '---').join('|')}|`);
  champions.forEach(champ => {
    push(`| ${champ.year} | ${champ.team} | ${POSITIONS.map(pos => `${money(champ.spend[pos])} (${champ.counts[pos]})`).join(' | ')} |`);
  });
  push(`| | **Champion avg** | ${POSITIONS.map(pos => `**${money(mean(champions.map(c => c.spend[pos])))}**`).join(' | ')} |`);
  push(`| | League avg | ${POSITIONS.map(pos => money(leagueAvg[pos])).join(' | ')} |`);
  push('');
  push('That table is the strongest caveat in this document. Over six titles the winning allocation averages out to roughly the league average, and the two most recent champions sat at opposite extremes. Five auctions is not enough for allocation alone to separate winners; the tier edges in section 7 are expected-value edges, not a formula for a title.');
  push('');
  push('The second strongest caveat is section 6c. Holding out 2021, 2022 or 2023 leaves the plan intact at roughly $150 on two RBs and $60 on six WRs, but holding out either 2024 or 2025 flips it to about $100 on RB and $122 on WR. The RB-heavy, WR-wide split leans on the two most recent seasons, in which the top of the RB market finally paid (Barkley, Henry, Gibbs, Taylor) after three years of not paying. Everything that survives all five refits - six WRs rather than three expensive ones, a cheap TE room, minimum K and DST - is on much firmer ground than the exact RB/WR dollar split.');
  push('');

  const activeTeams = teamRecords.filter(t => t.active !== null);
  push(`- Draft-day rosters explain only part of a season. Across ${activeTeams.length} team-seasons with Active FPTS (2021-2023), points earned by drafted players in starting lineups averaged **${fmt(100 * mean(activeTeams.map(t => t.active / t.pointsFor)))}%** of the team's actual points for. The rest came from in-season pickups and trades, so no draft plan is worth more than roughly two-thirds of the season.`);
  push(`- Roster quality does show up in the standings: correlation between a roster's total player points and the team's points for is **${fmt(correlation(teamRecords.map(t => t.rosterPoints), teamRecords.map(t => t.pointsFor)), 2)}** (n=${teamRecords.length}).`);
  push('- Positional spend and results, across the same 50 team-seasons:');
  push('');
  push('| Pos | Avg spend | Corr. with points for | Corr. with wins |');
  push('|---|---|---|---|');
  POSITIONS.forEach(pos => {
    const xs = teamRecords.map(t => t.spend[pos]);
    push(
      `| ${pos} | ${money(mean(xs))} | ${fmt(correlation(xs, teamRecords.map(t => t.pointsFor)) || 0, 2)} | ` +
      `${fmt(correlation(xs, teamRecords.map(t => t.wins)) || 0, 2)} |`
    );
  });
  push('');
  push(`- Sample size is five auctions. Per price rank that is five observations, widened to fifteen by the +/-1 rank window. Treat single-rank numbers as directional and tier-level numbers as meaningful.`);
  push(`- 2024 and 2025 have no Active FPTS, so those two seasons contribute player totals only.`);
  push(`- Price-rank averages assume you can buy at the going rate. If the room bids differently than it has for five years, the tiers move.`);
  push('');

  return out.join('\n');
}

// ---------------------------------------------------------------------------

// data/champions.json holds the title winners; pair each with its draft.
function loadChampions(seasons) {
  const file = path.join(process.cwd(), 'data', 'champions.json');
  if (!fs.existsSync(file)) return [];
  const entries = JSON.parse(fs.readFileSync(file, 'utf-8'));
  const out = [];
  entries.forEach(entry => {
    const season = seasons.find(s => s.year === entry.year);
    if (!season) return;
    entry.teams.forEach(team => {
      const key = normalizeTeam(team);
      const picks = season.draft.filter(p => normalizeTeam(p.team === '(unnamed)' ? '' : p.team) === key);
      if (picks.length === 0) return;
      const spend = {};
      const counts = {};
      POSITIONS.forEach(pos => {
        const group = picks.filter(p => p.pos === pos);
        spend[pos] = group.reduce((sum, p) => sum + p.salary, 0);
        counts[pos] = group.length;
      });
      out.push({ year: entry.year, team, spend, counts });
    });
  });
  return out.sort((a, b) => a.year - b.year);
}

function main() {
  const seasons = loadSeasons();
  const curves = {};
  POSITIONS.forEach(pos => {
    curves[pos] = withIsotonic(priceRankCurve(seasons, pos));
  });

  const capture = captureRates(seasons);
  const rosterPlan = optimizeRoster(seasons, capture);

  // Leave-one-season-out: refit the plan without each season in turn.
  const holdouts = YEARS.map(year => ({
    year,
    plan: optimizeRoster(seasons.filter(s => s.year !== year), capture)
  }));

  const champions = loadChampions(seasons);
  const depthCurve = depthCurveFor(seasons, capture);
  const puntComparison = puntComparisonFor(seasons, capture);
  const report = buildReport(seasons, curves, capture, rosterPlan, holdouts, champions, depthCurve, puntComparison);

  if (process.argv.includes('--stdout')) {
    process.stdout.write(report);
    return;
  }

  const outDir = path.join(process.cwd(), 'docs');
  fs.mkdirSync(outDir, { recursive: true });
  const outFile = path.join(outDir, 'auction-position-analysis.md');
  fs.writeFileSync(outFile, report);
  console.log(`Wrote ${path.relative(process.cwd(), outFile)}`);
}

main();
