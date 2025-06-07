import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Trophy, TrendingUp, Users, Calendar, Target, Award } from "lucide-react"
import fs from 'fs'
import path from 'path'

interface Champion {
  year: number;
  teams: string[];
}

interface Championship {
  team: string;
  championships: number;
  years: string[];
}

interface MostConsistent {
  team: string;
  avgFinish: number;
  avgPointsPerYear: number;
}

interface Record {
  category: string;
  record: string;
  holder: string;
  year: string;
}

interface Milestone {
  year: number;
  event: string;
  description: string;
}

// Sample data for records and milestones
const sampleRecords: Record[] = [
  {
    category: "Most Points in a Season",
    record: "1,234",
    holder: "Leeds United",
    year: "2014"
  },
  {
    category: "Longest Win Streak",
    record: "8 games",
    holder: "Masters of Disaster",
    year: "2018"
  }
]

const sampleMilestones: Milestone[] = [
  {
    year: 1994,
    event: "League Founded",
    description: "Major League Fantasy Football was established with 12 teams"
  },
  {
    year: 2010,
    event: "Expansion",
    description: "League expanded to 14 teams"
  }
]

// This is a server component
export default function HistoryPage() {
  // Read the static JSON data
  const championsPath = path.join(process.cwd(), 'data', 'champions.json')
  const championshipsPath = path.join(process.cwd(), 'data', 'championships.json')
  const mostConsistentPath = path.join(process.cwd(), 'data', 'most-consistent.json')
  
  // Default data in case the files don't exist yet
  const defaultData = {
    champions: [],
    championships: [],
    mostConsistent: []
  }

  let champions: Champion[] = []
  let championships: Championship[] = []
  let mostConsistent: MostConsistent[] = []

  try {
    champions = JSON.parse(fs.readFileSync(championsPath, 'utf-8'))
    championships = JSON.parse(fs.readFileSync(championshipsPath, 'utf-8'))
    mostConsistent = JSON.parse(fs.readFileSync(mostConsistentPath, 'utf-8'))
  } catch (error) {
    console.error('Error reading history data:', error)
  }

  // If no data is available, show a message
  if (champions.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center p-8">
          <h1 className="text-4xl font-bold mb-4">MLFF History</h1>
          <p className="text-xl text-gray-600 mb-8">
            No history data available yet. Please run the scraper to fetch the data.
          </p>
          <div className="bg-blue-50 p-6 rounded-lg">
            <h3 className="text-xl font-bold mb-4">How to Get Data</h3>
            <p className="text-gray-600 mb-4">
              Run the following command in your terminal to scrape the history data:
            </p>
            <code className="bg-gray-100 p-2 rounded block mb-4">
              npm run scrape-history
            </code>
            <p className="text-gray-600">
              Make sure you have set up your CBS Sports credentials in the .env.local file.
            </p>
          </div>
        </div>
      </div>
    )
  }

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
              <p className="text-3xl font-bold">{champions.length}</p>
              <p className="text-sm text-muted-foreground">{champions[champions.length - 1].year} - {champions[0].year}</p>
            </CardContent>
          </Card>
          <Card className="text-center">
            <CardHeader>
              <Users className="w-8 h-8 mx-auto text-blue-500" />
              <CardTitle>Total Teams</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">{championships.length}</p>
              <p className="text-sm text-muted-foreground">Past & Present</p>
            </CardContent>
          </Card>
          <Card className="text-center">
            <CardHeader>
              <TrendingUp className="w-8 h-8 mx-auto text-green-500" />
              <CardTitle>Games Played</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">{champions.length * 14}</p>
              <p className="text-sm text-muted-foreground">Regular Season</p>
            </CardContent>
          </Card>
          <Card className="text-center">
            <CardHeader>
              <Calendar className="w-8 h-8 mx-auto text-purple-500" />
              <CardTitle>Championships</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">{championships.reduce((sum, team) => sum + team.championships, 0)}</p>
              <p className="text-sm text-muted-foreground">Titles Awarded</p>
            </CardContent>
          </Card>
        </div>

        {/* Most Championships */}
        <div className="mb-12">
          <h2 className="text-3xl font-bold mb-6">Most Championships</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {championships.map((team, index) => (
              <Card key={team.team} className={index < 3 ? "border-yellow-200 bg-yellow-50" : ""}>
                <CardHeader className="flex flex-row items-center space-y-0 pb-2">
                  <div className="flex items-center space-x-2">
                    {index < 3 && <Trophy className="w-5 h-5 text-yellow-500" />}
                    <CardTitle className="text-lg">{team.team}</CardTitle>
                  </div>
                  <Badge variant={index < 3 ? "default" : "secondary"} className="ml-auto">
                    {team.championships} {team.championships === 1 ? 'Title' : 'Titles'}
                  </Badge>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">
                    {team.years.join(', ')}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* Most Consistent */}
        <div className="mb-12">
          <h2 className="text-3xl font-bold mb-6">Most Consistent</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {mostConsistent.map((team, index) => (
              <Card key={team.team} className={index < 3 ? "border-green-200 bg-green-50" : ""}>
                <CardHeader className="flex flex-row items-center space-y-0 pb-2">
                  <div className="flex items-center space-x-2">
                    {index < 3 && <Target className="w-5 h-5 text-green-500" />}
                    <CardTitle className="text-lg">{team.team}</CardTitle>
                  </div>
                  <Badge variant={index < 3 ? "default" : "secondary"} className="ml-auto">
                    {team.avgFinish.toFixed(1)} Avg Finish
                  </Badge>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">
                    {team.avgPointsPerYear.toFixed(1)} Points/Year
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* Championship History */}
        <div className="mb-12">
          <h2 className="text-3xl font-bold mb-6">Championship History</h2>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {champions.map((champion, index) => (
              <Card key={champion.year} className={index < 3 ? "border-yellow-200 bg-yellow-50" : ""}>
                <CardHeader className="flex flex-row items-center space-y-0 pb-2">
                  <div className="flex items-center space-x-2">
                    {index < 3 && <Award className="w-5 h-5 text-yellow-500" />}
                    <CardTitle className="text-lg">{champion.year} Champion{champion.teams.length > 1 ? 's' : ''}</CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  {champion.teams.map(team => (
                    <p key={team} className="font-semibold text-lg">{team}</p>
                  ))}
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* League Records */}
        <div className="mb-12">
          <h2 className="text-3xl font-bold mb-6">League Records</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {sampleRecords.map((record, index) => (
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
            {sampleMilestones.map((milestone, index) => (
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
            Looking for detailed historical statistics, head-to-head records, or season-by-season breakdowns? Visit our CBS Sports site for comprehensive league data and analytics.
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
