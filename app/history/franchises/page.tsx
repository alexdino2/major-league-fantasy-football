import Link from "next/link"
import type { Metadata } from "next"
import { Card, CardContent } from "@/components/ui/card"
import { PageHeader, TeamLogo } from "@/components/history/team"
import { history, pct, record } from "@/lib/history"

export const metadata: Metadata = {
  title: "Franchises | MLFF History",
  description: "Every MLFF franchise since 1994, with all-time records, titles and season-by-season history.",
}

export default function FranchisesPage() {
  const active = history.franchises.filter((f) => f.active).sort((a, b) => b.titles - a.titles || b.record.pct - a.record.pct)
  const past = history.franchises.filter((f) => !f.active).sort((a, b) => b.lastYear - a.lastYear || b.seasonsPlayed - a.seasonsPlayed)
  return (
    <>
      <PageHeader title="Franchises" subtitle="Records follow the franchise through name changes." />
      <h2 className="text-2xl font-bold mb-4">Active</h2>
      <Grid list={active} />
      <h2 className="text-2xl font-bold mt-10 mb-4">Former</h2>
      <Grid list={past} />
    </>
  )
}

function Grid({ list }: { list: typeof history.franchises }) {
  return (
    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {list.map((f) => (
        <Link key={f.id} href={`/history/franchises/${f.id}`} className="group min-w-0">
          <Card className="h-full transition-shadow group-hover:shadow-md">
            <CardContent className="pt-5 flex gap-4">
              <TeamLogo id={f.id} size={56} />
              <div className="min-w-0">
                <p className="font-semibold text-lg leading-tight">{f.name}</p>
                <p className="text-sm text-muted-foreground">
                  {f.firstYear === f.lastYear ? f.firstYear : `${f.firstYear}–${f.active ? "present" : f.lastYear}`} · {f.seasonsPlayed} season{f.seasonsPlayed === 1 ? "" : "s"}
                </p>
                <p className="text-sm mt-1 tabular-nums">
                  {record(f.record)} ({pct(f.record)}){f.titles ? ` · ${f.titles} title${f.titles === 1 ? "" : "s"}` : ""}
                </p>
                {f.names.length > 1 && <p className="text-xs text-muted-foreground mt-1 truncate">Also: {f.names.filter((n) => n !== f.name).join(", ")}</p>}
              </div>
            </CardContent>
          </Card>
        </Link>
      ))}
    </div>
  )
}
