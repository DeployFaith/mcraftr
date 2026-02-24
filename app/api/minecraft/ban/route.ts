import { NextRequest } from 'next/server'
import { rconForRequest, getSessionUserId } from '@/lib/rcon'
import { logAudit } from '@/lib/audit'
import { getUserFeatures } from '@/lib/users'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const userId = await getSessionUserId(req)
  if (!userId) return Response.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
  if (!getUserFeatures(userId).enable_admin_moderation) return Response.json({ ok: false, error: 'Feature disabled by admin' }, { status: 403 })
  try {
    const { player, reason, banIp } = await req.json()
    if (!player || typeof player !== 'string') {
      return Response.json({ ok: false, error: 'Player name is required' }, { status: 400 })
    }
    if (!/^[a-zA-Z0-9_]{1,16}$/.test(player)) {
      return Response.json({ ok: false, error: 'Invalid player name' }, { status: 400 })
    }

    // Strip control characters (including newlines) and limit length to prevent injection
    const cleanReason = (reason?.trim() || '').replace(/[^\x20-\x7E]/g, '').slice(0, 255)
    const banCmd = cleanReason ? `ban ${player} ${cleanReason}` : `ban ${player}`

    const results = await Promise.all([
      rconForRequest(req, banCmd),
      ...(banIp ? [rconForRequest(req, `ban-ip ${player}`)] : []),
    ])

    const failed = results.filter(r => !r.ok)
    if (failed.length === results.length) {
      return Response.json({ ok: false, error: failed[0].error || 'Ban failed' })
    }

    logAudit(userId, 'ban', player, cleanReason || undefined)
    return Response.json({
      ok: true,
      message: `Banned ${player}${banIp ? ' (+ IP)' : ''}${cleanReason ? `: ${cleanReason}` : ''}`,
    })
  } catch (e: unknown) {
    return Response.json({ ok: false, error: e instanceof Error ? e.message : 'Server error' }, { status: 500 })
  }
}
