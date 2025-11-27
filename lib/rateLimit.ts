/**
 * Rate Limit Manager for GitHub API
 * Tracks rate limits and prevents hitting them
 */

interface RateLimitState {
  remaining: number
  resetTime: number // Unix timestamp
  limit: number
  resource: string // 'core', 'search', etc.
}

class RateLimitManager {
  private limits: Map<string, RateLimitState> = new Map()
  private requestQueue: Array<() => Promise<any>> = []
  private processingQueue = false
  private readonly MIN_DELAY_MS = 100 // Minimum delay between requests
  private readonly SEARCH_DELAY_MS = 2000 // Extra delay for search API (stricter limits)

  /**
   * Update rate limit state from API response headers
   */
  updateFromHeaders(headers: any, resource: string = 'core'): void {
    // Headers can be a Headers object or plain object
    const getHeader = (key: string): string => {
      if (headers instanceof Headers) {
        return headers.get(key) || '0'
      }
      if (typeof headers === 'object' && headers !== null) {
        // Try different header name formats
        return headers[key] || headers[key.toLowerCase()] || '0'
      }
      return '0'
    }

    const remaining = parseInt(getHeader('x-ratelimit-remaining'), 10)
    const resetTime = parseInt(getHeader('x-ratelimit-reset'), 10)
    const limit = parseInt(getHeader('x-ratelimit-limit'), 10)

    if (remaining >= 0 && resetTime > 0) {
      this.limits.set(resource, {
        remaining,
        resetTime,
        limit,
        resource,
      })
    }
  }

  /**
   * Check if we can make a request for a given resource
   */
  canMakeRequest(resource: string = 'core'): boolean {
    const state = this.limits.get(resource)
    if (!state) {
      return true // No info yet, allow request
    }

    // If we have remaining requests, allow
    if (state.remaining > 5) {
      return true
    }

    // If we're close to limit, check reset time
    const now = Math.floor(Date.now() / 1000)
    if (state.resetTime > now) {
      // Still have time, but low on requests
      return state.remaining > 0
    }

    // Reset time has passed, we should have new quota
    return true
  }

  /**
   * Get the delay needed before making a request
   */
  getDelayBeforeRequest(resource: string = 'core'): number {
    const state = this.limits.get(resource)
    if (!state) {
      return this.MIN_DELAY_MS
    }

    const now = Math.floor(Date.now() / 1000)

    // If we're out of requests, wait until reset
    if (state.remaining <= 0 && state.resetTime > now) {
      const waitSeconds = state.resetTime - now + 1 // Add 1 second buffer
      return waitSeconds * 1000
    }

    // If we're low on requests, add extra delay
    if (state.remaining < 10) {
      return resource === 'search' ? this.SEARCH_DELAY_MS : 500
    }

    // Normal delay based on resource type
    return resource === 'search' ? this.SEARCH_DELAY_MS : this.MIN_DELAY_MS
  }

  /**
   * Get time until rate limit resets (in seconds)
   */
  getTimeUntilReset(resource: string = 'core'): number {
    const state = this.limits.get(resource)
    if (!state) {
      return 0
    }

    const now = Math.floor(Date.now() / 1000)
    return Math.max(0, state.resetTime - now)
  }

  /**
   * Check if we're currently rate limited
   */
  isRateLimited(resource: string = 'core'): boolean {
    const state = this.limits.get(resource)
    if (!state) {
      return false
    }

    const now = Math.floor(Date.now() / 1000)
    return state.remaining <= 0 && state.resetTime > now
  }

  /**
   * Get remaining requests for a resource
   */
  getRemaining(resource: string = 'core'): number {
    const state = this.limits.get(resource)
    return state?.remaining ?? 0
  }

  /**
   * Queue a request to be executed when rate limits allow
   */
  async queueRequest<T>(
    requestFn: () => Promise<T>,
    resource: string = 'core'
  ): Promise<T> {
    return new Promise((resolve, reject) => {
      this.requestQueue.push(async () => {
        try {
          const result = await this.executeWithRateLimit(requestFn, resource)
          resolve(result)
        } catch (error) {
          reject(error)
        }
      })

      this.processQueue()
    })
  }

  /**
   * Execute a request with rate limit checking
   */
  private async executeWithRateLimit<T>(
    requestFn: () => Promise<T>,
    resource: string = 'core'
  ): Promise<T> {
    // Check if we need to wait
    if (this.isRateLimited(resource)) {
      const waitTime = this.getTimeUntilReset(resource)
      if (waitTime > 0) {
        console.log(
          `⏸️ Rate limited for ${resource}. Waiting ${waitTime}s until reset...`
        )
        await new Promise(resolve => setTimeout(resolve, waitTime * 1000))
      }
    } else {
      // Add delay based on remaining requests
      const delay = this.getDelayBeforeRequest(resource)
      if (delay > 0) {
        await new Promise(resolve => setTimeout(resolve, delay))
      }
    }

    // Execute the request
    return requestFn()
  }

  /**
   * Process the request queue
   */
  private async processQueue(): Promise<void> {
    if (this.processingQueue || this.requestQueue.length === 0) {
      return
    }

    this.processingQueue = true

    while (this.requestQueue.length > 0) {
      const request = this.requestQueue.shift()
      if (request) {
        try {
          await request()
        } catch (error) {
          console.error('Error in queued request:', error)
        }
      }
    }

    this.processingQueue = false
  }

  /**
   * Clear the queue (useful when rate limited)
   */
  clearQueue(): void {
    this.requestQueue = []
  }

  /**
   * Get status for debugging
   */
  getStatus(): Record<string, RateLimitState> {
    return Object.fromEntries(this.limits)
  }
}

// Singleton instance
export const rateLimitManager = new RateLimitManager()

