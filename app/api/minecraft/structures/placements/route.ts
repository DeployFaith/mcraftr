import { NextRequest } from 'next/server'
import { checkFeatureAccess, getSessionActiveServerId, getUserFeatureFlags } from '@/lib/rcon'
import { listStructurePlacements } from '@/lib/structure-placements'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const features = await getUserFeatureFlags(req)
  if (!checkFeatureAccess(features, 'enable_structure_catalog')) {
    return Response.json({ ok: false, error: 'Feature disabled by admin' }, { status: 403 })
  }

  const serverId = await getSessionActiveServerId(req)
  if (!serverId) {
    return Response.json({ ok: false, error: 'No active server selected' }, { status: 400 })
  }

  const world = req.nextUrl.searchParams.get('world') || undefined
  const x = req.nextUrl.searchParams.get('x')
  const y = req.nextUrl.searchParams.get('y')
  const z = req.nextUrl.searchParams.get('z')
  const location =
    world && x !== null && y !== null && z !== null
      ? { x: Number(x), y: Number(y), z: Number(z) }
      : undefined

  const placements = listStructurePlacements(serverId, world, location)
  return Response.json({ ok: true, placements })
}
