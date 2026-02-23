import { NextRequest } from 'next/server'
import { getSessionUserId } from '@/lib/rcon'
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

  const since = parseInt(req.nextUrl.searchParams.get('since') ?? '0', 10)

  const rows = getDb().prepare(
    'SELECT id, type, player, message, ts FROM chat_log WHERE user_id = ? AND ts > ? ORDER BY ts ASC LIMIT 200'
  ).all(userId, since) as ChatEntry[]

  return Response.json({ ok: true, entries: rows })
}
