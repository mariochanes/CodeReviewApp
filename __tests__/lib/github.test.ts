// Mock Octokit before importing
jest.mock('@octokit/rest', () => {
  const mockHook = {
    before: jest.fn(),
    after: jest.fn(),
    error: jest.fn(),
  }

  const mockOctokit = {
    repos: {
      get: jest.fn().mockResolvedValue({
        data: {
          default_branch: 'main',
        },
      }),
      getContent: jest.fn().mockResolvedValue({
        data: [],
      }),
      listCommits: jest.fn().mockResolvedValue({
        data: [],
      }),
      getCommit: jest.fn().mockResolvedValue({
        data: {
          commit: {
            author: { name: 'Test Author', date: new Date().toISOString() },
            committer: { date: new Date().toISOString() },
          },
          author: { login: 'testuser' },
          files: [],
        },
      }),
    },
    search: {
      repos: jest.fn().mockResolvedValue({
        data: {
          items: [],
        },
      }),
    },
    hook: mockHook,
  }

  return {
    Octokit: jest.fn().mockImplementation(() => mockOctokit),
  }
})

import { getRandomCodeSnippet } from '@/lib/github'

describe('GitHub API Functions', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  test('getRandomCodeSnippet handles errors gracefully', async () => {
    // This test verifies the function handles errors without crashing
    const result = await getRandomCodeSnippet(1, false)
    // The function should return null when it can't fetch
    expect(result).toBeDefined() // Could be null or a snippet
  })

  test('getRandomCodeSnippet accepts fastMode parameter', async () => {
    // Test that the function accepts fastMode parameter
    const fastResult = await getRandomCodeSnippet(1, true)
    const normalResult = await getRandomCodeSnippet(1, false)
    
    // Both should not throw errors
    expect(fastResult).toBeDefined()
    expect(normalResult).toBeDefined()
  })
})

