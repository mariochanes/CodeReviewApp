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
  const [snippetCache, setSnippetCache] = useState<CachedSnippet[]>([])
  const [isPreloading, setIsPreloading] = useState(false)
  const [preloadQueue, setPreloadQueue] = useState(0) // Track pending preloads
  const [rateLimited, setRateLimited] = useState(false) // Track rate limit status
  const rateLimitCache = useRef<{ isLimited: boolean; timestamp: number }>({ isLimited: false, timestamp: 0 })
  const router = useRouter()

  // Check rate limit status from server (cached for 5 seconds to reduce API calls)
  const checkRateLimit = async (force: boolean = false): Promise<boolean> => {
    const now = Date.now()
    const cacheAge = now - rateLimitCache.current.timestamp
    
    // Use cached value if less than 5 seconds old and not forcing refresh
    if (!force && cacheAge < 5000 && rateLimitCache.current.timestamp > 0) {
      return rateLimitCache.current.isLimited
    }
    
    try {
      const response = await fetch('/api/rate-limit')
      const data = await response.json()
      
      const isLimited = data.search?.rateLimited || data.core?.rateLimited || false
      const wasLimited = rateLimitCache.current.isLimited
      
      rateLimitCache.current = { isLimited, timestamp: now }
      setRateLimited(isLimited)
      
      // Only log when state changes
      if (isLimited && !wasLimited) {
        const resetTime = data.search?.resetInSeconds || data.core?.resetInSeconds || 0
        console.log(`[Client] ⏸️ Rate limited. Reset in ${resetTime}s. Pausing preloads.`)
      }
      
      return isLimited
    } catch (error) {
      // If we can't check, use cached value or assume not limited (fail open)
      return rateLimitCache.current.isLimited || false
    }
  }

  // Preload function - builds cache to 50 snippets (rate-limited)
  const preloadSnippets = async (batchSize: number = 10) => {
    // Quick check using cached rate limit status (no API call)
    if (rateLimitCache.current.isLimited && Date.now() - rateLimitCache.current.timestamp < 30000) {
      return // Skip if recently rate limited
    }

    // Check current cache size and queue
    let currentSize = 0
    let currentQueue = 0
    setSnippetCache(prev => {
      currentSize = prev.length
      return prev
    })
    setPreloadQueue(prev => {
      currentQueue = prev
      return prev
    })
    
    // Don't preload if cache is full
    if (currentSize >= 50) {
      return
    }
    
    // More aggressive preloading when cache is very low - allow 2 concurrent
    const maxConcurrent = currentSize < 10 ? 2 : 1
    if (currentQueue >= maxConcurrent) {
      return
    }
    
    // Increment queue counter
    setPreloadQueue(prev => prev + 1)
    setIsPreloading(true)
    try {
      const needed = Math.min(50 - currentSize, batchSize)
      if (needed > 0) {
        const response = await fetch(`/api/snippets/batch?count=${needed}`)
        const data = await response.json()
        
        if (data.snippets?.length > 0) {
          const newSnippets: CachedSnippet[] = data.snippets.map((snippet: any) => ({
            snippet: {
              id: `temp-${Date.now()}-${Math.random()}`,
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
            const updated = [...prev, ...newSnippets]
            return updated.slice(0, 50) // Cap at 50
          })
        }
      }
    } catch (error) {
      // Update rate limit cache on error (might be rate limited)
      await checkRateLimit(true)
    } finally {
      setIsPreloading(false)
      setPreloadQueue(prev => Math.max(0, prev - 1))
    }
  }

  // Get next snippet - ALWAYS use cache if available (instant!)
  const getNextSnippet = async () => {
    // Check cache synchronously first
    let cachedItem: CachedSnippet | null = null
    let remainingCount = 0
    
    // Use a synchronous check to get cache state
    setSnippetCache(prev => {
      if (prev.length > 0) {
        cachedItem = prev[0]
        remainingCount = prev.length - 1
        return prev.slice(1) // Remove first item
      }
      return prev
    })
    
    // If we have cache, use it INSTANTLY (no loading!)
    if (cachedItem) {
      const cached: CachedSnippet = cachedItem
      // Set loading to false FIRST, then set data
      setLoading(false)
      setError(null)
      setSnippetData(cached)
      setSnippetCount(prev => prev + 1)
      
      // Save to DB in background (don't block UI)
      fetch('/api/snippets/random', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ snippet: cached.snippet }),
      })
      .then(async (response) => {
        if (response.ok) {
          const data = await response.json()
          // Only update if still showing same snippet
          setSnippetData(prev => prev?.snippet.content === cached.snippet.content ? data : prev)
        }
      })
      .catch(() => {}) // Silent fail
      
      // Preload aggressively when cache is getting low
      if (remainingCount < 25) {
        setTimeout(() => preloadSnippets(10), 300)
        if (remainingCount < 15) {
          setTimeout(() => preloadSnippets(10), 800)
        }
        if (remainingCount < 5) {
          setTimeout(() => preloadSnippets(10), 1500)
        }
      }
      return
    }
    
    // Cache empty - fetch new one (should rarely happen if preloading works)
    setError(null)
    setLoading(true)
    
    try {
      const isFirstLoad = snippetCount === 0
      const response = await fetch(`/api/snippets/random${isFirstLoad ? '?fast=true' : ''}`)
      const data = await response.json()
      
      if (!response.ok || data.error || !data.snippet) {
        setError(data.error || 'Failed to fetch snippet')
        setSnippetData(null)
        return
      }
      
      setSnippetData(data)
      setError(null)
      setSnippetCount(prev => prev + 1)
      
      // Preload to build cache
      setTimeout(() => preloadSnippets(10), 2000)
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Unknown error')
      setSnippetData(null)
    } finally {
      setLoading(false)
    }
  }

  const fetchRandomSnippet = getNextSnippet

  useEffect(() => {
    // Initial load
    getNextSnippet()
    
    // Start preloading to build cache (staggered to avoid rate limits)
    setTimeout(() => preloadSnippets(10), 2000)
    setTimeout(() => preloadSnippets(10), 5000)
    setTimeout(() => preloadSnippets(10), 9000)
    
    // Continue preloading periodically - more aggressive
    const preloadInterval = setInterval(() => {
      setSnippetCache(prev => {
        if (prev.length < 35) {
          setTimeout(() => preloadSnippets(10), 300)
        }
        return prev
      })
    }, 8000) // Check every 8 seconds
    
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

  if (!snippetData && !loading) {
    return (
      <div className="min-h-screen bg-gray-100 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center max-w-md mx-auto px-6">
          <p className="text-red-600 dark:text-red-400 mb-2 text-lg font-semibold">
            Failed to load code snippet
          </p>
          {error && (
            <p className="text-red-500 dark:text-red-300 mb-4 text-sm">
              {error}
            </p>
          )}
          <button
            onClick={() => getNextSnippet()}
            disabled={loading}
            className="px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Loading...' : 'Try Again'}
          </button>
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
            <button
              onClick={() => fetchRandomSnippet()}
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
        {error && (
          <div className="max-w-6xl mx-auto px-6 mb-4 animate-slideDown">
            <div className="bg-yellow-50 dark:bg-yellow-900/20 border-l-4 border-yellow-400 dark:border-yellow-600 rounded-lg p-4 shadow-md">
              <p className="text-yellow-800 dark:text-yellow-200 text-sm font-medium">
                ⚠️ {error}
              </p>
            </div>
          </div>
        )}
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
