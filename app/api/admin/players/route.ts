import { NextRequest } from 'next/server'
import { getToken } from 'next-auth/jwt'
import { getUserById, getUserFeatures } from '@/lib/users'
import { getDb } from '@/lib/db'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET, cookieName: 'authjs.session-token' })
  const userId = token?.id as string | undefined
  if (!userId) return Response.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
  const user = getUserById(userId)
  if (!user || user.role !== 'admin') return Response.json({ ok: false, error: 'Forbidden' }, { status: 403 })

  const features = getUserFeatures(userId)
  if (!features.enable_admin) return Response.json({ ok: false, error: 'Feature disabled by admin' }, { status: 403 })

  const filter = req.nextUrl.searchParams.get('filter') ?? '30d'

  let cutoff: number | null = null
  if (filter === '7d')  cutoff = Math.floor(Date.now() / 1000) - 7  * 24 * 3600
  if (filter === '30d') cutoff = Math.floor(Date.now() / 1000) - 30 * 24 * 3600

  const db = getDb()
  const rows = cutoff !== null
    ? db.prepare(
        'SELECT player_name, last_seen FROM player_directory WHERE user_id = ? AND last_seen >= ? ORDER BY last_seen DESC'
      ).all(userId, cutoff) as { player_name: string; last_seen: number }[]
    : db.prepare(
        'SELECT player_name, last_seen FROM player_directory WHERE user_id = ? ORDER BY last_seen DESC'
      ).all(userId) as { player_name: string; last_seen: number }[]

  return Response.json({ ok: true, players: rows })
}
