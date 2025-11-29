import { NextResponse } from 'next/server'
import { getRandomCodeSnippet, CodeSnippet } from '@/lib/github'
import { getRandomStaticSnippet } from '@/lib/staticSnippets'
import { getRandomPreGeneratedSnippet } from '@/lib/localCodeScanner'
import { convertStaticToCodeSnippet } from '@/lib/snippetCache'

// Minimum score threshold for interesting code (lowered to ensure we get results)
// Accept any snippet with a score > 0, or no score at all (for new mode)
const MIN_SCORE_THRESHOLD = 0

// Maximum time to spend fetching snippets (in ms)
const MAX_FETCH_TIME = 8000; // Reduced from 10s to 8s

// Track rate limit status globally
let isRateLimited = false;
let rateLimitResetTime = 0;

// Fallback snippets to use when GitHub API is rate limited
const getFallbackSnippets = (count: number): CodeSnippet[] => {
  console.log(`[Batch] Using fallback snippets (count: ${count})`);
  const snippets: CodeSnippet[] = [];
  
  // Generate a larger pool of snippets to choose from
  const localSnippetPool: CodeSnippet[] = [];
  const staticSnippetPool: CodeSnippet[] = [];
  
  // First build a pool of local code snippets (all of them)
  try {
    // Get all pre-generated snippets
    const preGenerated = [];
    for (let i = 0; i < 20; i++) { // Try to get up to 20 unique snippets
      const localSnippet = getRandomPreGeneratedSnippet();
      if (localSnippet) {
        // Check if we already have this snippet in the pool
        const isDuplicate = localSnippetPool.some(
          s => s.filePath === localSnippet.filePath && 
               s.startLine === localSnippet.startLine
        );
        
        if (!isDuplicate) {
          // Create a CodeSnippet from the local snippet
          localSnippetPool.push({
            repository: 'CodeReviewApp',
            filePath: localSnippet.filePath,
            content: localSnippet.content,
            language: localSnippet.language,
            startLine: localSnippet.startLine,
            endLine: localSnippet.endLine,
            url: `https://github.com/CodeReviewApp/${localSnippet.filePath}#L${localSnippet.startLine}-L${localSnippet.endLine}`,
            commitAuthor: 'CodeReviewApp Team',
            commitAuthorLogin: 'codereviewapp',
            score: 5
          });
        }
      }
    }
  } catch (error) {
    console.error('[Batch] Error building local snippet pool:', error);
  }
  
  // Then build a pool of static snippets
  try {
    // Get all static snippets (up to 20)
    for (let i = 0; i < 20; i++) {
      const staticSnippet = getRandomStaticSnippet();
      const codeSnippet = convertStaticToCodeSnippet(staticSnippet);
      
      // Check if we already have this snippet in the pool
      const isDuplicate = staticSnippetPool.some(
        s => s.content === codeSnippet.content
      );
      
      if (!isDuplicate) {
        staticSnippetPool.push(codeSnippet);
      }
    }
  } catch (error) {
    console.error('[Batch] Error building static snippet pool:', error);
  }
  
  console.log(`[Batch] Built fallback pools: ${localSnippetPool.length} local, ${staticSnippetPool.length} static`);
  
  // Now select snippets from the pools
  // First add local snippets (prioritize these)
  while (snippets.length < count && localSnippetPool.length > 0) {
    const randomIndex = Math.floor(Math.random() * localSnippetPool.length);
    snippets.push(localSnippetPool[randomIndex]);
    localSnippetPool.splice(randomIndex, 1); // Remove used snippet
  }
  
  // If we still need more, use static snippets
  while (snippets.length < count && staticSnippetPool.length > 0) {
    const randomIndex = Math.floor(Math.random() * staticSnippetPool.length);
    snippets.push(staticSnippetPool[randomIndex]);
    staticSnippetPool.splice(randomIndex, 1); // Remove used snippet
  }
  
  // If we STILL need more (unlikely), generate on the fly
  while (snippets.length < count) {
    try {
      const staticSnippet = getRandomStaticSnippet();
      const codeSnippet = convertStaticToCodeSnippet(staticSnippet);
      snippets.push(codeSnippet);
    } catch (error) {
      console.error('[Batch] Error getting additional static snippet:', error);
      break;
    }
  }
  
  console.log(`[Batch] Returning ${snippets.length} fallback snippets`);
  return snippets;
};

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const count = parseInt(searchParams.get('count') || '5', 10)
    const fastMode = searchParams.get('fast') === 'true'
    
    const snippets: CodeSnippet[] = []
    // More aggressive: 2x the count, maximum 15 attempts to ensure we get enough snippets
    const maxAttempts = Math.min(Math.max(Math.ceil(count * 2), 8), 15)
    
    console.log(`[Batch] Fetching ${count} snippets with max ${maxAttempts} attempts, fast mode: ${fastMode}`)
    
    // Set a timeout to ensure we don't spend too long fetching
    const startTime = Date.now()
    
    // Use Promise.all with a limited batch size to fetch in parallel
    const batchSize = 3 // Process 3 at a time to avoid overwhelming the API
    const batches = Math.ceil(maxAttempts / batchSize)
    
    for (let batch = 0; batch < batches; batch++) {
      // Check if we've spent too much time or have enough snippets
      if (Date.now() - startTime > MAX_FETCH_TIME || snippets.length >= count) {
        break
      }
      
      const batchStart = batch * batchSize
      const batchEnd = Math.min(batchStart + batchSize, maxAttempts)
      const batchPromises = []
      
      for (let i = batchStart; i < batchEnd; i++) {
        // Create a promise that resolves to null after a timeout
        const timeoutPromise = new Promise<null>(resolve => {
          setTimeout(() => resolve(null), 5000) // 5 second timeout per snippet
        })
        
        // Create the snippet fetch promise
        const fetchPromise = getRandomCodeSnippet(1, fastMode)
          .catch(error => {
            // Silently continue - errors are expected during batch operations
            return null
          })
        
        // Race the fetch against the timeout
        batchPromises.push(Promise.race([fetchPromise, timeoutPromise]))
      }
      
      // Wait for all promises in this batch
      const batchResults = await Promise.all(batchPromises)
      
      // Add valid snippets to our collection
      for (const snippet of batchResults) {
        if (snippet) {
          snippets.push(snippet)
          if (snippets.length >= count) {
            break
          }
        }
      }
      
      // Small delay between batches to avoid rate limits
      if (batch < batches - 1) {
        await new Promise(resolve => setTimeout(resolve, 500))
      }
    }
    
    // If we didn't get enough snippets from GitHub, use fallbacks
    if (snippets.length < count) {
      console.log(`[Batch] Only got ${snippets.length}/${count} snippets from GitHub, adding fallbacks`);
      const neededFallbacks = count - snippets.length;
      const fallbackSnippets = getFallbackSnippets(neededFallbacks);
      snippets.push(...fallbackSnippets);
      console.log(`[Batch] Added ${fallbackSnippets.length} fallback snippets`);
    }
    
    // Sort by score descending
    snippets.sort((a, b) => (b.score || 0) - (a.score || 0))
    
    const fetchTime = Date.now() - startTime
    console.log(`[Batch] Fetched ${snippets.length}/${count} snippets in ${fetchTime}ms (including fallbacks)`)
    
    return NextResponse.json({
      snippets,
      count: snippets.length,
      fetchTimeMs: fetchTime,
      usedFallbacks: snippets.length > 0 && snippets.some(s => s.repository === 'CodeReviewApp')
    })
  } catch (error) {
    console.error('Error in /api/snippets/batch:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json(
      { error: `Internal server error: ${errorMessage}`, snippets: [] },
      { status: 500 }
    )
  }
}
