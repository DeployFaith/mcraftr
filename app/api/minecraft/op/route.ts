import { NextRequest } from 'next/server'
import { rconForRequest, getSessionUserId } from '@/lib/rcon'
import { getUserById } from '@/lib/users'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Optional leading dot for Bedrock/Geyser players (e.g. ".calico")
const PLAYER_RE = /^\.?[a-zA-Z0-9_]{1,16}$/

export async function POST(req: NextRequest) {
  const userId = await getSessionUserId(req)
  if (!userId) return Response.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
  // op/deop grants full server operator privileges — admin only
  if (getUserById(userId)?.role !== 'admin') {
    return Response.json({ ok: false, error: 'Admin role required' }, { status: 403 })
  }
  try {
    const { player, action } = await req.json()
    if (!player || typeof player !== 'string') {
      return Response.json({ ok: false, error: 'Player name is required' }, { status: 400 })
    }
    if (!PLAYER_RE.test(player)) {
      return Response.json({ ok: false, error: 'Invalid player name' }, { status: 400 })
    }
    if (action !== 'op' && action !== 'deop') {
      return Response.json({ ok: false, error: 'Action must be "op" or "deop"' }, { status: 400 })
    }

    const result = await rconForRequest(req, `${action} ${player}`)
    if (!result.ok) return Response.json({ ok: false, error: result.error || 'RCON error' })

    return Response.json({
      ok: true,
      message: action === 'op' ? `Made ${player} an operator` : `Removed operator from ${player}`,
    })
  } catch (e: unknown) {
    return Response.json({ ok: false, error: e instanceof Error ? e.message : 'Server error' }, { status: 500 })
  }
}
