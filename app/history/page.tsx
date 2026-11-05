import Link from "next/link"
import type { Metadata } from "next"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Trophy, Calendar, Users, Swords } from "lucide-react"
import { PageHeader, TeamLink, TeamLogo } from "@/components/history/team"
import { history, franchiseName, fmt, ordinal, pct, record } from "@/lib/history"

export const metadata: Metadata = {
  title: "History | Major League Fantasy Football",
  description: "Every MLFF champion, franchise record and league milestone since 1994.",
}

export default function HistoryPage() {
  const { seasons, franchises, records, timeline, lastYear, firstYear } = history
  const titleCount = seasons.filter((s) => s.champion.length).length
  const active = franchises.filter((f) => f.active)
  const byTitles = [...franchises]
    .filter((f) => f.titles > 0)
    .sort((a, b) => b.titles - a.titles || b.finals - a.finals || (b.lastTitle ?? 0) - (a.lastTitle ?? 0))
  const allTime = [...franchises].sort((a, b) => Number(b.seasonsPlayed >= 5) - Number(a.seasonsPlayed >= 5) || b.record.pct - a.record.pct)
  const champSeasons = [...seasons].filter((s) => s.champion.length).reverse()

  const droughts = active
    .map((f) => ({ f, years: f.lastTitle ? lastYear - f.lastTitle : lastYear - f.firstYear + 1, never: !f.lastTitle }))
    .sort((a, b) => b.years - a.years)

  return (
    <>
      <PageHeader
        title="MLFF History"
        subtitle={`${seasons.length} seasons of Major League Fantasy Football, ${firstYear}–${lastYear}. Every champion, every franchise, and the numbers behind them.`}
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-12">
        <Stat icon={<Calendar className="w-6 h-6 text-purple-500" />} label="Seasons" value={seasons.length} sub={`${firstYear}–${lastYear}`} />
        <Stat icon={<Trophy className="w-6 h-6 text-yellow-500" />} label="Titles awarded" value={titleCount} sub={`${byTitles.length} different franchises`} />
        <Stat icon={<Users className="w-6 h-6 text-blue-500" />} label="Franchises" value={franchises.length} sub={`${active.length} active in ${lastYear}`} />
        <Stat icon={<Swords className="w-6 h-6 text-green-600" />} label="Games on file" value={fmt(records.coverage.gameCount)} sub={`Week-by-week, ${records.coverage.games}`} />
      </div>

      {/* Champions */}
      <section className="mb-12">
        <div className="flex items-baseline justify-between mb-4">
          <h2 className="text-2xl sm:text-3xl font-bold">Champions</h2>
          <Link href="/history/seasons" className="text-sm text-green-700 hover:underline">All seasons →</Link>
        </div>
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-16">Year</TableHead>
                  <TableHead>Champion</TableHead>
                  <TableHead className="hidden sm:table-cell">Runner-up</TableHead>
                  <TableHead className="hidden md:table-cell">Final</TableHead>
                  <TableHead className="text-right">Reg. season</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {champSeasons.map((s) => {
                  const champs = s.champion
                  const t = s.teams.find((x) => x.franchise === champs[0])
                  const fin = s.playoff?.final
                  return (
                    <TableRow key={s.year}>
                      <TableCell className="font-semibold">
                        <Link href={`/history/seasons/${s.year}`} className="hover:underline text-green-700">{s.year}</Link>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-1">
                          {champs.map((c) => (
                            <span key={c} className="flex items-center gap-2 font-medium">
                              <TeamLink id={c} year={s.year} logo />
                              {champs.length > 1 && <Badge variant="outline" className="text-xs">co-champion</Badge>}
                            </span>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell className="hidden sm:table-cell text-gray-600">
                        {s.runnerUp ? <TeamLink id={s.runnerUp} year={s.year} /> : <span className="text-muted-foreground">—</span>}
                      </TableCell>
                      <TableCell className="hidden md:table-cell text-gray-600 tabular-nums">
                        {fin ? (
                          <span>
                            {fmt(fin.score[fin.winner])}–{fmt(fin.score[fin.loser])}
                            {fin.format === "two-week aggregate" && <span className="text-xs text-muted-foreground"> (2 wks{fin.complete ? "" : ", partial"})</span>}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-gray-600">
                        {t ? (
                          <span>
                            {record(t)} <span className="text-xs text-muted-foreground">({ordinal(t.regRank)})</span>
                          </span>
                        ) : "—"}
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </section>

      {/* Title leaderboard + droughts */}
      <section className="grid lg:grid-cols-3 gap-6 mb-12">
        <div className="lg:col-span-2 min-w-0">
          <h2 className="text-2xl sm:text-3xl font-bold mb-4">Most championships</h2>
          <div className="grid sm:grid-cols-2 gap-4">
            {byTitles.map((f, i) => (
              <Card key={f.id} className={i < 3 ? "border-yellow-200 bg-yellow-50" : ""}>
                <CardHeader className="flex flex-row items-center gap-3 space-y-0 pb-2">
                  <TeamLogo id={f.id} size={36} />
                  <CardTitle className="text-lg">
                    <Link href={`/history/franchises/${f.id}`} className="hover:underline">{f.name}</Link>
                  </CardTitle>
                  <Badge className="ml-auto" variant={i < 3 ? "default" : "secondary"}>
                    {Number.isInteger(f.titles) ? f.titles : f.titles.toFixed(1)} {f.titles === 1 ? "title" : "titles"}
                  </Badge>
                </CardHeader>
                <CardContent className="text-sm text-muted-foreground">
                  <p>{f.titleYears.join(", ")}</p>
                  <p className="mt-1">{f.finals} finals · {f.runnerUps} runner-up</p>
                </CardContent>
              </Card>
            ))}
          </div>
          <p className="text-xs text-muted-foreground mt-2">* Co-championship, counted as ½ title.</p>
        </div>
        <div>
          <h2 className="text-2xl sm:text-3xl font-bold mb-4">Title droughts</h2>
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Active franchise</TableHead>
                    <TableHead className="text-right">Last title</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {droughts.map(({ f, years, never }) => (
                    <TableRow key={f.id}>
                      <TableCell><TeamLink id={f.id} /></TableCell>
                      <TableCell className="text-right tabular-nums">
                        {never ? <span className="text-red-700">Never ({years} seasons)</span> : <span>{f.lastTitle} <span className="text-xs text-muted-foreground">({years} yrs)</span></span>}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* All-time standings */}
      <section className="mb-12">
        <div className="flex items-baseline justify-between mb-4">
          <h2 className="text-2xl sm:text-3xl font-bold">All-time standings</h2>
          <Link href="/history/franchises" className="text-sm text-green-700 hover:underline">Franchise pages →</Link>
        </div>
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Franchise</TableHead>
                  <TableHead className="text-right">Seasons</TableHead>
                  <TableHead className="text-right">Record</TableHead>
                  <TableHead className="text-right">Pct</TableHead>
                  <TableHead className="text-right hidden md:table-cell">Points for</TableHead>
                  <TableHead className="text-right hidden md:table-cell">Avg finish</TableHead>
                  <TableHead className="text-right hidden lg:table-cell">Winning yrs</TableHead>
                  <TableHead className="text-right hidden lg:table-cell">Postseason</TableHead>
                  <TableHead className="text-right">Titles</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {allTime.map((f) => (
                  <TableRow key={f.id} className={f.active ? "" : "text-gray-500"}>
                    <TableCell className="font-medium">
                      <TeamLink id={f.id} logo />
                      <span className="block text-xs text-muted-foreground">{f.firstYear === f.lastYear ? f.firstYear : `${f.firstYear}–${f.active ? "present" : f.lastYear}`}</span>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{f.seasonsPlayed}</TableCell>
                    <TableCell className="text-right tabular-nums">{record(f.record)}</TableCell>
                    <TableCell className="text-right tabular-nums">{pct(f.record)}</TableCell>
                    <TableCell className="text-right tabular-nums hidden md:table-cell">{fmt(f.record.PF)}</TableCell>
                    <TableCell className="text-right tabular-nums hidden md:table-cell">{f.avgRegRank.toFixed(1)}</TableCell>
                    <TableCell className="text-right tabular-nums hidden lg:table-cell">{f.winningSeasons}</TableCell>
                    <TableCell className="text-right tabular-nums hidden lg:table-cell">{f.postseasonRecord.W + f.postseasonRecord.L ? record(f.postseasonRecord) : "—"}</TableCell>
                    <TableCell className="text-right tabular-nums font-semibold">{f.titles || "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
        <p className="text-xs text-muted-foreground mt-2">
          Regular season only. 1994–2002 as recorded in the pre-CBS sheet; 2003 onward rebuilt from week 1–16 results. Avg finish is regular-season rank. Franchises with fewer than five seasons are listed last.
          Postseason is the week-17 (and, since 2021, week-18) games on file from 2003.
        </p>
      </section>

      {/* Record book teaser */}
      <section className="mb-12">
        <div className="flex items-baseline justify-between mb-4">
          <h2 className="text-2xl sm:text-3xl font-bold">Record book highlights</h2>
          <Link href="/history/records" className="text-sm text-green-700 hover:underline">Full record book →</Link>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Highlight
            label="Highest score, game"
            value={fmt(records.highestScores[0].pts)}
            who={<TeamLink id={records.highestScores[0].team} year={records.highestScores[0].year} />}
            when={`${records.highestScores[0].year}, week ${records.highestScores[0].week}`}
          />
          <Highlight
            label="Biggest blowout"
            value={`+${fmt(records.biggestBlowouts[0].margin)}`}
            who={<TeamLink id={records.biggestBlowouts[0].winner} year={records.biggestBlowouts[0].year} />}
            when={`${records.biggestBlowouts[0].winnerPts}–${records.biggestBlowouts[0].loserPts} over ${franchiseName(records.biggestBlowouts[0].loser)}, ${records.biggestBlowouts[0].year}`}
          />
          <Highlight
            label="Best regular season"
            value={record(records.bestRecords[0])}
            who={<TeamLink id={records.bestRecords[0].team} year={records.bestRecords[0].year} />}
            when={String(records.bestRecords[0].year)}
          />
          <Highlight
            label="Longest win streak"
            value={`${records.longestWinStreaks[0].length} games`}
            who={<TeamLink id={records.longestWinStreaks[0].team} />}
            when={`${records.longestWinStreaks[0].from.year} wk ${records.longestWinStreaks[0].from.week} – ${records.longestWinStreaks[0].to.year} wk ${records.longestWinStreaks[0].to.week}`}
          />
        </div>
      </section>

      {/* Timeline */}
      <section className="mb-12">
        <h2 className="text-2xl sm:text-3xl font-bold mb-4">League timeline</h2>
        <Card>
          <CardContent className="pt-6">
            <ol className="relative border-l border-gray-200 ml-2 space-y-6">
              {timelineEntries(timeline).map((t) => (
                <li key={t.year} className="ml-6">
                  <span className="absolute -left-[7px] mt-1.5 h-3 w-3 rounded-full border-2 border-white bg-green-600" />
                  <Link href={`/history/seasons/${t.year}`} className="font-semibold text-green-700 hover:underline">{t.year}</Link>
                  <ul className="text-sm text-gray-700 mt-1 space-y-0.5">
                    {t.first && <li>League&apos;s first season on record, with {t.teamCount} teams.</li>}
                    {!t.first && t.joined.length > 0 && (
                      <li>Joined: {t.joined.map((id, i) => <span key={id}>{i > 0 && ", "}<TeamLink id={id} year={t.year} /></span>)}</li>
                    )}
                    {!t.first && t.left.length > 0 && (
                      <li className="text-gray-500">Last seen the year before: {t.left.map((id, i) => <span key={id}>{i > 0 && ", "}{franchiseName(id)}</span>)}</li>
                    )}
                    {t.renamed.map((r) => (
                      <li key={r.franchise}>{r.from} renamed to {r.to}</li>
                    ))}
                    {t.prevCount !== null && t.prevCount !== t.teamCount && <li>League goes from {t.prevCount} to {t.teamCount} teams.</li>}
                    {t.extra.map((e) => <li key={e}>{e}</li>)}
                  </ul>
                </li>
              ))}
            </ol>
          </CardContent>
        </Card>
        <p className="text-xs text-muted-foreground mt-2">Built from who appears in each season&apos;s standings. A franchise that skipped a year shows as leaving and rejoining.</p>
      </section>

      <section className="p-6 bg-blue-50 rounded-lg">
        <h3 className="text-xl font-bold mb-2">Know something we don&apos;t?</h3>
        <p className="text-gray-700 mb-3">
          Some of the record is still missing: week-by-week scores before 2003, a few playoff weeks, and who managed some of the 1990s teams.
          If you have old emails, spreadsheets or printouts, send them to the commissioner.
        </p>
        <a href="https://mlffatl.football.cbssports.com/" target="_blank" rel="noreferrer" className="text-blue-700 hover:text-blue-900 font-medium">
          League site on CBS Sports →
        </a>
      </section>
    </>
  )
}

// Format changes we can see in the data itself (week-18 games first appear in 2021).
const FORMAT_NOTES: Record<number, string> = {
  2021: "Championship becomes a two-week, total-points final (weeks 17 and 18).",
}

function timelineEntries(timeline: typeof history.timeline) {
  const counts = new Map(history.seasons.map((s) => [s.year, s.teamCount]))
  const years = new Set([...timeline.map((t) => t.year), ...Object.keys(FORMAT_NOTES).map(Number)])
  return [...years].sort((a, b) => a - b).map((year) => {
    const t = timeline.find((x) => x.year === year) ?? { year, teamCount: counts.get(year) ?? 0, joined: [], left: [], renamed: [], first: false }
    return { ...t, prevCount: t.first ? null : counts.get(year - 1) ?? null, extra: FORMAT_NOTES[year] ? [FORMAT_NOTES[year]] : [] }
  })
}

function Stat({ icon, label, value, sub }: { icon: React.ReactNode; label: string; value: React.ReactNode; sub: string }) {
  return (
    <Card className="text-center">
      <CardContent className="pt-6">
        <div className="flex justify-center mb-2">{icon}</div>
        <p className="text-3xl font-bold tabular-nums">{value}</p>
        <p className="font-medium">{label}</p>
        <p className="text-xs text-muted-foreground">{sub}</p>
      </CardContent>
    </Card>
  )
}

function Highlight({ label, value, who, when }: { label: string; value: string; who: React.ReactNode; when: string }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <p className="text-sm text-muted-foreground">{label}</p>
        <p className="text-3xl font-bold text-green-700 tabular-nums">{value}</p>
      </CardHeader>
      <CardContent className="text-sm">
        <div className="font-medium">{who}</div>
        <p className="text-muted-foreground">{when}</p>
      </CardContent>
    </Card>
  )
}
