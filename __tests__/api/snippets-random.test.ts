import { GET, POST } from '@/app/api/snippets/random/route'

// Mock GitHub functions
jest.mock('@/lib/github', () => ({
  getRandomCodeSnippet: jest.fn(),
  CodeSnippet: {},
}))

// Mock Prisma
jest.mock('@/lib/prisma', () => ({
  prisma: {
    codeSnippet: {
      findFirst: jest.fn(),
      create: jest.fn(),
    },
    project: {
      findUnique: jest.fn(),
      create: jest.fn(),
    },
    review: {
      findMany: jest.fn(),
    },
  },
}))

describe('/api/snippets/random', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('GET', () => {
    test('returns snippet successfully', async () => {
      const { getRandomCodeSnippet } = require('@/lib/github')
      const { prisma } = require('@/lib/prisma')

      const mockSnippet = {
        repository: 'test/repo',
        filePath: 'test.js',
        content: 'console.log("test")',
        language: 'javascript',
        startLine: 1,
        endLine: 5,
        url: 'https://github.com/test/repo/blob/main/test.js#L1-L5',
      }

      getRandomCodeSnippet.mockResolvedValue(mockSnippet)
      prisma.codeSnippet.findFirst.mockResolvedValue(null)
      prisma.project.findUnique.mockResolvedValue(null)
      prisma.project.create.mockResolvedValue({ id: '1' })
      prisma.codeSnippet.create.mockResolvedValue({
        id: '1',
        ...mockSnippet,
        projectId: '1',
      })

      const request = new Request('http://localhost:3000/api/snippets/random?mode=curated')
      const response = await GET(request as any)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.snippet).toBeDefined()
      expect(data.snippet.repository).toBe('test/repo')
    })

    test('returns existing snippet if found', async () => {
      const { getRandomCodeSnippet } = require('@/lib/github')
      const { prisma } = require('@/lib/prisma')

      const mockSnippet = {
        repository: 'test/repo',
        filePath: 'test.js',
        content: 'test',
        language: 'javascript',
        startLine: 1,
        endLine: 5,
        url: 'https://github.com/test/repo/blob/main/test.js',
      }

      getRandomCodeSnippet.mockResolvedValue(mockSnippet)
      prisma.codeSnippet.findFirst.mockResolvedValue({
        id: 'existing-1',
        ...mockSnippet,
      })
      prisma.review.findMany.mockResolvedValue([])

      const request = new Request('http://localhost:3000/api/snippets/random?mode=curated')
      const response = await GET(request as any)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.snippet.id).toBe('existing-1')
    })

    test('returns error when snippet fetch fails', async () => {
      const { getRandomCodeSnippet } = require('@/lib/github')

      getRandomCodeSnippet.mockResolvedValue(null)

      const request = new Request('http://localhost:3000/api/snippets/random?mode=curated')
      const response = await GET(request as any)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.error).toBeDefined()
    })
  })

  describe('POST', () => {
    test('creates new snippet successfully', async () => {
      const { prisma } = require('@/lib/prisma')

      const mockSnippet = {
        repository: 'test/repo',
        filePath: 'test.js',
        content: 'test',
        language: 'javascript',
        startLine: 1,
        endLine: 5,
        url: 'https://github.com/test/repo/blob/main/test.js',
      }

      prisma.codeSnippet.findFirst.mockResolvedValue(null)
      prisma.project.findUnique.mockResolvedValue(null)
      prisma.project.create.mockResolvedValue({ id: '1' })
      prisma.codeSnippet.create.mockResolvedValue({
        id: 'new-1',
        ...mockSnippet,
        projectId: '1',
      })

      const request = new Request('http://localhost:3000/api/snippets/random', {
        method: 'POST',
        body: JSON.stringify({ snippet: mockSnippet }),
      })

      const response = await POST(request as any)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.snippet).toBeDefined()
      expect(data.snippet.id).toBe('new-1')
    })

    test('returns error when snippet data is missing', async () => {
      const request = new Request('http://localhost:3000/api/snippets/random', {
        method: 'POST',
        body: JSON.stringify({}),
      })

      const response = await POST(request as any)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe('Snippet data required')
    })
  })
})
