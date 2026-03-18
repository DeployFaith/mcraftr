import { RateLimiterMemory, RateLimiterRedis, type RateLimiterAbstract } from 'rate-limiter-flexible'
import type { NextRequest } from 'next/server'
import { getUserById } from '@/lib/users'
import { isDemoRestrictedUser } from '@/lib/demo-policy'

type DemoLimitKey =
  | 'entity_spawn_user'
  | 'entity_spawn_shared'
  | 'structure_place_user'
  | 'structure_place_shared'
  | 'world_spawn_user'
  | 'world_spawn_shared'

const LIMITS: Record<DemoLimitKey, { points: number; duration: number }> = {
  entity_spawn_user: { points: 96, duration: 60 },
  entity_spawn_shared: { points: 240, duration: 60 },
  structure_place_user: { points: 6, duration: 10 * 60 },
  structure_place_shared: { points: 20, duration: 10 * 60 },
  world_spawn_user: { points: 6, duration: 10 * 60 },
  world_spawn_shared: { points: 20, duration: 10 * 60 },
}

const FRIENDLY_MESSAGES: Record<DemoLimitKey, string> = {
  entity_spawn_user: 'Demo spawn limit reached. Please wait a minute before spawning more entities.',
  entity_spawn_shared: 'The shared demo world is at its current entity spawn limit. Try again shortly.',
  structure_place_user: 'Demo structure placement limit reached. Please wait before placing more structures.',
  structure_place_shared: 'The shared demo world is at its current structure placement limit. Try again shortly.',
  world_spawn_user: 'Demo world-spawn changes are temporarily rate limited. Please wait before changing spawn again.',
  world_spawn_shared: 'The shared demo world is at its current spawn-change limit. Try again shortly.',
}

let redisClient: import('ioredis').Redis | null = null
const limiters = new Map<DemoLimitKey, RateLimiterAbstract>()

async function getRedisClient() {
  if (redisClient) return redisClient
  const { default: Redis } = await import('ioredis')
  const url = process.env.REDIS_URL || 'redis://localhost:6379'
  redisClient = new Redis(url, { enableOfflineQueue: false, lazyConnect: true })
  try {
    await redisClient.connect()
  } catch {
    redisClient = null
  }
  return redisClient
}

async function getLimiter(key: DemoLimitKey) {
  if (limiters.has(key)) return limiters.get(key)!
  const redis = await getRedisClient()
  const opts = LIMITS[key]
  const limiter = redis
    ? new RateLimiterRedis({ storeClient: redis, keyPrefix: `mcraftr:demo:${key}`, ...opts })
    : new RateLimiterMemory({ keyPrefix: `mcraftr:demo:${key}`, ...opts })
  limiters.set(key, limiter)
  return limiter
}

async function consume(key: DemoLimitKey, bucket: string, points: number) {
  const limiter = await getLimiter(key)
  try {
    await limiter.consume(bucket, points)
    return null
  } catch (error) {
    const retryAfter = Math.ceil(((error as { msBeforeNext?: number }).msBeforeNext ?? 60_000) / 1000)
    return Response.json(
      { ok: false, error: FRIENDLY_MESSAGES[key] },
      { status: 429, headers: { 'Retry-After': String(retryAfter) } },
    )
  }
}

export async function enforceDemoGuardrails(
  userId: string | null | undefined,
  serverId: string | null | undefined,
  action: 'entity_spawn' | 'structure_place' | 'world_spawn',
  points = 1,
) {
  if (!userId || !serverId) return null
  const user = getUserById(userId)
  if (!isDemoRestrictedUser(user)) return null

  const userKey = `${action}_user` as DemoLimitKey
  const sharedKey = `${action}_shared` as DemoLimitKey
  const userResponse = await consume(userKey, userId, points)
  if (userResponse) return userResponse
  return consume(sharedKey, serverId, points)
}

export function getDemoCappedCount(userId: string | null | undefined, requested: number, cap: number) {
  if (!userId) return requested
  const user = getUserById(userId)
  return isDemoRestrictedUser(user) ? Math.min(cap, requested) : requested
}

export function getDemoSelfPlayerCookie(req: NextRequest) {
  return req.cookies.get('mcraftr.demo-self-player')?.value ?? null
}
