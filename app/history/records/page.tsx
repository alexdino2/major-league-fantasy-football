import Link from "next/link"
import type { Metadata } from "next"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { PageHeader, TeamLink } from "@/components/history/team"
import { history, fmt, ordinal, pct, record, type GameRow, type ScoreRow, type SeasonRow, type Streak } from "@/lib/history"

export const metadata: Metadata = {
  title: "Record Book | MLFF History",
  description: "MLFF single-game, season and streak records.",
}

export default function RecordsPage() {
  const r = history.records
  const leaguePpg = (year: number) => {
    const s = history.seasons.find((x) => x.year === year)
    if (!s?.teams.length) return 0
    const pts = s.teams.reduce((a, t) => a + t.PF, 0)
    const games = s.teams.reduce((a, t) => a + t.W + t.L + t.T, 0)
    return pts / games
  }
  const firstPpg = leaguePpg(history.firstYear)
  const lastPpg = leaguePpg(history.lastYear)
  return (
    <>
      <PageHeader
        title="Record Book"
        subtitle={`Single-game and streak records cover the ${fmt(r.coverage.gameCount)} games on file (${r.coverage.games}). Season records cover every season, ${r.coverage.seasons}.`}
      />

      <h2 className="text-2xl font-bold mb-4">Single game</h2>
      <div className="grid lg:grid-cols-2 gap-4 mb-10">
        <ScoreTable title="Highest scores" rows={r.highestScores} />
        <ScoreTable title="Lowest scores" rows={r.lowestScores} />
        <GameTable title="Biggest blowouts" rows={r.biggestBlowouts} metric={(g) => `+${fmt(g.margin)}`} metricLabel="Margin" />
        <GameTable title="Highest combined scores" rows={r.highestCombined} metric={(g) => fmt(g.combined)} metricLabel="Total" />
        <GameTable title="Best scores in a loss" rows={r.highestLosingScores} metric={(g) => fmt(g.loserPts)} metricLabel="Lost with" />
        <GameTable title="Lowest combined scores" rows={r.lowestCombined} metric={(g) => fmt(g.combined)} metricLabel="Total" />
      </div>
      <p className="text-sm text-muted-foreground -mt-6 mb-10">{r.ties} games on file ended in a tie.</p>

      <h2 className="text-2xl font-bold mb-4">Streaks</h2>
      <div className="grid lg:grid-cols-2 gap-4 mb-10">
        <StreakTable title="Longest winning streaks" rows={r.longestWinStreaks} />
        <StreakTable title="Longest losing streaks" rows={r.longestLosingStreaks} />
      </div>
      <p className="text-sm text-muted-foreground -mt-6 mb-10">Regular-season games only. A streak carries over from one season to the next.</p>

      <h2 className="text-2xl font-bold mb-4">Season</h2>
      <div className="grid lg:grid-cols-2 gap-4 mb-4">
        <SeasonTable title="Best records" rows={r.bestRecords} metric={(s) => `${record(s)} (${pct(s)})`} />
        <SeasonTable title="Worst records" rows={r.worstRecords} metric={(s) => `${record(s)} (${pct(s)})`} />
        <SeasonTable title="Most points per game" rows={r.mostPointsPerGame} metric={(s) => s.ppg.toFixed(2)} />
        <SeasonTable title="Fewest points allowed per game" rows={r.fewestPointsAllowedPerGame} metric={(s) => (s.papg ?? 0).toFixed(2)} />
      </div>
      <p className="text-sm text-muted-foreground mb-10">
        Scoring has changed a lot: teams averaged {firstPpg.toFixed(1)} points a game in {history.firstYear} and {lastPpg.toFixed(1)} in {history.lastYear},
        so per-game season records favor the modern era.
      </p>

      <h2 className="text-2xl font-bold mb-4">Championship oddities</h2>
      <div className="grid lg:grid-cols-3 gap-4 mb-10">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-lg">Lowest-ranked champions</CardTitle></CardHeader>
          <CardContent className="space-y-1 text-sm">
            {r.lowestSeededChampions.map((c) => (
              <div key={c.year} className="flex justify-between">
                <span><Link href={`/history/seasons/${c.year}`} className="text-green-700 hover:underline">{c.year}</Link> <TeamLink id={c.team} year={c.year} /></span>
                <span className="tabular-nums">{ordinal(c.regRank)} in reg. season</span>
              </div>
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-lg">Worst to first</CardTitle></CardHeader>
          <CardContent className="space-y-1 text-sm">
            {r.worstToFirst.length ? r.worstToFirst.map((c) => (
              <div key={`${c.year}-${c.team}`} className="flex justify-between">
                <span><Link href={`/history/seasons/${c.year}`} className="text-green-700 hover:underline">{c.year}</Link> <TeamLink id={c.team} year={c.year} /></span>
                <span className="tabular-nums">{ordinal(c.prevRegRank)} the year before</span>
              </div>
            )) : <p className="text-muted-foreground">None.</p>}
            <p className="text-xs text-muted-foreground pt-1">Champions who ranked 7th or worse in the previous regular season.</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-lg">Most weekly high scores</CardTitle></CardHeader>
          <CardContent className="space-y-1 text-sm">
            {r.weekHighScoreLeaders.map((c) => (
              <div key={`${c.year}-${c.team}`} className="flex justify-between">
                <span><Link href={`/history/seasons/${c.year}`} className="text-green-700 hover:underline">{c.year}</Link> <TeamLink id={c.team} year={c.year} /></span>
                <span className="tabular-nums">{c.weeksWon} weeks</span>
              </div>
            ))}
            <p className="text-xs text-muted-foreground pt-1">Weeks with the league&apos;s top score in one season. Shared tops split.</p>
          </CardContent>
        </Card>
      </div>
    </>
  )
}

function When({ year, week, post }: { year: number; week: number; post?: boolean }) {
  return (
    <Link href={`/history/seasons/${year}`} className="text-green-700 hover:underline whitespace-nowrap">
      {year} wk {week}{post ? " (post)" : ""}
    </Link>
  )
}

function ScoreTable({ title, rows }: { title: string; rows: ScoreRow[] }) {
  return (
    <Card className="min-w-0">
      <CardHeader className="pb-2"><CardTitle className="text-lg">{title}</CardTitle></CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow><TableHead className="w-8">#</TableHead><TableHead>Team</TableHead><TableHead className="text-right">Pts</TableHead><TableHead className="hidden sm:table-cell">Opponent</TableHead><TableHead className="text-right">When</TableHead></TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((x, i) => (
              <TableRow key={i}>
                <TableCell className="text-muted-foreground">{i + 1}</TableCell>
                <TableCell><TeamLink id={x.team} year={x.year} /></TableCell>
                <TableCell className="text-right tabular-nums font-semibold">{fmt(x.pts)}</TableCell>
                <TableCell className="hidden sm:table-cell text-gray-600">{x.oppName} ({fmt(x.oppPts)})</TableCell>
                <TableCell className="text-right"><When year={x.year} week={x.week} post={x.post} /></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}

function GameTable({ title, rows, metric, metricLabel }: { title: string; rows: GameRow[]; metric: (g: GameRow) => string; metricLabel: string }) {
  return (
    <Card className="min-w-0">
      <CardHeader className="pb-2"><CardTitle className="text-lg">{title}</CardTitle></CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow><TableHead className="w-8">#</TableHead><TableHead>Game</TableHead><TableHead className="text-right">{metricLabel}</TableHead><TableHead className="text-right">When</TableHead></TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((g, i) => (
              <TableRow key={i}>
                <TableCell className="text-muted-foreground">{i + 1}</TableCell>
                <TableCell>
                  <span className="font-medium"><TeamLink id={g.winner} year={g.year} /> {fmt(g.winnerPts)}</span>
                  <span className="text-gray-500">, {g.loserName} {fmt(g.loserPts)}</span>
                </TableCell>
                <TableCell className="text-right tabular-nums font-semibold">{metric(g)}</TableCell>
                <TableCell className="text-right"><When year={g.year} week={g.week} post={g.post} /></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}

function StreakTable({ title, rows }: { title: string; rows: Streak[] }) {
  return (
    <Card className="min-w-0">
      <CardHeader className="pb-2"><CardTitle className="text-lg">{title}</CardTitle></CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow><TableHead className="w-8">#</TableHead><TableHead>Team</TableHead><TableHead className="text-right">Games</TableHead><TableHead className="text-right">From – to</TableHead></TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((s, i) => (
              <TableRow key={i}>
                <TableCell className="text-muted-foreground">{i + 1}</TableCell>
                <TableCell><TeamLink id={s.team} /></TableCell>
                <TableCell className="text-right tabular-nums font-semibold">{s.length}</TableCell>
                <TableCell className="text-right text-gray-600 whitespace-nowrap">{s.from.year} wk {s.from.week} – {s.to.year === s.from.year ? "" : `${s.to.year} `}wk {s.to.week}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}

function SeasonTable({ title, rows, metric }: { title: string; rows: SeasonRow[]; metric: (s: SeasonRow) => string }) {
  return (
    <Card className="min-w-0">
      <CardHeader className="pb-2"><CardTitle className="text-lg">{title}</CardTitle></CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow><TableHead className="w-8">#</TableHead><TableHead>Team</TableHead><TableHead className="text-right">Year</TableHead><TableHead className="text-right"></TableHead><TableHead className="text-right hidden sm:table-cell">Finish</TableHead></TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((s, i) => (
              <TableRow key={i}>
                <TableCell className="text-muted-foreground">{i + 1}</TableCell>
                <TableCell><TeamLink id={s.team} year={s.year} /></TableCell>
                <TableCell className="text-right"><Link href={`/history/seasons/${s.year}`} className="text-green-700 hover:underline">{s.year}</Link></TableCell>
                <TableCell className="text-right tabular-nums font-semibold whitespace-nowrap">{metric(s)}</TableCell>
                <TableCell className="text-right hidden sm:table-cell">{s.champion ? "🏆" : ordinal(s.finish)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}
