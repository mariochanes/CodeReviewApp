/**
 * Local Code Snippets
 * Pre-generated code snippets from our own codebase for instant display
 * without requiring any network requests.
 */

export interface LocalCodeSnippet {
  id: string;
  filePath: string;
  content: string;
  language: string;
  startLine: number;
  endLine: number;
  title: string;
}

// Pre-generated snippets for even faster loading
export const preGeneratedSnippets: LocalCodeSnippet[] = [
  {
    id: 'local-app-page-1',
    filePath: 'app/page.tsx',
    language: 'typescript',
    startLine: 280,
    endLine: 310,
    title: 'app/page.tsx',
    content: `  // Fetch reviews for a cached snippet
  const fetchSnippetReviews = useCallback(async (snippet: SnippetData['snippet']) => {
    try {
      const response = await fetch('/api/snippets/random', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ snippet }),
      });
      
      if (response.ok) {
        const data = await response.json();
        // Only update if still showing same snippet
        setSnippetData(prev => 
          prev?.snippet.content === snippet.content ? data : prev
        );
      }
    } catch (error) {
      // Silent fail - we already have the snippet content
    }
  }, []);`
  },
  {
    id: 'local-components-codesnippet-1',
    filePath: 'components/CodeSnippet.tsx',
    language: 'typescript',
    startLine: 40,
    endLine: 70,
    title: 'components/CodeSnippet.tsx',
    content: `  const handleSubmitReview = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      const response = await fetch('/api/reviews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          snippetId: snippet.id,
          reviewerName,
          comment,
          smellType,
          severity,
        }),
      })

      if (response.ok) {
        const newReview = await response.json()
        setReviews([newReview, ...reviews])
        setShowReviewForm(false)
        setComment('')
        setReviewerName('')
      }
    } catch (error) {
      console.error('Error submitting review:', error)
    } finally {
      setLoading(false)
    }
  }`
  },
  {
    id: 'local-lib-github-1',
    filePath: 'lib/github.ts',
    language: 'typescript',
    startLine: 400,
    endLine: 430,
    title: 'lib/github.ts',
    content: `// Detect code smells and interesting patterns
function detectCodePatterns(lines: string[], start: number, end: number, language: string): {
  codeSmells: string[]
  interestingPatterns: string[]
  potentialIssues: string[]
  educationalValue: string[]
} {
  const section = lines.slice(start - 1, end)
  const fullText = section.join('\\n')
  const codeSmells: string[] = []
  const interestingPatterns: string[] = []
  const potentialIssues: string[] = []
  const educationalValue: string[] = []

  // Code Smells Detection
  if (section.length > 50) codeSmells.push('Long method/function')
  if (fullText.match(/if\\s*\\([^)]*\\)\\s*\\{[^}]*if\\s*\\([^)]*\\)\\s*\\{[^}]*if\\s*\\(/)) {
    codeSmells.push('Deep nesting')
  }
  if (fullText.match(/console\\.(log|warn|error)/)) codeSmells.push('Console statements')
  if (fullText.match(/TODO|FIXME|HACK|XXX/i)) codeSmells.push('TODO/FIXME comments')`
  },
  {
    id: 'local-lib-snippetcache-1',
    filePath: 'lib/snippetCache.ts',
    language: 'typescript',
    startLine: 100,
    endLine: 130,
    title: 'lib/snippetCache.ts',
    content: `/**
 * Add a snippet to the cache
 */
export function cacheSnippet(snippet: CodeSnippet): void {
  if (!isLocalStorageAvailable()) {
    return;
  }

  try {
    const cache = getCache();
    
    // Check if snippet already exists in cache
    const existingIndex = cache.snippets.findIndex(
      s => s.repository === snippet.repository && 
           s.filePath === snippet.filePath && 
           s.startLine === snippet.startLine && 
           s.endLine === snippet.endLine
    );

    const cachedSnippet: CachedSnippet = {
      ...snippet,
      cachedAt: Date.now()
    };

    if (existingIndex >= 0) {
      // Update existing snippet
      cache.snippets[existingIndex] = cachedSnippet;
    } else {
      // Add new snippet
      cache.snippets.unshift(cachedSnippet);`
  },
  {
    id: 'local-app-api-snippets-random-1',
    filePath: 'app/api/snippets/random/route.ts',
    language: 'typescript',
    startLine: 1,
    endLine: 30,
    title: 'app/api/snippets/random/route.ts',
    content: `import { NextRequest, NextResponse } from 'next/server'
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
      })`
  }
];

/**
 * Get a random pre-generated snippet
 */
export function getRandomPreGeneratedSnippet(): LocalCodeSnippet {
  const randomIndex = Math.floor(Math.random() * preGeneratedSnippets.length);
  return preGeneratedSnippets[randomIndex];
}
