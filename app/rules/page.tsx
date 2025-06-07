import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { DollarSign, Trophy, FileText, Users, Calendar, AlertCircle } from "lucide-react"

export default function RulesPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-4">MLFF League Constitution</h1>
          <p className="text-xl text-gray-600">Official rules and regulations for Major League Fantasy Football</p>
          <div className="flex items-center gap-2 mt-4">
            <Badge variant="outline" className="text-sm">
              <Calendar className="w-4 h-4 mr-1" />
              Established 1994
            </Badge>
            <Badge variant="outline" className="text-sm">
              <Users className="w-4 h-4 mr-1" />
              10 Team League
            </Badge>
          </div>
        </div>

        {/* Prize Structure Overview */}
        <Card className="mb-8 border-green-200 bg-green-50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="w-6 h-6 text-green-600" />
              Prize Structure - Total Pot: $2,000
            </CardTitle>
            <CardDescription>Annual prize distribution breakdown</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span>Triangle Bowl Winner:</span>
                  <span className="font-bold text-green-600">$750</span>
                </div>
                <div className="flex justify-between">
                  <span>Triangle Bowl Runner-up:</span>
                  <span className="font-bold">$400</span>
                </div>
                <div className="flex justify-between">
                  <span>Third Place:</span>
                  <span className="font-bold">$200</span>
                </div>
                <div className="flex justify-between">
                  <span>Weekly News (16 weeks):</span>
                  <span className="font-bold">$400</span>
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span>Best Breakdown:</span>
                  <span className="font-bold">$50</span>
                </div>
                <div className="flex justify-between">
                  <span>Most Points (Season):</span>
                  <span className="font-bold">$25</span>
                </div>
                <div className="flex justify-between">
                  <span>Most Points (Single Game):</span>
                  <span className="font-bold">$25</span>
                </div>
                <div className="flex justify-between">
                  <span>CBS Site Fees:</span>
                  <span className="font-bold text-red-600">-$150</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Weekly Awards */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="w-6 h-6 text-blue-600" />
              News of the Week
            </CardTitle>
            <CardDescription>Weekly $25 award for highest scoring team</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-blue-50 p-4 rounded-lg">
              <h4 className="font-semibold mb-2">Award Requirements:</h4>
              <ul className="space-y-2 text-sm">
                <li>• The owner of the highest scoring team wins $25</li>
                <li>• Winner must write and post the "News of the Week"</li>
                <li>• News must be posted by the end of Thursday</li>
                <li>• Failure to post by deadline forfeits the $25</li>
                <li>• Forfeited money goes to the Triangle Bowl winner</li>
              </ul>
            </div>
            <div className="bg-yellow-50 p-4 rounded-lg border-l-4 border-yellow-400">
              <div className="flex items-start gap-2">
                <AlertCircle className="w-5 h-5 text-yellow-600 mt-0.5" />
                <div>
                  <h4 className="font-semibold text-yellow-800">Important Notes:</h4>
                  <ul className="text-sm text-yellow-700 mt-1 space-y-1">
                    <li>• Week 17 winner is not entitled to the $25 award</li>
                    <li>• Award may be forfeited if news quality is deemed insufficient</li>
                    <li>• If multiple teams tie for highest score, award is divided evenly</li>
                  </ul>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Season Awards */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Trophy className="w-6 h-6 text-yellow-600" />
              Season Awards
            </CardTitle>
            <CardDescription>Annual performance-based prizes</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="text-center p-4 bg-yellow-50 rounded-lg">
                <DollarSign className="w-8 h-8 text-yellow-600 mx-auto mb-2" />
                <h4 className="font-semibold">Most Points for the Year</h4>
                <p className="text-2xl font-bold text-yellow-600">$25</p>
                <p className="text-sm text-gray-600 mt-1">Includes Week 17</p>
              </div>
              <div className="text-center p-4 bg-green-50 rounded-lg">
                <Trophy className="w-8 h-8 text-green-600 mx-auto mb-2" />
                <h4 className="font-semibold">Most Points in a Game</h4>
                <p className="text-2xl font-bold text-green-600">$25</p>
                <p className="text-sm text-gray-600 mt-1">Single game record</p>
              </div>
              <div className="text-center p-4 bg-blue-50 rounded-lg">
                <FileText className="w-8 h-8 text-blue-600 mx-auto mb-2" />
                <h4 className="font-semibold">Best Breakdown</h4>
                <p className="text-2xl font-bold text-blue-600">$50</p>
                <p className="text-sm text-gray-600 mt-1">Awarded at end of Week 17</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Tiebreakers */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          <Card>
            <CardHeader>
              <CardTitle>Triangle Bowl Tiebreakers</CardTitle>
              <CardDescription>Championship and playoff game tie resolution</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="bg-gray-50 p-4 rounded-lg">
                <p className="text-sm">
                  If the Triangle Bowl or 3rd Place game ends in a tie, the award will be{" "}
                  <span className="font-semibold">divided evenly</span> amongst the tied teams.
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Division Tiebreakers</CardTitle>
              <CardDescription>Order of tiebreaker resolution</CardDescription>
            </CardHeader>
            <CardContent>
              <ol className="text-sm space-y-1">
                <li>1. Record (by Win-Loss %)</li>
                <li>2. Points For</li>
                <li>3. Division Record</li>
                <li>4. Record in Common Games</li>
                <li>5. Points Against (strength of victory)</li>
                <li>6. Strength of Schedule</li>
                <li>7. Points Diff in Division</li>
                <li>8. Points Diff in Common Games</li>
                <li>9. Most Touchdowns</li>
              </ol>
            </CardContent>
          </Card>
        </div>

        {/* Scoring Rules */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Individual Player Points</CardTitle>
            <CardDescription>Special scoring clarifications</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="bg-blue-50 p-4 rounded-lg">
              <p className="text-sm">
                <span className="font-semibold">Special Teams Scoring:</span> Individual players do score points for
                touchdowns on special teams. This means that special teams and individual players may receive points for
                the same score.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* League History Note */}
        <Card className="border-green-200 bg-green-50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="w-6 h-6 text-green-600" />
              League Heritage
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm">
              Major League Fantasy Football has been operating under these core principles since{" "}
              <span className="font-bold">1994</span>, making it one of the longest-running fantasy football leagues.
              These rules have evolved over our <span className="font-bold">30-year history</span> to ensure fair play
              and competitive balance.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
