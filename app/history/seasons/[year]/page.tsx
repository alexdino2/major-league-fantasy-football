import Link from "next/link"
import { notFound } from "next/navigation"
import type { Metadata } from "next"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { ChevronLeft, ChevronRight, Trophy } from "lucide-react"
import { DataNote, PageHeader, TeamLink } from "@/components/history/team"
import { history, season as getSeason, fmt, ordinal, pct, record, seasonName, type Game, type Season } from "@/lib/history"

export function generateStaticParams() {
  return history.seasons.map((s) => ({ year: String(s.year) }))
}

export async function generateMetadata({ params }: { params: Promise<{ year: string }> }): Promise<Metadata> {
  const { year } = await params
  return { title: `${year} Season | MLFF History` }
}

const POS_ORDER = ["QB", "RB", "WR", "TE", "K", "DST", "?"]

export default async function SeasonPage({ params }: { params: Promise<{ year: string }> }) {
  const { year: y } = await params
  const year = Number(y)
  const s = getSeason(year)
  if (!s) notFound()

  const prev = getSeason(year - 1)
  const next = getSeason(year + 1)
  const divisions = s.divisions.length ? s.divisions : [null]
  const final = s.playoff?.final
  const regGames = s.games
  const weeks = [...new Set(regGames.map((g) => g.week))].sort((a, b) => a - b)
  const weekHigh = new Map(weeks.map((w) => [w, Math.max(...regGames.filter((g) => g.week === w).flatMap((g) => [g.awayPts, g.homePts]))]))

  const superlatives = regGames.length ? seasonSuperlatives(regGames) : null
  const hasPA = s.teams.some((t) => t.PA !== undefined && t.PA !== null)
  const hasHighLow = s.teams.some((t) => t.max != null)

  return (
    <>
      <div className="flex items-center justify-between mb-4 text-sm">
        {prev ? <Link href={`/history/seasons/${prev.year}`} className="inline-flex items-center text-green-700 hover:underline"><ChevronLeft className="w-4 h-4" />{prev.year}</Link> : <span />}
        <Link href="/history/seasons" className="text-muted-foreground hover:underline">All seasons</Link>
        {next ? <Link href={`/history/seasons/${next.year}`} className="inline-flex items-center text-green-700 hover:underline">{next.year}<ChevronRight className="w-4 h-4" /></Link> : <span />}
      </div>

      <PageHeader
        title={`${year} Season`}
        subtitle={`${s.teamCount} teams${s.divisions.length ? ` · ${s.divisions.join(" and ")} divisions` : ""} · ${s.source === "cbs" ? "CBS Sports records" : "Pre-CBS league records"}`}
      />

      {s.notes.length > 0 && (
        <div className="space-y-2 mb-8">
          {s.notes.map((n) => <DataNote key={n}>{n}</DataNote>)}
        </div>
      )}

      {/* Champion */}
      <section className="grid md:grid-cols-3 gap-4 mb-10">
        <Card className="md:col-span-1 border-yellow-200 bg-yellow-50">
          <CardHeader className="pb-2">
            <p className="text-sm text-muted-foreground flex items-center gap-1"><Trophy className="w-4 h-4 text-yellow-500" /> Champion{s.champion.length > 1 ? "s" : ""}</p>
          </CardHeader>
          <CardContent className="space-y-1">
            {s.champion.map((c) => (
              <div key={c} className="text-xl font-bold"><TeamLink id={c} year={year} logo /></div>
            ))}
            {s.runnerUp && <p className="text-sm text-muted-foreground pt-1">Runner-up: <TeamLink id={s.runnerUp} year={year} /></p>}
          </CardContent>
        </Card>
        {final && (
          <Card className="md:col-span-2">
            <CardHeader className="pb-2">
              <p className="text-sm text-muted-foreground">Championship · week {final.legs[0]?.week ?? 17}</p>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Team</TableHead>
                    {final.legs.map((l) => <TableHead key={l.week} className="text-right">Wk {l.week}</TableHead>)}
                    {final.legs.length > 1 && <TableHead className="text-right">Total</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {[final.winner, final.loser].map((t) => (
                    <TableRow key={t} className={t === final.winner ? "font-semibold" : "text-gray-600"}>
                      <TableCell><TeamLink id={t} year={year} logo /></TableCell>
                      {final.legs.map((l) => <TableCell key={l.week} className="text-right tabular-nums">{fmt(l[t])}</TableCell>)}
                      {final.legs.length > 1 && <TableCell className="text-right tabular-nums">{fmt(final.score[t])}</TableCell>}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {!final.complete && <p className="text-xs text-amber-800 mt-2">Only part of this final is in the CBS export.</p>}
            </CardContent>
          </Card>
        )}
      </section>

      {/* Standings */}
      <section className="mb-10">
        <h2 className="text-2xl font-bold mb-4">Regular-season standings</h2>
        <div className="grid xl:grid-cols-2 gap-4">
          {divisions.map((div) => {
            const rows = s.teams.filter((t) => (div ? t.division === div : true)).sort((a, b) => a.regRank - b.regRank)
            return (
              <Card key={div ?? "all"} className="min-w-0">
                {div && <CardHeader className="pb-0"><CardTitle className="text-lg">{div} Division</CardTitle></CardHeader>}
                <CardContent className="p-0 pt-2">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-8 pr-0">#</TableHead>
                        <TableHead>Team</TableHead>
                        <TableHead className="text-right">W-L-T</TableHead>
                        <TableHead className="text-right hidden sm:table-cell">Pct</TableHead>
                        <TableHead className="text-right">PF</TableHead>
                        {hasPA && <TableHead className="text-right hidden sm:table-cell">PA</TableHead>}
                        {hasHighLow && <TableHead className="text-right hidden md:table-cell">High</TableHead>}
                        {s.hasWeekly && <TableHead className="text-right hidden md:table-cell" title="Weeks with the league's top score">Top wk</TableHead>}
                        <TableHead className="text-right">Finish</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {rows.map((t) => (
                        <TableRow key={t.franchise} className={s.champion.includes(t.franchise) ? "bg-yellow-50" : ""}>
                          <TableCell className="pr-0 text-xs text-muted-foreground tabular-nums">{t.regRank}</TableCell>
                          <TableCell className="font-medium">
                            <TeamLink id={t.franchise} year={year} />
                          </TableCell>
                          <TableCell className="text-right tabular-nums">{t.W}-{t.L}-{t.T}</TableCell>
                          <TableCell className="text-right tabular-nums hidden sm:table-cell">{pct(t)}</TableCell>
                          <TableCell className="text-right tabular-nums">{fmt(t.PF)}</TableCell>
                          {hasPA && <TableCell className="text-right tabular-nums hidden sm:table-cell">{fmt(t.PA ?? null)}</TableCell>}
                          {hasHighLow && <TableCell className="text-right tabular-nums hidden md:table-cell">{fmt(t.max ?? null)}</TableCell>}
                          {s.hasWeekly && <TableCell className="text-right tabular-nums hidden md:table-cell">{t.weeksWon ? fmt(t.weeksWon, Number.isInteger(t.weeksWon) ? 0 : 1) : "—"}</TableCell>}
                          <TableCell className="text-right tabular-nums">{t.finish ? ordinal(t.finish) : "—"}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            )
          })}
        </div>
        <p className="text-xs text-muted-foreground mt-2"># is overall regular-season rank (win pct, then points for). Finish is the final placing after the postseason, where the bracket export has it.</p>
      </section>

      {superlatives && (
        <section className="mb-10">
          <h2 className="text-2xl font-bold mb-4">Season superlatives</h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Super label="High score" value={fmt(superlatives.high.pts)} who={<TeamLink id={superlatives.high.team} year={year} />} when={`Week ${superlatives.high.week}`} />
            <Super label="Low score" value={fmt(superlatives.low.pts)} who={<TeamLink id={superlatives.low.team} year={year} />} when={`Week ${superlatives.low.week}`} />
            <Super label="Biggest blowout" value={`+${fmt(superlatives.blowout.margin)}`} who={<TeamLink id={superlatives.blowout.winner} year={year} />} when={`Week ${superlatives.blowout.week}, ${superlatives.blowout.w}–${superlatives.blowout.l}`} />
            <Super label="Closest game" value={superlatives.closest.margin === 0 ? "Tie" : `${fmt(superlatives.closest.margin)} pt`} who={<span><TeamLink id={superlatives.closest.winner} year={year} /> v <TeamLink id={superlatives.closest.loser} year={year} /></span>} when={`Week ${superlatives.closest.week}, ${superlatives.closest.w}–${superlatives.closest.l}`} />
          </div>
        </section>
      )}

      {/* Postseason games */}
      {s.playoff && s.playoff.games.length > 0 && (
        <section className="mb-10">
          <h2 className="text-2xl font-bold mb-4">Postseason</h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {s.playoff.games.map((g, i) => (
              <GameCard key={i} g={g} year={year} label={`Week ${g.week} · ${g.kind === "final" ? "Championship" : "Placement"}`} highlight={g.kind === "final"} />
            ))}
          </div>
        </section>
      )}

      {/* Weekly results */}
      {weeks.length > 0 && (
        <section className="mb-10">
          <h2 className="text-2xl font-bold mb-4">Week by week</h2>
          <div className="grid md:grid-cols-2 xl:grid-cols-4 gap-4">
            {weeks.map((w) => (
              <Card key={w}>
                <CardHeader className="py-3"><CardTitle className="text-base">Week {w}</CardTitle></CardHeader>
                <CardContent className="pt-0 space-y-1.5">
                  {regGames.filter((g) => g.week === w).map((g, i) => (
                    <MiniGame key={i} g={g} year={year} top={weekHigh.get(w)!} />
                  ))}
                </CardContent>
              </Card>
            ))}
          </div>
          <p className="text-xs text-muted-foreground mt-2">Winner in bold. <span className="text-green-700 font-semibold">Green</span> marks the week&apos;s top score.</p>
        </section>
      )}

      <AuctionSection s={s} />
    </>
  )
}

function seasonSuperlatives(games: Game[]) {
  const scores = games.flatMap((g) => [
    { team: g.away, pts: g.awayPts, week: g.week },
    { team: g.home, pts: g.homePts, week: g.week },
  ])
  const high = [...scores].sort((a, b) => b.pts - a.pts)[0]
  const low = [...scores].filter((x) => x.pts > 0).sort((a, b) => a.pts - b.pts)[0]
  const results = games.map((g) => {
    const awayWin = g.awayPts >= g.homePts
    return {
      week: g.week,
      winner: awayWin ? g.away : g.home,
      loser: awayWin ? g.home : g.away,
      w: awayWin ? g.awayPts : g.homePts,
      l: awayWin ? g.homePts : g.awayPts,
      margin: Math.abs(g.awayPts - g.homePts),
    }
  })
  const blowout = [...results].sort((a, b) => b.margin - a.margin)[0]
  const closest = [...results].sort((a, b) => a.margin - b.margin)[0]
  return { high, low, blowout, closest }
}

function Super({ label, value, who, when }: { label: string; value: string; who: React.ReactNode; when: string }) {
  return (
    <Card>
      <CardContent className="pt-5">
        <p className="text-sm text-muted-foreground">{label}</p>
        <p className="text-2xl font-bold text-green-700 tabular-nums">{value}</p>
        <div className="text-sm font-medium">{who}</div>
        <p className="text-xs text-muted-foreground">{when}</p>
      </CardContent>
    </Card>
  )
}

function GameCard({ g, year, label, highlight }: { g: Game; year: number; label: string; highlight?: boolean }) {
  const awayWin = g.awayPts > g.homePts
  const homeWin = g.homePts > g.awayPts
  return (
    <Card className={highlight ? "border-yellow-300" : ""}>
      <CardContent className="pt-4 text-sm">
        <p className="text-xs text-muted-foreground mb-2">{label}</p>
        <div className={`flex justify-between ${awayWin ? "font-semibold" : "text-gray-600"}`}><TeamLink id={g.away} year={year} /><span className="tabular-nums">{fmt(g.awayPts)}</span></div>
        <div className={`flex justify-between ${homeWin ? "font-semibold" : "text-gray-600"}`}><TeamLink id={g.home} year={year} /><span className="tabular-nums">{fmt(g.homePts)}</span></div>
      </CardContent>
    </Card>
  )
}

function MiniGame({ g, year, top }: { g: Game; year: number; top: number }) {
  const rows: Array<[string, number, boolean]> = [
    [g.away, g.awayPts, g.awayPts > g.homePts],
    [g.home, g.homePts, g.homePts > g.awayPts],
  ]
  return (
    <div className="rounded border border-gray-100 px-2 py-1 text-xs">
      {rows.map(([t, p, win]) => (
        <div key={t} className={`flex justify-between gap-2 ${win ? "font-semibold" : "text-gray-600"}`}>
          <span className="truncate">{seasonName(t, year)}</span>
          <span className={`tabular-nums ${p === top ? "text-green-700" : ""}`}>{fmt(p)}</span>
        </div>
      ))}
    </div>
  )
}

function AuctionSection({ s }: { s: Season }) {
  const a = s.auction
  if (!a) return null
  if (a.format !== "auction") {
    return (
      <section className="mb-10">
        <h2 className="text-2xl font-bold mb-4">Draft</h2>
        <DataNote>{a.note}</DataNote>
      </section>
    )
  }
  const year = s.year
  const positions = POS_ORDER.filter((p) => a.positionSpend?.[p])
  const teamRows = Object.entries(a.teamSpend ?? {}).sort((x, y) => (a.hasPoints ? y[1].fpts - x[1].fpts : y[1].spend - x[1].spend))
  return (
    <section className="mb-10">
      <div className="flex items-baseline justify-between mb-4">
        <h2 className="text-2xl font-bold">{year} auction</h2>
        <Link href="/history/auctions" className="text-sm text-green-700 hover:underline">Auction history →</Link>
      </div>
      <div className="grid lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2 min-w-0">
          <CardHeader className="pb-2"><CardTitle className="text-lg">Top buys</CardTitle></CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Player</TableHead>
                  <TableHead className="hidden sm:table-cell">Bought by</TableHead>
                  <TableHead className="text-right">Price</TableHead>
                  {a.hasPoints && <TableHead className="text-right">Pts</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {a.topBuys!.slice(0, 12).map((p, i) => (
                  <TableRow key={i}>
                    <TableCell>
                      <span className="font-medium">{p.player}</span> <span className="text-xs text-muted-foreground">{p.pos}{p.nflTeam ? ` · ${p.nflTeam}` : ""}</span>
                      <span className="block sm:hidden text-xs text-muted-foreground">{p.team ? seasonName(p.team, year) : "Unassigned"}</span>
                    </TableCell>
                    <TableCell className="hidden sm:table-cell">{p.team ? <TeamLink id={p.team} year={year} /> : <span className="text-muted-foreground">Unassigned</span>}</TableCell>
                    <TableCell className="text-right tabular-nums font-semibold">${p.salary}</TableCell>
                    {a.hasPoints && <TableCell className="text-right tabular-nums">{fmt(p.fpts)}</TableCell>}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-lg">Where the money went</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {positions.map((p) => {
              const v = a.positionSpend![p]
              return (
                <div key={p}>
                  <div className="flex justify-between text-sm"><span className="font-medium">{p === "?" ? "K/DST (unlabeled)" : p}</span><span className="tabular-nums text-muted-foreground">${fmt(v.spend)} · {Math.round(v.share * 100)}%</span></div>
                  <div className="h-2 rounded bg-gray-100"><div className="h-2 rounded bg-green-600" style={{ width: `${Math.max(1, v.share * 100)}%` }} /></div>
                </div>
              )
            })}
            <p className="text-xs text-muted-foreground pt-2">${fmt(a.totalSpend)} spent on {a.picks} players.</p>
          </CardContent>
        </Card>
      </div>

      {a.hasPoints && (
        <div className="grid lg:grid-cols-3 gap-4 mt-4">
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-lg">Best bargains ($10 or less)</CardTitle></CardHeader>
            <CardContent className="space-y-1 text-sm">
              {a.bestValues!.map((p, i) => (
                <div key={i} className="flex justify-between gap-2">
                  <span className="truncate"><span className="font-medium">{p.player}</span> <span className="text-xs text-muted-foreground">{p.pos} · {p.team ? seasonName(p.team, year) : "?"}</span></span>
                  <span className="tabular-nums shrink-0">${p.salary} → {fmt(p.fpts)}</span>
                </div>
              ))}
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-lg">Priciest letdowns</CardTitle></CardHeader>
            <CardContent className="space-y-1 text-sm">
              {a.busts!.map((p, i) => (
                <div key={i} className="flex justify-between gap-2">
                  <span className="truncate"><span className="font-medium">{p.player}</span> <span className="text-xs text-muted-foreground">{p.pos} · {p.team ? seasonName(p.team, year) : "?"}</span></span>
                  <span className="tabular-nums shrink-0">${p.salary} → {fmt(p.fpts)}</span>
                </div>
              ))}
              <p className="text-xs text-muted-foreground pt-1">Lowest points per dollar among the 30 most expensive players.</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-lg">Points from the auction</CardTitle></CardHeader>
            <CardContent className="space-y-1 text-sm">
              {teamRows.map(([t, v]) => (
                <div key={t} className="flex justify-between gap-2">
                  <TeamLink id={t} year={year} />
                  <span className="tabular-nums">{fmt(v.fpts)} <span className="text-xs text-muted-foreground">(${v.spend})</span></span>
                </div>
              ))}
              <p className="text-xs text-muted-foreground pt-1">Season points scored by each team&apos;s auctioned players, whether or not they started. Waiver pickups are not included.</p>
            </CardContent>
          </Card>
        </div>
      )}
    </section>
  )
}
