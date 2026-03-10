import { NextRequest } from 'next/server'
import { getSessionUserId, getSessionActiveServerId, getUserFeatureFlags, checkFeatureAccess } from '@/lib/rcon'
import { checkRateLimit } from '@/lib/ratelimit'
import { logAudit } from '@/lib/audit'
import { getDb } from '@/lib/db'
import { runBridgeCommand } from '@/lib/server-bridge'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const userId = await getSessionUserId(req)
  if (!userId) return Response.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
  const serverId = await getSessionActiveServerId(req)
  if (!serverId) return Response.json({ ok: false, error: 'No active server selected' }, { status: 400 })

  const features = await getUserFeatureFlags(req)
  if (!checkFeatureAccess(features, 'enable_chat') || !checkFeatureAccess(features, 'enable_chat_write')) {
    return Response.json({ ok: false, error: 'Feature disabled by admin' }, { status: 403 })
  }

  const rl = await checkRateLimit(req, 'broadcast', userId)
  if (rl.limited) return rl.response

  try {
    const { message } = await req.json()
    if (!message || typeof message !== 'string') {
      return Response.json({ ok: false, error: 'Message is required' }, { status: 400 })
    }
    // Strip control characters and newlines; cap at 256 chars
    const clean = message.replace(/[^\x20-\x7E]/g, '').trim().slice(0, 256)
    if (!clean) {
      return Response.json({ ok: false, error: 'Message cannot be empty' }, { status: 400 })
    }

    const result = await runBridgeCommand(req, `broadcast ${clean}`)
    if (!result.ok) {
      console.warn('[mcraftr] /api/minecraft/broadcast failed', { error: result.error || 'RCON error' })
      return Response.json({ ok: false, error: result.error || 'RCON error', code: result.code }, { status: 502 })
    }

    logAudit(userId, 'broadcast', undefined, clean, serverId)
    try {
      getDb().prepare('INSERT INTO chat_log (user_id, server_id, type, player, message) VALUES (?, ?, ?, NULL, ?)').run(userId, serverId, 'broadcast', clean)
    } catch {}
    return Response.json({ ok: true, message: result.stdout || 'Broadcast sent' })
  } catch (e: unknown) {
    const error = e instanceof Error ? e.message : 'Server error'
    console.warn('[mcraftr] /api/minecraft/broadcast exception', { error })
    return Response.json({ ok: false, error }, { status: 500 })
  }
}
