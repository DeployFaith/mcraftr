import { NextRequest } from 'next/server'
import { rconForRequest, getSessionUserId, getUserFeatureFlags, checkFeatureAccess } from '@/lib/rcon'
import { getUserById } from '@/lib/users'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Raw RCON console — admin only.
// Uses the standard rcon rate limiter (30 cmds/60s per user).
// The security agent can add a dedicated stricter limiter if desired.

export async function POST(req: NextRequest) {
  const userId = await getSessionUserId(req)
  if (!userId) return Response.json({ ok: false, error: 'Unauthorized' }, { status: 401 })

  const features = await getUserFeatureFlags(req)
  if (!checkFeatureAccess(features, 'enable_rcon')) {
    return Response.json({ ok: false, error: 'Feature disabled by admin' }, { status: 403 })
  }

  // Admin-only gate
  const user = getUserById(userId)
  if (!user || user.role !== 'admin') {
    return Response.json({ ok: false, error: 'Admin access required' }, { status: 403 })
  }

  try {
    const { command } = await req.json()
    if (!command || typeof command !== 'string') {
      return Response.json({ ok: false, error: 'Command is required' }, { status: 400 })
    }
    const cmd = command.trim()
    if (!cmd) {
      return Response.json({ ok: false, error: 'Command cannot be empty' }, { status: 400 })
    }
    if (cmd.length > 256) {
      return Response.json({ ok: false, error: 'Command too long (max 256 chars)' }, { status: 400 })
    }

    const result = await rconForRequest(req, cmd)
    if (!result.ok) return Response.json({ ok: false, error: result.error || 'RCON error' })

    return Response.json({ ok: true, output: result.stdout || '(no output)' })
  } catch (e: unknown) {
    return Response.json({ ok: false, error: e instanceof Error ? e.message : 'Server error' }, { status: 500 })
  }
}
