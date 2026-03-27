import { RateLimiterRedis, RateLimiterMemory, RateLimiterAbstract } from 'rate-limiter-flexible'
import { NextRequest } from 'next/server'

function isPublicDemo() {
  return process.env.MCRAFTR_PUBLIC_DEMO === 'true'
}

function isRateLimitingEnabled() {
  // Default to enabled for safety. Self-hosters can opt out explicitly.
  return process.env.MCRAFTR_DISABLE_RATE_LIMITING !== 'true'
}

// ── Redis client (lazy, singleton) ────────────────────────────────────────────

let _redisClient: import('ioredis').Redis | null = null

async function getRedisClient() {
  if (_redisClient) return _redisClient
  const { default: Redis } = await import('ioredis')
  const url = process.env.REDIS_URL || 'redis://localhost:6379'
  _redisClient = new Redis(url, { enableOfflineQueue: false, lazyConnect: true })
  try {
    await _redisClient.connect()
  } catch {
    // Will fall back to memory limiter
    _redisClient = null
  }
  return _redisClient
}

// ── Limiter factory ───────────────────────────────────────────────────────────
// Falls back to in-memory if Redis isn't available (dev / cold start).

type LimiterKey = 'register' | 'login' | 'account' | 'rcon' | 'inventory' | 'broadcast'

const PUBLIC_DEMO_LIMITS: Record<LimiterKey, { points: number; duration: number }> = {
  register: { points: 5, duration: 15 * 60 }, // 5 attempts per 15 min
  login: { points: 10, duration: 15 * 60 }, // 10 attempts per 15 min
  account: { points: 5, duration: 15 * 60 }, // 5 attempts per 15 min
  rcon: { points: 300, duration: 60 }, // 300 RCON commands per 60s per user (admin panel use)
  inventory: { points: 500, duration: 60 }, // per-slot inventory fetches (up to ~120 calls/fetch)
  broadcast: { points: 10, duration: 60 }, // 10 broadcasts per 60s
}

const SELF_HOST_LIMITS: Record<LimiterKey, { points: number; duration: number }> = {
  register: { points: 20, duration: 15 * 60 }, // gentle default for self-hosting
  login: { points: 30, duration: 15 * 60 },
  account: { points: 20, duration: 15 * 60 },
  rcon: { points: 1200, duration: 60 },
  inventory: { points: 1500, duration: 60 },
  broadcast: { points: 30, duration: 60 },
}

function getLimits() {
  return isPublicDemo() ? PUBLIC_DEMO_LIMITS : SELF_HOST_LIMITS
}

const _limiters = new Map<string, RateLimiterAbstract>()

async function getLimiter(key: LimiterKey): Promise<RateLimiterAbstract> {
  const limits = getLimits()
  const profile = isPublicDemo() ? 'demo' : 'selfhost'
  const cacheKey = `${profile}:${key}`
  if (_limiters.has(cacheKey)) return _limiters.get(cacheKey)!

  const opts = limits[key]
  const redis = await getRedisClient()

  const limiter = redis
    ? new RateLimiterRedis({ storeClient: redis, keyPrefix: `mcraftr:rl:${cacheKey}`, ...opts })
    : new RateLimiterMemory({ keyPrefix: `mcraftr:rl:${cacheKey}`, ...opts })

  _limiters.set(cacheKey, limiter)
  return limiter
}

// ── Public helper ─────────────────────────────────────────────────────────────

export type RateLimitResult =
  | { limited: false }
  | { limited: true; retryAfter: number; response: Response }

/**
 * Check rate limit for a request.
 * @param req     - Incoming NextRequest
 * @param key     - Which limiter to use
 * @param userId  - Optional user ID to key on (falls back to IP)
 */
export async function checkRateLimit(
  req: NextRequest,
  key: LimiterKey,
  userId?: string,
): Promise<RateLimitResult> {
  if (!isRateLimitingEnabled()) {
    return { limited: false }
  }

  const limits = getLimits()
  const limiter = await getLimiter(key)
  // Use the rightmost entry in X-Forwarded-For — the last hop added by a
  // trusted proxy. The leftmost entry is client-controlled and trivially
  // spoofable, making it useless for rate limiting.
  const xffHeader = req.headers.get('x-forwarded-for')
  const ip = xffHeader
    ? xffHeader.split(',').at(-1)!.trim()
    : (req.headers.get('x-real-ip') ?? 'unknown')
  const rateLimitKey = userId ?? ip

  try {
    await limiter.consume(rateLimitKey)
    return { limited: false }
  } catch (err: unknown) {
    // RateLimiterRes is thrown when limit exceeded
    const retryAfter = Math.ceil(
      ((err as { msBeforeNext?: number }).msBeforeNext ?? 60_000) / 1000
    )
    return {
      limited: true,
      retryAfter,
      response: Response.json(
        { ok: false, error: 'Too many requests. Please try again later.' },
        {
          status: 429,
          headers: {
            'Retry-After': String(retryAfter),
            'X-RateLimit-Limit': String(limits[key].points),
            'X-RateLimit-Remaining': '0',
          },
        }
      ),
    }
  }
}
