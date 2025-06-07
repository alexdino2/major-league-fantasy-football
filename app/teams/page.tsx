import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Trophy, TrendingUp, TrendingDown, Users } from "lucide-react"
import Image from "next/image"

export default function TeamsPage() {
  const teams = [
    {
      id: 1,
      name: "Thunder Bolts",
      manager: "Mike Johnson",
      founded: 1994,
      championships: 2,
      playoffAppearances: 8,
      currentRecord: "12-2",
      lastChampionship: 2023,
      logo: "/placeholder.svg?height=100&width=100",
      colors: ["bg-yellow-500", "bg-blue-600"],
      motto: "Strike Fast, Strike Hard",
    },
    {
      id: 2,
      name: "Gridiron Gladiators",
      manager: "Sarah Chen",
      founded: 1994,
      championships: 1,
      playoffAppearances: 7,
      currentRecord: "9-5",
      lastChampionship: 2022,
      logo: "/placeholder.svg?height=100&width=100",
      colors: ["bg-red-600", "bg-gray-800"],
      motto: "Victory Through Battle",
    },
    {
      id: 3,
      name: "End Zone Elites",
      manager: "David Rodriguez",
      founded: 1994,
      championships: 1,
      playoffAppearances: 6,
      currentRecord: "8-6",
      lastChampionship: 2021,
      logo: "/placeholder.svg?height=100&width=100",
      colors: ["bg-green-600", "bg-white"],
      motto: "Excellence in Every Play",
    },
    {
      id: 4,
      name: "Fantasy Phenoms",
      manager: "Lisa Thompson",
      founded: 1994,
      championships: 1,
      playoffAppearances: 9,
      currentRecord: "10-4",
      lastChampionship: 2020,
      logo: "/placeholder.svg?height=100&width=100",
      colors: ["bg-orange-500", "bg-purple-600"],
      motto: "Rising Above the Rest",
    },
    {
      id: 5,
      name: "Touchdown Titans",
      manager: "James Wilson",
      founded: 1994,
      championships: 1,
      playoffAppearances: 5,
      currentRecord: "7-7",
      lastChampionship: 2019,
      logo: "/placeholder.svg?height=100&width=100",
      colors: ["bg-blue-800", "bg-silver"],
      motto: "Strength in Numbers",
    },
    {
      id: 6,
      name: "Pigskin Prophets",
      manager: "Amanda Davis",
      founded: 2011,
      championships: 1,
      playoffAppearances: 6,
      currentRecord: "8-6",
      lastChampionship: 2018,
      logo: "/placeholder.svg?height=100&width=100",
      colors: ["bg-purple-700", "bg-gold"],
      motto: "Predicting Victory",
    },
    {
      id: 7,
      name: "Gridiron Gurus",
      manager: "Robert Kim",
      founded: 1994,
      championships: 1,
      playoffAppearances: 4,
      currentRecord: "6-8",
      lastChampionship: 2017,
      logo: "/placeholder.svg?height=100&width=100",
      colors: ["bg-teal-600", "bg-orange-400"],
      motto: "Wisdom Wins Games",
    },
    {
      id: 8,
      name: "Fantasy Fanatics",
      manager: "Jennifer Lee",
      founded: 1994,
      championships: 1,
      playoffAppearances: 7,
      currentRecord: "9-5",
      lastChampionship: 2016,
      logo: "/placeholder.svg?height=100&width=100",
      colors: ["bg-pink-500", "bg-black"],
      motto: "Passion Drives Success",
    },
    {
      id: 9,
      name: "Championship Chasers",
      manager: "Michael Brown",
      founded: 2012,
      championships: 1,
      playoffAppearances: 3,
      currentRecord: "5-9",
      lastChampionship: 2015,
      logo: "/placeholder.svg?height=100&width=100",
      colors: ["bg-red-500", "bg-yellow-400"],
      motto: "Always in Pursuit",
    },
    {
      id: 10,
      name: "Victory Vultures",
      manager: "Emily Garcia",
      founded: 2013,
      championships: 1,
      playoffAppearances: 4,
      currentRecord: "7-7",
      lastChampionship: 2014,
      logo: "/placeholder.svg?height=100&width=100",
      colors: ["bg-gray-700", "bg-red-600"],
      motto: "Scavenging Success",
    },
  ]

  const getPerformanceIcon = (record: string) => {
    const [wins, losses] = record.split("-").map(Number)
    if (wins > losses) return <TrendingUp className="w-4 h-4 text-green-500" />
    if (wins < losses) return <TrendingDown className="w-4 h-4 text-red-500" />
    return <Users className="w-4 h-4 text-gray-500" />
  }

  const getRecordColor = (record: string) => {
    const [wins, losses] = record.split("-").map(Number)
    if (wins > losses) return "text-green-600"
    if (wins < losses) return "text-red-600"
    return "text-gray-600"
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-4">MLFF Teams</h1>
          <p className="text-xl text-gray-600">Meet the 10 franchises that make up Major League Fantasy Football</p>
        </div>

        {/* Teams Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
          {teams.map((team) => (
            <Card key={team.id} className="overflow-hidden hover:shadow-lg transition-shadow">
              <CardHeader className="text-center pb-4">
                <div className="relative mx-auto mb-4">
                  <Image
                    src={team.logo || "/placeholder.svg"}
                    alt={`${team.name} logo`}
                    width={80}
                    height={80}
                    className="rounded-full border-4 border-white shadow-lg"
                  />
                  {team.championships > 0 && (
                    <div className="absolute -top-2 -right-2">
                      <Badge className="bg-yellow-500 text-yellow-900 px-2 py-1">
                        <Trophy className="w-3 h-3 mr-1" />
                        {team.championships}
                      </Badge>
                    </div>
                  )}
                </div>
                <CardTitle className="text-xl">{team.name}</CardTitle>
                <CardDescription className="text-base">Managed by {team.manager}</CardDescription>
                <p className="text-sm italic text-gray-500 mt-2">"{team.motto}"</p>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium">Current Record:</span>
                  <div className="flex items-center gap-2">
                    {getPerformanceIcon(team.currentRecord)}
                    <span className={`font-bold ${getRecordColor(team.currentRecord)}`}>{team.currentRecord}</span>
                  </div>
                </div>

                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium">Championships:</span>
                  <span className="font-bold">{team.championships}</span>
                </div>

                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium">Playoff Apps:</span>
                  <span className="font-bold">{team.playoffAppearances}</span>
                </div>

                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium">Founded:</span>
                  <span className="font-bold">{team.founded}</span>
                </div>

                {team.lastChampionship && (
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium">Last Title:</span>
                    <Badge variant="outline">{team.lastChampionship}</Badge>
                  </div>
                )}

                <div className="flex justify-center gap-2 pt-2">
                  {team.colors.map((color, index) => (
                    <div key={index} className={`w-6 h-6 rounded-full border-2 border-gray-300 ${color}`} />
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* League Standings Summary */}
        <div className="mb-12">
          <h2 className="text-3xl font-bold mb-6">Current Season Standings</h2>
          <Card>
            <CardHeader>
              <CardTitle>2024 Regular Season</CardTitle>
              <CardDescription>Current standings based on win-loss record</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {teams
                  .sort((a, b) => {
                    const [aWins] = a.currentRecord.split("-").map(Number)
                    const [bWins] = b.currentRecord.split("-").map(Number)
                    return bWins - aWins
                  })
                  .map((team, index) => (
                    <div key={team.id} className="flex items-center justify-between py-2 border-b last:border-b-0">
                      <div className="flex items-center gap-4">
                        <span className="font-bold text-lg w-6">{index + 1}</span>
                        <Image
                          src={team.logo || "/placeholder.svg"}
                          alt={`${team.name} logo`}
                          width={32}
                          height={32}
                          className="rounded-full"
                        />
                        <div>
                          <p className="font-semibold">{team.name}</p>
                          <p className="text-sm text-gray-500">{team.manager}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <span className={`font-bold ${getRecordColor(team.currentRecord)}`}>{team.currentRecord}</span>
                        {team.championships > 0 && <Trophy className="w-4 h-4 text-yellow-500" />}
                      </div>
                    </div>
                  ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Team Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Trophy className="w-5 h-5 text-yellow-500" />
                Most Championships
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">Thunder Bolts</p>
              <p className="text-muted-foreground">2 Championships (2019, 2023)</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-green-500" />
                Most Playoff Apps
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">Fantasy Phenoms</p>
              <p className="text-muted-foreground">9 Playoff Appearances</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="w-5 h-5 text-blue-500" />
                Founding Member
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">8 Teams</p>
              <p className="text-muted-foreground">Since 1994</p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
