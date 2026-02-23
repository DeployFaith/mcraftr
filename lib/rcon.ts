/**
 * rcon.ts — unified RCON helper for Mcraftr API routes
 *
 * All users connect directly via the RCON TCP protocol (rcon-client).
 */
import { Rcon } from 'rcon-client'
import { getUserById } from './users'
import { NextRequest } from 'next/server'
import { getToken } from 'next-auth/jwt'
import { checkRateLimit } from './ratelimit'

export type RconResult = {
  ok: boolean
  stdout: string
  error?: string
}

// ── Direct RCON path ──────────────────────────────────────────────────────────

async function rconDirect(
  host: string,
  port: number,
  password: string,
  cmd: string
): Promise<RconResult> {
  const client = new Rcon({ host, port, password, timeout: 6000 })
  try {
    await client.connect()
    const stdout = await client.send(cmd)
    // Strip Minecraft color/formatting codes (§ followed by any char)
    return { ok: true, stdout: stdout.replace(/§./g, '').trim() }
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'RCON error'
    return { ok: false, stdout: '', error: msg }
  } finally {
    try { await client.end() } catch { /* ignore */ }
  }
}

// ── Auth helper — verify JWT and return userId, or null ───────────────────────

export async function getSessionUserId(req: NextRequest): Promise<string | null> {
  const token = await getToken({
    req,
    secret: process.env.NEXTAUTH_SECRET,
    cookieName: 'authjs.session-token',
  })
  const userId = token?.id as string | undefined
  return userId ?? null
}

// ── Public helper — resolves auth, rate-limits, dispatches RCON ──────────────

export async function rconForRequest(req: NextRequest, cmd: string): Promise<RconResult> {
  const token = await getToken({
    req,
    secret: process.env.NEXTAUTH_SECRET,
    cookieName: 'authjs.session-token',
  })
  const userId = token?.id as string | undefined

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

  if (!user.server) {
    return { ok: false, stdout: '', error: 'No server configured' }
  }

  return rconDirect(user.server.host, user.server.port, user.server.password, cmd)
}

// ── Test a connection without saving it ──────────────────────────────────────

export async function testRconConnection(
  host: string,
  port: number,
  password: string
): Promise<RconResult> {
  return rconDirect(host, port, password, 'list')
}
