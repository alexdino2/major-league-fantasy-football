import { NextResponse } from 'next/server'
import { prisma } from "@/lib/prisma"

export async function POST(request: Request) {
  try {
    const { videoId } = await request.json()

    if (!videoId) {
      return NextResponse.json(
        { error: "Video ID is required" },
        { status: 400 }
      )
    }

    // Get YouTube API key from environment
    const apiKey = process.env.YOUTUBE_API_KEY
    if (!apiKey) {
      console.error("YouTube API key not found in environment variables")
      return NextResponse.json(
        { error: "YouTube API key not configured" },
        { status: 500 }
      )
    }

    // Fetch video details from YouTube API
    const response = await fetch(
      `https://www.googleapis.com/youtube/v3/videos?part=snippet&id=${videoId}&key=${apiKey}`
    )

    if (!response.ok) {
      const error = await response.json()
      console.error("YouTube API error:", error)
      return NextResponse.json(
        { error: "Failed to fetch video details from YouTube" },
        { status: response.status }
      )
    }

    const data = await response.json()

    if (!data.items || data.items.length === 0) {
      console.error("No video found for ID:", videoId)
      return NextResponse.json(
        { error: "Video not found on YouTube" },
        { status: 404 }
      )
    }

    const videoDetails = data.items[0].snippet

    // Extract year and week from publish date
    const publishDate = new Date(videoDetails.publishedAt)
    const year = publishDate.getFullYear()
    const week = getWeekNumber(publishDate)

    try {
      // Create media item in database
      const mediaItem = await prisma.mediaItem.create({
        data: {
          videoId,
          title: videoDetails.title,
          description: videoDetails.description,
          year,
          week,
          type: "highlight", // Default type
          submittedAt: new Date(),
        },
      })

      return NextResponse.json(mediaItem)
    } catch (dbError) {
      console.error("Database error:", dbError)
      return NextResponse.json(
        { error: "Failed to save video to database" },
        { status: 500 }
      )
    }
  } catch (error) {
    console.error("Error submitting video:", error)
    return NextResponse.json(
      { error: "Failed to submit video" },
      { status: 500 }
    )
  }
}

// Helper function to get week number
function getWeekNumber(date: Date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  const dayNum = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() + 4 - dayNum)
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7)
} 