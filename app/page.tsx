'use client'

import { useEffect, useState } from 'react'
import CodeSnippet from '@/components/CodeSnippet'
import { getRandomStaticSnippet, convertStaticToCodeSnippet } from '@/lib/staticSnippets'
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

export default function Home() {
  const [snippetData, setSnippetData] = useState<SnippetData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [snippetCount, setSnippetCount] = useState(0)

  // Get next snippet - prioritize local snippets
  const getNextSnippet = async () => {
    setLoading(true)
    setError(null)
    
    // First try to use a local snippet
    const localSnippet = getRandomPreGeneratedSnippet()
    
    if (localSnippet) {
      // Use local snippet for immediate display
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
      }
      
      setSnippetData({
        snippet: localSnippetFormatted,
        reviews: []
      })
      setSnippetCount(prev => prev + 1)
    } else {
      // Fallback to static snippet
      const staticSnippet = getRandomStaticSnippet()
      const codeSnippet = convertStaticToCodeSnippet(staticSnippet)
      
      // Add an ID to the snippet
      const snippetWithId = {
        ...codeSnippet,
        id: `static-${Date.now()}-${Math.random()}`
      }
      
      setSnippetData({
        snippet: snippetWithId,
        reviews: []
      })
      setSnippetCount(prev => prev + 1)
    }
    
    setLoading(false)
  }

  // Initialize with a snippet on load
  useEffect(() => {
    getNextSnippet()
  }, [])

  // Default snippet to use if nothing else is available
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
              </div>
            </div>
          </div>
          <div className="flex gap-3 items-center">
            <button
              onClick={getNextSnippet}
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
          </div>
        </div>
      </nav>
      
      {/* Main Content */}
      <main className="py-8">
        {error && (
          <div className="max-w-6xl mx-auto px-6 mb-4">
            <div className="bg-yellow-50 dark:bg-yellow-900/20 border-l-4 border-yellow-400 dark:border-yellow-600 rounded-lg p-4 shadow-md">
              <p className="text-yellow-800 dark:text-yellow-200 text-sm font-medium">
                ⚠️ {error}
              </p>
            </div>
          </div>
        )}
        <div>
          {snippetData ? (
            <CodeSnippet
              snippet={snippetData.snippet || defaultSnippet}
              reviews={snippetData.reviews || []}
            />
          ) : (
            <div className="max-w-6xl mx-auto p-6">
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl border border-gray-200 dark:border-gray-700 p-6">
                <p className="text-gray-600 dark:text-gray-400 text-center">Loading code snippet...</p>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
