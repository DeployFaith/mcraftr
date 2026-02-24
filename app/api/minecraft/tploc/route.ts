import { NextRequest } from 'next/server'
import { rconForRequest, getSessionUserId, getUserFeatureFlags, checkFeatureAccess } from '@/lib/rcon'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const PLAYER_RE = /^[a-zA-Z0-9_]{1,16}$/

export async function POST(req: NextRequest) {
  const userId = await getSessionUserId(req)
  if (!userId) return Response.json({ ok: false, error: 'Unauthorized' }, { status: 401 })

  const features = await getUserFeatureFlags(req)
  if (!checkFeatureAccess(features, 'enable_teleport')) {
    return Response.json({ ok: false, error: 'Feature disabled by admin' }, { status: 403 })
  }

  try {
    const { player, x, y, z } = await req.json()
    if (!player || typeof player !== 'string') return Response.json({ ok: false, error: 'Missing player' }, { status: 400 })
    if (!PLAYER_RE.test(player)) return Response.json({ ok: false, error: 'Invalid player name' }, { status: 400 })
    if (x == null || y == null || z == null)   return Response.json({ ok: false, error: 'Missing coordinates' }, { status: 400 })

    const nx = Number(x), ny = Number(y), nz = Number(z)
    if (!Number.isFinite(nx) || !Number.isFinite(ny) || !Number.isFinite(nz)) {
      return Response.json({ ok: false, error: 'Coordinates must be numbers' }, { status: 400 })
    }

    const result = await rconForRequest(req, `tp ${player} ${nx} ${ny} ${nz}`)
    if (!result.ok) return Response.json({ ok: false, error: result.error || 'RCON error' })

    return Response.json({ ok: true, message: `Teleported ${player} → ${nx}, ${ny}, ${nz}` })
  } catch (e: unknown) {
    return Response.json({ ok: false, error: e instanceof Error ? e.message : 'Server error' }, { status: 500 })
  }
}
