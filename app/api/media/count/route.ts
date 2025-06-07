import { NextResponse } from 'next/server'
import { prisma } from "@/lib/prisma"

export async function GET() {
  try {
    const count = await prisma.mediaItem.count()
    return NextResponse.json({ count })
  } catch (error) {
    console.error('Error counting media items:', error)
    return NextResponse.json(
      { error: 'Failed to count media items' },
      { status: 500 }
    )
  }
} 