import Rankings from '@/components/Rankings'

export default function RankingsPage() {
  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-900">
      <nav className="bg-white dark:bg-gray-800 shadow-md">
        <div className="max-w-6xl mx-auto px-6 py-4 flex justify-between items-center">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            CodeReview
          </h1>
          <a
            href="/"
            className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition"
          >
            Back to Reviews
          </a>
        </div>
      </nav>
      <Rankings />
    </div>
  )
}

