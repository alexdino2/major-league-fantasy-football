import Link from "next/link"
import type { Metadata } from "next"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Trophy } from "lucide-react"
import { PageHeader, TeamLogo } from "@/components/history/team"
import { history, record, seasonName } from "@/lib/history"

export const metadata: Metadata = {
  title: "Seasons | MLFF History",
  description: "Season-by-season MLFF standings, playoffs, weekly results and auctions.",
}

export default function SeasonsPage() {
  const seasons = [...history.seasons].reverse()
  return (
    <>
      <PageHeader title="Seasons" subtitle="Pick a year for standings, the championship, every weekly score on file, and the auction." />
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {seasons.map((s) => {
          const best = [...s.teams].sort((a, b) => a.regRank - b.regRank)[0]
          return (
            <Link key={s.year} href={`/history/seasons/${s.year}`} className="group">
              <Card className="h-full transition-shadow group-hover:shadow-md">
                <CardHeader className="pb-2">
                  <CardTitle className="text-2xl flex items-center justify-between">
                    {s.year}
                    <span className="text-xs font-normal text-muted-foreground">{s.teamCount} teams</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <div className="flex items-center gap-2 font-medium">
                    <Trophy className="w-4 h-4 text-yellow-500 shrink-0" />
                    {s.champion.length ? (
                      <span className="flex items-center gap-2">
                        {s.champion.map((c) => <TeamLogo key={c} id={c} size={20} />)}
                        {s.champion.map((c) => seasonName(c, s.year)).join(" & ")}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">Unknown</span>
                    )}
                  </div>
                  {best && (
                    <p className="text-muted-foreground">
                      Best record: {seasonName(best.franchise, s.year)} ({record(best)})
                    </p>
                  )}
                  <div className="flex flex-wrap gap-1 pt-1">
                    {s.hasWeekly ? <Badge variant="secondary">Weekly scores</Badge> : <Badge variant="outline">Standings only</Badge>}
                    {s.auction?.format === "auction" && <Badge variant="secondary">Auction</Badge>}
                    {s.notes.some((n) => /missing|unknown|not recorded/i.test(n)) && <Badge variant="outline" className="border-amber-300 text-amber-800">Gaps</Badge>}
                  </div>
                </CardContent>
              </Card>
            </Link>
          )
        })}
      </div>
    </>
  )
}
