import { NextResponse } from 'next/server'
import { prisma } from "@/lib/prisma"

export async function GET() {
  try {
    const items = await prisma.mediaItem.findMany({
      orderBy: {
        submittedAt: 'desc'
      }
    })

    return NextResponse.json(items)
  } catch (error) {
    console.error('Error listing media items:', error)
    return NextResponse.json(
      { error: 'Failed to list media items' },
      { status: 500 }
    )
  }
} 