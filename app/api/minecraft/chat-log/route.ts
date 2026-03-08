import { NextRequest } from 'next/server'
import { getSessionActiveServerId, getSessionUserId, getUserFeatureFlags, checkFeatureAccess } from '@/lib/rcon'
import { getDb } from '@/lib/db'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export type ChatEntry = {
  id: number
  type: 'broadcast' | 'msg'
  player: string | null
  message: string
  ts: number
}

export async function GET(req: NextRequest) {
  const userId = await getSessionUserId(req)
  if (!userId) return Response.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
  const serverId = await getSessionActiveServerId(req)
  if (!serverId) return Response.json({ ok: false, error: 'No active server' }, { status: 400 })

  const features = await getUserFeatureFlags(req)
  if (!checkFeatureAccess(features, 'enable_chat') || !checkFeatureAccess(features, 'enable_chat_read')) {
    return Response.json({ ok: false, error: 'Feature disabled by admin' }, { status: 403 })
  }

  const since = parseInt(req.nextUrl.searchParams.get('since') ?? '0', 10)

  const rows = getDb().prepare(
    'SELECT id, type, player, message, ts FROM chat_log WHERE user_id = ? AND server_id = ? AND ts > ? ORDER BY ts ASC LIMIT 200'
  ).all(userId, serverId, since) as ChatEntry[]

  return Response.json({ ok: true, entries: rows })
}

export async function DELETE(req: NextRequest) {
  const userId = await getSessionUserId(req)
  if (!userId) return Response.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
  const serverId = await getSessionActiveServerId(req)
  if (!serverId) return Response.json({ ok: false, error: 'No active server' }, { status: 400 })

  const features = await getUserFeatureFlags(req)
  if (!checkFeatureAccess(features, 'enable_chat') || !checkFeatureAccess(features, 'enable_chat_read')) {
    return Response.json({ ok: false, error: 'Feature disabled by admin' }, { status: 403 })
  }

  try {
    const body = await req.json().catch(() => ({}))
    const clearAll = !!body?.clearAll

    if (clearAll) {
      const result = getDb().prepare('DELETE FROM chat_log WHERE user_id = ? AND server_id = ?').run(userId, serverId)
      return Response.json({ ok: true, deleted: result.changes })
    }

    const id = Number(body?.id)
    if (!Number.isInteger(id) || id < 1) {
      return Response.json({ ok: false, error: 'Invalid chat entry id' }, { status: 400 })
    }

    const result = getDb().prepare('DELETE FROM chat_log WHERE user_id = ? AND server_id = ? AND id = ?').run(userId, serverId, id)
    if (result.changes === 0) {
      return Response.json({ ok: false, error: 'Chat entry not found' }, { status: 404 })
    }

    return Response.json({ ok: true })
  } catch (e: unknown) {
    return Response.json({ ok: false, error: e instanceof Error ? e.message : 'Server error' }, { status: 500 })
  }
}
