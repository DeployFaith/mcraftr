import { NextRequest } from 'next/server'
import { logAudit } from '@/lib/audit'
import { checkFeatureAccess, getSessionActiveServerId, getSessionUserId, getUserFeatureFlags } from '@/lib/rcon'
import { requireServerCapability } from '@/lib/server-capability'
import { runBridgeJson } from '@/lib/server-bridge'
import { listAllStructurePlacements, markStructurePlacementRemoved, type StructurePlacement } from '@/lib/structure-placements'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type BridgeResponse = {
  ok: boolean
  world?: string
  error?: string
}

async function removeTrackedPlacement(req: NextRequest, placement: StructurePlacement) {
  const isNative = placement.source_kind === 'native'
  if (isNative) {
    const width = placement.max_x - placement.min_x + 1
    const height = placement.max_y - placement.min_y + 1
    const length = placement.max_z - placement.min_z + 1
    return runBridgeJson<BridgeResponse>(
      req,
      `structures clear ${placement.world} ${placement.origin_x} ${placement.origin_y} ${placement.origin_z} ${width} ${height} ${length} ${placement.rotation}`,
    )
  }
  return runBridgeJson<BridgeResponse>(
    req,
    `structures remove ${placement.bridge_ref} ${placement.world} ${placement.origin_x} ${placement.origin_y} ${placement.origin_z} ${placement.rotation} ${placement.include_air ? 'air' : 'noair'}`,
  )
}

export async function POST(req: NextRequest) {
  const features = await getUserFeatureFlags(req)
  if (!checkFeatureAccess(features, 'enable_structure_catalog')) {
    return Response.json({ ok: false, error: 'Feature disabled by admin' }, { status: 403 })
  }
  if (!checkFeatureAccess(features, 'enable_structure_remove')) {
    return Response.json({ ok: false, error: 'Feature disabled by admin' }, { status: 403 })
  }

  const capability = await requireServerCapability(req, 'full')
  if (!capability.ok) return capability.response

  const serverId = await getSessionActiveServerId(req)
  if (!serverId) {
    return Response.json({ ok: false, error: 'No active server selected' }, { status: 400 })
  }

  const body = await req.json().catch(() => ({}))
  const world = typeof body.world === 'string' && body.world.trim() ? body.world.trim() : undefined
  const placements = listAllStructurePlacements(serverId, world)

  if (placements.length === 0) {
    return Response.json({ ok: true, removedCount: 0, failedCount: 0, world: world ?? null })
  }

  let removedCount = 0
  for (const placement of placements) {
    const bridge = await removeTrackedPlacement(req, placement)
    if (bridge.ok && bridge.data.ok !== false) {
      markStructurePlacementRemoved(placement.id, serverId)
      removedCount += 1
    }
  }

  if (removedCount === 0) {
    return Response.json({ ok: false, error: 'Failed to remove any tracked structures' }, { status: 502 })
  }

  const failedCount = placements.length - removedCount
  const userId = await getSessionUserId(req)
  if (userId) {
    logAudit(
      userId,
      'structure_clear',
      world ?? 'all-tracked-placements',
      `${removedCount} tracked structure placement${removedCount === 1 ? '' : 's'} removed${failedCount > 0 ? ` (${failedCount} failed)` : ''}`,
      serverId,
    )
  }

  return Response.json({
    ok: true,
    removedCount,
    failedCount,
    world: world ?? null,
    warning: failedCount > 0 ? `${failedCount} tracked placements could not be removed.` : null,
  })
}
