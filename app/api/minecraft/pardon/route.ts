import { NextRequest } from 'next/server'
import { rconForRequest, getSessionUserId } from '@/lib/rcon'
import { logAudit } from '@/lib/audit'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Optional leading dot for Bedrock/Geyser players (e.g. ".calico")
const PLAYER_RE = /^\.?[a-zA-Z0-9_]{1,16}$/

export async function POST(req: NextRequest) {
  const userId = await getSessionUserId(req)
  if (!userId) return Response.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
  try {
    const { player, pardonIp } = await req.json()
    if (!player || typeof player !== 'string') {
      return Response.json({ ok: false, error: 'Player name is required' }, { status: 400 })
    }
    if (!PLAYER_RE.test(player)) {
      return Response.json({ ok: false, error: 'Invalid player name' }, { status: 400 })
    }

    const results = await Promise.all([
      rconForRequest(req, `pardon ${player}`),
      ...(pardonIp ? [rconForRequest(req, `pardon-ip ${player}`)] : []),
    ])

    const failed = results.filter(r => !r.ok)
    if (failed.length === results.length) {
      return Response.json({ ok: false, error: failed[0].error || 'Pardon failed' })
    }

    logAudit(userId, 'pardon', player)
    return Response.json({
      ok: true,
      message: `Pardoned ${player}${pardonIp ? ' (+ IP)' : ''}`,
    })
  } catch (e: unknown) {
    return Response.json({ ok: false, error: e instanceof Error ? e.message : 'Server error' }, { status: 500 })
  }
}
