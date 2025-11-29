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
    let owner, name;
    
    // Handle case when repository doesn't have a slash (like our local "CodeReviewApp" snippets)
    if (snippet.repository.includes('/')) {
      [owner, name] = snippet.repository.split('/');
    } else {
      // If no slash, use the repository name as both owner and name
      owner = snippet.repository;
      name = snippet.repository;
    }
    
    const fullName = snippet.repository;

    // Get or create project
    let project = await prisma.project.findUnique({
      where: { fullName },
    });

    if (!project) {
      console.log(`Creating new project: owner=${owner}, name=${name}, fullName=${fullName}`);
      project = await prisma.project.create({
        data: {
          owner,
          name,
          fullName,
        },
      });
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
    
    // Set a timeout to ensure we don't spend too long fetching
    const startTime = Date.now()
    const MAX_FETCH_TIME = 5000; // 5 seconds max
    
    // Create a promise that resolves to null after a timeout
    const timeoutPromise = new Promise<null>(resolve => {
      setTimeout(() => resolve(null), MAX_FETCH_TIME)
    })
    
    // Create the snippet fetch promise with reduced retries (2 instead of 3)
    const fetchPromise = getRandomCodeSnippet(2, fastMode)
    
    // Race the fetch against the timeout
    const snippet = await Promise.race([fetchPromise, timeoutPromise])
    
    if (!snippet) {
      console.log(`[Random] Snippet fetch timed out or failed after ${Date.now() - startTime}ms`)
      return NextResponse.json({ 
        error: 'Failed to fetch snippet from GitHub. Using cached or local snippets instead.',
        timedOut: true
      }, { status: 200 }) // Return 200 so client can handle gracefully
    }

    // Use a transaction for database operations to improve performance
    const result = await prisma.$transaction(async (tx) => {
      // Check if snippet already exists
      const existing = await tx.codeSnippet.findFirst({
        where: {
          repository: snippet.repository,
          filePath: snippet.filePath,
          startLine: snippet.startLine,
          endLine: snippet.endLine,
        },
      })

      if (existing) {
        // Return existing snippet with reviews
        const reviews = await tx.review.findMany({
          where: { snippetId: existing.id },
          include: {
            votes: true,
          },
          orderBy: {
            createdAt: 'desc',
          },
        })

        return {
          snippet: existing,
          reviews,
        }
      }

      // Create new snippet
      let owner, name;
      
      // Handle case when repository doesn't have a slash (like our local "CodeReviewApp" snippets)
      if (snippet.repository.includes('/')) {
        [owner, name] = snippet.repository.split('/');
      } else {
        // If no slash, use the repository name as both owner and name
        owner = snippet.repository;
        name = snippet.repository;
      }
      
      const fullName = snippet.repository;

      // Get or create project
      let project = await tx.project.findUnique({
        where: { fullName },
      });

      if (!project) {
        console.log(`Creating new project in transaction: owner=${owner}, name=${name}, fullName=${fullName}`);
        project = await tx.project.create({
          data: {
            owner,
            name,
            fullName,
          },
        });
      }

      const newSnippet = await tx.codeSnippet.create({
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

      return {
        snippet: newSnippet,
        reviews: [],
      }
    })
    
    const fetchTime = Date.now() - startTime
    console.log(`[Random] Fetched and processed snippet in ${fetchTime}ms`)
    
    return NextResponse.json({
      ...result,
      fetchTimeMs: fetchTime,
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
