'use client'

import { useState } from 'react'

interface CodeSnippetProps {
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

export default function CodeSnippet({ snippet, reviews: initialReviews }: CodeSnippetProps) {
  // Safety check
  if (!snippet) {
    return (
      <div className="max-w-6xl mx-auto p-6">
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <p className="text-red-800 dark:text-red-200">Error: Snippet data is missing</p>
        </div>
      </div>
    )
  }

  const [reviews, setReviews] = useState(initialReviews)
  const [showReviewForm, setShowReviewForm] = useState(false)
  const [reviewerName, setReviewerName] = useState('')
  const [comment, setComment] = useState('')
  const [smellType, setSmellType] = useState('code_smell')
  const [severity, setSeverity] = useState('medium')
  const [loading, setLoading] = useState(false)

  const handleSubmitReview = async (e: React.FormEvent) => {
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
  }

  const handleVote = async (reviewId: string, isAgree: boolean, voterName: string) => {
    if (!voterName.trim()) {
      alert('Please enter your name to vote')
      return
    }

    try {
      const response = await fetch('/api/votes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reviewId,
          voterName,
          isAgree,
        }),
      })

      if (response.ok) {
        // Refresh reviews to get updated vote counts
        const reviewsResponse = await fetch(`/api/reviews?snippetId=${snippet.id}`)
        const updatedReviews = await reviewsResponse.json()
        setReviews(updatedReviews)
      }
    } catch (error) {
      console.error('Error voting:', error)
    }
  }

  const openPR = () => {
    const [owner, repo] = snippet.repository.split('/')
    
    // Build PR body with context
    let prBody = `## Code Review Suggestion from CodeReview App\n\n`
    prBody += `**File:** ${snippet.filePath}\n`
    prBody += `**Lines:** ${snippet.startLine}-${snippet.endLine}\n`
    prBody += `**View on GitHub:** ${snippet.url}\n\n`
    
    if (reviews.length > 0) {
      prBody += `### Reviews (${reviews.length})\n\n`
      reviews.slice(0, 5).forEach((review) => {
        const agreeCount = review.votes.filter((v) => v.isAgree).length
        const disagreeCount = review.votes.filter((v) => !v.isAgree).length
        prBody += `- **${review.reviewerName}** (${review.smellType}, ${review.severity}): ${review.comment}\n`
        prBody += `  - 👍 ${agreeCount} | 👎 ${disagreeCount}\n\n`
      })
      if (reviews.length > 5) {
        prBody += `_... and ${reviews.length - 5} more review(s)_\n\n`
      }
    } else {
      prBody += `_No reviews yet. Be the first to review this code!_`
    }
    
    const prUrl = `https://github.com/${owner}/${repo}/compare/main...main?quick_pull=1&body=${encodeURIComponent(prBody)}`
    window.open(prUrl, '_blank')
  }

  const agreeCount = (review: typeof reviews[0]) =>
    review.votes.filter((v) => v.isAgree).length
  const disagreeCount = (review: typeof reviews[0]) =>
    review.votes.filter((v) => !v.isAgree).length

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl border border-gray-200 dark:border-gray-700 p-6 transform transition-all hover:shadow-2xl">
        <div className="flex justify-between items-start mb-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              Code Review
            </h1>
            <p className="text-gray-600 dark:text-gray-400 mt-1">
              {snippet.repository} - {snippet.filePath}
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-500 mt-1">
              Lines {snippet.startLine}-{snippet.endLine}
            </p>
            {(snippet.commitAuthor || snippet.commitDate) && (
              <div className="mt-2 flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400">
                {snippet.commitAuthor && (
                  <span className="flex items-center gap-1">
                    <span>👤</span>
                    <span>
                      {snippet.commitAuthorLogin && snippet.commitAuthorLogin !== snippet.commitAuthor ? (
                        <a
                          href={`https://github.com/${snippet.commitAuthorLogin}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                        >
                          {snippet.commitAuthor} (@{snippet.commitAuthorLogin})
                        </a>
                      ) : (
                        snippet.commitAuthor
                      )}
                    </span>
                  </span>
                )}
                {snippet.commitDate && (
                  <span className="flex items-center gap-1">
                    <span>📅</span>
                    <span>
                      {new Date(snippet.commitDate).toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </span>
                )}
              </div>
            )}
          </div>
          <div className="flex gap-2">
            <a
              href={snippet.url}
              target="_blank"
              rel="noopener noreferrer"
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-all transform hover:scale-105 active:scale-95 shadow-md hover:shadow-lg font-medium"
            >
              🔗 View on GitHub
            </a>
            <button
              onClick={openPR}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-all transform hover:scale-105 active:scale-95 shadow-md hover:shadow-lg font-medium"
            >
              🚀 Open PR
            </button>
          </div>
        </div>

        {/* Code Display */}
        <div className="bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 rounded-lg p-5 overflow-x-auto border border-gray-700 shadow-inner">
          <div className="flex items-center gap-2 mb-3 pb-2 border-b border-gray-700">
            <div className="flex gap-1.5">
              <div className="w-3 h-3 rounded-full bg-red-500"></div>
              <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
              <div className="w-3 h-3 rounded-full bg-green-500"></div>
            </div>
            <span className="text-xs text-gray-400 ml-2 font-mono">{snippet.language}</span>
          </div>
          <pre className="text-sm text-gray-100 font-mono leading-relaxed">
            <code className="block">{snippet.content}</code>
          </pre>
        </div>
      </div>

      {/* Reviews Section */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl border border-gray-200 dark:border-gray-700 p-6 transform transition-all hover:shadow-2xl">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">
            Reviews ({reviews.length})
          </h2>
          <button
            onClick={() => setShowReviewForm(!showReviewForm)}
            className="px-5 py-2.5 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-lg hover:from-purple-700 hover:to-pink-700 transition-all transform hover:scale-105 active:scale-95 shadow-lg hover:shadow-xl font-medium"
          >
            {showReviewForm ? '✕ Cancel' : '💬 Add Review'}
          </button>
        </div>

        {/* Review Form */}
        {showReviewForm && (
          <form onSubmit={handleSubmitReview} className="mb-6 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg space-y-4">
            <input
              type="text"
              placeholder="Your name"
              value={reviewerName}
              onChange={(e) => setReviewerName(e.target.value)}
              required
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
            />
            <textarea
              placeholder="Your review comment..."
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              required
              rows={4}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
            />
            <div className="flex gap-4">
              <select
                value={smellType}
                onChange={(e) => setSmellType(e.target.value)}
                className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
              >
                <option value="code_smell">Code Smell</option>
                <option value="good_practice">Good Practice</option>
                <option value="bug">Potential Bug</option>
                <option value="performance">Performance Issue</option>
                <option value="security">Security Concern</option>
              </select>
              <select
                value={severity}
                onChange={(e) => setSeverity(e.target.value)}
                className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
            </div>
            <button
              type="submit"
              disabled={loading}
              className="px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition disabled:opacity-50"
            >
              {loading ? 'Submitting...' : 'Submit Review'}
            </button>
          </form>
        )}

        {/* Reviews List */}
        <div className="space-y-4">
          {reviews.map((review) => (
            <div
              key={review.id}
              className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg"
            >
              <div className="flex justify-between items-start mb-2">
                <div>
                  <span className="font-semibold text-gray-900 dark:text-white">
                    {review.reviewerName}
                  </span>
                  <span className="ml-2 px-2 py-1 text-xs bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 rounded">
                    {review.smellType}
                  </span>
                  <span
                    className={`ml-2 px-2 py-1 text-xs rounded ${
                      review.severity === 'high'
                        ? 'bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200'
                        : review.severity === 'medium'
                        ? 'bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200'
                        : 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200'
                    }`}
                  >
                    {review.severity}
                  </span>
                </div>
                <span className="text-sm text-gray-500 dark:text-gray-400">
                  {new Date(review.createdAt).toLocaleDateString()}
                </span>
              </div>
              <p className="text-gray-700 dark:text-gray-300 mb-3">{review.comment}</p>
              <div className="flex gap-2 items-center">
                <VoteButton
                  reviewId={review.id}
                  isAgree={true}
                  count={agreeCount(review)}
                  onVote={handleVote}
                />
                <VoteButton
                  reviewId={review.id}
                  isAgree={false}
                  count={disagreeCount(review)}
                  onVote={handleVote}
                />
              </div>
            </div>
          ))}
          {reviews.length === 0 && (
            <p className="text-gray-500 dark:text-gray-400 text-center py-8">
              No reviews yet. Be the first to review this code!
            </p>
          )}
        </div>
      </div>
    </div>
  )
}

function VoteButton({
  reviewId,
  isAgree,
  count,
  onVote,
}: {
  reviewId: string
  isAgree: boolean
  count: number
  onVote: (reviewId: string, isAgree: boolean, voterName: string) => void
}) {
  const [voterName, setVoterName] = useState('')

  const handleClick = () => {
    if (!voterName.trim()) {
      const name = prompt('Enter your name to vote:')
      if (name) {
        setVoterName(name)
        onVote(reviewId, isAgree, name)
      }
    } else {
      onVote(reviewId, isAgree, voterName)
    }
  }

  return (
    <button
      onClick={handleClick}
      className={`px-3 py-1 rounded-lg text-sm transition ${
        isAgree
          ? 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 hover:bg-green-200 dark:hover:bg-green-800'
          : 'bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200 hover:bg-red-200 dark:hover:bg-red-800'
      }`}
    >
      {isAgree ? '👍' : '👎'} {count}
    </button>
  )
}

