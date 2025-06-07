import { NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'

interface MediaItem {
  id: string
  type: 'media' | 'news'
  title: string
  description: string
  year: number
  week: number
  date: string
  videoId?: string
  submittedAt: string
}

export async function GET() {
  try {
    const dataDir = path.join(process.cwd(), 'data')
    const submissionsPath = path.join(dataDir, 'content-submissions.json')
    
    let items: MediaItem[] = []
    try {
      const existingData = fs.readFileSync(submissionsPath, 'utf-8')
      items = JSON.parse(existingData)
    } catch (error) {
      // File doesn't exist yet, that's okay
    }

    return NextResponse.json(items.sort((a, b) => {
      // Sort by submittedAt in descending order (newest first)
      return new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime()
    }))
  } catch (error) {
    console.error('Error listing media items:', error)
    return NextResponse.json(
      { error: 'Failed to list media items' },
      { status: 500 }
    )
  }
} 