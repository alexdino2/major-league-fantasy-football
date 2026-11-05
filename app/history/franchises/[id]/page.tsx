import Link from "next/link"
import { notFound } from "next/navigation"
import type { Metadata } from "next"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Trophy } from "lucide-react"
import { PageHeader, TeamLink, TeamLogo } from "@/components/history/team"
import { franchise as getFranchise, history, fmt, ordinal, pct, record } from "@/lib/history"

export function generateStaticParams() {
  return history.franchises.map((f) => ({ id: f.id }))
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params
  const f = getFranchise(id)
  return { title: `${f?.name ?? "Franchise"} | MLFF History` }
}

export default async function FranchisePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const f = getFranchise(id)
  if (!f) notFound()

  const vs = Object.entries(history.h2h[f.id] ?? {})
    .map(([opp, r]) => ({ opp, ...r }))
    .sort((a, b) => b.games - a.games)
  const seasons = [...f.seasons].reverse()
  const maxPct = 1

  return (
    <>
      <div className="flex items-center gap-4 mb-2">
        <TeamLogo id={f.id} size={72} />
        <div>
          <PageHeader
            title={f.name}
            subtitle={
              <>
                {f.firstYear === f.lastYear ? f.firstYear : `${f.firstYear}–${f.active ? "present" : f.lastYear}`} · {f.seasonsPlayed} season{f.seasonsPlayed === 1 ? "" : "s"}
                {f.manager && <> · Manager: {f.manager}</>}
              </>
            }
          />
        </div>
      </div>
      {f.names.length > 1 && (
        <p className="text-sm text-muted-foreground -mt-4 mb-6">Has also played as: {f.names.filter((n) => n !== f.name).join(", ")}</p>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10">
        <Tile label="All-time record" value={record(f.record)} sub={`${pct(f.record)} · ${f.winningSeasons} winning seasons`} />
        <Tile label="Championships" value={f.titles ? String(f.titles) : "0"} sub={f.titleYears.length ? f.titleYears.join(", ") : "Still chasing one"} />
        <Tile label="Finals" value={String(f.finals)} sub={`${f.runnerUps} runner-up finish${f.runnerUps === 1 ? "" : "es"}`} />
        <Tile
          label="Best season"
          value={record(f.bestSeason)}
          sub={`${f.bestSeason.year} · ${fmt(f.bestSeason.PF)} PF`}
        />
      </div>

      {/* Season by season */}
      <section className="mb-10">
        <h2 className="text-2xl font-bold mb-4">Season by season</h2>
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Year</TableHead>
                  <TableHead className="hidden md:table-cell">Played as</TableHead>
                  <TableHead className="text-right">Record</TableHead>
                  <TableHead className="hidden sm:table-cell w-40">Win %</TableHead>
                  <TableHead className="text-right">PF</TableHead>
                  <TableHead className="text-right hidden sm:table-cell">PA</TableHead>
                  <TableHead className="text-right">Reg. rank</TableHead>
                  <TableHead className="text-right">Finish</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {seasons.map((s) => {
                  const p = (s.W + 0.5 * s.T) / Math.max(1, s.W + s.L + s.T)
                  return (
                    <TableRow key={s.year} className={s.champion ? "bg-yellow-50" : ""}>
                      <TableCell className="font-semibold">
                        <Link href={`/history/seasons/${s.year}`} className="text-green-700 hover:underline">{s.year}</Link>
                        {s.champion && <Trophy className="inline w-4 h-4 ml-1 text-yellow-500" aria-label="Champion" />}
                      </TableCell>
                      <TableCell className="hidden md:table-cell text-gray-600">{s.name}</TableCell>
                      <TableCell className="text-right tabular-nums">{record(s)}</TableCell>
                      <TableCell className="hidden sm:table-cell">
                        <div className="h-2 rounded bg-gray-100" title={pct(s)}>
                          <div className={`h-2 rounded ${p >= 0.5 ? "bg-green-600" : "bg-gray-400"}`} style={{ width: `${(p / maxPct) * 100}%` }} />
                        </div>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{fmt(s.PF)}</TableCell>
                      <TableCell className="text-right tabular-nums hidden sm:table-cell">{fmt(s.PA)}</TableCell>
                      <TableCell className="text-right tabular-nums">{ordinal(s.regRank)}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {s.champion ? <Badge>{s.coChampion ? "Co-champ" : "Champion"}</Badge> : s.runnerUp ? <Badge variant="secondary">Runner-up</Badge> : ordinal(s.finish)}
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </section>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Head to head */}
        {vs.length > 0 && (
          <section>
            <h2 className="text-2xl font-bold mb-4">Head to head</h2>
            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Opponent</TableHead>
                      <TableHead className="text-right">Record</TableHead>
                      <TableHead className="text-right hidden sm:table-cell">Avg score</TableHead>
                      <TableHead className="text-right">Postseason</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {vs.map((r) => (
                      <TableRow key={r.opp}>
                        <TableCell><TeamLink id={r.opp} /></TableCell>
                        <TableCell className={`text-right tabular-nums ${r.W > r.L ? "text-green-700 font-medium" : r.W < r.L ? "text-red-700" : ""}`}>{record(r)}</TableCell>
                        <TableCell className="text-right tabular-nums hidden sm:table-cell">{(r.PF / r.games).toFixed(1)}–{(r.PA / r.games).toFixed(1)}</TableCell>
                        <TableCell className="text-right tabular-nums">{r.postW + r.postL ? `${r.postW}-${r.postL}` : "—"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
            <p className="text-xs text-muted-foreground mt-2">Every game on file, 2003 onward, including the postseason.</p>
          </section>
        )}

        {/* Auction profile */}
        {f.auction && (
          <section>
            <h2 className="text-2xl font-bold mb-4">At the auction</h2>
            <div className="space-y-4">
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-lg">Biggest buys</CardTitle></CardHeader>
                <CardContent className="space-y-1 text-sm">
                  {f.auction.mostExpensive.map((p, i) => (
                    <div key={i} className="flex justify-between gap-2">
                      <span><span className="font-medium">{p.player}</span> <span className="text-xs text-muted-foreground">{p.pos} · {p.year}</span></span>
                      <span className="tabular-nums font-semibold">${p.salary}</span>
                    </div>
                  ))}
                </CardContent>
              </Card>
              {f.auction.mostBought.length > 0 && (
                <Card>
                  <CardHeader className="pb-2"><CardTitle className="text-lg">Old favorites</CardTitle></CardHeader>
                  <CardContent className="space-y-1 text-sm">
                    {f.auction.mostBought.map((p) => (
                      <div key={p.player} className="flex justify-between gap-2">
                        <span><span className="font-medium">{p.player}</span> <span className="text-xs text-muted-foreground">{p.pos} · {p.years.join(", ")}</span></span>
                        <span className="tabular-nums shrink-0">{p.times}× · ${p.spend}</span>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              )}
              <p className="text-xs text-muted-foreground">Auctions on file: {f.auction.years.join(", ")}.</p>
            </div>
          </section>
        )}
      </div>
    </>
  )
}

function Tile({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <Card>
      <CardContent className="pt-5">
        <p className="text-sm text-muted-foreground">{label}</p>
        <p className="text-2xl font-bold tabular-nums">{value}</p>
        <p className="text-xs text-muted-foreground">{sub}</p>
      </CardContent>
    </Card>
  )
}
