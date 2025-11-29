'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import CodeSnippet from '@/components/CodeSnippet'
import { getRandomStaticSnippet } from '@/lib/staticSnippets'
import { 
  getRandomCachedSnippet, 
  getLastViewedSnippet, 
  cacheSnippet, 
  setLastViewedSnippet,
  convertStaticToCodeSnippet,
  getCacheStatistics
} from '@/lib/snippetCache'
import { getRandomPreGeneratedSnippet } from '@/lib/localCodeScanner'

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
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [snippetCount, setSnippetCount] = useState(0)
  const [snippetCache, setSnippetCache] = useState<CachedSnippet[]>([])
  const [isPreloading, setIsPreloading] = useState(false)
  const [preloadQueue, setPreloadQueue] = useState(0) // Track pending preloads
  const [rateLimited, setRateLimited] = useState(false) // Track rate limit status
  const [isFirstLoad, setIsFirstLoad] = useState(true)
  const [usingStaticSnippet, setUsingStaticSnippet] = useState(false)
  const [usingCachedSnippet, setUsingCachedSnippet] = useState(false)
  const [usingLocalSnippet, setUsingLocalSnippet] = useState(false)
  const [newSnippetsAdded, setNewSnippetsAdded] = useState(false)
  const rateLimitCache = useRef<{ isLimited: boolean; timestamp: number }>({ isLimited: false, timestamp: 0 })
  const router = useRouter()

  // Check rate limit status from server (cached for 30 minutes to minimize API calls)
  const checkRateLimit = async (force: boolean = false): Promise<boolean> => {
    const now = Date.now()
    const cacheAge = now - rateLimitCache.current.timestamp
    
    // Use cached value if less than 30 minutes old and not forcing refresh
    // This is a significant increase from 5 seconds to reduce API calls
    if (!force && cacheAge < 1800000 && rateLimitCache.current.timestamp > 0) {
      return rateLimitCache.current.isLimited
    }
    
    // Only check if absolutely necessary
    if (force) {
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
          console.log(`[Client] ⏸️ Rate limited. Reset in ${resetTime}s.`)
        }
        
        return isLimited
      } catch (error) {
        // If we can't check, use cached value or assume not limited (fail open)
        return rateLimitCache.current.isLimited || false
      }
    }
    
    // If not forcing and cache is expired, just return the last known value
    // This prevents unnecessary API calls
    return rateLimitCache.current.isLimited || false
  }

  // Track preload attempts to implement exponential backoff
  const preloadAttempts = useRef(0);
  const lastPreloadTime = useRef(0);
  const cacheFillingStatus = useRef({ inProgress: false, attempts: 0, success: 0 });
  
  // Minimal cache filling function - only used when explicitly requested by user
  const forceFillCache = async (targetCount: number = 5) => { // Reduced default target from 15 to 5
    console.log(`[Cache] Filling cache to ${targetCount} items (only when explicitly requested)...`);
    
    if (cacheFillingStatus.current.inProgress) {
      console.log('[Cache] Already filling cache, skipping duplicate request');
      return;
    }
    
    cacheFillingStatus.current = { inProgress: true, attempts: 0, success: 0 };
    setIsPreloading(true);
    
    // Get current cache size
    let currentSize = 0;
    setSnippetCache(prev => {
      currentSize = prev.length;
      return prev;
    });
    
    // If we already have enough items, just return
    if (currentSize >= targetCount) {
      console.log(`[Cache] Already have ${currentSize} items, no need to fill`);
      cacheFillingStatus.current.inProgress = false;
      setIsPreloading(false);
      return;
    }
    
    // Single attempt to fill cache - no multiple attempts
    try {
      console.log(`[Cache] Filling cache (single attempt)`);
      
      // Check rate limit first - but don't force a check, use cached value
      const isLimited = await checkRateLimit(false);
      if (isLimited) {
        console.log('[Cache] Rate limited, aborting cache fill');
        cacheFillingStatus.current.inProgress = false;
        setIsPreloading(false);
        return;
      }
      
      // Fetch a batch of snippets - only what we need
      const batchSize = Math.min(targetCount - currentSize, 5);
      console.log(`[Cache] Requesting batch of ${batchSize} snippets`);
      
      const response = await fetch(`/api/snippets/batch?count=${batchSize}`);
      const data = await response.json();
      
      if (data.snippets?.length > 0) {
        console.log(`[Cache] Received ${data.snippets.length} snippets`);
        
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
        }));
        
        // Update cache
        setSnippetCache(prev => {
          const updated = [...prev, ...newSnippets];
          currentSize = updated.length;
          return updated.slice(0, 10); // Cap at 10 instead of 30
        });
        
        cacheFillingStatus.current.success++;
        
        // Show notification
        setNewSnippetsAdded(true);
        setTimeout(() => setNewSnippetsAdded(false), 3000);
        
        console.log(`[Cache] Cache now has ${currentSize} items`);
      } else {
        console.log('[Cache] No snippets received from API');
      }
    } catch (error) {
      console.error('[Cache] Error filling cache:', error);
    }
    
    cacheFillingStatus.current.inProgress = false;
    setIsPreloading(false);
    console.log(`[Cache] Finished filling cache with ${currentSize} items`);
  };
  
  // Preload function - builds cache to 30 snippets (rate-limited with backoff)
  const preloadSnippets = async (batchSize: number = 5) => { // Reduced batch size
    const now = Date.now();
    
    // Implement exponential backoff for rate limits
    if (rateLimitCache.current.isLimited) {
      const waitTime = Math.min(120000, Math.pow(2, preloadAttempts.current) * 10000);
      if (now - rateLimitCache.current.timestamp < waitTime) {
        console.log(`Backing off preload for ${Math.round((waitTime - (now - rateLimitCache.current.timestamp)) / 1000)}s`);
        return; // Skip if in backoff period
      }
    }
    
    // Enforce minimum time between preloads (5 seconds)
    if (now - lastPreloadTime.current < 5000) {
      return; // Too soon since last preload
    }
    
    // Check current cache size and queue
    let currentSize = 0;
    let currentQueue = 0;
    setSnippetCache(prev => {
      currentSize = prev.length;
      return prev;
    });
    setPreloadQueue(prev => {
      currentQueue = prev;
      return prev;
    });
    
    // Don't preload if cache is sufficient (reduced from 50 to 30)
    if (currentSize >= 30) {
      return;
    }
    
    // Only allow one preload at a time
    if (currentQueue > 0) {
      return;
    }
    
    // Increment queue counter
    setPreloadQueue(prev => prev + 1);
    setIsPreloading(true);
    lastPreloadTime.current = now;
    
    try {
      const needed = Math.min(30 - currentSize, batchSize);
      if (needed > 0) {
        const response = await fetch(`/api/snippets/batch?count=${needed}`);
        const data = await response.json();
        
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
          }));
          
          setSnippetCache(prev => {
            const updated = [...prev, ...newSnippets];
            return updated.slice(0, 30); // Cap at 30
          });
          
          // Show notification that new snippets were added
          if (newSnippets.length > 0) {
            setNewSnippetsAdded(true);
            // Auto-hide notification after 3 seconds
            setTimeout(() => setNewSnippetsAdded(false), 3000);
          }
          
          // Reset backoff on success
          preloadAttempts.current = 0;
        }
      }
    } catch (error) {
      // Update rate limit cache on error and increment backoff counter
      const isLimited = await checkRateLimit(true);
      if (isLimited) {
        preloadAttempts.current += 1;
        console.log(`Rate limited, increasing backoff (attempt ${preloadAttempts.current})`);
      }
    } finally {
      setIsPreloading(false);
      setPreloadQueue(prev => Math.max(0, prev - 1));
    }
  }

  // Get next snippet - NEVER show loading screen and prioritize local snippets
  const getNextSnippet = async () => {
    // Reset state flags
    setUsingLocalSnippet(false);
    setUsingStaticSnippet(false);
    setUsingCachedSnippet(false);
    setError(null);
    
    console.log('[NextSnippet] Getting next snippet');
    
    // First try to use a local snippet - prioritize local snippets to avoid API calls
    console.log('[NextSnippet] Trying local snippet first');
    const localSnippet = getRandomPreGeneratedSnippet();
    
    if (localSnippet) {
      // Use local snippet for immediate display (zero network requests)
      const localSnippetFormatted = {
        id: localSnippet.id,
        repository: 'CodeReviewApp',
        filePath: localSnippet.filePath,
        content: localSnippet.content,
        language: localSnippet.language,
        startLine: localSnippet.startLine,
        endLine: localSnippet.endLine,
        url: `https://github.com/CodeReviewApp/${localSnippet.filePath}#L${localSnippet.startLine}-L${localSnippet.endLine}`,
        commitAuthor: 'CodeReviewApp Team',
        commitAuthorLogin: 'codereviewapp'
      };
      
      setSnippetData({
        snippet: localSnippetFormatted,
        reviews: []
      });
      setUsingLocalSnippet(true);
      setSnippetCount(prev => prev + 1);
      
      // No background API calls - we're preserving resources
      return;
    }
    
    // If no local snippet available, try to use cache
    // Get the actual cache array to check if it has items
    let currentCache: CachedSnippet[] = [];
    
    // Use a synchronous approach to get the current cache
    setSnippetCache(prev => {
      currentCache = [...prev]; // Make a copy of the current cache
      return prev; // Don't modify the cache yet
    });
    
    // Wait for state update to complete
    await new Promise(resolve => setTimeout(resolve, 0));
    
    // Check if the cache has items
    const hasCachedItems = currentCache.length > 0;
    console.log(`[NextSnippet] No local snippet available. Has cached items: ${hasCachedItems} (cache size: ${currentCache.length})`);
    
    // Use cache if available
    if (hasCachedItems) {
      console.log('[NextSnippet] Using cached snippet');
      
      // Get the first item from the cache
      const cachedItem = currentCache[0];
      
      // Remove it from the cache
      setSnippetCache(prev => prev.slice(1));
      
      // Use the cached snippet
      setSnippetData(cachedItem);
      setUsingCachedSnippet(true);
      setSnippetCount(prev => prev + 1);
      
      // Save to DB in background (don't block UI)
      fetch('/api/snippets/random', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ snippet: cachedItem.snippet }),
      })
      .then(async (response) => {
        if (response.ok) {
          const data = await response.json()
          // Only update if still showing same snippet
          setSnippetData(prev => prev?.snippet.content === cachedItem.snippet.content ? data : prev)
        }
      })
      .catch(() => {}) // Silent fail
      
      // No automatic preloading - user must explicitly request cache filling
      return;
    }
    
    // If we get here, there are no local or cached items, so use a static snippet
    console.log('[NextSnippet] No local or cached items, using static snippet');
    
    // Use a static snippet (bundled with the app)
    const staticSnippet = getRandomStaticSnippet();
    const codeSnippet = convertStaticToCodeSnippet(staticSnippet);
    
    // Add an ID to the snippet
    const snippetWithId = {
      ...codeSnippet,
      id: `static-${Date.now()}-${Math.random()}`
    };
    
    setSnippetData({
      snippet: snippetWithId,
      reviews: []
    });
    setUsingStaticSnippet(true);
    setSnippetCount(prev => prev + 1);
    
    // No background API calls - we're preserving resources
  }

  const fetchRandomSnippet = getNextSnippet;
  
  // Fetch reviews for a cached snippet
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
  }, []);

  useEffect(() => {
    // Try to load in this order:
    // 1. Local code snippet (from our own codebase) - INSTANT
    // 2. Last viewed snippet from cache
    // 3. Random snippet from cache
    // 4. Static snippet
    
    // IMPORTANT: Set loading to false immediately to prevent infinite loading state
    setLoading(false);
    
    // First, try to use a pre-generated local snippet from our own codebase
    console.log('[Initial Load] Attempting to load local snippet');
    const localSnippet = getRandomPreGeneratedSnippet();
    
    if (localSnippet) {
      console.log('[Initial Load] Successfully loaded local snippet:', localSnippet.id);
      // Use local snippet for immediate display (zero network requests)
      const localSnippetFormatted = {
        id: localSnippet.id,
        repository: 'CodeReviewApp',
        filePath: localSnippet.filePath,
        content: localSnippet.content,
        language: localSnippet.language,
        startLine: localSnippet.startLine,
        endLine: localSnippet.endLine,
        url: `https://github.com/CodeReviewApp/${localSnippet.filePath}#L${localSnippet.startLine}-L${localSnippet.endLine}`,
        commitAuthor: 'CodeReviewApp Team',
        commitAuthorLogin: 'codereviewapp'
      };
      
      setSnippetData({
        snippet: localSnippetFormatted,
        reviews: []
      });
      setLoading(false);
      setUsingLocalSnippet(true);
      setSnippetCount(prev => prev + 1);
      
      // No background loading - preserve resources
    } else {
      console.log('[Initial Load] No local snippet available, trying cached snippets');
      // Fallback to cached snippets
      const lastViewedSnippet = getLastViewedSnippet();
      const cachedSnippet = lastViewedSnippet || getRandomCachedSnippet();
      
      if (cachedSnippet) {
        console.log('[Initial Load] Using cached snippet');
        // Use cached snippet for immediate display
        const snippetWithId = {
          ...cachedSnippet,
          id: `cached-${Date.now()}-${Math.random()}`
        };
        
        setSnippetData({
          snippet: snippetWithId,
          reviews: []
        });
        setLoading(false);
        setUsingCachedSnippet(true);
        setSnippetCount(prev => prev + 1);
        
        // Cache the snippet for future use
        cacheSnippet(cachedSnippet);
        setLastViewedSnippet(cachedSnippet);
      } else {
        console.log('[Initial Load] No cached snippet available, using static snippet');
        // No cached snippet, use static snippet
        const staticSnippet = getRandomStaticSnippet();
        const codeSnippet = convertStaticToCodeSnippet(staticSnippet);
        
        // Add an ID to the snippet
        const snippetWithId = {
          ...codeSnippet,
          id: `static-${Date.now()}-${Math.random()}`
        };
        
        setSnippetData({
          snippet: snippetWithId,
          reviews: []
        });
        setLoading(false);
        setUsingStaticSnippet(true);
        setSnippetCount(prev => prev + 1);
      }
    }
    
    // No automatic cache filling or preloading - user must explicitly request it
    
  }, []);

  // Default snippet to use if nothing else is available
  // This ensures we always have something to display
  const defaultSnippet = {
    id: 'default-snippet',
    repository: 'CodeReviewApp',
    filePath: 'app/page.tsx',
    content: `// This is the main page component of the CodeReview app
export default function Home() {
  // State for managing code snippets
  const [snippetData, setSnippetData] = useState(null)
  
  // Load snippets from various sources
  useEffect(() => {
    // First try local snippets (fastest)
    const localSnippet = getRandomPreGeneratedSnippet()
    
    if (localSnippet) {
      setSnippetData({
        snippet: localSnippetFormatted,
        reviews: []
      })
    }
    
    // Then try to load from cache or API
    // ...
  }, [])
  
  return (
    <div>
      {/* Display the code snippet */}
      <CodeSnippet snippet={snippetData.snippet} reviews={snippetData.reviews} />
    </div>
  )
}`,
    language: 'typescript',
    startLine: 1,
    endLine: 30,
    url: 'https://github.com/CodeReviewApp/app/page.tsx',
    commitAuthor: 'CodeReviewApp Team',
    commitAuthorLogin: 'codereviewapp'
  }

  // Get cache statistics for display
  const [cacheStats, setCacheStats] = useState({ hits: 0, misses: 0, hitRate: '0%' });
  const [showDebugPanel, setShowDebugPanel] = useState(false);
  const [debugInfo, setDebugInfo] = useState({
    rateLimitStatus: 'Unknown',
    rateLimitReset: 0,
    cacheFillingStatus: 'Idle',
    cacheFillingAttempts: 0,
    cacheFillingSuccess: 0,
    lastApiResponse: '',
    errors: [] as string[]
  });
  
  // Update cache statistics and debug info periodically
  useEffect(() => {
    const updateStats = () => {
      // Update cache statistics
      const stats = getCacheStatistics();
      const total = stats.hits + stats.misses;
      const hitRate = total > 0 ? Math.round((stats.hits / total) * 100) : 0;
      setCacheStats({
        hits: stats.hits,
        misses: stats.misses,
        hitRate: `${hitRate}%`
      });
      
      // Update debug info
      setDebugInfo({
        rateLimitStatus: rateLimited ? 'Rate Limited' : 'Not Rate Limited',
        rateLimitReset: Math.max(0, Math.floor((rateLimitCache.current.timestamp + 60000 - Date.now()) / 1000)),
        cacheFillingStatus: cacheFillingStatus.current.inProgress ? 'In Progress' : 'Idle',
        cacheFillingAttempts: cacheFillingStatus.current.attempts,
        cacheFillingSuccess: cacheFillingStatus.current.success,
        lastApiResponse: '',
        errors: []
      });
    };
    
    // Update immediately and then every second
    updateStats();
    const interval = setInterval(updateStats, 1000);
    
    return () => clearInterval(interval);
  }, [rateLimited]);
  
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
                <div className="flex items-center gap-2">
                  <p className="text-xs text-green-600 dark:text-green-400 flex items-center">
                    <span className={`mr-1 ${isPreloading ? 'animate-pulse' : ''}`}>💾</span>
                    <span>{snippetCache.length}/30 cached</span>
                  </p>
                  {isPreloading && (
                    <span className="ml-1 text-xs text-blue-500 dark:text-blue-400 animate-pulse">
                      (loading...)
                    </span>
                  )}
                  <span className="text-xs text-purple-600 dark:text-purple-400 flex items-center ml-2">
                    <span className="mr-1">📊</span>
                    <span>Hit rate: {cacheStats.hitRate}</span>
                  </span>
                </div>
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
            <button
              onClick={() => forceFillCache(10)}
              disabled={cacheFillingStatus.current.inProgress}
              className="px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-all transform hover:scale-105 active:scale-95 shadow-lg text-sm font-medium flex items-center"
            >
              <span className={`mr-1 ${isPreloading ? 'animate-spin' : ''}`}>💾</span>
              {isPreloading ? 'Filling...' : 'Fill Cache'}
            </button>
          </div>
        </div>
      </nav>

      {/* Debug Panel Toggle */}
      <div className="fixed bottom-4 right-4 z-50">
        <button
          onClick={() => setShowDebugPanel(!showDebugPanel)}
          className="bg-gray-800 text-white p-2 rounded-full shadow-lg hover:bg-gray-700"
          title="Toggle Debug Panel"
        >
          {showDebugPanel ? '🔽' : '🔼'}
        </button>
      </div>
      
      {/* Debug Panel */}
      {showDebugPanel && (
        <div className="fixed bottom-16 right-4 w-96 bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 z-50 overflow-hidden">
          <div className="p-4 bg-gray-100 dark:bg-gray-700 border-b border-gray-200 dark:border-gray-600 flex justify-between items-center">
            <h3 className="font-bold text-gray-800 dark:text-white">Debug Panel</h3>
            <button 
              onClick={() => setShowDebugPanel(false)}
              className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            >
              ✕
            </button>
          </div>
          <div className="p-4 max-h-96 overflow-y-auto">
            <div className="space-y-4">
              {/* Rate Limit Status */}
              <div>
                <h4 className="font-semibold text-sm text-gray-700 dark:text-gray-300 mb-1">Rate Limit Status</h4>
                <div className={`text-sm p-2 rounded ${rateLimited ? 'bg-red-100 dark:bg-red-900/20 text-red-800 dark:text-red-200' : 'bg-green-100 dark:bg-green-900/20 text-green-800 dark:text-green-200'}`}>
                  {rateLimited ? '⚠️ Rate Limited' : '✅ Not Rate Limited'}
                </div>
              </div>
              
              {/* Cache Status */}
              <div>
                <h4 className="font-semibold text-sm text-gray-700 dark:text-gray-300 mb-1">Cache Status</h4>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div className="bg-blue-50 dark:bg-blue-900/20 p-2 rounded">
                    <span className="text-blue-800 dark:text-blue-200">Size: {snippetCache.length}/30</span>
                  </div>
                  <div className="bg-purple-50 dark:bg-purple-900/20 p-2 rounded">
                    <span className="text-purple-800 dark:text-purple-200">Hit Rate: {cacheStats.hitRate}</span>
                  </div>
                </div>
              </div>
              
              {/* Cache Filling Status */}
              <div>
                <h4 className="font-semibold text-sm text-gray-700 dark:text-gray-300 mb-1">Cache Filling</h4>
                <div className="bg-gray-50 dark:bg-gray-700/50 p-2 rounded text-sm">
                  <p>Status: {cacheFillingStatus.current.inProgress ? 'In Progress' : 'Idle'}</p>
                  <p>Attempts: {cacheFillingStatus.current.attempts}</p>
                  <p>Success: {cacheFillingStatus.current.success}</p>
                </div>
              </div>
              
              {/* Current Snippet */}
              <div>
                <h4 className="font-semibold text-sm text-gray-700 dark:text-gray-300 mb-1">Current Snippet</h4>
                <div className="bg-gray-50 dark:bg-gray-700/50 p-2 rounded text-sm">
                  <p>Type: {usingLocalSnippet ? 'Local' : usingCachedSnippet ? 'Cached' : usingStaticSnippet ? 'Static' : 'Unknown'}</p>
                  <p>Repository: {snippetData?.snippet.repository || 'None'}</p>
                  <p>File: {snippetData?.snippet.filePath || 'None'}</p>
                </div>
              </div>
              
              {/* Actions */}
              <div className="flex gap-2">
                <button
                  onClick={() => forceFillCache(10)}
                  disabled={cacheFillingStatus.current.inProgress}
                  className="bg-blue-600 text-white px-3 py-1 rounded text-sm disabled:opacity-50"
                >
                  Force Fill Cache
                </button>
                <button
                  onClick={() => checkRateLimit(true)}
                  className="bg-gray-600 text-white px-3 py-1 rounded text-sm"
                >
                  Check Rate Limit
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      
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
        {/* Local snippet notification removed as requested */}
        {newSnippetsAdded && (
          <div className="max-w-6xl mx-auto px-6 mb-4 animate-slideDown">
            <div className="bg-green-50 dark:bg-green-900/20 border-l-4 border-green-400 dark:border-green-600 rounded-lg p-4 shadow-md">
              <p className="text-green-800 dark:text-green-200 text-sm font-medium flex items-center">
                <span className="mr-2">✅</span> 
                New code snippets added to cache! These will be available for instant viewing.
              </p>
            </div>
          </div>
        )}
        <div className="animate-fadeInUp">
          <CodeSnippet
            snippet={snippetData?.snippet || defaultSnippet}
            reviews={snippetData?.reviews || []}
          />
        </div>
      </main>
    </div>
  )
}
