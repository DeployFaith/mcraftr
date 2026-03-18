import { NextRequest } from 'next/server'
import { getUserById, getUserFeatures } from '@/lib/users'
import { getDb } from '@/lib/db'
import { getDemoReadonlyAccess, requireAdminReadable } from '@/lib/demo-readonly'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const auth = requireAdminReadable(await getDemoReadonlyAccess(req))
  if (!auth.ok) return auth.response
  const { access } = auth
  const userId = access.userId
  const serverId = access.serverId
  if (!serverId) return Response.json({ ok: false, error: 'No active server' }, { status: 400 })

  const features = getUserFeatures(userId)
  if (!access.demoReadOnly && !features.enable_admin_moderation && !features.enable_admin_whitelist && !features.enable_admin_operator) {
    return Response.json({ ok: false, error: 'Feature disabled by admin' }, { status: 403 })
  }

  const filter = req.nextUrl.searchParams.get('filter') ?? '30d'

  let cutoff: number | null = null
  if (filter === '7d')  cutoff = Math.floor(Date.now() / 1000) - 7  * 24 * 3600
  if (filter === '30d') cutoff = Math.floor(Date.now() / 1000) - 30 * 24 * 3600

  const db = getDb()
  const rows = cutoff !== null
    ? db.prepare(
        'SELECT player_name, last_seen FROM player_directory WHERE user_id = ? AND server_id = ? AND last_seen >= ? ORDER BY last_seen DESC'
      ).all(userId, serverId, cutoff) as { player_name: string; last_seen: number }[]
    : db.prepare(
        'SELECT player_name, last_seen FROM player_directory WHERE user_id = ? AND server_id = ? ORDER BY last_seen DESC'
      ).all(userId, serverId) as { player_name: string; last_seen: number }[]

  return Response.json({ ok: true, players: rows, readOnly: access.demoReadOnly })
}
