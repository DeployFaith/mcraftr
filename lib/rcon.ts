/**
 * rcon.ts — unified RCON helper for Mcraftr API routes
 *
 * All users connect directly via the RCON TCP protocol (rcon-client).
 */
import { rconDirect, type RconResult } from './rcon-client'
import { getActiveServer, getUserByEmail, getUserById, getUserFeatures, type UserFeatures } from './users'
import { NextRequest } from 'next/server'
import { getToken } from 'next-auth/jwt'
import { checkRateLimit } from './ratelimit'

async function resolveSessionUser(req: NextRequest): Promise<{ userId: string | null; activeServerId: string | null }> {
  const token = await getToken({
    req,
    secret: process.env.NEXTAUTH_SECRET,
    cookieName: 'authjs.session-token',
  })

  const tokenUserId = typeof token?.id === 'string' ? token.id : null
  if (tokenUserId) {
    const user = getUserById(tokenUserId)
    if (user) {
      return {
        userId: user.id,
        activeServerId: (typeof token?.activeServerId === 'string' ? token.activeServerId : null) ?? user.activeServerId ?? null,
      }
    }
  }

  const tokenEmail = typeof token?.email === 'string' ? token.email.trim().toLowerCase() : null
  if (!tokenEmail) {
    return { userId: null, activeServerId: null }
  }

  const user = getUserByEmail(tokenEmail)
  if (!user) {
    return { userId: null, activeServerId: null }
  }

  return {
    userId: user.id,
    activeServerId: user.activeServerId ?? null,
  }
}

// ── Feature flag helpers ─────────────────────────────────────────────────────────

export async function getUserFeatureFlags(req: NextRequest): Promise<UserFeatures | null> {
  const { userId } = await resolveSessionUser(req)
  if (!userId) return null
  return getUserFeatures(userId)
}

export function checkFeatureAccess(features: UserFeatures | null, feature: keyof UserFeatures): boolean {
  if (!features) return true
  return features[feature]
}

// ── Auth helper — verify JWT and return userId, or null ───────────────────────

export async function getSessionUserId(req: NextRequest): Promise<string | null> {
  const { userId } = await resolveSessionUser(req)
  return userId
}

export async function getSessionActiveServerId(req: NextRequest): Promise<string | null> {
  const { activeServerId } = await resolveSessionUser(req)
  return activeServerId
}

// ── Public helper — resolves auth, rate-limits, dispatches RCON ──────────────

export async function rconForRequest(req: NextRequest, cmd: string): Promise<RconResult> {
  const { userId } = await resolveSessionUser(req)

  if (!userId) {
    return { ok: false, stdout: '', error: 'Not authenticated' }
  }

  // Rate-limit RCON commands per authenticated user (30 per 60s)
  const rl = await checkRateLimit(req, 'rcon', userId)
  if (rl.limited) {
    return { ok: false, stdout: '', error: 'Too many requests. Please try again later.' }
  }

  const user = getUserById(userId)
  if (!user) {
    return { ok: false, stdout: '', error: 'User not found' }
  }

  const activeServer = getActiveServer(userId)
  if (!activeServer) {
    return { ok: false, stdout: '', error: 'No server configured' }
  }

  return rconDirect(activeServer.host, activeServer.port, activeServer.password, cmd)
}

// ── Test a connection without saving it ──────────────────────────────────────

export async function testRconConnection(
  host: string,
  port: number,
  password: string
): Promise<RconResult> {
  return rconDirect(host, port, password, 'list')
}
