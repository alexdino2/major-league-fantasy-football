/**
 * Builds data/history/league.json for the website's history pages from the raw
 * files in data/yearly-stats plus the league-curated data/champions.json.
 *
 *   node scripts/build-history-site.js
 *
 * One-time / re-runnable: it only reads the CSVs and rewrites the JSON. It prints
 * every data problem it finds as a WARN line so gaps are visible
 * (see docs/history-data-gaps.md).
 */

const fs = require('fs')
const path = require('path')
const { FRANCHISES, franchiseFor, norm } = require('./lib/franchises')

const ROOT = process.cwd()
const STATS = path.join(ROOT, 'data', 'yearly-stats')
const OUT_DIR = path.join(ROOT, 'data', 'history')
const FIRST_YEAR = 1994
const LAST_YEAR = 2025
const POSTSEASON_WEEK = 17 // week 17 is championship / placement week in every season with weekly data
// Week 18 (2021 on) is the league's All-Star game, not part of the championship.
// It is left out of every record, per the commissioner and Brad.
const ALL_STAR_WEEK = 18

// 2001 only exists in the pre-CBS sheet, which still uses the old name; CBS calls the franchise
// Munich Cowboys in both 2000 and 2002, so use that for 2001 as well.
const NAME_OVERRIDES = { 2001: { 'Italian Stallions': 'Munich Cowboys' } }

const warnings = []
const warn = (msg) => {
  warnings.push(msg)
  console.warn('WARN', msg)
}

// ---------- CSV ----------
function parseCsv(text) {
  const rows = []
  let row = []
  let cell = ''
  let q = false
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (q) {
      if (c === '"' && text[i + 1] === '"') { cell += '"'; i++ }
      else if (c === '"') q = false
      else cell += c
    } else if (c === '"') q = true
    else if (c === ',') { row.push(cell); cell = '' }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++
      row.push(cell); rows.push(row); row = []; cell = ''
    } else cell += c
  }
  if (cell !== '' || row.length) { row.push(cell); rows.push(row) }
  return rows.filter((r) => r.some((x) => x !== ''))
}
const readCsv = (file) => (fs.existsSync(file) ? parseCsv(fs.readFileSync(file, 'utf-8')) : null)
function readCsvObjects(file) {
  const rows = readCsv(file)
  if (!rows) return null
  const [head, ...body] = rows
  return body.map((r) => Object.fromEntries(head.map((h, i) => [h, r[i] ?? ''])))
}
const num = (v) => (v === undefined || v === null || v === '' ? null : Number(v))
const round = (v, d = 1) => (v === null || v === undefined ? null : Math.round(v * 10 ** d) / 10 ** d)

function fid(name, ctx) {
  const f = franchiseFor(name)
  if (!f) warn(`Unknown team name "${name}" (${ctx})`)
  return f ? f.id : `unknown:${norm(name)}`
}

// ---------- Sources ----------
function loadPreCbs() {
  const rows = readCsvObjects(path.join(STATS, 'historicaldata.csv'))
  const byYear = {}
  for (const r of rows) {
    const y = Number(r.Year)
    ;(byYear[y] ||= []).push({
      name: r.FantasyTeamName.trim(),
      division: r.Division ? r.Division.trim() : null,
      W: num(r.Wins), L: num(r.Losses), T: num(r.Ties) || 0,
      PF: num(r.PointsFor), PA: num(r.PointsAgainst),
      max: num(r.Max), min: num(r.Min),
      finalRank: num(r.FinalRank),
      weeksWon: num(r.WeeksWon),
      winnings: num(r.Winnings),
    })
  }
  return byYear
}

function loadCbsStandings(year) {
  const rows = readCsv(path.join(STATS, `standings_${year}.csv`))
  if (!rows) return null
  const teams = []
  let division = null
  for (let r of rows) {
    if (r.length === 1 || /DIVISION$/i.test(r[0])) {
      division = r[0].replace(/\s*DIVISION$/i, '').trim()
      division = division.charAt(0) + division.slice(1).toLowerCase()
      continue
    }
    if (r[0] === 'TEAM') continue
    // Unquoted team names containing a comma ("My hate for you, it grow") spill into an extra column.
    if (r.length > 8) r = [r.slice(0, r.length - 7).join(','), ...r.slice(r.length - 7)]
    teams.push({
      name: r[0].trim(), division,
      W: num(r[1]), L: num(r[2]), T: num(r[3]) || 0,
      PF: num(r[5]), PA: num(r[6]), weeksWon: num(r[7]),
    })
  }
  return teams
}

// Scores recovered by hand (e.g. from league recap articles) for weeks the CBS export lost.
// They fill a week only when the export has no real game for that week, so a re-scrape can't wipe them.
const MANUAL_WEEKLY = readCsvObjects(path.join(STATS, 'manual_weekly_results.csv')) || []

function loadWeekly(year) {
  let rows = readCsvObjects(path.join(STATS, `weekly_results_${year}.csv`))
  if (!rows) return null
  const manual = MANUAL_WEEKLY.filter((r) => Number(r.year) === year)
  const manualWeeks = new Set(manual.map((r) => r.week))
  for (const w of manualWeeks) {
    if (rows.some((r) => r.week === w && r.away_team !== 'TBA' && r.home_team !== 'TBA')) {
      warn(`${year}: week ${w} has real games in the CBS export; manual scores for it are ignored`)
      continue
    }
    rows = rows.filter((r) => r.week !== w).concat(manual.filter((r) => r.week === w))
    warn(`${year}: week ${w} filled from manual_weekly_results.csv`)
  }
  const games = []
  let tba = 0
  for (const r of rows) {
    if (r.away_team === 'TBA' || r.home_team === 'TBA') { tba++; continue }
    games.push({
      week: Number(r.week),
      away: fid(r.away_team, `weekly ${year}`), awayName: r.away_team,
      home: fid(r.home_team, `weekly ${year}`), homeName: r.home_team,
      awayPts: Number(r.away_result), homePts: Number(r.home_result),
    })
  }
  return { games, tba }
}

function loadBracket(year) {
  const rows = readCsvObjects(path.join(STATS, `playoff_bracket_${year}.csv`))
  if (!rows) return null
  return rows.map((r) => ({
    slot: Number(r.matchup_id.split('_').pop()),
    top: fid(r.top_team, `bracket ${year}`), topPts: Number(r.top_score),
    bottom: fid(r.bottom_team, `bracket ${year}`), bottomPts: Number(r.bottom_score),
  })).sort((a, b) => a.slot - b.slot)
}

function loadChampions() {
  const champs = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'champions.json'), 'utf-8'))
  const out = {}
  for (const c of champs) out[c.year] = c.teams.map((t) => fid(t, `champions.json ${c.year}`))
  return out
}

// ---------- Auctions ----------
const POS_RE = /\s+(QB|RB|WR|TE|K|DST|DEF|D\/ST)\s*•.*$/
function parsePlayer(raw) {
  const s = raw.replace(/\s+/g, ' ').trim()
  const m = s.match(/^(.*?)\s+(QB|RB|WR|TE|K|DST|DEF)\s*•\s*([A-Z]{2,3})?\s*$/)
  if (m) return { player: m[1].trim(), pos: m[2] === 'DEF' ? 'DST' : m[2], nflTeam: m[3] || null }
  // Kickers/defenses sometimes come without a position token: "Rob Bironas •"
  return { player: s.replace(/\s*•.*$/, '').trim(), pos: null, nflTeam: null }
}

function loadAuction(year, seasonTeams) {
  let rows = readCsvObjects(path.join(STATS, `draft_results_${year}.csv`))
  if (!rows) return null
  // 2010-2011 exports are shifted one column: Team, "/", Team, Player, Salary
  if (rows.length && rows.every((r) => r.POS === '/')) {
    rows = rows.map((r) => ({ ...r, Player: r.Salary, Salary: r.ELIG, ELIG: '' }))
  }
  if (!rows.some((r) => num(r.Salary) !== null && num(r.Salary) > 0)) {
    return { year, format: 'snake', note: 'Snake draft or unreadable export: no salaries in the file.' }
  }
  const groups = []
  for (const r of rows) {
    const label = r.Team.trim()
    let g = groups[groups.length - 1]
    if (!g || g.label !== label) { g = { label, picks: [] }; groups.push(g) }
    g.picks.push(r)
  }
  // Labeled groups are UPPERCASE team names. The first group has no real label (blank, or
  // "Munich Cowboys" written in by scripts/fix-munich-cowboys.js). It belongs to whichever
  // season team has no labeled group.
  const labeled = new Set()
  for (const g of groups) {
    if (g.label && g.label === g.label.toUpperCase()) {
      const f = franchiseFor(g.label)
      if (f) labeled.add(f.id)
    }
  }
  const missing = seasonTeams.filter((t) => !labeled.has(t))
  const picks = []
  for (const g of groups) {
    let team
    if (g.label && g.label === g.label.toUpperCase()) team = fid(g.label, `draft ${year}`)
    else if (missing.length === 1) team = missing[0]
    else {
      team = null
      warn(`Draft ${year}: ${g.picks.length} picks in an unlabeled group could not be assigned (teams without a group: ${missing.join(', ') || 'none'})`)
    }
    if (g.label === 'Munich Cowboys' && team && team !== 'munich-cowboys') {
      warn(`Draft ${year}: first group was labeled "Munich Cowboys" by fix-munich-cowboys.js but belongs to ${team}`)
    }
    for (const r of g.picks) {
      const p = parsePlayer(r.Player)
      const pos = (r.ELIG && r.ELIG.trim()) || p.pos || (r.POS && /^(QB|RB|WR|TE|K|DST)$/.test(r.POS) ? r.POS : null)
      picks.push({
        team, player: p.player, pos: pos === 'DEF' ? 'DST' : pos, nflTeam: p.nflTeam,
        salary: num(r.Salary) || 0,
        fpts: num(r['Total FPTS']),
      })
    }
  }
  const total = picks.reduce((s, p) => s + p.salary, 0)
  const byPos = {}
  for (const p of picks) {
    const k = p.pos || '?'
    byPos[k] ||= { spend: 0, count: 0 }
    byPos[k].spend += p.salary
    byPos[k].count++
  }
  const hasPts = picks.some((p) => p.fpts !== null)
  const sorted = [...picks].sort((a, b) => b.salary - a.salary)
  const byTeam = {}
  for (const p of picks) if (p.team) (byTeam[p.team] ||= { spend: 0, count: 0, fpts: 0 }), byTeam[p.team].spend += p.salary, byTeam[p.team].count++, byTeam[p.team].fpts += p.fpts || 0
  return {
    year,
    format: 'auction',
    totalSpend: total,
    picks: picks.length,
    hasPoints: hasPts,
    positionSpend: Object.fromEntries(Object.entries(byPos).map(([k, v]) => [k, { ...v, share: round(v.spend / total, 3) }])),
    topBuys: sorted.slice(0, 15),
    allPicks: picks,
    teamSpend: byTeam,
    bestValues: hasPts
      ? [...picks].filter((p) => p.fpts !== null && p.salary <= 10).sort((a, b) => b.fpts - a.fpts).slice(0, 10)
      : [],
    busts: hasPts
      ? sorted.slice(0, 30).filter((p) => p.fpts !== null).sort((a, b) => a.fpts / a.salary - b.fpts / b.salary).slice(0, 8)
      : [],
  }
}

// ---------- Build ----------
function main() {
  const preCbs = loadPreCbs()
  const champions = loadChampions()
  // League-provided context for a season (data/season-notes.json), shown on that season's page.
  const seasonNotes = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'season-notes.json'), 'utf-8'))
  const seasons = []
  const allGames = []

  for (let year = FIRST_YEAR; year <= LAST_YEAR; year++) {
    const notes = []
    const cbs = loadCbsStandings(year)
    const pre = preCbs[year]
    const source = cbs ? 'cbs' : pre ? 'pre-cbs' : null
    if (!source) {
      warn(`${year}: no standings in any file`)
      seasons.push({ year, source: null, teams: [], notes: ['No standings on file for this season.'] })
      continue
    }

    // Base standings
    const teams = (cbs || pre).map((t) => ({ franchise: fid(t.name, `standings ${year}`), ...t, name: NAME_OVERRIDES[year]?.[t.name] || t.name }))
    if (cbs && pre) {
      // Bring pre-CBS-only columns (final rank, max/min, winnings) across and check the two sources agree.
      for (const t of teams) {
        const p = pre.find((x) => franchiseFor(x.name)?.id === t.franchise)
        if (!p) { warn(`${year}: ${t.name} is in CBS standings but not in the pre-CBS sheet`); continue }
        Object.assign(t, { max: p.max, min: p.min, finalRank: p.finalRank, winnings: p.winnings, altName: p.name !== t.name ? p.name : undefined })
        if (p.W !== t.W || p.L !== t.L || p.PF !== t.PF) {
          warn(`${year}: ${t.name} CBS ${t.W}-${t.L} ${t.PF} PF vs pre-CBS sheet ${p.W}-${p.L} ${p.PF} PF`)
        }
      }
    }
    if (!cbs && pre) {
      for (const t of teams) {
        if (t.PA === null) t.PA = undefined
      }
      if (pre.some((t) => t.PA === null)) notes.push('Points against were not recorded this season.')
    }

    // Weekly results
    const weekly = loadWeekly(year)
    let bracket = loadBracket(year)
    let games = []
    let playoff = null
    if (weekly) {
      const allStar = weekly.games.filter((g) => g.week >= ALL_STAR_WEEK)
      games = weekly.games.filter((g) => g.week < ALL_STAR_WEEK).map((g) => ({ ...g, year, post: g.week >= POSTSEASON_WEEK }))
      if (allStar.length || year >= 2021) notes.push('Week 18 is the All-Star game and is not counted in any record.')
      // Some bracket exports captured the All-Star game instead of week 17; drop those matchups.
      if (bracket) {
        const isAllStar = (b) => allStar.some((g) => (g.away === b.top && g.home === b.bottom && g.awayPts === b.topPts && g.homePts === b.bottomPts) || (g.home === b.top && g.away === b.bottom && g.homePts === b.topPts && g.awayPts === b.bottomPts))
        const kept = bracket.filter((b) => !isAllStar(b))
        if (kept.length !== bracket.length) warn(`${year}: dropped ${bracket.length - kept.length} bracket matchup(s) that are the week-18 All-Star game`)
        bracket = kept.length ? kept : null
      }
      const reg = games.filter((g) => !g.post)
      const regWeeks = new Set(reg.map((g) => g.week))
      if (regWeeks.size !== 16) warn(`${year}: ${regWeeks.size} regular-season weeks in weekly results`)
      if (!games.some((g) => g.week === POSTSEASON_WEEK)) {
        warn(`${year}: week ${POSTSEASON_WEEK} games are missing (only TBA placeholders)`)
        notes.push(`Week ${POSTSEASON_WEEK} scores (the championship and placement games) are missing from the CBS export.`)
      }

      // Regular-season record from the games themselves
      const rec = {}
      for (const t of teams) rec[t.franchise] = { W: 0, L: 0, T: 0, PF: 0, PA: 0, high: 0, low: Infinity, weeksWon: 0 }
      for (const g of reg) {
        for (const [me, op, mp, opp] of [[g.away, g.home, g.awayPts, g.homePts], [g.home, g.away, g.homePts, g.awayPts]]) {
          const r = rec[me]
          if (!r) { warn(`${year}: ${me} plays in week ${g.week} but is not in standings`); continue }
          r.PF += mp; r.PA += opp
          r.high = Math.max(r.high, mp); r.low = Math.min(r.low, mp)
          if (mp > opp) r.W++; else if (mp < opp) r.L++; else r.T++
        }
      }
      // weekly high score (ties split)
      for (const w of regWeeks) {
        const scores = reg.filter((g) => g.week === w).flatMap((g) => [[g.away, g.awayPts], [g.home, g.homePts]])
        const top = Math.max(...scores.map((s) => s[1]))
        const winners = scores.filter((s) => s[1] === top)
        for (const [t] of winners) if (rec[t]) rec[t].weeksWon += 1 / winners.length
      }
      for (const t of teams) {
        const r = rec[t.franchise]
        if (r.W + r.L + r.T === t.W + t.L + t.T && (r.W !== t.W || r.L !== t.L || r.T !== t.T || Math.abs(r.PF - t.PF) > 0.5)) {
          warn(`${year}: ${t.name} standings ${t.W}-${t.L}-${t.T} ${t.PF} vs weekly ${r.W}-${r.L}-${r.T} ${r.PF}`)
        }
        t.official = { W: t.W, L: t.L, T: t.T, PF: t.PF, PA: t.PA }
        Object.assign(t, { W: r.W, L: r.L, T: r.T, PF: round(r.PF), PA: round(r.PA), max: r.high, min: r.low === Infinity ? null : r.low, weeksWon: round(r.weeksWon, 1) })
      }
      if (teams.some((t) => t.official.W + t.official.L + t.official.T !== t.W + t.L + t.T)) {
        notes.push('CBS counted the week-17 postseason game in its standings for this season; records here are weeks 1-16 only, and week 17 is shown under Postseason.')
      }

      // Postseason
      const post = games.filter((g) => g.post)
      const findGame = (week, a, b) => post.find((g) => g.week === week && ((g.away === a && g.home === b) || (g.away === b && g.home === a)))
      const pts = (g, t) => (!g ? null : g.away === t ? g.awayPts : g.homePts)
      // The final is the week-17 game in bracket slot 1. Without a bracket file, it is the
      // week-17 game the champion (or both co-champions) played.
      let finalPair = null
      const champIds = champions[year] || []
      if (bracket && bracket.length) finalPair = [bracket[0].top, bracket[0].bottom]
      else if (champIds.length) {
        const g = post.find((x) => x.week === POSTSEASON_WEEK && (champIds.length > 1
          ? champIds.includes(x.away) && champIds.includes(x.home)
          : x.away === champIds[0] || x.home === champIds[0]))
        if (g) finalPair = [g.away, g.home]
      }

      const placements = {}
      const placementGames = []
      if (bracket) {
        for (const b of bracket) {
          const g17 = findGame(17, b.top, b.bottom)
          if (!g17) warn(`${year}: bracket game ${b.top} v ${b.bottom} not found in week 17`)
          else if (pts(g17, b.top) !== b.topPts || pts(g17, b.bottom) !== b.bottomPts) warn(`${year}: bracket score mismatch for slot ${b.slot}`)
        }
      }
      let final = null
      if (finalPair) {
        const [a, b] = finalPair
        const g = findGame(POSTSEASON_WEEK, a, b)
        if (g) {
          const winner = pts(g, a) > pts(g, b) ? a : b
          const loser = winner === a ? b : a
          final = {
            format: 'single game',
            legs: [{ week: g.week, [a]: pts(g, a), [b]: pts(g, b) }],
            teams: [a, b],
            score: { [a]: pts(g, a), [b]: pts(g, b) },
            winner, loser,
            complete: true,
          }
          placements[winner] = 1
          placements[loser] = 2
        }
      }
      // Consolation / placement games from the bracket order (slot k decides places 2k-1 and 2k)
      if (bracket) {
        for (const b of bracket) {
          if (b.slot === 1) continue
          const g = findGame(17, b.top, b.bottom)
          if (!g) continue
          const w = pts(g, b.top) > pts(g, b.bottom) ? b.top : pts(g, b.top) < pts(g, b.bottom) ? b.bottom : null
          if (w) {
            placements[w] = 2 * b.slot - 1
            placements[w === b.top ? b.bottom : b.top] = 2 * b.slot
          } else {
            // tied placement game: both teams share the higher place
            placements[b.top] = placements[b.bottom] = 2 * b.slot - 1
          }
        }
      }
      for (const g of post) {
        const isFinal = final && final.teams.includes(g.away) && final.teams.includes(g.home)
        placementGames.push({ ...g, kind: isFinal ? 'final' : 'placement' })
      }
      if (!bracket) {
        notes.push(year >= 2021 && year <= 2021 ? "This season's CBS bracket export only holds the All-Star game, so placement order below 2nd is unknown." : 'No playoff bracket export for this season, so placement order below 2nd is unknown.')
        warn(`${year}: no playoff bracket file`)
      } else if (bracket.length < 5) {
        notes.push(`The bracket export only has ${bracket.length} of 5 placement games; places below ${bracket.length * 2} are unknown.`)
        warn(`${year}: bracket only has ${bracket.length} matchups`)
      }
      playoff = { final, games: placementGames }
      for (const t of teams) t.finish = placements[t.franchise] ?? null
    } else {
      notes.push('No week-by-week results on file for this season.')
      for (const t of teams) t.finish = t.finalRank ?? null
    }

    // Regular-season rank (win pct, then points for)
    const ranked = [...teams].sort((a, b) => pct(b) - pct(a) || b.PF - a.PF)
    ranked.forEach((t, i) => (t.regRank = i + 1))

    // Champion: the league's own list is authoritative; compare with what the games say.
    const champ = champions[year] || []
    if (!champ.length) warn(`${year}: no champion in champions.json`)
    if (playoff?.final && champ.length === 1 && playoff.final.winner !== champ[0]) {
      warn(`${year}: champions.json says ${champ[0]} but the final score says ${playoff.final.winner}`)
      notes.push('The final score in the CBS export does not match the champion in the league record; the league record is shown.')
    }
    // League-provided context goes first; the generic co-title line only when the league gave no reason.
    const curated = seasonNotes[year] || []
    if (champ.length > 1 && !curated.length) notes.push('Co-championship: the title was shared (½ title each).')
    // Drop the generic missing-week-17 line when the league note already explains it.
    if (curated.some((n) => /week 17/i.test(n))) {
      const i = notes.findIndex((n) => n.startsWith('Week 17 scores'))
      if (i >= 0) notes.splice(i, 1)
    }
    notes.unshift(...curated)
    for (const t of teams) {
      if (champ.includes(t.franchise)) t.finish = 1
      else if (t.finish === 1) t.finish = 2
    }
    let runnerUp = null
    if (champ.length === 1) {
      if (playoff?.final) runnerUp = playoff.final.teams.find((t) => t !== champ[0]) || null
      else runnerUp = teams.find((t) => t.finalRank === 2)?.franchise || null
    }

    // Auction
    const auction = loadAuction(year, teams.map((t) => t.franchise))

    seasons.push({
      year,
      source,
      teamCount: teams.length,
      divisions: [...new Set(teams.map((t) => t.division).filter(Boolean))],
      teams,
      champion: champ,
      runnerUp,
      playoff,
      hasWeekly: Boolean(weekly),
      games: games.filter((g) => !g.post),
      auction: auction && auction.format === 'auction' ? { ...auction, allPicks: undefined } : auction,
      notes,
    })
    allGames.push(...games)
    if (auction?.allPicks) allPicksAll.push(...auction.allPicks.map((p) => ({ ...p, year })))
  }

  // ---------- Franchise roll-up ----------
  const franchises = FRANCHISES.map((f) => {
    const rows = []
    for (const s of seasons) {
      const t = s.teams.find((x) => x.franchise === f.id)
      if (!t) continue
      rows.push({
        year: s.year, name: t.name, division: t.division,
        W: t.W, L: t.L, T: t.T, PF: t.PF, PA: t.PA ?? null,
        regRank: t.regRank, finish: t.finish, teamCount: s.teamCount,
        champion: s.champion.includes(f.id), coChampion: s.champion.length > 1 && s.champion.includes(f.id),
        runnerUp: s.runnerUp === f.id,
      })
    }
    if (!rows.length) return null
    const sum = (k) => rows.reduce((a, r) => a + (r[k] || 0), 0)
    const W = sum('W'), L = sum('L'), T = sum('T')
    const games = allGames.filter((g) => g.away === f.id || g.home === f.id)
    const postRec = { W: 0, L: 0, T: 0 }
    for (const g of games.filter((g) => g.post)) {
      const me = g.away === f.id ? g.awayPts : g.homePts
      const op = g.away === f.id ? g.homePts : g.awayPts
      if (me > op) postRec.W++; else if (me < op) postRec.L++; else postRec.T++
    }
    const titles = rows.filter((r) => r.champion).reduce((a, r) => a + (r.coChampion ? 0.5 : 1), 0)
    const ppg = (r) => r.PF / Math.max(1, r.W + r.L + r.T)
    const best = [...rows].sort((a, b) => pct(b) - pct(a) || b.PF - a.PF)[0]
    const worst = [...rows].sort((a, b) => pct(a) - pct(b) || a.PF - b.PF)[0]
    const names = [...new Set(rows.map((r) => r.name))]
    const lastTitle = rows.filter((r) => r.champion).map((r) => r.year).pop() || null
    return {
      ...f,
      names,
      firstYear: rows[0].year,
      lastYear: rows[rows.length - 1].year,
      active: rows[rows.length - 1].year === LAST_YEAR,
      seasonsPlayed: rows.length,
      record: { W, L, T, pct: round(W / Math.max(1, W + L + T), 3), PF: round(sum('PF')), PA: round(sum('PA')) },
      postseasonRecord: postRec,
      titles,
      titleYears: rows.filter((r) => r.champion).map((r) => (r.coChampion ? `${r.year}*` : String(r.year))),
      runnerUps: rows.filter((r) => r.runnerUp).length,
      finals: rows.filter((r) => r.champion || r.runnerUp).length,
      lastTitle,
      avgRegRank: round(rows.reduce((a, r) => a + r.regRank, 0) / rows.length, 1),
      winningSeasons: rows.filter((r) => r.W > r.L).length,
      bestSeason: best && { year: best.year, W: best.W, L: best.L, T: best.T, PF: best.PF },
      worstSeason: worst && { year: worst.year, W: worst.W, L: worst.L, T: worst.T, PF: worst.PF },
      bestPpgSeason: [...rows].sort((a, b) => ppg(b) - ppg(a))[0].year,
      seasons: rows,
    }
  }).filter(Boolean)

  // ---------- Franchise auction profile ----------
  for (const f of franchises) {
    const mine = allPicksAll.filter((p) => p.team === f.id)
    if (!mine.length) continue
    const counts = {}
    for (const p of mine) {
      const c = (counts[p.player] ||= { player: p.player, pos: p.pos, times: 0, spend: 0, years: [] })
      c.times++; c.spend += p.salary; c.years.push(p.year)
    }
    const years = [...new Set(mine.map((p) => p.year))]
    const posSpend = {}
    for (const p of mine) posSpend[p.pos || '?'] = (posSpend[p.pos || '?'] || 0) + p.salary
    const total = mine.reduce((a, p) => a + p.salary, 0)
    f.auction = {
      years,
      mostExpensive: [...mine].sort((a, b) => b.salary - a.salary || a.year - b.year).slice(0, 10),
      mostBought: Object.values(counts).filter((c) => c.times >= 2).sort((a, b) => b.times - a.times || b.spend - a.spend).slice(0, 10),
      positionShare: Object.fromEntries(Object.entries(posSpend).map(([k, v]) => [k, round(v / total, 3)])),
    }
  }

  // ---------- Records ----------
  const named = (id) => franchises.find((f) => f.id === id)?.name || id
  const nameIn = (g, side) => (side === 'away' ? g.awayName : g.homeName)
  const scoreRows = allGames.flatMap((g) => [
    { year: g.year, week: g.week, post: g.post, team: g.away, name: g.awayName, pts: g.awayPts, opp: g.home, oppName: g.homeName, oppPts: g.homePts },
    { year: g.year, week: g.week, post: g.post, team: g.home, name: g.homeName, pts: g.homePts, opp: g.away, oppName: g.awayName, oppPts: g.awayPts },
  ])
  const top = (arr, n = 10) => arr.slice(0, n)
  const games = allGames.map((g) => {
    const winAway = g.awayPts >= g.homePts
    return {
      year: g.year, week: g.week, post: g.post,
      winner: winAway ? g.away : g.home, winnerName: winAway ? g.awayName : g.homeName, winnerPts: winAway ? g.awayPts : g.homePts,
      loser: winAway ? g.home : g.away, loserName: winAway ? g.homeName : g.awayName, loserPts: winAway ? g.homePts : g.awayPts,
      margin: Math.abs(g.awayPts - g.homePts), combined: g.awayPts + g.homePts, tie: g.awayPts === g.homePts,
    }
  })

  // Streaks (regular season, chronological, carried across seasons for all-time)
  const streaks = []
  for (const f of franchises) {
    const res = allGames
      .filter((g) => !g.post && (g.away === f.id || g.home === f.id))
      .sort((a, b) => a.year - b.year || a.week - b.week)
      .map((g) => {
        const me = g.away === f.id ? g.awayPts : g.homePts
        const op = g.away === f.id ? g.homePts : g.awayPts
        return { year: g.year, week: g.week, r: me > op ? 'W' : me < op ? 'L' : 'T' }
      })
    for (const kind of ['W', 'L']) {
      let run = []
      const flush = () => {
        if (run.length >= 2) streaks.push({ team: f.id, kind, length: run.length, from: { year: run[0].year, week: run[0].week }, to: { year: run[run.length - 1].year, week: run[run.length - 1].week } })
        run = []
      }
      for (const x of res) (x.r === kind ? run.push(x) : flush())
      flush()
    }
  }
  const seasonRows = seasons.flatMap((s) => s.teams.map((t) => ({
    year: s.year, team: t.franchise, name: t.name, W: t.W, L: t.L, T: t.T, PF: t.PF, PA: t.PA ?? null,
    games: t.W + t.L + t.T, ppg: round(t.PF / Math.max(1, t.W + t.L + t.T), 2), pct: round(pct(t), 3),
    papg: t.PA != null ? round(t.PA / Math.max(1, t.W + t.L + t.T), 2) : null,
    champion: s.champion.includes(t.franchise), finish: t.finish,
  })))

  const records = {
    coverage: {
      games: `${Math.min(...allGames.map((g) => g.year))}-${Math.max(...allGames.map((g) => g.year))}`,
      seasons: `${FIRST_YEAR}-${LAST_YEAR}`,
      gameCount: allGames.length,
    },
    highestScores: top([...scoreRows].sort((a, b) => b.pts - a.pts || a.year - b.year)),
    lowestScores: top([...scoreRows].filter((r) => r.pts > 0).sort((a, b) => a.pts - b.pts || a.year - b.year)),
    biggestBlowouts: top([...games].sort((a, b) => b.margin - a.margin || a.year - b.year)),
    highestCombined: top([...games].sort((a, b) => b.combined - a.combined || a.year - b.year)),
    lowestCombined: top([...games].sort((a, b) => a.combined - b.combined || a.year - b.year)),
    highestLosingScores: top([...games].filter((g) => !g.tie).sort((a, b) => b.loserPts - a.loserPts || a.year - b.year)),
    ties: games.filter((g) => g.tie).length,
    longestWinStreaks: top(streaks.filter((s) => s.kind === 'W').sort((a, b) => b.length - a.length || a.from.year - b.from.year)),
    longestLosingStreaks: top(streaks.filter((s) => s.kind === 'L').sort((a, b) => b.length - a.length || a.from.year - b.from.year)),
    bestRecords: top([...seasonRows].sort((a, b) => b.pct - a.pct || b.PF - a.PF)),
    worstRecords: top([...seasonRows].sort((a, b) => a.pct - b.pct || a.PF - b.PF)),
    mostPointsPerGame: top([...seasonRows].sort((a, b) => b.ppg - a.ppg)),
    fewestPointsAllowedPerGame: top([...seasonRows].filter((r) => r.papg !== null).sort((a, b) => a.papg - b.papg)),
    mostPointsSeason: top([...seasonRows].sort((a, b) => b.PF - a.PF)),
    worstToFirst: seasons
      .filter((s) => s.champion.length)
      .map((s) => {
        const prev = seasons.find((p) => p.year === s.year - 1)
        return s.champion.map((c) => {
          const t = prev?.teams.find((x) => x.franchise === c)
          return t ? { year: s.year, team: c, prevRegRank: t.regRank, prevFinish: t.finish } : null
        })
      })
      .flat()
      .filter((x) => x && x.prevRegRank >= 7)
      .sort((a, b) => b.prevRegRank - a.prevRegRank),
    weekHighScoreLeaders: top(
      seasons.flatMap((s) => s.teams.filter((t) => t.weeksWon != null && s.hasWeekly).map((t) => ({ year: s.year, team: t.franchise, name: t.name, weeksWon: t.weeksWon })))
        .sort((a, b) => b.weeksWon - a.weeksWon || a.year - b.year)
    ),
    championsWithLosingRecord: seasonRows.filter((r) => r.champion && r.W < r.L),
    lowestSeededChampions: seasons
      .filter((s) => s.champion.length === 1)
      .map((s) => ({ year: s.year, team: s.champion[0], regRank: s.teams.find((t) => t.franchise === s.champion[0])?.regRank }))
      .sort((a, b) => b.regRank - a.regRank)
      .slice(0, 8),
  }

  // ---------- Head to head ----------
  const h2h = {}
  for (const g of allGames) {
    for (const [a, b, ap, bp] of [[g.away, g.home, g.awayPts, g.homePts], [g.home, g.away, g.homePts, g.awayPts]]) {
      h2h[a] ||= {}
      const r = (h2h[a][b] ||= { W: 0, L: 0, T: 0, PF: 0, PA: 0, postW: 0, postL: 0, games: 0, last: null })
      r.games++
      r.PF += ap; r.PA += bp
      if (ap > bp) r.W++; else if (ap < bp) r.L++; else r.T++
      if (g.post) { if (ap > bp) r.postW++; else if (ap < bp) r.postL++ }
      r.last = { year: g.year, week: g.week, pts: ap, oppPts: bp }
    }
  }
  for (const a of Object.values(h2h)) for (const r of Object.values(a)) { r.PF = round(r.PF); r.PA = round(r.PA) }

  // ---------- Auctions all-time ----------
  const auctionYears = seasons.filter((s) => s.auction?.format === 'auction').map((s) => s.year)
  const playerCounts = {}
  for (const p of allPicksAll) {
    const k = `${p.player}|${p.pos}`
    const c = (playerCounts[k] ||= { player: p.player, pos: p.pos, times: 0, spend: 0, maxSalary: 0, years: [] })
    c.times++; c.spend += p.salary; c.maxSalary = Math.max(c.maxSalary, p.salary); c.years.push(p.year)
  }
  const auctions = {
    years: auctionYears,
    mostExpensive: top([...allPicksAll].sort((a, b) => b.salary - a.salary || a.year - b.year), 25),
    mostExpensiveByPos: Object.fromEntries(['QB', 'RB', 'WR', 'TE', 'K', 'DST'].map((pos) => [pos, top(allPicksAll.filter((p) => p.pos === pos).sort((a, b) => b.salary - a.salary), 5)])),
    mostTotalSpend: top(Object.values(playerCounts).sort((a, b) => b.spend - a.spend), 15),
    positionShareByYear: auctionYears.map((y) => {
      const a = seasons.find((s) => s.year === y).auction
      return { year: y, ...Object.fromEntries(['QB', 'RB', 'WR', 'TE', 'K', 'DST'].map((p) => [p, a.positionSpend[p]?.share ?? 0])) }
    }),
    topPriceByYear: auctionYears.map((y) => {
      const a = seasons.find((s) => s.year === y).auction
      return { year: y, ...a.topBuys[0] }
    }),
  }

  // ---------- Membership timeline ----------
  const timeline = []
  for (let i = 0; i < seasons.length; i++) {
    const s = seasons[i]
    const prev = seasons[i - 1]
    if (!s.teams.length) continue
    const now = new Set(s.teams.map((t) => t.franchise))
    const before = new Set(prev?.teams.map((t) => t.franchise) || [])
    const joined = [...now].filter((x) => !before.has(x))
    const left = [...before].filter((x) => !now.has(x))
    const renamed = s.teams.filter((t) => {
      const p = prev?.teams.find((x) => x.franchise === t.franchise)
      return p && p.name !== t.name
    }).map((t) => ({ franchise: t.franchise, from: prev.teams.find((x) => x.franchise === t.franchise).name, to: t.name }))
    if (i === 0 || joined.length || left.length || renamed.length || (prev && prev.teamCount !== s.teamCount)) {
      timeline.push({ year: s.year, teamCount: s.teamCount, joined, left, renamed, first: i === 0 })
    }
  }

  const out = {
    generatedAt: new Date().toISOString(),
    firstYear: FIRST_YEAR,
    lastYear: LAST_YEAR,
    franchises,
    seasons,
    records,
    h2h,
    auctions,
    timeline,
    warnings,
  }
  fs.mkdirSync(OUT_DIR, { recursive: true })
  fs.writeFileSync(path.join(OUT_DIR, 'league.json'), JSON.stringify(out))
  const kb = (fs.statSync(path.join(OUT_DIR, 'league.json')).size / 1024).toFixed(0)
  console.log(`Wrote data/history/league.json (${kb} KB): ${seasons.length} seasons, ${franchises.length} franchises, ${allGames.length} games, ${allPicksAll.length} auction picks, ${warnings.length} warnings`)
}

const allPicksAll = []
const pct = (t) => (t.W + 0.5 * (t.T || 0)) / Math.max(1, t.W + t.L + (t.T || 0))

main()
