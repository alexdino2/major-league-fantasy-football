import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Calendar, Search, ExternalLink } from "lucide-react"
import Image from "next/image"
import Link from "next/link"

export default function NewsPage() {
  const newsArticles = [
    {
      id: 1,
      title: "2024 Draft Results Are In!",
      excerpt:
        "The annual MLFF draft concluded with some surprising picks and strategic moves that will shape the upcoming season.",
      category: "Draft Day",
      date: "September 1, 2024",
      image: "/placeholder.svg?height=200&width=400",
      featured: true,
    },
    {
      id: 2,
      title: "Mid-Season Trade Deadline Recap",
      excerpt: "Multiple blockbuster trades shake up the league standings as teams position for playoff runs.",
      category: "Trades",
      date: "November 8, 2023",
      image: "/placeholder.svg?height=200&width=400",
      featured: false,
    },
    {
      id: 3,
      title: "2023 Championship Game Thriller",
      excerpt: "An overtime classic decides the league champion in one of the most exciting finales in MLFF history.",
      category: "Championship",
      date: "January 15, 2024",
      image: "/placeholder.svg?height=200&width=400",
      featured: true,
    },
    {
      id: 4,
      title: "Rookie of the Year Performances",
      excerpt: "First-year players making immediate impacts across multiple franchises this season.",
      category: "Analysis",
      date: "October 15, 2023",
      image: "/placeholder.svg?height=200&width=400",
      featured: false,
    },
    {
      id: 5,
      title: "Weekly Waiver Wire Gems",
      excerpt: "Hidden treasures on the waiver wire that could make or break your fantasy season.",
      category: "Strategy",
      date: "September 20, 2023",
      image: "/placeholder.svg?height=200&width=400",
      featured: false,
    },
    {
      id: 6,
      title: "League Rule Changes for 2024",
      excerpt: "Important updates to scoring and roster rules that every manager needs to know.",
      category: "League News",
      date: "August 1, 2024",
      image: "/placeholder.svg?height=200&width=400",
      featured: false,
    },
  ]

  const categories = ["All", "Draft Day", "Trades", "Championship", "Analysis", "Strategy", "League News"]

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-4">MLFF News & Articles</h1>
          <p className="text-xl text-gray-600">
            Stay up to date with the latest news, analysis, and stories from Major League Fantasy Football
          </p>
        </div>

        {/* Search and Filters */}
        <div className="mb-8 flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <Input placeholder="Search articles..." className="pl-10" />
          </div>
          <div className="flex gap-2 flex-wrap">
            {categories.map((category) => (
              <Button key={category} variant={category === "All" ? "default" : "outline"} size="sm">
                {category}
              </Button>
            ))}
          </div>
        </div>

        {/* Featured Articles */}
        <div className="mb-12">
          <h2 className="text-2xl font-bold mb-6">Featured Stories</h2>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {newsArticles
              .filter((article) => article.featured)
              .map((article) => (
                <Card key={article.id} className="overflow-hidden hover:shadow-lg transition-shadow">
                  <Image
                    src={article.image || "/placeholder.svg"}
                    alt={article.title}
                    width={400}
                    height={200}
                    className="w-full h-48 object-cover"
                  />
                  <CardHeader>
                    <div className="flex items-center gap-2 mb-2">
                      <Badge>{article.category}</Badge>
                      <div className="flex items-center text-sm text-gray-500">
                        <Calendar className="w-4 h-4 mr-1" />
                        {article.date}
                      </div>
                    </div>
                    <CardTitle className="text-xl">{article.title}</CardTitle>
                    <CardDescription className="text-base">{article.excerpt}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Button asChild>
                      <Link href={`/news/${article.id}`}>Read Full Article</Link>
                    </Button>
                  </CardContent>
                </Card>
              ))}
          </div>
        </div>

        {/* All Articles */}
        <div>
          <h2 className="text-2xl font-bold mb-6">All Articles</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {newsArticles.map((article) => (
              <Card key={article.id} className="overflow-hidden hover:shadow-lg transition-shadow">
                <Image
                  src={article.image || "/placeholder.svg"}
                  alt={article.title}
                  width={400}
                  height={200}
                  className="w-full h-40 object-cover"
                />
                <CardHeader className="pb-2">
                  <div className="flex items-center gap-2 mb-2">
                    <Badge variant="secondary" className="text-xs">
                      {article.category}
                    </Badge>
                    <div className="flex items-center text-xs text-gray-500">
                      <Calendar className="w-3 h-3 mr-1" />
                      {article.date}
                    </div>
                  </div>
                  <CardTitle className="text-lg line-clamp-2">{article.title}</CardTitle>
                </CardHeader>
                <CardContent className="pt-0">
                  <p className="text-sm text-gray-600 line-clamp-2 mb-4">{article.excerpt}</p>
                  <Button asChild size="sm" variant="outline">
                    <Link href={`/news/${article.id}`}>Read More</Link>
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* External Links Section */}
        <div className="mt-16 p-6 bg-blue-50 rounded-lg">
          <h3 className="text-xl font-bold mb-4">External Coverage</h3>
          <p className="text-gray-600 mb-4">Check out articles and coverage about MLFF from external sources:</p>
          <div className="space-y-2">
            <Link href="#" className="flex items-center text-blue-600 hover:text-blue-800 transition-colors">
              <ExternalLink className="w-4 h-4 mr-2" />
              ESPN Fantasy Football Feature on MLFF
            </Link>
            <Link href="#" className="flex items-center text-blue-600 hover:text-blue-800 transition-colors">
              <ExternalLink className="w-4 h-4 mr-2" />
              Yahoo Sports: League Spotlight
            </Link>
            <Link href="#" className="flex items-center text-blue-600 hover:text-blue-800 transition-colors">
              <ExternalLink className="w-4 h-4 mr-2" />
              FantasyPros: MLFF Draft Analysis
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
