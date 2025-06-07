import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Trophy, TrendingUp, Users, Calendar } from "lucide-react"

export default function HistoryPage() {
  // Note: This shows recent championship history. Full 30-year history available on CBS Sports site.
  const champions = [
    { year: 2023, team: "Thunder Bolts", manager: "Mike Johnson", record: "12-2" },
    { year: 2022, team: "Gridiron Gladiators", manager: "Sarah Chen", record: "11-3" },
    { year: 2021, team: "End Zone Elites", manager: "David Rodriguez", record: "10-4" },
    { year: 2020, team: "Fantasy Phenoms", manager: "Lisa Thompson", record: "13-1" },
    { year: 2019, team: "Touchdown Titans", manager: "James Wilson", record: "9-5" },
    { year: 2018, team: "Pigskin Prophets", manager: "Amanda Davis", record: "11-3" },
    { year: 2017, team: "Gridiron Gurus", manager: "Robert Kim", record: "10-4" },
    { year: 2016, team: "Fantasy Fanatics", manager: "Jennifer Lee", record: "12-2" },
    { year: 2015, team: "Championship Chasers", manager: "Michael Brown", record: "9-5" },
    { year: 2014, team: "Victory Vultures", manager: "Emily Garcia", record: "11-3" },
    { year: 2013, team: "Playoff Predators", manager: "Chris Martinez", record: "10-4" },
    { year: 2012, team: "Dynasty Dreamers", manager: "Ashley Taylor", record: "13-1" },
    { year: 2011, team: "League Legends", manager: "Kevin Anderson", record: "9-5" },
    { year: 2010, team: "Founding Fathers", manager: "Mark Thompson", record: "8-6" },
  ]

  const records = [
    { category: "Most Points in a Season", record: "1,847 points", holder: "Fantasy Phenoms (2020)", year: "2020" },
    { category: "Highest Single Week Score", record: "198.5 points", holder: "Thunder Bolts", year: "2023" },
    { category: "Most Championships", record: "2 titles", holder: "Mike Johnson", year: "2019, 2023" },
    { category: "Longest Win Streak", record: "14 games", holder: "Dynasty Dreamers", year: "2012-2013" },
    { category: "Most Trades in a Season", record: "12 trades", holder: "Trade Master Inc.", year: "2021" },
    { category: "Best Draft Pick", record: "Josh Gordon (Rd 15)", holder: "Gridiron Gurus", year: "2013" },
  ]

  const milestones = [
    {
      year: 1994,
      event: "League Founded",
      description: "MLFF officially established as one of the first fantasy football leagues",
    },
    { year: 2010, event: "League Founded", description: "MLFF officially established with 10 founding members" },
    { year: 2012, event: "First Dynasty", description: "Dynasty Dreamers win back-to-back championships" },
    { year: 2015, event: "Rule Changes", description: "Implemented PPR scoring and expanded playoffs" },
    { year: 2018, event: "Digital Transition", description: "Moved from paper drafts to full digital platform" },
    { year: 2020, event: "COVID Season", description: "Successfully navigated pandemic season with virtual draft" },
    { year: 2023, event: "Record Breaking", description: "Multiple league records broken in single season" },
  ]

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-4">MLFF History</h1>
          <p className="text-xl text-gray-600">
            A complete record of Major League Fantasy Football's championship legacy and memorable moments
          </p>
        </div>

        {/* League Stats Overview */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-12">
          <Card className="text-center">
            <CardHeader>
              <Trophy className="w-8 h-8 mx-auto text-yellow-500" />
              <CardTitle>Seasons</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">30</p>
              <p className="text-sm text-muted-foreground">1994 - 2023</p>
            </CardContent>
          </Card>
          <Card className="text-center">
            <CardHeader>
              <Users className="w-8 h-8 mx-auto text-blue-500" />
              <CardTitle>Total Managers</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">15</p>
              <p className="text-sm text-muted-foreground">Past & Present</p>
            </CardContent>
          </Card>
          <Card className="text-center">
            <CardHeader>
              <TrendingUp className="w-8 h-8 mx-auto text-green-500" />
              <CardTitle>Games Played</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">4,200</p>
              <p className="text-sm text-muted-foreground">Regular Season</p>
            </CardContent>
          </Card>
          <Card className="text-center">
            <CardHeader>
              <Calendar className="w-8 h-8 mx-auto text-purple-500" />
              <CardTitle>Championships</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">30</p>
              <p className="text-sm text-muted-foreground">Titles Awarded</p>
            </CardContent>
          </Card>
        </div>

        {/* Championship History */}
        <div className="mb-12">
          <h2 className="text-3xl font-bold mb-6">Championship History</h2>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {champions.map((champion, index) => (
              <Card key={champion.year} className={index < 3 ? "border-yellow-200 bg-yellow-50" : ""}>
                <CardHeader className="flex flex-row items-center space-y-0 pb-2">
                  <div className="flex items-center space-x-2">
                    {index < 3 && <Trophy className="w-5 h-5 text-yellow-500" />}
                    <CardTitle className="text-lg">{champion.year} Champion</CardTitle>
                  </div>
                  <Badge variant={index < 3 ? "default" : "secondary"} className="ml-auto">
                    {champion.record}
                  </Badge>
                </CardHeader>
                <CardContent>
                  <p className="font-semibold text-lg">{champion.team}</p>
                  <p className="text-muted-foreground">Managed by {champion.manager}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* League Records */}
        <div className="mb-12">
          <h2 className="text-3xl font-bold mb-6">League Records</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {records.map((record, index) => (
              <Card key={index}>
                <CardHeader>
                  <CardTitle className="text-lg">{record.category}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold text-green-600 mb-2">{record.record}</p>
                  <p className="text-muted-foreground">{record.holder}</p>
                  <Badge variant="outline" className="mt-2">
                    {record.year}
                  </Badge>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* League Milestones */}
        <div>
          <h2 className="text-3xl font-bold mb-6">League Milestones</h2>
          <div className="space-y-6">
            {milestones.map((milestone, index) => (
              <Card key={index}>
                <CardHeader className="flex flex-row items-center space-y-0">
                  <div className="flex items-center space-x-4">
                    <Badge variant="outline" className="text-lg px-3 py-1">
                      {milestone.year}
                    </Badge>
                    <div>
                      <CardTitle className="text-xl">{milestone.event}</CardTitle>
                      <CardDescription className="text-base mt-1">{milestone.description}</CardDescription>
                    </div>
                  </div>
                </CardHeader>
              </Card>
            ))}
          </div>
        </div>

        {/* Historical Stats Section */}
        <div className="mt-16 p-6 bg-blue-50 rounded-lg">
          <h3 className="text-xl font-bold mb-4">Want More Stats?</h3>
          <p className="text-gray-600 mb-4">
            Looking for detailed historical statistics, head-to-head records, or season-by-season breakdowns from 30
            years? Visit our CBS Sports site for comprehensive league data and analytics.
          </p>
          <a
            href="https://mlffatl.football.cbssports.com/"
            target="_blank"
            className="inline-flex items-center text-blue-600 hover:text-blue-800 font-medium"
            rel="noreferrer"
          >
            View Detailed Stats on CBS Sports →
          </a>
        </div>
      </div>
    </div>
  )
}
