import { NextResponse } from 'next/server'
import { getRandomCodeSnippet, CodeSnippet } from '@/lib/github'

// Minimum score threshold for interesting code (lowered to ensure we get results)
// Accept any snippet with a score > 0, or no score at all (for new mode)
const MIN_SCORE_THRESHOLD = 0

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const count = parseInt(searchParams.get('count') || '5', 10)
    
    const snippets: CodeSnippet[] = []
    const attempts = Math.max(count * 3, 20) // Try 3x the count, minimum 20 attempts
    
    for (let i = 0; i < attempts && snippets.length < count; i++) {
      try {
        const snippet = await getRandomCodeSnippet(1, false) // Full scoring for preloaded snippets
        
        if (snippet) {
          // Accept any snippet (score is optional, especially for new mode)
          snippets.push(snippet)
        }
      } catch (error) {
        // Silently continue - errors are expected during batch operations
      }
    }
    
    // Sort by score descending
    snippets.sort((a, b) => (b.score || 0) - (a.score || 0))
    
    return NextResponse.json({
      snippets,
      count: snippets.length,
      threshold: MIN_SCORE_THRESHOLD,
    })
  } catch (error) {
    console.error('Error in /api/snippets/batch:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json(
      { error: `Internal server error: ${errorMessage}`, snippets: [] },
      { status: 500 }
    )
  }
}

