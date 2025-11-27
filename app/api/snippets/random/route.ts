import { NextRequest, NextResponse } from 'next/server'
import { getRandomCodeSnippet, CodeSnippet } from '@/lib/github'
import { prisma } from '@/lib/prisma'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const snippet = body.snippet as CodeSnippet
    
    if (!snippet) {
      return NextResponse.json({ error: 'Snippet data required' }, { status: 400 })
    }

    // Check if snippet already exists
    const existing = await prisma.codeSnippet.findFirst({
      where: {
        repository: snippet.repository,
        filePath: snippet.filePath,
        startLine: snippet.startLine,
        endLine: snippet.endLine,
      },
    })

    if (existing) {
      // Return existing snippet with reviews
      const reviews = await prisma.review.findMany({
        where: { snippetId: existing.id },
        include: {
          votes: true,
        },
        orderBy: {
          createdAt: 'desc',
        },
      })

      return NextResponse.json({
        snippet: existing,
        reviews,
      })
    }

    // Create new snippet
    const [owner, name] = snippet.repository.split('/')
    const fullName = snippet.repository

    // Get or create project
    let project = await prisma.project.findUnique({
      where: { fullName },
    })

    if (!project) {
      project = await prisma.project.create({
        data: {
          owner,
          name,
          fullName,
        },
      })
    }

    const newSnippet = await prisma.codeSnippet.create({
      data: {
        repository: snippet.repository,
        filePath: snippet.filePath,
        content: snippet.content,
        language: snippet.language,
        startLine: snippet.startLine,
        endLine: snippet.endLine,
        url: snippet.url,
        projectId: project.id,
      },
    })

    return NextResponse.json({
      snippet: newSnippet,
      reviews: [],
    })
  } catch (error) {
    console.error('Error in /api/snippets/random POST:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json(
      { error: `Internal server error: ${errorMessage}` },
      { status: 500 }
    )
  }
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const fastMode = searchParams.get('fast') === 'true' // Fast mode for first load
    
    const snippet = await getRandomCodeSnippet(3, fastMode)
    
    if (!snippet) {
      return NextResponse.json({ error: 'Failed to fetch snippet from GitHub. This could be due to rate limiting or network issues.' }, { status: 500 })
    }

    // Check if snippet already exists
    const existing = await prisma.codeSnippet.findFirst({
      where: {
        repository: snippet.repository,
        filePath: snippet.filePath,
        startLine: snippet.startLine,
        endLine: snippet.endLine,
      },
    })

    if (existing) {
      // Return existing snippet with reviews
      const reviews = await prisma.review.findMany({
        where: { snippetId: existing.id },
        include: {
          votes: true,
        },
        orderBy: {
          createdAt: 'desc',
        },
      })

      return NextResponse.json({
        snippet: existing,
        reviews,
      })
    }

    // Create new snippet
    const [owner, name] = snippet.repository.split('/')
    const fullName = snippet.repository

    // Get or create project
    let project = await prisma.project.findUnique({
      where: { fullName },
    })

    if (!project) {
      project = await prisma.project.create({
        data: {
          owner,
          name,
          fullName,
        },
      })
    }

    const newSnippet = await prisma.codeSnippet.create({
      data: {
        repository: snippet.repository,
        filePath: snippet.filePath,
        content: snippet.content,
        language: snippet.language,
        startLine: snippet.startLine,
        endLine: snippet.endLine,
        url: snippet.url,
        projectId: project.id,
      },
    })

    return NextResponse.json({
      snippet: newSnippet,
      reviews: [],
    })
  } catch (error) {
    console.error('Error in /api/snippets/random:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json(
      { error: `Internal server error: ${errorMessage}` },
      { status: 500 }
    )
  }
}

