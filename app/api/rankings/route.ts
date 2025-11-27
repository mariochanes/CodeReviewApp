import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    // Get top reviewers (by agreement votes)
    const topReviewers = await prisma.review.groupBy({
      by: ['reviewerName'],
      _count: {
        id: true,
      },
      orderBy: {
        _count: {
          id: 'desc',
        },
      },
      take: 10,
    })

    // Get reviewer scores (agreement ratio)
    const reviewersWithScores = await Promise.all(
      topReviewers.map(async (reviewer) => {
        const reviews = await prisma.review.findMany({
          where: { reviewerName: reviewer.reviewerName },
          include: { votes: true },
        })

        const totalVotes = reviews.reduce(
          (sum, r) => sum + r.votes.length,
          0
        )
        const agreeVotes = reviews.reduce(
          (sum, r) => sum + r.votes.filter((v) => v.isAgree).length,
          0
        )
        const agreementRatio =
          totalVotes > 0 ? (agreeVotes / totalVotes) * 100 : 0

        return {
          name: reviewer.reviewerName,
          reviewCount: reviewer._count.id,
          agreementRatio: Math.round(agreementRatio * 100) / 100,
        }
      })
    )

    // Get top projects by quality score
    const topProjects = await prisma.project.findMany({
      orderBy: {
        qualityScore: 'desc',
      },
      take: 20,
    })

    return NextResponse.json({
      reviewers: reviewersWithScores.sort(
        (a, b) => b.agreementRatio - a.agreementRatio
      ),
      projects: topProjects.map((p) => ({
        fullName: p.fullName,
        qualityScore: Math.round(p.qualityScore * 100) / 100,
        reviewCount: p.reviewCount,
        description: p.description,
      })),
    })
  } catch (error) {
    console.error('Error fetching rankings:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

