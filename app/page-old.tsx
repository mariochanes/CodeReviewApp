'use client'

import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import CodeSnippet from '@/components/CodeSnippet'

interface SnippetData {
  snippet: {
    id: string
    repository: string
    filePath: string
    content: string
    language: string
    startLine: number
    endLine: number
    url: string
    commitAuthor?: string
    commitAuthorLogin?: string
    commitDate?: string
  }
  reviews: Array<{
    id: string
    reviewerName: string
    comment: string
    smellType: string
    severity: string
    createdAt: string
    votes: Array<{
      id: string
      voterName: string
      isAgree: boolean
    }>
  }>
}

interface CachedSnippet extends SnippetData {
  score?: number
}

export default function Home() {
  const [snippetData, setSnippetData] = useState<SnippetData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [snippetCount, setSnippetCount] = useState(0)
  const [mode, setMode] = useState<'curated' | 'new'>('new')
  const [snippetCache, setSnippetCache] = useState<CachedSnippet[]>([])
  const [isPreloading, setIsPreloading] = useState(false)
  const router = useRouter()

  // Pre-fetch and cache interesting snippets in the background
  const preloadSnippets = async (codeMode: 'curated' | 'new' = mode, targetCount: number = 10) => {
    if (isPreloading) return // Don't preload if already loading
    
    // Check cache size using functional update to get current state
    let shouldSkip = false
    setSnippetCache(prev => {
      if (prev.length >= 75) {
        console.log(`[Client] Cache is full (${prev.length} snippets), skipping preload`)
        shouldSkip = true
      }
      return prev // Don't modify, just check
    })
    
    if (shouldSkip) return
    
    setIsPreloading(true)
    try {
      // Get current cache size using functional update
      let currentCacheSize = 0
      setSnippetCache(prev => {
        currentCacheSize = prev.length
        return prev // Don't modify, just read
      })
      
      // Cap target count at 75 to avoid over-preloading
      const maxTarget = Math.min(targetCount, 75)
      const needed = Math.max(maxTarget - currentCacheSize, 5) // Always fetch at least 5, but don't exceed 75 total
      
      console.log(`[Client] Pre-loading ${needed} snippets (mode: ${codeMode}, current cache: ${currentCacheSize})...`)
      const response = await fetch(`/api/snippets/batch?mode=${codeMode}&count=${needed}`)
      const data = await response.json()
      
      if (data.snippets && data.snippets.length > 0) {
        // Convert to SnippetData format and store in cache
        const newSnippets: CachedSnippet[] = data.snippets.map((snippet: any) => ({
          snippet: {
            id: `temp-${Date.now()}-${Math.random()}`, // Temporary ID
            repository: snippet.repository,
            filePath: snippet.filePath,
            content: snippet.content,
            language: snippet.language,
            startLine: snippet.startLine,
            endLine: snippet.endLine,
            url: snippet.url,
            commitAuthor: snippet.commitAuthor,
            commitAuthorLogin: snippet.commitAuthorLogin,
            commitDate: snippet.commitDate,
          },
          reviews: [],
          score: snippet.score,
        }))
        
        setSnippetCache(prev => {
          // Cap at 75 snippets maximum
          const currentLength = prev.length
          if (currentLength >= 75) {
            console.log(`[Client] Cache already at limit (75), skipping add`)
            return prev
          }
          const toAdd = Math.min(newSnippets.length, 75 - currentLength)
          const updated = [...prev, ...newSnippets.slice(0, toAdd)]
          console.log(`[Client] Cached ${toAdd} snippets. Total in cache: ${updated.length}`)
          return updated
        })
      } else {
        console.log('[Client] No snippets returned from batch, will retry...')
        // Retry after a short delay if we got nothing (only if under 75)
        setSnippetCache(prev => {
          if (prev.length < 75) {
            setTimeout(() => preloadSnippets(codeMode, targetCount), 2000)
          }
          return prev
        })
      }
    } catch (error) {
      console.error('[Client] Error pre-loading snippets:', error)
      // Retry after delay on error (only if under 75)
      setSnippetCache(prev => {
        if (prev.length < 75) {
          setTimeout(() => preloadSnippets(codeMode, targetCount), 3000)
        }
        return prev
      })
    } finally {
      setIsPreloading(false)
    }
  }

  // Get next snippet from cache or fetch new one
  // This function ONLY runs when user explicitly requests a new snippet
  const getNextSnippet = async (codeMode: 'curated' | 'new' = mode) => {
    // First, try to get from cache (instant display!)
    if (snippetCache.length > 0) {
      const cached = snippetCache[0]
      const remaining = snippetCache.slice(1)
      setSnippetCache(remaining)
      
      console.log(`[Client] Using cached snippet (score: ${cached.score || 'N/A'}). ${remaining.length} remaining in cache.`)
      
      // Show cached snippet immediately (no loading!)
      setSnippetData(cached)
      setError(null)
      setSnippetCount(prev => prev + 1)
      setLoading(false)
      
      // Save to database and get real ID (in background, don't block UI)
      // Store the current snippet content to ensure we don't accidentally replace it
      const currentSnippetContent = cached.snippet.content
      const currentSnippetUrl = cached.snippet.url
      
      fetch('/api/snippets/random', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ snippet: cached.snippet }),
      })
      .then(async (response) => {
        if (response.ok) {
          const data = await response.json()
          // Only update if it's the same snippet (same content and URL) - just update ID and reviews
          if (data.snippet && 
              data.snippet.content === currentSnippetContent && 
              data.snippet.url === currentSnippetUrl) {
            setSnippetData(prev => {
              // Only update if current snippet matches what we're updating
              // This prevents replacing the snippet if user clicked "Next" while this was loading
              if (prev && prev.snippet.content === currentSnippetContent) {
                return data
              }
              return prev // Don't change if user has moved on
            })
          }
        }
      })
      .catch((error) => {
        console.error('[Client] Error saving cached snippet:', error)
        // Snippet already shown, so this is fine
      })
      
      // Aggressively preload to keep cache full (target 15 snippets, max 75)
      if (remaining.length < 10 && !isPreloading && snippetCache.length < 75) {
        setTimeout(() => preloadSnippets(codeMode, 15), 100)
      }
      return
    }
    
    // Cache empty - show loading and fetch new one
    // Only set loading if we don't have a snippet to show
    if (!snippetData) {
      setLoading(true)
    }
    setError(null)
    
    try {
      console.log(`[Client] Cache empty, fetching new snippet (mode: ${codeMode})...`)
      const response = await fetch(`/api/snippets/random?mode=${codeMode}`)
      const data = await response.json()
      
      console.log('[Client] Response received:', { ok: response.ok, hasError: !!data.error, hasSnippet: !!data.snippet })
      
      if (!response.ok || data.error || !data.snippet) {
        // Don't show error - just keep trying in background for preloading
        // But DON'T change the displayed snippet - keep showing what we have or loading
        console.error('[Client] Failed to fetch, will retry preloading...')
        // Only preload more, don't change displayed snippet (max 75)
        if (snippetCache.length < 75) {
          setTimeout(() => preloadSnippets(codeMode, 15), 2000)
        }
        // Keep loading state if no snippet to show, otherwise keep current snippet
        if (!snippetData) {
          setLoading(true)
        } else {
          setLoading(false)
        }
        return
      }
      
      console.log('[Client] Successfully loaded snippet:', data.snippet.repository)
      setSnippetData(data)
      setError(null)
      setSnippetCount(prev => prev + 1)
      setLoading(false)
      
      // Aggressively preload more in background (max 75)
      if (snippetCache.length < 75) {
        setTimeout(() => preloadSnippets(codeMode, 15), 100)
      }
    } catch (error) {
      console.error('[Client] Error fetching snippet:', error)
      // Don't show error - just preload more in background (max 75)
      // DON'T change the displayed snippet automatically - keep what we have
      if (snippetCache.length < 75) {
        setTimeout(() => preloadSnippets(codeMode, 15), 2000)
      }
      // Keep loading state if no snippet to show, otherwise keep current snippet
      if (!snippetData) {
        setLoading(true)
      } else {
        setLoading(false)
      }
    }
  }

  const fetchRandomSnippet = getNextSnippet

  useEffect(() => {
    // Start preloading immediately (before first load)
    preloadSnippets('new', 15)
    
    // Initial load after a tiny delay to let cache start filling
    setTimeout(() => {
      getNextSnippet('new')
    }, 500)
    
    // Keep preloading aggressively (until we hit 75)
    const preloadInterval = setInterval(() => {
      if (snippetCache.length < 75 && snippetCache.length < 10 && !isPreloading) {
        preloadSnippets(mode, 15)
      }
    }, 5000) // Check every 5 seconds
    
    return () => clearInterval(preloadInterval)
  }, [])

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 via-blue-50 to-indigo-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="relative">
            <div className="animate-spin rounded-full h-16 w-16 border-4 border-purple-200 dark:border-purple-900 mx-auto"></div>
            <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-purple-600 dark:border-purple-400 mx-auto absolute top-0 left-1/2 transform -translate-x-1/2"></div>
          </div>
          <p className="mt-6 text-gray-700 dark:text-gray-300 text-lg font-medium animate-pulse">
            Discovering interesting code...
          </p>
          <p className="mt-2 text-gray-500 dark:text-gray-400 text-sm">
            Finding the perfect snippet to review
          </p>
        </div>
      </div>
    )
  }

  // Never show error state - always show loading if no data
  if (!snippetData) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 via-blue-50 to-indigo-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="relative">
            <div className="animate-spin rounded-full h-16 w-16 border-4 border-purple-200 dark:border-purple-900 mx-auto"></div>
            <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-purple-600 dark:border-purple-400 mx-auto absolute top-0 left-1/2 transform -translate-x-1/2"></div>
          </div>
          <p className="mt-6 text-gray-700 dark:text-gray-300 text-lg font-medium animate-pulse">
            Discovering interesting code...
          </p>
          <p className="mt-2 text-gray-500 dark:text-gray-400 text-sm">
            {snippetCache.length > 0 
              ? `Preparing ${snippetCache.length} snippet${snippetCache.length !== 1 ? 's' : ''}...`
              : 'Finding the perfect snippet to review'}
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50/30 to-purple-50/30 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
      {/* Navigation */}
      <nav className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-md shadow-lg border-b border-gray-200 dark:border-gray-700 sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-6 py-4 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="text-3xl">🔍</div>
            <div>
              <h1 className="text-2xl font-bold bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">
                CodeReview
              </h1>
              <div className="flex items-center gap-2">
                {snippetCount > 0 && (
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {snippetCount} reviewed
                  </p>
                )}
                {snippetCache.length > 0 && (
                  <p className="text-xs text-green-600 dark:text-green-400">
                    {snippetCache.length} cached
                  </p>
                )}
              </div>
            </div>
          </div>
          <div className="flex gap-3 items-center">
            {/* Mode Toggle */}
            <div className="flex items-center gap-2 bg-gray-100 dark:bg-gray-700 rounded-lg p-1">
              <button
                onClick={() => {
                  const newMode: 'curated' | 'new' = 'curated'
                  setMode(newMode)
                  fetchRandomSnippet(newMode)
                }}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                  mode === 'curated'
                    ? 'bg-white dark:bg-gray-600 text-purple-600 dark:text-purple-400 shadow-sm'
                    : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100'
                }`}
              >
                📚 Curated
              </button>
              <button
                onClick={() => {
                  const newMode: 'curated' | 'new' = 'new'
                  setMode(newMode)
                  fetchRandomSnippet(newMode)
                }}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                  mode === 'new'
                    ? 'bg-white dark:bg-gray-600 text-blue-600 dark:text-blue-400 shadow-sm'
                    : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100'
                }`}
              >
                🆕 Brand New
              </button>
            </div>
            
            <button
              onClick={() => fetchRandomSnippet(mode)}
              disabled={loading}
              className="px-5 py-2.5 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-lg hover:from-purple-700 hover:to-blue-700 transition-all transform hover:scale-105 active:scale-95 shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none font-medium"
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <span className="animate-spin">⚡</span> Loading...
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <span>✨</span> Next Snippet
                </span>
              )}
            </button>
            <button
              onClick={() => router.push('/rankings')}
              className="px-5 py-2.5 bg-gray-700 dark:bg-gray-600 text-white rounded-lg hover:bg-gray-800 dark:hover:bg-gray-500 transition-all transform hover:scale-105 active:scale-95 shadow-lg font-medium"
            >
              🏆 Rankings
            </button>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="py-8 animate-fadeIn">
        {snippetData && (
          <div className="animate-fadeInUp">
            <CodeSnippet
              snippet={snippetData.snippet}
              reviews={snippetData.reviews}
            />
          </div>
        )}
      </main>
    </div>
  )
}

