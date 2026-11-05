import type { Metadata } from "next"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { PageHeader, TeamLink, TeamLogo } from "@/components/history/team"
import { history, franchiseName, pct, record } from "@/lib/history"

export const metadata: Metadata = {
  title: "Head to Head | MLFF History",
  description: "All-time MLFF head-to-head records between every pair of franchises since 2003.",
}

export default function HeadToHeadPage() {
  const h2h = history.h2h
  const teams = history.franchises
    .filter((f) => h2h[f.id] && Object.values(h2h[f.id]).reduce((a, r) => a + r.games, 0) >= 30)
    .sort((a, b) => Number(b.active) - Number(a.active) || a.name.localeCompare(b.name))

  const pairs: Array<{ a: string; b: string; W: number; L: number; T: number; games: number; postW: number; postL: number }> = []
  for (const [a, opps] of Object.entries(h2h)) {
    for (const [b, r] of Object.entries(opps)) {
      if (a < b) pairs.push({ a, b, ...r })
    }
  }
  const mostPlayed = [...pairs].sort((x, y) => y.games - x.games).slice(0, 8)
  const lopsided = pairs
    .filter((p) => p.games >= 15)
    .map((p) => {
      const lead = p.W >= p.L ? { top: p.a, bot: p.b, W: p.W, L: p.L } : { top: p.b, bot: p.a, W: p.L, L: p.W }
      return { ...lead, T: p.T, games: p.games, share: lead.W / (p.W + p.L || 1) }
    })
    .sort((x, y) => y.share - x.share)
    .slice(0, 8)
  const playoffRivals = pairs
    .filter((p) => p.postW + p.postL >= 3)
    .sort((x, y) => y.postW + y.postL - (x.postW + x.postL))
    .slice(0, 8)

  return (
    <>
      <PageHeader title="Head to Head" subtitle="Every game on file from 2003 onward, regular season and postseason. Read across: the row team's record against the column team." />

      <Card className="mb-10">
        <CardContent className="p-0 overflow-x-auto">
          <table className="text-xs sm:text-sm border-collapse w-full">
            <thead>
              <tr>
                <th className="sticky left-0 bg-white p-2 text-left font-medium text-muted-foreground">vs →</th>
                {teams.map((t) => (
                  <th key={t.id} className="p-1 text-center font-medium" title={t.name}>
                    <div className="flex flex-col items-center gap-1">
                      <TeamLogo id={t.id} size={24} />
                      <span className="hidden lg:block text-[10px] leading-tight max-w-[64px]">{t.name}</span>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {teams.map((row) => (
                <tr key={row.id} className="border-t">
                  <th className="sticky left-0 bg-white p-2 text-left font-medium whitespace-nowrap"><TeamLink id={row.id} /></th>
                  {teams.map((col) => {
                    if (col.id === row.id) return <td key={col.id} className="bg-gray-100" />
                    const r = h2h[row.id]?.[col.id]
                    if (!r) return <td key={col.id} className="p-1 text-center text-gray-300">—</td>
                    const share = (r.W + 0.5 * r.T) / r.games
                    const bg = share >= 0.6 ? "bg-green-200" : share > 0.5 ? "bg-green-50" : share === 0.5 ? "" : share > 0.4 ? "bg-red-50" : "bg-red-200"
                    return (
                      <td key={col.id} className={`p-1 text-center tabular-nums whitespace-nowrap ${bg}`} title={`${row.name} v ${col.name}: ${record(r)} (${pct(r)})`}>
                        {record(r)}
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <div className="grid lg:grid-cols-3 gap-4">
        <ListCard title="Most-played matchups">
          {mostPlayed.map((p) => (
            <Row key={p.a + p.b} left={<><TeamLink id={p.a} /> v <TeamLink id={p.b} /></>} right={`${p.games} games · ${record(p)}`} />
          ))}
        </ListCard>
        <ListCard title="Most one-sided rivalries" note="At least 15 meetings.">
          {lopsided.map((p) => (
            <Row key={p.top + p.bot} left={<><TeamLink id={p.top} /> over {franchiseName(p.bot)}</>} right={`${record(p)} · ${Math.round(p.share * 100)}%`} />
          ))}
        </ListCard>
        <ListCard title="Postseason rivalries" note="Week 17–18 meetings, row team first.">
          {playoffRivals.map((p) => (
            <Row key={p.a + p.b} left={<><TeamLink id={p.a} /> v <TeamLink id={p.b} /></>} right={`${p.postW}-${p.postL}`} />
          ))}
        </ListCard>
      </div>
    </>
  )
}

function ListCard({ title, note, children }: { title: string; note?: string; children: React.ReactNode }) {
  return (
    <Card>
      <CardHeader className="pb-2"><CardTitle className="text-lg">{title}</CardTitle></CardHeader>
      <CardContent className="space-y-1.5 text-sm">
        {children}
        {note && <p className="text-xs text-muted-foreground pt-1">{note}</p>}
      </CardContent>
    </Card>
  )
}

function Row({ left, right }: { left: React.ReactNode; right: string }) {
  return (
    <div className="flex justify-between gap-2">
      <span className="min-w-0">{left}</span>
      <span className="tabular-nums shrink-0 text-gray-600">{right}</span>
    </div>
  )
}
