import Link from "next/link"
import type { Metadata } from "next"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { DataNote, PageHeader, TeamLink } from "@/components/history/team"
import { history } from "@/lib/history"

export const metadata: Metadata = {
  title: "Auctions | MLFF History",
  description: "MLFF auction history: record prices, where the money goes, and the players the league keeps buying.",
}

const POS = ["QB", "RB", "WR", "TE", "K", "DST"] as const
const POS_COLOR: Record<string, string> = {
  QB: "bg-blue-600",
  RB: "bg-green-600",
  WR: "bg-orange-500",
  TE: "bg-purple-500",
  K: "bg-gray-400",
  DST: "bg-gray-600",
}

export default function AuctionsPage() {
  const a = history.auctions
  const first = a.years[0]
  const last = a.years[a.years.length - 1]
  return (
    <>
      <PageHeader title="Auctions" subtitle={`${a.years.length} auctions on file, ${first}–${last}. $300 cap per team.`} />
      <div className="mb-8">
        <DataNote>
          Draft files before {first} are missing or unreadable (2008 is a garbled snake-draft export; 2009 and earlier are not on file). Player
          season points are only in the {history.seasons.filter((s) => s.auction?.hasPoints).map((s) => s.year).join(", ")} exports.
        </DataNote>
      </div>

      <section className="mb-10">
        <h2 className="text-2xl font-bold mb-4">Where the money goes</h2>
        <Card>
          <CardContent className="pt-6 space-y-2">
            {a.positionShareByYear.map((row) => {
              const known = POS.reduce((s, p) => s + (row[p] || 0), 0)
              return (
                <div key={row.year} className="flex items-center gap-3">
                  <Link href={`/history/seasons/${row.year}`} className="w-12 text-sm text-green-700 hover:underline tabular-nums">{row.year}</Link>
                  <div className="flex h-5 flex-1 overflow-hidden rounded">
                    {POS.map((p) => (
                      <div key={p} className={POS_COLOR[p]} style={{ width: `${(row[p] / known) * 100}%` }} title={`${p}: ${Math.round((row[p] / known) * 100)}%`} />
                    ))}
                  </div>
                  <span className="w-28 text-xs text-muted-foreground tabular-nums hidden sm:block">
                    RB {Math.round((row.RB / known) * 100)}% · WR {Math.round((row.WR / known) * 100)}%
                  </span>
                </div>
              )
            })}
            <div className="flex flex-wrap gap-3 pt-3 text-xs">
              {POS.map((p) => (
                <span key={p} className="inline-flex items-center gap-1"><span className={`inline-block h-3 w-3 rounded-sm ${POS_COLOR[p]}`} />{p}</span>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">Share of position-labeled dollars. In 2010–2011 some kickers and defenses have no position label and are left out.</p>
          </CardContent>
        </Card>
      </section>

      <div className="grid lg:grid-cols-2 gap-6 mb-10">
        <section>
          <h2 className="text-2xl font-bold mb-4">Top price each year</h2>
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader><TableRow><TableHead>Year</TableHead><TableHead>Player</TableHead><TableHead className="hidden sm:table-cell">Bought by</TableHead><TableHead className="text-right">Price</TableHead></TableRow></TableHeader>
                <TableBody>
                  {[...a.topPriceByYear].reverse().map((p) => (
                    <TableRow key={p.year}>
                      <TableCell><Link href={`/history/seasons/${p.year}`} className="text-green-700 hover:underline">{p.year}</Link></TableCell>
                      <TableCell><span className="font-medium">{p.player}</span> <span className="text-xs text-muted-foreground">{p.pos}</span></TableCell>
                      <TableCell className="hidden sm:table-cell">{p.team ? <TeamLink id={p.team} year={p.year} /> : "—"}</TableCell>
                      <TableCell className="text-right tabular-nums font-semibold">${p.salary}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </section>
        <section>
          <h2 className="text-2xl font-bold mb-4">Most expensive ever</h2>
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader><TableRow><TableHead className="w-8">#</TableHead><TableHead>Player</TableHead><TableHead className="hidden sm:table-cell">Bought by</TableHead><TableHead className="text-right">Price</TableHead></TableRow></TableHeader>
                <TableBody>
                  {a.mostExpensive.slice(0, 15).map((p, i) => (
                    <TableRow key={i}>
                      <TableCell className="text-muted-foreground">{i + 1}</TableCell>
                      <TableCell><span className="font-medium">{p.player}</span> <span className="text-xs text-muted-foreground">{p.pos} · {p.year}</span></TableCell>
                      <TableCell className="hidden sm:table-cell">{p.team ? <TeamLink id={p.team} year={p.year} /> : "—"}</TableCell>
                      <TableCell className="text-right tabular-nums font-semibold">${p.salary}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </section>
      </div>

      <section className="mb-10">
        <h2 className="text-2xl font-bold mb-4">Record price by position</h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {POS.map((p) => (
            <Card key={p}>
              <CardHeader className="pb-2"><CardTitle className="text-lg">{p}</CardTitle></CardHeader>
              <CardContent className="space-y-1 text-sm">
                {a.mostExpensiveByPos[p].map((x, i) => (
                  <div key={i} className="flex justify-between gap-2">
                    <span className="truncate"><span className="font-medium">{x.player}</span> <span className="text-xs text-muted-foreground">{x.year}</span></span>
                    <span className="tabular-nums shrink-0">${x.salary}</span>
                  </div>
                ))}
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <section>
        <h2 className="text-2xl font-bold mb-4">Where the league&apos;s money has gone</h2>
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader><TableRow><TableHead className="w-8">#</TableHead><TableHead>Player</TableHead><TableHead className="text-right">Times bought</TableHead><TableHead className="text-right hidden sm:table-cell">Top price</TableHead><TableHead className="text-right">Total spent</TableHead></TableRow></TableHeader>
              <TableBody>
                {a.mostTotalSpend.map((p, i) => (
                  <TableRow key={p.player}>
                    <TableCell className="text-muted-foreground">{i + 1}</TableCell>
                    <TableCell><span className="font-medium">{p.player}</span> <span className="text-xs text-muted-foreground">{p.pos} · {p.years[0]}–{p.years[p.years.length - 1]}</span></TableCell>
                    <TableCell className="text-right tabular-nums">{p.times}</TableCell>
                    <TableCell className="text-right tabular-nums hidden sm:table-cell">${p.maxSalary}</TableCell>
                    <TableCell className="text-right tabular-nums font-semibold">${p.spend}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </section>
    </>
  )
}
