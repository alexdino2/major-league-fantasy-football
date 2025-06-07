"use client"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Calendar, ExternalLink, Search } from "lucide-react"
import Link from "next/link"
import { useState, useMemo, useEffect } from "react"
import { toast } from "sonner"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { DateRange } from "react-day-picker"
import { Calendar as CalendarComponent } from "@/components/ui/calendar"

interface MediaItem {
  id: string
  type?: 'media' | 'news'
  year?: number
  week?: number
  videoId: string
  submittedAt: string
}

export default function MediaPage() {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [videoUrl, setVideoUrl] = useState("")
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedYear, setSelectedYear] = useState<number | undefined>()
  const [selectedWeek, setSelectedWeek] = useState<number | undefined>()
  const [sortOrder, setSortOrder] = useState<"newest" | "oldest">("newest")
  const [dateRange, setDateRange] = useState<DateRange | undefined>()
  const [mediaItems, setMediaItems] = useState<MediaItem[]>([])
  const [isLoading, setIsLoading] = useState(true)

  const fetchMediaItems = async () => {
    try {
      const response = await fetch('/api/media/list')
      if (!response.ok) {
        throw new Error('Failed to fetch media items')
      }
      const data = await response.json()
      setMediaItems(data)
    } catch (error) {
      toast.error('Failed to load media items')
      console.error('Error fetching media items:', error)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchMediaItems()
  }, [])

  // Filter and sort media items
  const filteredMediaItems = useMemo(() => {
    let filtered = [...mediaItems]

    // Apply search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      filtered = filtered.filter(item => 
        item.videoId.toLowerCase().includes(query)
      )
    }

    // Apply sorting
    filtered.sort((a, b) => {
      const dateA = new Date(a.submittedAt).getTime()
      const dateB = new Date(b.submittedAt).getTime()
      return sortOrder === "newest" ? dateB - dateA : dateA - dateB
    })

    return filtered
  }, [mediaItems, searchQuery, sortOrder])

  const extractYouTubeVideoId = (url: string): string | null => {
    // Handles various YouTube URL formats
    try {
      // youtu.be/VIDEOID
      const shortMatch = url.match(/youtu\.be\/([\w-]{11})/)
      if (shortMatch) return shortMatch[1]
      // youtube.com/watch?v=VIDEOID
      const longMatch = url.match(/[?&]v=([\w-]{11})/)
      if (longMatch) return longMatch[1]
      // youtube.com/embed/VIDEOID
      const embedMatch = url.match(/embed\/([\w-]{11})/)
      if (embedMatch) return embedMatch[1]
      // youtube.com/v/VIDEOID
      const vMatch = url.match(/\/v\/([\w-]{11})/)
      if (vMatch) return vMatch[1]
      return null
    } catch {
      return null
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)

    try {
      // Validate YouTube URL
      const youtubeRegex = /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be)\/.+$/
      if (!youtubeRegex.test(videoUrl)) {
        toast.error("Please enter a valid YouTube URL")
        setIsSubmitting(false)
        return
      }

      // Robustly extract video ID
      const videoId = extractYouTubeVideoId(videoUrl)
      if (!videoId) {
        toast.error("Could not extract video ID from URL. Please check the link format.")
        setIsSubmitting(false)
        return
      }

      // Submit to API
      const response = await fetch('/api/media/submit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          videoId,
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        toast.error(error.error || error.message || 'Failed to submit video')
        setIsSubmitting(false)
        return
      }

      const newItem = await response.json()
      toast.success("Video submitted successfully!")
      setVideoUrl("")
      // Optimistically add the new item to the top of the list
      setMediaItems((prev) => [newItem, ...prev])
      // Fetch the latest list in the background
      fetchMediaItems()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to submit video. Please try again.")
    } finally {
      setIsSubmitting(false)
    }
  }

  // Helper function to get week number
  const getWeekNumber = (date: Date) => {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
    const dayNum = d.getUTCDay() || 7
    d.setUTCDate(d.getUTCDate() + 4 - dayNum)
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
    return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7)
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading media...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b">
        <div className="container mx-auto px-4 py-6">
          <h1 className="text-3xl font-bold">Media</h1>
          <p className="text-gray-600 mt-2">Watch highlights, interviews, and more from the MLFF community</p>
        </div>
      </div>

      {/* Main Content */}
      <div className="container mx-auto px-4 py-6">
        {/* Filters */}
        <div className="flex flex-col md:flex-row gap-4 mb-6">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
              <Input
                placeholder="Search videos..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
          <Select 
            value={selectedYear?.toString() || "all"} 
            onValueChange={(value) => setSelectedYear(value === "all" ? undefined : parseInt(value))}
          >
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Year" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Years</SelectItem>
              {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i).map(year => (
                <SelectItem key={year} value={year.toString()}>{year}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select 
            value={selectedWeek?.toString() || "all"} 
            onValueChange={(value) => setSelectedWeek(value === "all" ? undefined : parseInt(value))}
          >
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Week" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Weeks</SelectItem>
              {Array.from({ length: 17 }, (_, i) => i + 1).map(week => (
                <SelectItem key={week} value={week.toString()}>Week {week}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={sortOrder} onValueChange={(value: "newest" | "oldest") => setSortOrder(value)}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Sort by" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="newest">Newest First</SelectItem>
              <SelectItem value="oldest">Oldest First</SelectItem>
            </SelectContent>
          </Select>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="w-[180px]">
                <Calendar className="mr-2 h-4 w-4" />
                {dateRange?.from ? (
                  dateRange.to ? (
                    <>
                      {dateRange.from.toLocaleDateString()} -{" "}
                      {dateRange.to.toLocaleDateString()}
                    </>
                  ) : (
                    dateRange.from.toLocaleDateString()
                  )
                ) : (
                  "Date Range"
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <CalendarComponent
                initialFocus
                mode="range"
                defaultMonth={dateRange?.from}
                selected={dateRange}
                onSelect={setDateRange}
                numberOfMonths={2}
              />
            </PopoverContent>
          </Popover>
        </div>

        {/* Featured Video */}
        {filteredMediaItems.length > 0 && (
          <div className="mb-12">
            <h2 className="text-2xl font-bold mb-6">Featured Video</h2>
            <Card className="overflow-hidden">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="aspect-video relative">
                  <iframe
                    src={`https://www.youtube.com/embed/${filteredMediaItems[0].videoId}`}
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                    className="absolute inset-0 w-full h-full"
                  />
                </div>
                <CardHeader className="lg:p-8">
                  <div className="flex items-center gap-4 pt-4">
                    <Badge variant="outline">{filteredMediaItems[0].type}</Badge>
                  </div>
                  <div className="flex gap-4 pt-4">
                    <Button asChild>
                      <Link href={`https://youtube.com/watch?v=${filteredMediaItems[0].videoId}`} target="_blank">
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
        )}

        {/* Video Grid */}
        <div className="mb-12">
          <h2 className="text-2xl font-bold mb-6">All Videos</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredMediaItems.map((item) => (
              <Card key={item.id} className="overflow-hidden">
                <div className="aspect-video relative">
                  <iframe
                    src={`https://www.youtube.com/embed/${item.videoId}`}
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                    className="absolute inset-0 w-full h-full"
                  />
                </div>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      {item.type && <Badge variant="secondary">{item.type}</Badge>}
                    </div>
                    <Link
                      href={`https://www.youtube.com/watch?v=${item.videoId}`}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <Button variant="ghost" size="icon">
                        <ExternalLink className="h-4 w-4" />
                      </Button>
                    </Link>
                  </div>
                </CardHeader>
              </Card>
            ))}
          </div>
        </div>

        {/* Submit Form */}
        <Card>
          <CardHeader>
            <div className="text-lg font-semibold mb-2">Submit Video</div>
            <div className="text-gray-500 mb-4">Share a YouTube video with the community</div>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Input
                  id="videoUrl"
                  placeholder="https://www.youtube.com/watch?v=..."
                  value={videoUrl}
                  onChange={(e) => setVideoUrl(e.target.value)}
                  required
                />
              </div>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? "Submitting..." : "Submit Video"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}