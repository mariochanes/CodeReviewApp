import { render, screen, waitFor, fireEvent, act } from '@testing-library/react'
import '@testing-library/jest-dom'
import Home from '@/app/page'

// Mock next/navigation
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: jest.fn(),
  }),
}))

// Mock fetch
global.fetch = jest.fn()

describe('CodeReview App - Home Page', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    // Reset fetch mock
    ;(global.fetch as jest.Mock).mockClear()
  })

  test('displays loading state initially', () => {
    render(<Home />)
    expect(screen.getByText(/Discovering interesting code/i)).toBeInTheDocument()
    expect(screen.getByText(/Finding the perfect snippet to review/i)).toBeInTheDocument()
  })

  test('fetches and displays snippet successfully', async () => {
    const mockSnippet = {
      snippet: {
        id: '1',
        repository: 'test/repo',
        filePath: 'src/test.js',
        content: 'console.log("test")',
        language: 'javascript',
        startLine: 1,
        endLine: 5,
        url: 'https://github.com/test/repo/blob/main/src/test.js#L1-L5',
      },
      reviews: [],
    }

    ;(global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => mockSnippet,
    })

    render(<Home />)

    await waitFor(() => {
      expect(screen.getByText(/test\/repo/i)).toBeInTheDocument()
    }, { timeout: 3000 })
  })

  test('displays error message when fetch fails', async () => {
    ;(global.fetch as jest.Mock).mockRejectedValueOnce(new Error('Network error'))

    await act(async () => {
      render(<Home />)
    })

    await waitFor(() => {
      expect(screen.getByText(/Failed to load code snippet/i)).toBeInTheDocument()
    }, { timeout: 3000 })
  })

  test('handles Next Snippet button click', async () => {
    const mockSnippet = {
      snippet: {
        id: '1',
        repository: 'test/repo',
        filePath: 'test.js',
        content: 'test',
        language: 'javascript',
        startLine: 1,
        endLine: 5,
        url: 'https://github.com/test/repo/blob/main/test.js',
      },
      reviews: [],
    }

    ;(global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => mockSnippet,
    })

    await act(async () => {
      render(<Home />)
    })

    // Wait for initial load
    await waitFor(() => {
      expect(screen.getByText(/test\/repo/i)).toBeInTheDocument()
    }, { timeout: 3000 })

    // Click Next Snippet button
    await act(async () => {
      const nextButton = screen.getByText(/Next Snippet/i)
      fireEvent.click(nextButton)
    })

    // Check that fetch was called
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalled()
    }, { timeout: 3000 })
  })

  test('displays Next Snippet button', async () => {
    const mockSnippet = {
      snippet: {
        id: '1',
        repository: 'test/repo',
        filePath: 'test.js',
        content: 'test',
        language: 'javascript',
        startLine: 1,
        endLine: 5,
        url: 'https://github.com/test/repo/blob/main/test.js',
      },
      reviews: [],
    }

    ;(global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => mockSnippet,
    })

    render(<Home />)

    await waitFor(() => {
      expect(screen.getByText(/Next Snippet/i)).toBeInTheDocument()
    })
  })

  test('displays Rankings button', async () => {
    const mockSnippet = {
      snippet: {
        id: '1',
        repository: 'test/repo',
        filePath: 'test.js',
        content: 'test',
        language: 'javascript',
        startLine: 1,
        endLine: 5,
        url: 'https://github.com/test/repo/blob/main/test.js',
      },
      reviews: [],
    }

    ;(global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => mockSnippet,
    })

    await act(async () => {
      render(<Home />)
    })

    await waitFor(() => {
      expect(screen.getByText(/Rankings/i)).toBeInTheDocument()
    }, { timeout: 3000 })
  })
})

