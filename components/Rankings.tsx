'use client'

import { useEffect, useState } from 'react'

interface RankingsData {
  reviewers: Array<{
    name: string
    reviewCount: number
    agreementRatio: number
  }>
  projects: Array<{
    fullName: string
    qualityScore: number
    reviewCount: number
    description: string | null
  }>
}

export default function Rankings() {
  const [rankings, setRankings] = useState<RankingsData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchRankings()
  }, [])

  const fetchRankings = async () => {
    try {
      const response = await fetch('/api/rankings')
      const data = await response.json()
      setRankings(data)
    } catch (error) {
      console.error('Error fetching rankings:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return <div className="text-center py-8">Loading rankings...</div>
  }

  if (!rankings) {
    return <div className="text-center py-8">Failed to load rankings</div>
  }

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
        Rankings
      </h1>

      {/* Top Reviewers */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
          Top Reviewers
        </h2>
        <div className="space-y-3">
          {rankings.reviewers.map((reviewer, index) => (
            <div
              key={reviewer.name}
              className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700 rounded-lg"
            >
              <div className="flex items-center gap-4">
                <span className="text-2xl font-bold text-gray-400 dark:text-gray-500">
                  #{index + 1}
                </span>
                <div>
                  <p className="font-semibold text-gray-900 dark:text-white">
                    {reviewer.name}
                  </p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {reviewer.reviewCount} reviews
                  </p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-lg font-bold text-green-600 dark:text-green-400">
                  {reviewer.agreementRatio.toFixed(1)}%
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Agreement Rate
                </p>
              </div>
            </div>
          ))}
          {rankings.reviewers.length === 0 && (
            <p className="text-gray-500 dark:text-gray-400 text-center py-4">
              No reviewers yet
            </p>
          )}
        </div>
      </div>

      {/* Top Projects */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
          Top Projects by Code Quality
        </h2>
        <div className="space-y-3">
          {rankings.projects.map((project, index) => (
            <div
              key={project.fullName}
              className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700 rounded-lg"
            >
              <div className="flex items-center gap-4">
                <span className="text-2xl font-bold text-gray-400 dark:text-gray-500">
                  #{index + 1}
                </span>
                <div>
                  <a
                    href={`https://github.com/${project.fullName}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-semibold text-blue-600 dark:text-blue-400 hover:underline"
                  >
                    {project.fullName}
                  </a>
                  {project.description && (
                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                      {project.description}
                    </p>
                  )}
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    {project.reviewCount} reviews
                  </p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-lg font-bold text-purple-600 dark:text-purple-400">
                  {project.qualityScore.toFixed(1)}%
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Quality Score
                </p>
              </div>
            </div>
          ))}
          {rankings.projects.length === 0 && (
            <p className="text-gray-500 dark:text-gray-400 text-center py-4">
              No projects ranked yet
            </p>
          )}
        </div>
      </div>
    </div>
  )
}

