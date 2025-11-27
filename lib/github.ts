import { Octokit } from '@octokit/rest'
import { rateLimitManager } from './rateLimit'

const octokit = new Octokit({
  auth: process.env.GITHUB_TOKEN, // Optional, but recommended for higher rate limits
})

// Track last logged rate limit to avoid spam
const lastRateLimitLog: Record<string, number> = {}

// Hook into Octokit to track rate limits from all responses (only if hook exists)
if (octokit.hook) {
  octokit.hook.before('request', async (options) => {
    const resource = options.url?.includes('/search/') ? 'search' : 'core'
    
    if (rateLimitManager.isRateLimited(resource)) {
      const waitTime = rateLimitManager.getTimeUntilReset(resource)
      if (waitTime > 0) {
        const now = Date.now()
        // Only log once per 10 seconds per resource
        if (!lastRateLimitLog[resource] || now - lastRateLimitLog[resource] > 10000) {
          console.log(`⏸️ Rate limited (${resource}). Waiting ${waitTime}s...`)
          lastRateLimitLog[resource] = now
        }
        await new Promise(resolve => setTimeout(resolve, waitTime * 1000))
      }
    } else {
      const delay = rateLimitManager.getDelayBeforeRequest(resource)
      if (delay > 0) {
        await new Promise(resolve => setTimeout(resolve, delay))
      }
    }
  })

  octokit.hook.after('request', async (response, options) => {
    // Update rate limit state from response headers
    const resource = options.url?.includes('/search/') ? 'search' : 'core'
    // Octokit responses have headers in response.headers
    if (response?.headers) {
      rateLimitManager.updateFromHeaders(response.headers, resource)
    }
  })

  octokit.hook.error('request', async (error, options) => {
    // Update rate limit state even on errors (headers are still present)
    if (error && typeof error === 'object' && 'response' in error) {
      const errorWithResponse = error as { response?: { headers?: any } }
      if (errorWithResponse.response?.headers) {
        const resource = options.url?.includes('/search/') ? 'search' : 'core'
        rateLimitManager.updateFromHeaders(errorWithResponse.response.headers, resource)
      }
    }
    throw error
  })
}

// Popular repositories used as fallback when new/trending repos aren't available
const POPULAR_REPOS = [
  // Popular & Established
  'facebook/react',
  'vercel/next.js',
  'microsoft/vscode',
  'nodejs/node',
  'microsoft/TypeScript',
  'angular/angular',
  'vuejs/vue',
  'golang/go',
  'rust-lang/rust',
  'python/cpython',
  // Modern & Trending
  'sveltejs/svelte',
  'denoland/deno',
  'tauri-apps/tauri',
  'supabase/supabase',
  't3-oss/create-t3-app',
  'withastro/astro',
  'remix-run/remix',
  'tremorlabs/tremor',
  'shadcn-ui/ui',
  'vercel/turbo',
  // Up-and-coming & Cool
  'oven-sh/bun',
  'neovim/neovim',
  'lapce/lapce',
  'helix-editor/helix',
  'zed-industries/zed',
  'microsoft/playwright',
  'vitest-dev/vitest',
  'pnpm/pnpm',
  'rome/tools',
  'biomejs/biome',
  // Interesting & Niche
  'ryo-ma/github-profile-trophy',
  'anuraghazra/github-readme-stats',
  'novuhq/novu',
  'calcom/cal.com',
  'appwrite/appwrite',
  'n8n-io/n8n',
  'mattermost/mattermost',
  'outline/outline',
  'logseq/logseq',
  'immich-app/immich',
]

// Function to get trending repositories from GitHub
async function getTrendingRepos(): Promise<string[]> {
  try {
    // Search for repositories created in the last week, sorted by stars
    const oneWeekAgo = new Date()
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7)
    const dateStr = oneWeekAgo.toISOString().split('T')[0]
    
    const { data } = await octokit.search.repos({
      q: `created:>${dateStr} language:javascript language:typescript language:python language:rust language:go stars:>10`,
      sort: 'stars',
      order: 'desc',
      per_page: 20,
    })
    
    return data.items.map(repo => repo.full_name)
  } catch (error: any) {
    // Suppress verbose rate limit errors
    if (error?.status !== 403) {
      console.error('Error fetching trending repos:', error?.message || 'Unknown error')
    }
    return []
  }
}

// Function to get brand new repositories (created or updated recently)
async function getBrandNewRepos(): Promise<string[]> {
  if (rateLimitManager.isRateLimited('search')) {
    return [] // Return empty to fall back to popular repos
  }

  try {
    const sevenDaysAgo = new Date()
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
    const oneDayAgo = new Date()
    oneDayAgo.setDate(oneDayAgo.getDate() - 1)
    
    const dateStrCreated = sevenDaysAgo.toISOString().split('T')[0]
    const dateStrUpdated = oneDayAgo.toISOString().split('T')[0]
    
    const repos: Set<string> = new Set()
    let rateLimitLogged = false
    
    // Strategy 1: Recently created repos
    try {
      if (!rateLimitManager.isRateLimited('search')) {
        const { data: createdData } = await octokit.search.repos({
          q: `created:>${dateStrCreated} language:javascript language:typescript language:python language:rust language:go language:java stars:>5`,
          sort: 'stars',
          order: 'desc',
          per_page: 20,
        })
        createdData.items.forEach(repo => repos.add(repo.full_name))
      }
    } catch (error: any) {
      if (error?.status === 403 && !rateLimitLogged) {
        const waitTime = rateLimitManager.getTimeUntilReset('search')
        console.log(`⚠️ Search API rate limit hit. Reset in ${waitTime}s.`)
        rateLimitLogged = true
      } else if (error?.status !== 403) {
        console.error('Error searching created repos:', error?.message || 'Unknown error')
      }
    }
    
    // Strategy 2: Recently updated repos
    try {
      if (!rateLimitManager.isRateLimited('search')) {
        const { data: updatedData } = await octokit.search.repos({
          q: `pushed:>${dateStrUpdated} language:javascript language:typescript language:python language:rust language:go language:java stars:>3`,
          sort: 'updated',
          order: 'desc',
          per_page: 20,
        })
        updatedData.items.forEach(repo => repos.add(repo.full_name))
      }
    } catch (error: any) {
      if (error?.status === 403 && !rateLimitLogged) {
        const waitTime = rateLimitManager.getTimeUntilReset('search')
        console.log(`⚠️ Search API rate limit hit. Reset in ${waitTime}s.`)
        rateLimitLogged = true
      } else if (error?.status !== 403) {
        console.error('Error searching updated repos:', error?.message || 'Unknown error')
      }
    }
    
    return Array.from(repos)
  } catch (error: any) {
    if (error?.status !== 403) {
      console.error('Error fetching brand new repos:', error?.message || 'Unknown error')
    }
    return []
  }
}

// Function to find recently committed code files
async function findRecentlyCommittedCode(owner: string, repo: string, branch: string): Promise<Array<{ path: string; sha: string; date: string; author: string; authorLogin: string }>> {
  try {
    // Get recent commits
    const { data: commits } = await octokit.repos.listCommits({
      owner,
      repo,
      sha: branch,
      per_page: 10,
    })
    
    if (commits.length === 0) {
      return []
    }
    
    // Get files from recent commits
    const recentFiles: Map<string, { path: string; sha: string; date: string; author: string; authorLogin: string }> = new Map()
    let checkedCommits = 0
    
    for (const commit of commits.slice(0, 5)) { // Check last 5 commits
      try {
        const { data: commitData } = await octokit.repos.getCommit({
          owner,
          repo,
          ref: commit.sha,
        })
        
        checkedCommits++
        
        // Extract author info
        const authorName = commitData.commit.author?.name || commitData.author?.login || 'Unknown'
        const authorLogin = commitData.author?.login || commitData.commit.author?.name || 'Unknown'
        const commitDate = commitData.commit.committer?.date || commitData.commit.author?.date || new Date().toISOString()
        
        if (commitData.files && commitData.files.length > 0) {
          for (const file of commitData.files) {
            // Only include code files that were added or modified
            if ((file.status === 'added' || file.status === 'modified') &&
                file.filename.match(/\.(js|ts|jsx|tsx|py|java|cpp|c|go|rs|rb|php)$/i) &&
                !file.filename.includes('.min.') &&
                file.filename.length < 200 &&
                file.filename.length > 0) {
              // Prefer most recent version
              if (!recentFiles.has(file.filename) || 
                  new Date(commitDate) > new Date(recentFiles.get(file.filename)!.date)) {
                recentFiles.set(file.filename, {
                  path: file.filename,
                  sha: commit.sha,
                  date: commitDate,
                  author: authorName,
                  authorLogin: authorLogin,
                })
              }
            }
          }
        }
      } catch (error: any) {
        // Skip if we can't get commit details (might be 404, rate limit, etc.)
        if (error?.status !== 404) {
          console.error(`Error getting commit ${commit.sha}:`, error?.message || error)
        }
        continue
      }
    }
    
    return Array.from(recentFiles.values())
  } catch (error: any) {
    console.error(`Error finding recently committed code for ${owner}/${repo}:`, error?.message || error)
    return []
  }
}

export interface CodeSnippet {
  repository: string
  filePath: string
  content: string
  language: string
  startLine: number
  endLine: number
  url: string
  score?: number  // Optional score for filtering
  commitAuthor?: string  // Author name
  commitAuthorLogin?: string  // GitHub username
  commitDate?: string  // ISO date string
  metrics?: {
    complexity: number
    codeSmells: number
    interestingPatterns: number
    educationalValue: number
    potentialIssues: number
  }
}

// Helper function to recursively find code files
async function findCodeFiles(
  owner: string,
  repo: string,
  branch: string,
  path: string = '',
  maxDepth: number = 3,
  currentDepth: number = 0
): Promise<any[]> {
  if (currentDepth >= maxDepth) {
    return []
  }

  try {
    const { data: contents } = await octokit.repos.getContent({
      owner,
      repo,
      path,
      ref: branch,
    })

    if (!Array.isArray(contents)) {
      return []
    }

    const codeFiles: any[] = []
    const directories: any[] = []

    for (const item of contents) {
      if (item.type === 'file' && item.name.match(/\.(js|ts|jsx|tsx|py|java|cpp|c|go|rs|rb|php)$/i)) {
        // Skip very large files (>1MB) and minified files
        if (item.size && item.size < 1000000 && !item.name.includes('.min.')) {
          codeFiles.push(item)
        }
      } else if (item.type === 'dir' && !item.name.startsWith('.') && item.name !== 'node_modules' && item.name !== 'vendor') {
        directories.push(item)
      }
    }

    // If we found code files at this level, return them (prefer files closer to root)
    if (codeFiles.length > 0 && currentDepth <= 1) {
      return codeFiles
    }

    // Otherwise, search in subdirectories
    for (const dir of directories.slice(0, 3)) { // Limit to 3 subdirectories to avoid too many API calls
      const subFiles = await findCodeFiles(owner, repo, branch, dir.path, maxDepth, currentDepth + 1)
      codeFiles.push(...subFiles)
      if (codeFiles.length >= 10) break // Enough files found
    }

    return codeFiles
  } catch (error) {
    console.error(`Error searching in ${path}:`, error)
    return []
  }
}

// Advanced code analysis and scoring system
interface CodeSection {
  start: number
  end: number
  type: string
  score: number
  metrics: {
    complexity: number
    codeSmells: number
    interestingPatterns: number
    educationalValue: number
    potentialIssues: number
  }
  reasons: string[]
}

// Analyze code complexity and quality
function analyzeCodeComplexity(lines: string[], start: number, end: number): {
  cyclomaticComplexity: number
  nestingDepth: number
  lineLengthIssues: number
  magicNumbers: number
  longParameterList: boolean
} {
  const section = lines.slice(start - 1, end)
  let cyclomaticComplexity = 1 // Base complexity
  let maxNestingDepth = 0
  let currentNesting = 0
  let lineLengthIssues = 0
  let magicNumbers = 0
  let longParameterList = false

  for (const line of section) {
    const trimmed = line.trim()
    
    // Cyclomatic complexity: count decision points
    if (/if\s*\(|else\s*if|switch\s*\(|case\s+|catch\s*\(|while\s*\(|for\s*\(|&&|\|\|/.test(trimmed)) {
      cyclomaticComplexity++
    }
    
    // Nesting depth
    if (trimmed.includes('{') || trimmed.includes('(')) {
      currentNesting++
      maxNestingDepth = Math.max(maxNestingDepth, currentNesting)
    }
    if (trimmed.includes('}') || trimmed.includes(')')) {
      currentNesting = Math.max(0, currentNesting - 1)
    }
    
    // Line length issues
    if (line.length > 100) lineLengthIssues++
    
    // Magic numbers (numbers that aren't 0, 1, -1, or common constants)
    const numberMatches = trimmed.match(/\b\d{2,}\b/g)
    if (numberMatches) {
      magicNumbers += numberMatches.length
    }
    
    // Long parameter lists
    const paramMatch = trimmed.match(/\([^)]{50,}\)/)
    if (paramMatch) longParameterList = true
  }

  return {
    cyclomaticComplexity,
    nestingDepth: maxNestingDepth,
    lineLengthIssues,
    magicNumbers,
    longParameterList,
  }
}

// Detect code smells and interesting patterns
function detectCodePatterns(lines: string[], start: number, end: number, language: string): {
  codeSmells: string[]
  interestingPatterns: string[]
  potentialIssues: string[]
  educationalValue: string[]
} {
  const section = lines.slice(start - 1, end)
  const fullText = section.join('\n')
  const codeSmells: string[] = []
  const interestingPatterns: string[] = []
  const potentialIssues: string[] = []
  const educationalValue: string[] = []

  // Code Smells Detection
  if (section.length > 50) codeSmells.push('Long method/function')
  if (fullText.match(/if\s*\([^)]*\)\s*\{[^}]*if\s*\([^)]*\)\s*\{[^}]*if\s*\(/)) {
    codeSmells.push('Deep nesting')
  }
  if (fullText.match(/console\.(log|warn|error)/)) codeSmells.push('Console statements')
  if (fullText.match(/TODO|FIXME|HACK|XXX/i)) codeSmells.push('TODO/FIXME comments')
  if (fullText.match(/catch\s*\([^)]*\)\s*\{\s*\}/)) codeSmells.push('Empty catch block')
  if (fullText.match(/var\s+\w+/)) codeSmells.push('Use of var (consider let/const)')
  if (fullText.match(/==\s*[^=]|!=\s*[^=]/)) codeSmells.push('Loose equality (==)')
  if (fullText.match(/eval\s*\(|new Function/)) codeSmells.push('Use of eval')
  if (fullText.match(/\.innerHTML\s*=/)) potentialIssues.push('Potential XSS (innerHTML)')
  
  // Interesting Patterns
  if (fullText.match(/async\s+function|await\s+/)) interestingPatterns.push('Async/await pattern')
  if (fullText.match(/Promise\.(all|race|allSettled)/)) interestingPatterns.push('Promise patterns')
  if (fullText.match(/useState|useEffect|useCallback|useMemo/)) interestingPatterns.push('React hooks')
  if (fullText.match(/\.map\s*\(|\.filter\s*\(|\.reduce\s*\(/)) interestingPatterns.push('Functional programming')
  if (fullText.match(/try\s*\{|catch\s*\(|finally\s*\{/)) interestingPatterns.push('Error handling')
  if (fullText.match(/class\s+\w+|interface\s+\w+|type\s+\w+/)) interestingPatterns.push('Type definitions')
  if (fullText.match(/@\w+|decorator/)) interestingPatterns.push('Decorators')
  if (fullText.match(/\.test\s*\(|\.match\s*\(|regex/)) interestingPatterns.push('Regex patterns')
  if (fullText.match(/recursive|recursion/i)) interestingPatterns.push('Recursive algorithm')
  if (fullText.match(/algorithm|sort|search|binary|tree|graph/i)) educationalValue.push('Algorithm implementation')
  
  // Potential Issues
  if (fullText.match(/password|secret|api[_-]?key|token/i) && !fullText.match(/process\.env|config/)) {
    potentialIssues.push('Possible hardcoded credentials')
  }
  if (fullText.match(/SQL|SELECT|INSERT|DELETE|UPDATE/i) && fullText.match(/\$\{|\+.*\+/)) {
    potentialIssues.push('Possible SQL injection risk')
  }
  if (fullText.match(/setTimeout|setInterval/) && !fullText.match(/clearTimeout|clearInterval/)) {
    potentialIssues.push('Possible memory leak (missing cleanup)')
  }
  if (fullText.match(/\.forEach\s*\([^)]*async/)) potentialIssues.push('Async in forEach (may not work as expected)')
  if (fullText.match(/\.map\s*\([^)]*async/) && !fullText.match(/Promise\.all/)) {
    potentialIssues.push('Async map without Promise.all')
  }
  
  // Educational Value
  if (fullText.match(/design pattern|factory|singleton|observer|strategy/i)) {
    educationalValue.push('Design pattern')
  }
  if (fullText.match(/optimization|performance|memoization|caching/i)) {
    educationalValue.push('Performance optimization')
  }
  if (fullText.match(/security|authentication|authorization|encryption/i)) {
    educationalValue.push('Security implementation')
  }
  if (fullText.match(/test|spec|describe|it\(|expect/)) educationalValue.push('Test code')
  if (fullText.match(/\/\*\*[\s\S]*?\*\//)) educationalValue.push('Well-documented code')

  return { codeSmells, interestingPatterns, potentialIssues, educationalValue }
}

// Score a code section based on multiple factors
function scoreCodeSection(
  section: { start: number; end: number; type: string },
  lines: string[],
  language: string
): CodeSection {
  const complexity = analyzeCodeComplexity(lines, section.start, section.end)
  const patterns = detectCodePatterns(lines, section.start, section.end, language)
  
  let score = 0
  const reasons: string[] = []
  
  // Complexity scoring (moderate complexity is interesting, too high is a code smell)
  if (complexity.cyclomaticComplexity >= 5 && complexity.cyclomaticComplexity <= 15) {
    score += 15
    reasons.push(`Moderate complexity (${complexity.cyclomaticComplexity})`)
  } else if (complexity.cyclomaticComplexity > 15) {
    score += 20
    reasons.push(`High complexity (${complexity.cyclomaticComplexity}) - review needed`)
  }
  
  // Nesting depth
  if (complexity.nestingDepth >= 3) {
    score += 10
    reasons.push(`Deep nesting (${complexity.nestingDepth} levels)`)
  }
  
  // Code smells (negative but interesting for review)
  if (patterns.codeSmells.length > 0) {
    score += patterns.codeSmells.length * 5
    reasons.push(`Code smells: ${patterns.codeSmells.join(', ')}`)
  }
  
  // Interesting patterns (positive)
  score += patterns.interestingPatterns.length * 8
  if (patterns.interestingPatterns.length > 0) {
    reasons.push(`Patterns: ${patterns.interestingPatterns.slice(0, 3).join(', ')}`)
  }
  
  // Potential issues (high priority for review)
  score += patterns.potentialIssues.length * 15
  if (patterns.potentialIssues.length > 0) {
    reasons.push(`⚠️ Issues: ${patterns.potentialIssues.join(', ')}`)
  }
  
  // Educational value
  score += patterns.educationalValue.length * 10
  if (patterns.educationalValue.length > 0) {
    reasons.push(`📚 Educational: ${patterns.educationalValue.join(', ')}`)
  }
  
  // Length scoring (prefer medium-sized sections, penalize long ones heavily)
  const length = section.end - section.start
  if (length >= 15 && length <= 30) {
    score += 5
  } else if (length > 30 && length <= 35) {
    score += 2 // Slightly long but acceptable
  } else if (length > 35) {
    score -= 15 // Heavily penalize sections that are too long
  }
  
  // Magic numbers
  if (complexity.magicNumbers > 0) {
    score += 5
    reasons.push(`${complexity.magicNumbers} magic number(s)`)
  }
  
  // Long parameter list
  if (complexity.longParameterList) {
    score += 5
    reasons.push('Long parameter list')
  }

  return {
    ...section,
    score,
    metrics: {
      complexity: complexity.cyclomaticComplexity,
      codeSmells: patterns.codeSmells.length,
      interestingPatterns: patterns.interestingPatterns.length,
      educationalValue: patterns.educationalValue.length,
      potentialIssues: patterns.potentialIssues.length,
    },
    reasons,
  }
}

// Find interesting code sections (functions, classes, methods) with scoring
function findInterestingSections(
  content: string,
  language: string,
  minLines: number = 10,
  maxLines: number = 35  // Reduced from 50 to keep snippets focused
): CodeSection[] {
  const lines = content.split('\n')
  const sections: Array<{ start: number; end: number; type: string }> = []
  
  // Patterns for different languages
  const patterns: Record<string, { function: RegExp; class: RegExp }> = {
    javascript: {
      function: /^(export\s+)?(async\s+)?function\s+\w+|^(export\s+)?(const|let|var)\s+\w+\s*=\s*(async\s+)?\(|^(export\s+)?(const|let|var)\s+\w+\s*=\s*(async\s+)?\(/,
      class: /^(export\s+)?class\s+\w+/,
    },
    typescript: {
      function: /^(export\s+)?(async\s+)?function\s+\w+|^(export\s+)?(const|let|var)\s+\w+\s*[:=]\s*(async\s+)?\(|^(export\s+)?(const|let|var)\s+\w+\s*[:=]\s*(async\s+)?\(/,
      class: /^(export\s+)?(abstract\s+)?class\s+\w+/,
    },
    python: {
      function: /^def\s+\w+|^async\s+def\s+\w+/,
      class: /^class\s+\w+/,
    },
    java: {
      function: /^\s*(public|private|protected)?\s*(static\s+)?\w+\s+\w+\s*\(/,
      class: /^(public\s+)?(abstract\s+)?class\s+\w+/,
    },
    go: {
      function: /^func\s+(\w+\s+)?\w+\s*\(/,
      class: /^type\s+\w+\s+(struct|interface)/,
    },
    rust: {
      function: /^(pub\s+)?(async\s+)?fn\s+\w+/,
      class: /^(pub\s+)?(struct|enum|impl)\s+\w+/,
    },
  }
  
  const langPatterns = patterns[language] || patterns.javascript
  let currentSection: { start: number; end: number; type: string } | null = null
  let braceCount = 0
  let parenCount = 0
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const trimmed = line.trim()
    
    // Check for function or class start
    if (langPatterns.function.test(trimmed) || langPatterns.class.test(trimmed)) {
      // Save previous section if valid
      if (currentSection && currentSection.end - currentSection.start >= minLines) {
        sections.push(currentSection)
      }
      
      // Start new section
      const type = langPatterns.class.test(trimmed) ? 'class' : 'function'
      currentSection = { start: i + 1, end: i + 1, type }
      braceCount = 0
      parenCount = 0
    }
    
    if (currentSection) {
      // Count braces and parentheses to find end
      for (const char of line) {
        if (char === '{') braceCount++
        if (char === '}') braceCount--
        if (char === '(') parenCount++
        if (char === ')') parenCount--
      }
      
      currentSection.end = i + 1
      
      // End section if braces are balanced and we have enough lines
      if (braceCount === 0 && parenCount === 0 && currentSection.end - currentSection.start >= minLines) {
        // Limit section size - trim if too long
        let sectionLength = currentSection.end - currentSection.start
        if (sectionLength > maxLines) {
          // Trim to maxLines, keeping the beginning (usually most important)
          currentSection.end = currentSection.start + maxLines - 1
        }
        if (currentSection.end - currentSection.start <= maxLines) {
          sections.push(currentSection)
        }
        currentSection = null
      }
    }
  }
  
  // Add final section if valid
  if (currentSection && currentSection.end - currentSection.start >= minLines) {
    let sectionLength = currentSection.end - currentSection.start
    if (sectionLength > maxLines) {
      // Trim to maxLines
      currentSection.end = currentSection.start + maxLines - 1
    }
    if (currentSection.end - currentSection.start <= maxLines) {
      sections.push(currentSection)
    }
  }
  
  // Score all sections and return sorted by score
  const scoredSections = sections
    .map(section => scoreCodeSection(section, lines, language))
    .filter(section => section.score > 0) // Only include sections with positive scores
    .sort((a, b) => b.score - a.score) // Sort by score descending
  
  return scoredSections
}

export async function getRandomCodeSnippet(
  maxRetries: number = 3,
  fastMode: boolean = false // Fast mode skips complex scoring for first load
): Promise<CodeSnippet | null> {
  let availableRepos: string[] = []
  
  // Always use "new" mode - get recently created repos or recently committed code
  const newRepos = await getBrandNewRepos()
  if (newRepos.length > 0) {
    availableRepos = newRepos
  } else {
    // Fallback to trending if no brand new repos found
    const trending = await getTrendingRepos()
    if (trending.length > 0) {
      availableRepos = trending
    } else {
      // Last resort: use popular repos
      availableRepos = [...POPULAR_REPOS]
    }
  }
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      // Pick a random repository from available list
      const repo = availableRepos[Math.floor(Math.random() * availableRepos.length)]
      const [owner, name] = repo.split('/')

      // Get repository info to find the default branch
      const { data: repoInfo } = await octokit.repos.get({
        owner,
        repo: name,
      })
      const defaultBranch = repoInfo.default_branch || 'main'

      let codeFiles: any[] = []
      let commitInfo: { author: string; authorLogin: string; date: string } | null = null
      
      // Try to find recently committed files first (always use "new" mode)
      try {
        const recentFiles = await findRecentlyCommittedCode(owner, name, defaultBranch)
        if (recentFiles.length > 0) {
          // Convert to file format expected by rest of code, preserving commit info
          codeFiles = recentFiles.map(f => ({
            path: f.path,
            name: f.path.split('/').pop() || f.path,
            size: 0, // We don't have size info from commits
            commitInfo: {
              author: f.author,
              authorLogin: f.authorLogin,
              date: f.date,
            },
          }))
        }
      } catch (error) {
        // Continue to fallback
      }
      
      // Fallback to regular file search if no recent commits found
      if (codeFiles.length === 0) {
        codeFiles = await findCodeFiles(owner, name, defaultBranch)
      }

      if (codeFiles.length === 0) {
        continue // Try another repo
      }

      // Pick a random file
      const randomFile = codeFiles[Math.floor(Math.random() * codeFiles.length)]
      
      // If we have commit info from recent files, use it
      if (randomFile.commitInfo) {
        commitInfo = randomFile.commitInfo
      } else {
        // Try to get commit info for regular files by finding the last commit that modified this file
        try {
          const { data: commits } = await octokit.repos.listCommits({
            owner,
            repo: name,
            path: randomFile.path,
            per_page: 1,
          })
          
          if (commits.length > 0) {
            const commit = commits[0]
            commitInfo = {
              author: commit.commit.author?.name || commit.author?.login || 'Unknown',
              authorLogin: commit.author?.login || commit.commit.author?.name || 'Unknown',
              date: commit.commit.committer?.date || commit.commit.author?.date || new Date().toISOString(),
            }
          }
        } catch (error) {
          // Silently fail - commit info is optional
        }
      }

      // Get file content
      const { data: fileContent } = await octokit.repos.getContent({
        owner,
        repo: name,
        path: randomFile.path,
        ref: defaultBranch,
      })

      if (Array.isArray(fileContent) || fileContent.type !== 'file') {
        continue
      }

      const content = Buffer.from(fileContent.content, 'base64').toString('utf-8')
      const lines = content.split('\n')

      // Skip files that are too short
      if (lines.length < 15) {
        continue
      }

      // Detect language from file extension
      const extension = randomFile.name.split('.').pop()?.toLowerCase() || 'text'
      const languageMap: Record<string, string> = {
        js: 'javascript',
        jsx: 'javascript',
        ts: 'typescript',
        tsx: 'typescript',
        py: 'python',
        java: 'java',
        cpp: 'cpp',
        c: 'c',
        go: 'go',
        rs: 'rust',
        rb: 'ruby',
        php: 'php',
      }
      const language = languageMap[extension] || extension

      // FAST MODE: Skip complex scoring for first load, just pick a reasonable section
      let startLine: number
      let endLine: number
      let snippetContent: string
      let selectedSection: CodeSection | null = null
      let snippetScore: number | undefined
      let snippetMetrics: CodeSnippet['metrics'] | undefined
      
      if (fastMode) {
        // Fast path: just pick a middle section (15-35 lines)
        const midPoint = Math.floor(lines.length / 2)
        startLine = Math.max(1, midPoint - 10)
        endLine = Math.min(startLine + 34, lines.length) // Max 35 lines
        snippetContent = lines.slice(startLine - 1, endLine).join('\n')
        snippetScore = 5 // Default score for fast mode
      } else {
        // Full mode: Find and score interesting code sections
        const sections = findInterestingSections(content, language, 10, 35)
        
        if (sections.length > 0) {
          // Use weighted random selection favoring higher scores
          // Top 30% get 70% chance, next 40% get 25% chance, rest get 5% chance
          const topCount = Math.max(1, Math.floor(sections.length * 0.3))
          const midCount = Math.max(1, Math.floor(sections.length * 0.4))
          
          const topSections = sections.slice(0, topCount)
          const midSections = sections.slice(topCount, topCount + midCount)
          const restSections = sections.slice(topCount + midCount)
          
          const rand = Math.random()
          if (rand < 0.7 && topSections.length > 0) {
            selectedSection = topSections[Math.floor(Math.random() * topSections.length)]
          } else if (rand < 0.95 && midSections.length > 0) {
            selectedSection = midSections[Math.floor(Math.random() * midSections.length)]
          } else if (restSections.length > 0) {
            selectedSection = restSections[Math.floor(Math.random() * restSections.length)]
          } else {
            selectedSection = sections[0]
          }
          
          startLine = selectedSection.start
          // Ensure we don't exceed max lines (35)
          endLine = Math.min(selectedSection.end, selectedSection.start + 34)
          snippetContent = lines.slice(startLine - 1, endLine).join('\n')
          snippetScore = selectedSection.score
          snippetMetrics = selectedSection.metrics
        } else {
          // Fallback: Advanced pattern-based selection with scoring
        const candidates: Array<{ start: number; end: number; score: number; reasons: string[] }> = []
        
        for (let i = 0; i < lines.length - 15; i++) {
          const blockStart = i + 1
          const blockEnd = Math.min(i + 35, lines.length) // Reduced from 40 to 35
          const block = lines.slice(i, blockEnd)
          const blockText = block.join('\n')
          
          // Create a temporary section for analysis
          const tempSection = { start: blockStart, end: blockEnd, type: 'block' }
          const complexity = analyzeCodeComplexity(lines, blockStart, blockEnd)
          const patterns = detectCodePatterns(lines, blockStart, blockEnd, language)
          
          let score = 0
          const reasons: string[] = []
          
          // Score based on multiple factors
          if (complexity.cyclomaticComplexity >= 3) {
            score += complexity.cyclomaticComplexity * 2
            reasons.push(`Complexity: ${complexity.cyclomaticComplexity}`)
          }
          
          score += patterns.interestingPatterns.length * 5
          score += patterns.potentialIssues.length * 10
          score += patterns.educationalValue.length * 8
          
          // Comments and documentation
          const commentLines = block.filter(l => l.trim().startsWith('//') || l.trim().startsWith('/*') || l.trim().startsWith('*')).length
          if (commentLines > 0) {
            score += Math.min(commentLines * 2, 10)
            reasons.push(`${commentLines} comment lines`)
          }
          
          // Error handling
          if (blockText.match(/try|catch|throw|error|exception/i)) {
            score += 5
            reasons.push('Error handling')
          }
          
          // Penalties
          if (blockText.match(/console\.(log|warn|error)/)) score -= 3
          if (complexity.lineLengthIssues > 5) score -= 5
          
          if (score > 5) { // Only consider blocks with meaningful scores
            candidates.push({ start: blockStart, end: blockEnd, score, reasons })
          }
        }
        
        if (candidates.length > 0) {
          // Sort by score and pick from top candidates
          candidates.sort((a, b) => b.score - a.score)
          const topCandidates = candidates.slice(0, Math.min(5, candidates.length))
          const selected = topCandidates[Math.floor(Math.random() * topCandidates.length)]
          
          startLine = selected.start
          // Ensure we don't exceed max lines
          endLine = Math.min(selected.end, selected.start + 34) // Max 35 lines (0-indexed)
          snippetContent = lines.slice(startLine - 1, endLine).join('\n')
        } else {
          // Last resort: pick a reasonable middle section (max 35 lines)
          const midPoint = Math.floor(lines.length / 2)
          startLine = Math.max(1, midPoint - 15)
          endLine = Math.min(startLine + 34, lines.length) // Max 35 lines
          snippetContent = lines.slice(startLine - 1, endLine).join('\n')
          snippetScore = 3 // Low score for fallback
        }
        } // End of else block for sections.length > 0
      } // End of else block for fastMode

      // Final safety check: ensure content doesn't exceed 35 lines
      const contentLines = snippetContent.split('\n')
      if (contentLines.length > 35) {
        snippetContent = contentLines.slice(0, 35).join('\n')
        endLine = startLine + 34
      }

      // Calculate score if not already set (for fallback cases or fast mode)
      if (!snippetScore || !snippetMetrics) {
        if (selectedSection) {
          snippetScore = selectedSection.score
          snippetMetrics = selectedSection.metrics
        } else {
          // Calculate score for fallback blocks
          const tempSection = { start: startLine, end: endLine, type: 'block' }
          const scored = scoreCodeSection(tempSection, lines, language)
          snippetScore = snippetScore || scored.score
          snippetMetrics = snippetMetrics || scored.metrics
        }
      }

      return {
        repository: repo,
        filePath: randomFile.path,
        content: snippetContent,
        language: languageMap[extension] || extension,
        startLine,
        endLine,
        url: `https://github.com/${repo}/blob/${defaultBranch}/${randomFile.path}#L${startLine}-L${endLine}`,
        score: snippetScore,
        metrics: snippetMetrics,
        commitAuthor: commitInfo?.author,
        commitAuthorLogin: commitInfo?.authorLogin,
        commitDate: commitInfo?.date,
      };
    } catch (error: any) {
      // Suppress verbose logging for rate limits (403) - only log once per function call
      if (error?.status === 403) {
        if (attempt === 1) {
          // Only log once on first attempt to avoid spam
          console.error('⚠️ GitHub API rate limit exceeded. Falling back to popular repos.')
        }
        // If rate limited, wait a bit before retrying
        if (attempt < maxRetries) {
          await new Promise(resolve => setTimeout(resolve, 2000 * attempt))
        }
      } else if (error?.status === 404) {
        // Silently continue for 404 errors (expected during random selection)
      } else if (error?.status) {
        // Only log non-rate-limit errors on last attempt to reduce noise
        if (attempt === maxRetries) {
          console.error(`GitHub API error ${error.status}: ${error.message || 'Unknown error'}`)
        }
        // For other errors, wait before retrying
        if (attempt < maxRetries) {
          await new Promise(resolve => setTimeout(resolve, 1000 * attempt))
        }
      }
      
      // If this was the last attempt, return null
      if (attempt === maxRetries) {
        return null
      }
    }
  }
  
  return null;
}

export async function getRepositoryInfo(owner: string, repo: string) {
  try {
    const { data } = await octokit.repos.get({
      owner,
      repo,
    })
    return {
      name: data.name,
      fullName: data.full_name,
      description: data.description,
      owner: data.owner.login,
    }
  } catch (error) {
    console.error('Error fetching repository info:', error)
    return null
  }
}

