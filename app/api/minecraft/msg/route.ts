import { NextRequest } from 'next/server'
import { rconForRequest, getSessionUserId, getUserFeatureFlags, checkFeatureAccess } from '@/lib/rcon'
import { getDb } from '@/lib/db'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const PLAYER_RE = /^\.?[a-zA-Z0-9_]{1,16}$/

export async function POST(req: NextRequest) {
  const userId = await getSessionUserId(req)
  if (!userId) return Response.json({ ok: false, error: 'Unauthorized' }, { status: 401 })

  const features = await getUserFeatureFlags(req)
  if (!checkFeatureAccess(features, 'enable_chat') || !checkFeatureAccess(features, 'enable_chat_write')) {
    return Response.json({ ok: false, error: 'Feature disabled by admin' }, { status: 403 })
  }

  try {
    const { player, message } = await req.json()
    if (!player || !PLAYER_RE.test(player)) {
      return Response.json({ ok: false, error: 'Invalid player name' }, { status: 400 })
    }
    if (!message || typeof message !== 'string' || !message.trim()) {
      return Response.json({ ok: false, error: 'Message is required' }, { status: 400 })
    }
    const clean = message.replace(/[\x00-\x1f\x7f]/g, '').slice(0, 256)
    const result = await rconForRequest(req, `msg ${player} ${clean}`)
    if (!result.ok) return Response.json({ ok: false, error: result.error })
    try {
      getDb().prepare('INSERT INTO chat_log (user_id, type, player, message) VALUES (?, ?, ?, ?)').run(userId, 'msg', player, clean)
    } catch {}
    return Response.json({ ok: true, message: `Message sent to ${player}` })
  } catch (e: unknown) {
    return Response.json({ ok: false, error: e instanceof Error ? e.message : 'Server error' }, { status: 500 })
  }
}
