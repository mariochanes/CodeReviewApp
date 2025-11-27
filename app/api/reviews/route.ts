import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const reviewSchema = z.object({
  snippetId: z.string(),
  reviewerName: z.string().min(1).max(100),
  comment: z.string().min(1).max(1000),
  smellType: z.string(),
  severity: z.enum(['low', 'medium', 'high']),
})

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const data = reviewSchema.parse(body)

    const review = await prisma.review.create({
      data,
      include: {
        votes: true,
        snippet: {
          include: {
            project: true,
          },
        },
      },
    })

    // Increment review count for the project
    if (review.snippet.project) {
      await prisma.project.update({
        where: { id: review.snippet.project.id },
        data: {
          reviewCount: {
            increment: 1,
          },
        },
      })
    }

    return NextResponse.json(review)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request data', details: error.errors },
        { status: 400 }
      )
    }
    console.error('Error creating review:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const snippetId = searchParams.get('snippetId')

    if (!snippetId) {
      return NextResponse.json(
        { error: 'snippetId is required' },
        { status: 400 }
      )
    }

    const reviews = await prisma.review.findMany({
      where: { snippetId },
      include: {
        votes: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    })

    return NextResponse.json(reviews)
  } catch (error) {
    console.error('Error fetching reviews:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

