import { NextResponse } from 'next/server'
import { rateLimitManager } from '@/lib/rateLimit'

export async function GET() {
  try {
    const status = rateLimitManager.getStatus()
    const coreRemaining = rateLimitManager.getRemaining('core')
    const searchRemaining = rateLimitManager.getRemaining('search')
    const coreRateLimited = rateLimitManager.isRateLimited('core')
    const searchRateLimited = rateLimitManager.isRateLimited('search')
    const coreResetTime = rateLimitManager.getTimeUntilReset('core')
    const searchResetTime = rateLimitManager.getTimeUntilReset('search')

    return NextResponse.json({
      core: {
        remaining: coreRemaining,
        rateLimited: coreRateLimited,
        resetInSeconds: coreResetTime,
      },
      search: {
        remaining: searchRemaining,
        rateLimited: searchRateLimited,
        resetInSeconds: searchResetTime,
      },
      status,
    })
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to get rate limit status' },
      { status: 500 }
    )
  }
}

