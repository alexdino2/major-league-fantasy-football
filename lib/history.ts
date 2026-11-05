// Server-only access to the generated league history (data/history/league.json).
// Rebuild the JSON with: node scripts/build-history-site.js
import league from "@/data/history/league.json"

export type Franchise = {
  id: string
  name: string
  manager: string | null
  logo: string | null
  aliases: string[]
  names: string[]
  firstYear: number
  lastYear: number
  active: boolean
  seasonsPlayed: number
  record: { W: number; L: number; T: number; pct: number; PF: number; PA: number }
  postseasonRecord: { W: number; L: number; T: number }
  titles: number
  titleYears: string[]
  runnerUps: number
  finals: number
  lastTitle: number | null
  avgRegRank: number
  winningSeasons: number
  bestSeason: { year: number; W: number; L: number; T: number; PF: number }
  worstSeason: { year: number; W: number; L: number; T: number; PF: number }
  bestPpgSeason: number
  seasons: FranchiseSeason[]
  auction?: {
    years: number[]
    mostExpensive: Pick[]
    mostBought: Array<{ player: string; pos: string | null; times: number; spend: number; years: number[] }>
    positionShare: Record<string, number>
  }
}

export type FranchiseSeason = {
  year: number
  name: string
  division: string | null
  W: number
  L: number
  T: number
  PF: number
  PA: number | null
  regRank: number
  finish: number | null
  teamCount: number
  champion: boolean
  coChampion: boolean
  runnerUp: boolean
}

export type SeasonTeam = {
  franchise: string
  name: string
  division: string | null
  W: number
  L: number
  T: number
  PF: number
  PA?: number | null
  max?: number | null
  min?: number | null
  weeksWon?: number | null
  winnings?: number | null
  finalRank?: number | null
  regRank: number
  finish: number | null
  official?: { W: number; L: number; T: number; PF: number; PA: number }
}

export type Game = {
  week: number
  away: string
  awayName: string
  home: string
  homeName: string
  awayPts: number
  homePts: number
  year: number
  post: boolean
  kind?: "final" | "placement"
}

export type Pick = {
  team: string | null
  player: string
  pos: string | null
  nflTeam: string | null
  salary: number
  fpts: number | null
  year?: number
}

export type Auction = {
  year: number
  format: "auction" | "snake"
  note?: string
  totalSpend?: number
  picks?: number
  hasPoints?: boolean
  positionSpend?: Record<string, { spend: number; count: number; share: number }>
  topBuys?: Pick[]
  teamSpend?: Record<string, { spend: number; count: number; fpts: number }>
  bestValues?: Pick[]
  busts?: Pick[]
}

export type Final = {
  format: string
  legs: Array<Record<string, number>>
  teams: [string, string]
  score: Record<string, number>
  winner: string
  loser: string
  complete: boolean
}

export type Season = {
  year: number
  source: "cbs" | "pre-cbs" | null
  teamCount: number
  divisions: string[]
  teams: SeasonTeam[]
  champion: string[]
  runnerUp: string | null
  playoff: { final: Final | null; games: Game[] } | null
  hasWeekly: boolean
  games: Game[]
  auction: Auction | null
  notes: string[]
}

export type ScoreRow = { year: number; week: number; post: boolean; team: string; name: string; pts: number; opp: string; oppName: string; oppPts: number }
export type GameRow = {
  year: number; week: number; post: boolean
  winner: string; winnerName: string; winnerPts: number
  loser: string; loserName: string; loserPts: number
  margin: number; combined: number; tie: boolean
}
export type SeasonRow = {
  year: number; team: string; name: string; W: number; L: number; T: number; PF: number; PA: number | null
  games: number; ppg: number; pct: number; papg: number | null; champion: boolean; finish: number | null
}
export type Streak = { team: string; kind: "W" | "L"; length: number; from: { year: number; week: number }; to: { year: number; week: number } }

export type H2H = { W: number; L: number; T: number; PF: number; PA: number; postW: number; postL: number; games: number; last: { year: number; week: number; pts: number; oppPts: number } | null }

type League = {
  generatedAt: string
  firstYear: number
  lastYear: number
  franchises: Franchise[]
  seasons: Season[]
  records: {
    coverage: { games: string; seasons: string; gameCount: number }
    highestScores: ScoreRow[]
    lowestScores: ScoreRow[]
    biggestBlowouts: GameRow[]
    highestCombined: GameRow[]
    lowestCombined: GameRow[]
    highestLosingScores: GameRow[]
    ties: number
    longestWinStreaks: Streak[]
    longestLosingStreaks: Streak[]
    bestRecords: SeasonRow[]
    worstRecords: SeasonRow[]
    mostPointsPerGame: SeasonRow[]
    fewestPointsAllowedPerGame: SeasonRow[]
    mostPointsSeason: SeasonRow[]
    worstToFirst: Array<{ year: number; team: string; prevRegRank: number; prevFinish: number | null }>
    weekHighScoreLeaders: Array<{ year: number; team: string; name: string; weeksWon: number }>
    championsWithLosingRecord: SeasonRow[]
    lowestSeededChampions: Array<{ year: number; team: string; regRank: number }>
  }
  h2h: Record<string, Record<string, H2H>>
  auctions: {
    years: number[]
    mostExpensive: Pick[]
    mostExpensiveByPos: Record<string, Pick[]>
    mostTotalSpend: Array<{ player: string; pos: string | null; times: number; spend: number; maxSalary: number; years: number[] }>
    positionShareByYear: Array<{ year: number } & Record<string, number>>
    topPriceByYear: Array<Pick & { year: number }>
  }
  timeline: Array<{
    year: number
    teamCount: number
    joined: string[]
    left: string[]
    renamed: Array<{ franchise: string; from: string; to: string }>
    first: boolean
  }>
  warnings: string[]
}

export const history = league as unknown as League

const byId = new Map(history.franchises.map((f) => [f.id, f]))

export function franchise(id: string | null | undefined): Franchise | undefined {
  return id ? byId.get(id) : undefined
}

export function franchiseName(id: string | null | undefined): string {
  return franchise(id)?.name ?? "Unknown"
}

/** The name a franchise played under in a given season (falls back to its current name). */
export function seasonName(id: string, year: number): string {
  const f = franchise(id)
  return f?.seasons.find((s) => s.year === year)?.name ?? f?.name ?? id
}

export function season(year: number): Season | undefined {
  return history.seasons.find((s) => s.year === year)
}

export function record(r: { W: number; L: number; T?: number }): string {
  return r.T ? `${r.W}-${r.L}-${r.T}` : `${r.W}-${r.L}`
}

export function pct(r: { W: number; L: number; T?: number }): string {
  const g = r.W + r.L + (r.T || 0)
  if (!g) return ".000"
  const v = (r.W + 0.5 * (r.T || 0)) / g
  return v >= 1 ? "1.000" : v.toFixed(3).replace(/^0/, "")
}

export function ordinal(n: number | null | undefined): string {
  if (n === null || n === undefined) return "—"
  const s = ["th", "st", "nd", "rd"]
  const v = n % 100
  return n + (s[(v - 20) % 10] || s[v] || s[0])
}

export function fmt(n: number | null | undefined, digits = 0): string {
  if (n === null || n === undefined || Number.isNaN(n)) return "—"
  return n.toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits })
}

/** Franchises that have played since weekly results start (2003), ordered by current/most recent first. */
export function mainFranchises(): Franchise[] {
  return history.franchises.filter((f) => f.lastYear >= 2003)
}
