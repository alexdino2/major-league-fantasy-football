import type { Metadata } from "next"
import { HistoryDashboard, type DashboardData } from "@/components/history/dashboard"
import { history } from "@/lib/history"

export const metadata: Metadata = {
  title: "Dashboard | MLFF History",
  description: "Interactive MLFF history dashboard: filter by era and franchise to compare scoring, finishes, titles, luck, rivalries and auctions.",
}

function buildData(): DashboardData {
  const franchises = history.franchises.map((f) => ({
    id: f.id,
    name: f.name,
    logo: f.logo,
    active: f.active,
    first: f.firstYear,
    last: f.lastYear,
  }))
  const index = new Map(franchises.map((f, i) => [f.id, i]))

  const teamSeasons = history.seasons.flatMap((s) =>
    s.teams.map((t) => ({
      y: s.year,
      f: index.get(t.franchise)!,
      name: t.name,
      W: t.W,
      L: t.L,
      T: t.T,
      PF: t.PF,
      PA: t.PA ?? null,
      rr: t.regRank,
      fin: t.finish,
      ch: s.champion.includes(t.franchise) ? (s.champion.length > 1 ? 0.5 : 1) : 0,
      ru: s.runnerUp === t.franchise,
      n: s.teamCount,
    }))
  )

  // [year, week, post(0/1), awayIdx, homeIdx, awayPts, homePts]
  const games: DashboardData["games"] = []
  for (const s of history.seasons) {
    for (const g of s.games) games.push([s.year, g.week, 0, index.get(g.away)!, index.get(g.home)!, g.awayPts, g.homePts])
    for (const g of s.playoff?.games ?? []) games.push([s.year, g.week, 1, index.get(g.away)!, index.get(g.home)!, g.awayPts, g.homePts])
  }

  const auctions = history.auctions.positionShareByYear.map((row) => {
    const s = history.seasons.find((x) => x.year === row.year)!
    const top = (s.auction?.topBuys ?? []).slice(0, 3).map((p) => ({
      player: p.player,
      pos: p.pos,
      salary: p.salary,
      f: p.team ? index.get(p.team) ?? null : null,
    }))
    return { year: row.year, QB: row.QB, RB: row.RB, WR: row.WR, TE: row.TE, K: row.K, DST: row.DST, top }
  })

  return {
    firstYear: history.firstYear,
    lastYear: history.lastYear,
    franchises,
    teamSeasons,
    games,
    auctions,
  }
}

export default function DashboardPage() {
  return <HistoryDashboard data={buildData()} />
}
