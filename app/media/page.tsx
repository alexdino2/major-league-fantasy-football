import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Play, Search, ExternalLink, Calendar } from "lucide-react"
import Image from "next/image"
import Link from "next/link"

export default function MediaPage() {
  const mediaItems = [
    {
      id: 1,
      title: "Draft Day Highlights 2024",
      description: "Watch the best moments from this year's draft including surprise picks and reactions.",
      type: "YouTube Video",
      duration: "15:32",
      date: "September 1, 2024",
      thumbnail: "/placeholder.svg?height=200&width=350",
      category: "Draft",
      youtubeId: "dQw4w9WgXcQ",
    },
    {
      id: 2,
      title: "Championship Game Recap 2023",
      description: "Relive the intense final matchup that decided the 2023 MLFF champion.",
      type: "YouTube Video",
      duration: "22:45",
      date: "January 15, 2024",
      thumbnail: "/placeholder.svg?height=200&width=350",
      category: "Championship",
      youtubeId: "dQw4w9WgXcQ",
    },
    {
      id: 3,
      title: "Trade Deadline Madness",
      description: "A compilation of the craziest trades and reactions from trade deadline day.",
      type: "YouTube Video",
      duration: "18:20",
      date: "November 8, 2023",
      thumbnail: "/placeholder.svg?height=200&width=350",
      category: "Trades",
      youtubeId: "dQw4w9WgXcQ",
    },
    {
      id: 4,
      title: "Season Preview 2024",
      description: "Team-by-team breakdown and predictions for the upcoming MLFF season.",
      type: "YouTube Video",
      duration: "35:15",
      date: "August 15, 2024",
      thumbnail: "/placeholder.svg?height=200&width=350",
      category: "Preview",
      youtubeId: "dQw4w9WgXcQ",
    },
    {
      id: 5,
      title: "Best Trash Talk Moments",
      description: "The funniest and most memorable trash talk moments from league history.",
      type: "YouTube Video",
      duration: "12:30",
      date: "July 4, 2024",
      thumbnail: "/placeholder.svg?height=200&width=350",
      category: "Comedy",
      youtubeId: "dQw4w9WgXcQ",
    },
    {
      id: 6,
      title: "Draft Strategy Deep Dive",
      description: "Expert analysis of different draft strategies used by MLFF managers.",
      type: "YouTube Video",
      duration: "28:45",
      date: "August 20, 2023",
      thumbnail: "/placeholder.svg?height=200&width=350",
      category: "Strategy",
      youtubeId: "dQw4w9WgXcQ",
    },
  ]

  const categories = ["All", "Draft", "Championship", "Trades", "Preview", "Comedy", "Strategy"]

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-4">MLFF Media Gallery</h1>
          <p className="text-xl text-gray-600">
            Videos, highlights, and memorable moments from Major League Fantasy Football
          </p>
        </div>

        {/* Search and Filters */}
        <div className="mb-8 flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <Input placeholder="Search videos..." className="pl-10" />
          </div>
          <div className="flex gap-2 flex-wrap">
            {categories.map((category) => (
              <Button key={category} variant={category === "All" ? "default" : "outline"} size="sm">
                {category}
              </Button>
            ))}
          </div>
        </div>

        {/* Featured Video */}
        <div className="mb-12">
          <h2 className="text-2xl font-bold mb-6">Featured Video</h2>
          <Card className="overflow-hidden">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="relative">
                <Image
                  src={mediaItems[0].thumbnail || "/placeholder.svg"}
                  alt={mediaItems[0].title}
                  width={600}
                  height={400}
                  className="w-full h-64 lg:h-full object-cover"
                />
                <div className="absolute inset-0 bg-black/20 flex items-center justify-center">
                  <Button size="lg" className="rounded-full w-16 h-16">
                    <Play className="w-8 h-8" />
                  </Button>
                </div>
                <Badge className="absolute top-4 left-4">{mediaItems[0].category}</Badge>
                <Badge variant="secondary" className="absolute bottom-4 right-4">
                  {mediaItems[0].duration}
                </Badge>
              </div>
              <CardHeader className="lg:p-8">
                <CardTitle className="text-2xl">{mediaItems[0].title}</CardTitle>
                <CardDescription className="text-base">{mediaItems[0].description}</CardDescription>
                <div className="flex items-center gap-4 pt-4">
                  <div className="flex items-center text-sm text-gray-500">
                    <Calendar className="w-4 h-4 mr-1" />
                    {mediaItems[0].date}
                  </div>
                  <Badge variant="outline">{mediaItems[0].type}</Badge>
                </div>
                <div className="flex gap-4 pt-4">
                  <Button asChild>
                    <Link href={`https://youtube.com/watch?v=${mediaItems[0].youtubeId}`} target="_blank">
                      Watch on YouTube
                      <ExternalLink className="w-4 h-4 ml-2" />
                    </Link>
                  </Button>
                  <Button variant="outline">Share Video</Button>
                </div>
              </CardHeader>
            </div>
          </Card>
        </div>

        {/* Video Grid */}
        <div>
          <h2 className="text-2xl font-bold mb-6">All Videos</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {mediaItems.slice(1).map((item) => (
              <Card key={item.id} className="overflow-hidden hover:shadow-lg transition-shadow">
                <div className="relative">
                  <Image
                    src={item.thumbnail || "/placeholder.svg"}
                    alt={item.title}
                    width={350}
                    height={200}
                    className="w-full h-48 object-cover"
                  />
                  <div className="absolute inset-0 bg-black/20 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
                    <Button size="lg" className="rounded-full">
                      <Play className="w-6 h-6" />
                    </Button>
                  </div>
                  <Badge className="absolute top-2 left-2 text-xs">{item.category}</Badge>
                  <Badge variant="secondary" className="absolute bottom-2 right-2 text-xs">
                    {item.duration}
                  </Badge>
                </div>
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg line-clamp-2">{item.title}</CardTitle>
                  <div className="flex items-center gap-2 text-sm text-gray-500">
                    <Calendar className="w-3 h-3" />
                    {item.date}
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  <p className="text-sm text-gray-600 line-clamp-2 mb-4">{item.description}</p>
                  <Button asChild size="sm" variant="outline" className="w-full">
                    <Link href={`https://youtube.com/watch?v=${item.youtubeId}`} target="_blank">
                      Watch on YouTube
                      <ExternalLink className="w-4 h-4 ml-2" />
                    </Link>
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* Upload Section */}
        <div className="mt-16 p-6 bg-green-50 rounded-lg">
          <h3 className="text-xl font-bold mb-4">Submit Your Content</h3>
          <p className="text-gray-600 mb-4">
            Have a great MLFF moment to share? Submit your videos and articles to be featured on the site.
          </p>
          <div className="flex gap-4">
            <Button>Submit Video Link</Button>
            <Button variant="outline">Upload Media</Button>
          </div>
        </div>
      </div>
    </div>
  )
}
