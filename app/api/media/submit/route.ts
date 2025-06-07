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

    // Create media item in database
    const mediaItem = await prisma.mediaItem.create({
      data: {
        videoId,
        submittedAt: new Date(),
      },
    })

    return NextResponse.json(mediaItem)
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