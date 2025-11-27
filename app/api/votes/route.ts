import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const voteSchema = z.object({
  reviewId: z.string(),
  voterName: z.string().min(1).max(100),
  isAgree: z.boolean(),
})

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const data = voteSchema.parse(body)

    // Use upsert to handle existing votes
    const vote = await prisma.vote.upsert({
      where: {
        reviewId_voterName: {
          reviewId: data.reviewId,
          voterName: data.voterName,
        },
      },
      update: {
        isAgree: data.isAgree,
      },
      create: data,
    })

    // Update project quality score based on agreement
    const review = await prisma.review.findUnique({
      where: { id: data.reviewId },
      include: {
        snippet: {
          include: {
            project: true,
          },
        },
      },
    })

    if (review?.snippet.project) {
      // Calculate quality score based on agreement ratio
      const allVotes = await prisma.vote.findMany({
        where: {
          review: {
            snippet: {
              projectId: review.snippet.projectId,
            },
          },
        },
      })

      const agreeCount = allVotes.filter((v) => v.isAgree).length
      const totalVotes = allVotes.length
      const qualityScore = totalVotes > 0 ? (agreeCount / totalVotes) * 100 : 0

      await prisma.project.update({
        where: { id: review.snippet.project!.id },
        data: {
          qualityScore,
        },
      })
    }

    return NextResponse.json(vote)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request data', details: error.errors },
        { status: 400 }
      )
    }
    console.error('Error creating vote:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

