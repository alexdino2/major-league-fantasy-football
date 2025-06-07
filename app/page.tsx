import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Calendar, Trophy, Users, Video } from "lucide-react"
import Image from "next/image"
import Link from "next/link"

export default function HomePage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-green-50 to-white">
      {/* Hero Section */}
      <section className="relative py-20 px-4 text-center bg-gradient-to-r from-green-600 to-blue-600 text-white">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-5xl font-bold mb-4">Major League Fantasy Football</h1>
          <p className="text-xl mb-8 opacity-90">The ultimate destination for MLFF history, stats, and memories</p>
          <div className="flex flex-wrap justify-center gap-4 mb-8">
            <Badge variant="secondary" className="text-lg px-4 py-2">
              <Users className="w-4 h-4 mr-2" />
              10 Teams
            </Badge>
            <Badge variant="secondary" className="text-lg px-4 py-2">
              <Trophy className="w-4 h-4 mr-2" />
              Est. 1994
            </Badge>
          </div>
          <div className="flex flex-wrap justify-center gap-4">
            <Button asChild size="lg" variant="secondary">
              <Link href="/news">Latest News</Link>
            </Button>
            <Button
              asChild
              size="lg"
              variant="secondary"
              className="bg-orange-500 text-white hover:bg-orange-600 border-orange-500"
            >
              <Link href="https://mlffatl.football.cbssports.com/" target="_blank">
                CBS Sports Site
              </Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Quick Stats */}
      <section className="py-16 px-4">
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-16">
            <Card className="text-center">
              <CardHeader>
                <Trophy className="w-8 h-8 mx-auto text-yellow-500" />
                <CardTitle>Championships</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold">30</p>
                <p className="text-sm text-muted-foreground">Seasons Completed</p>
              </CardContent>
            </Card>
            <Card className="text-center">
              <CardHeader>
                <Users className="w-8 h-8 mx-auto text-blue-500" />
                <CardTitle>Active Teams</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold">10</p>
                <p className="text-sm text-muted-foreground">Competing Franchises</p>
              </CardContent>
            </Card>
            <Card className="text-center">
              <CardHeader>
                <Video className="w-8 h-8 mx-auto text-red-500" />
                <CardTitle>Media Files</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold">150+</p>
                <p className="text-sm text-muted-foreground">Videos & Articles</p>
              </CardContent>
            </Card>
            <Card className="text-center">
              <CardHeader>
                <Calendar className="w-8 h-8 mx-auto text-green-500" />
                <CardTitle>News Articles</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold">200+</p>
                <p className="text-sm text-muted-foreground">Stories Published</p>
              </CardContent>
            </Card>
          </div>

          {/* Recent News */}
          <div className="mb-16">
            <div className="flex justify-between items-center mb-8">
              <h2 className="text-3xl font-bold">Latest News</h2>
              <Button asChild variant="outline">
                <Link href="/news">View All News</Link>
              </Button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <Card>
                <Image
                  src="/placeholder.svg?height=200&width=400"
                  alt="Draft Day 2024"
                  width={400}
                  height={200}
                  className="w-full h-48 object-cover rounded-t-lg"
                />
                <CardHeader>
                  <Badge className="w-fit">Draft Day</Badge>
                  <CardTitle>2024 Draft Results Are In!</CardTitle>
                  <CardDescription>
                    The annual MLFF draft concluded with some surprising picks and strategic moves.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">September 1, 2024</p>
                </CardContent>
              </Card>
              <Card>
                <Image
                  src="/placeholder.svg?height=200&width=400"
                  alt="Championship Recap"
                  width={400}
                  height={200}
                  className="w-full h-48 object-cover rounded-t-lg"
                />
                <CardHeader>
                  <Badge className="w-fit">Championship</Badge>
                  <CardTitle>2023 Season Recap</CardTitle>
                  <CardDescription>
                    A thrilling season finale with record-breaking performances and upsets.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">January 15, 2024</p>
                </CardContent>
              </Card>
              <Card>
                <Image
                  src="/placeholder.svg?height=200&width=400"
                  alt="Trade Deadline"
                  width={400}
                  height={200}
                  className="w-full h-48 object-cover rounded-t-lg"
                />
                <CardHeader>
                  <Badge className="w-fit">Trades</Badge>
                  <CardTitle>Mid-Season Trade Frenzy</CardTitle>
                  <CardDescription>
                    Multiple blockbuster trades shake up the league standings before playoffs.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">November 8, 2023</p>
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Featured Media */}
          <div>
            <div className="flex justify-between items-center mb-8">
              <h2 className="text-3xl font-bold">Featured Media</h2>
              <Button asChild variant="outline">
                <Link href="/media">View All Media</Link>
              </Button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <Card>
                <CardHeader>
                  <CardTitle>Draft Day Highlights 2024</CardTitle>
                  <CardDescription>
                    Watch the best moments from this year's draft including surprise picks and reactions.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="aspect-video bg-gray-100 rounded-lg flex items-center justify-center">
                    <Video className="w-12 h-12 text-gray-400" />
                  </div>
                  <p className="text-sm text-muted-foreground mt-2">YouTube • 15:32</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle>Championship Game Recap</CardTitle>
                  <CardDescription>
                    Relive the intense final matchup that decided the 2023 MLFF champion.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="aspect-video bg-gray-100 rounded-lg flex items-center justify-center">
                    <Video className="w-12 h-12 text-gray-400" />
                  </div>
                  <p className="text-sm text-muted-foreground mt-2">YouTube • 22:45</p>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
