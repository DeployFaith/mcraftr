import { NextRequest } from 'next/server'
import { checkFeatureAccess, getSessionActiveServerId, getSessionUserId, getUserFeatureFlags } from '@/lib/rcon'
import { logAudit } from '@/lib/audit'
import { getStructurePlacementById, markStructurePlacementRemoved } from '@/lib/structure-placements'
import { runFgmcJson } from '@/lib/world-stack'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type BridgeResponse = {
  ok: boolean
  world?: string
  error?: string
}

export async function POST(req: NextRequest) {
  const features = await getUserFeatureFlags(req)
  if (!checkFeatureAccess(features, 'enable_structure_catalog')) {
    return Response.json({ ok: false, error: 'Feature disabled by admin' }, { status: 403 })
  }

  const serverId = await getSessionActiveServerId(req)
  if (!serverId) {
    return Response.json({ ok: false, error: 'No active server selected' }, { status: 400 })
  }

  const { placementId } = await req.json()
  if (!placementId || typeof placementId !== 'string') {
    return Response.json({ ok: false, error: 'Placement id is required' }, { status: 400 })
  }

  const placement = getStructurePlacementById(placementId, serverId)
  if (!placement || placement.removed_at) {
    return Response.json({ ok: false, error: 'Placement was not found' }, { status: 404 })
  }

  const isNative = placement.source_kind === 'native'
  if (isNative) {
    const width = placement.max_x - placement.min_x + 1
    const height = placement.max_y - placement.min_y + 1
    const length = placement.max_z - placement.min_z + 1
    const command = `structures clear ${placement.world} ${placement.origin_x} ${placement.origin_y} ${placement.origin_z} ${width} ${height} ${length} ${placement.rotation}`
    const bridge = await runFgmcJson<BridgeResponse>(req, command)
    if (!bridge.ok || bridge.data.ok === false) {
      return Response.json({ ok: false, error: bridge.ok ? bridge.data.error || 'Failed to remove native structure' : bridge.error }, { status: 502 })
    }
  } else {
    const command = `structures remove ${placement.bridge_ref} ${placement.world} ${placement.origin_x} ${placement.origin_y} ${placement.origin_z} ${placement.rotation} ${placement.include_air ? 'air' : 'noair'}`
    const bridge = await runFgmcJson<BridgeResponse>(req, command)
    if (!bridge.ok || bridge.data.ok === false) {
      return Response.json({ ok: false, error: bridge.ok ? bridge.data.error || 'Failed to remove structure' : bridge.error }, { status: 502 })
    }
  }

  markStructurePlacementRemoved(placement.id, serverId)
  const userId = await getSessionUserId(req)
  if (userId) {
    logAudit(userId, 'structure_remove', placement.structure_label, `${placement.world} @ ${placement.origin_x},${placement.origin_y},${placement.origin_z}`, serverId)
  }

  return Response.json({ ok: true, placementId: placement.id, world: placement.world })
}
