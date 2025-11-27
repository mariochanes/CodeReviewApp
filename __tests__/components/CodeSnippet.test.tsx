import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom'
import CodeSnippet from '@/components/CodeSnippet'

// Mock fetch
global.fetch = jest.fn()

const mockSnippet = {
  id: '1',
  repository: 'test/repo',
  filePath: 'src/test.js',
  content: 'console.log("test");',
  language: 'javascript',
  startLine: 1,
  endLine: 5,
  url: 'https://github.com/test/repo/blob/main/src/test.js#L1-L5',
}

const mockReviews = []

describe('CodeSnippet Component', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(global.fetch as jest.Mock).mockClear()
  })

  test('renders snippet information', () => {
    render(<CodeSnippet snippet={mockSnippet} reviews={mockReviews} />)

    expect(screen.getByText(/test\/repo/i)).toBeInTheDocument()
    expect(screen.getByText(/src\/test\.js/i)).toBeInTheDocument()
    expect(screen.getByText(/Lines 1-5/i)).toBeInTheDocument()
  })

  test('renders code content', () => {
    render(<CodeSnippet snippet={mockSnippet} reviews={mockReviews} />)

    expect(screen.getByText(/console\.log\("test"\)/i)).toBeInTheDocument()
  })

  test('displays View on GitHub link', () => {
    render(<CodeSnippet snippet={mockSnippet} reviews={mockReviews} />)

    const githubLink = screen.getByText(/View on GitHub/i)
    expect(githubLink).toBeInTheDocument()
    expect(githubLink.closest('a')).toHaveAttribute('href', mockSnippet.url)
  })

  test('shows review form when Add Review is clicked', () => {
    render(<CodeSnippet snippet={mockSnippet} reviews={mockReviews} />)

    const addReviewButton = screen.getByText(/Add Review/i)
    fireEvent.click(addReviewButton)

    expect(screen.getByPlaceholderText(/Your name/i)).toBeInTheDocument()
    expect(screen.getByPlaceholderText(/Your review comment/i)).toBeInTheDocument()
  })

  test('displays existing reviews', () => {
    const reviewsWithData = [
      {
        id: 'review-1',
        reviewerName: 'John Doe',
        comment: 'This is a good practice',
        smellType: 'good_practice',
        severity: 'low',
        createdAt: new Date().toISOString(),
        votes: [],
      },
    ]

    render(<CodeSnippet snippet={mockSnippet} reviews={reviewsWithData} />)

    expect(screen.getByText(/John Doe/i)).toBeInTheDocument()
    expect(screen.getByText(/This is a good practice/i)).toBeInTheDocument()
  })

  test('shows no reviews message when empty', () => {
    render(<CodeSnippet snippet={mockSnippet} reviews={[]} />)

    expect(screen.getByText(/No reviews yet/i)).toBeInTheDocument()
  })

  test('handles missing snippet gracefully', () => {
    // @ts-ignore - Testing error case
    render(<CodeSnippet snippet={null} reviews={[]} />)

    expect(screen.getByText(/Error: Snippet data is missing/i)).toBeInTheDocument()
  })
})

