import { NextRequest } from 'next/server'
import { checkFeatureAccess, getSessionActiveServerId, getSessionUserId, getUserFeatureFlags } from '@/lib/rcon'
import { logAudit } from '@/lib/audit'
import { requireServerCapability } from '@/lib/server-capability'
import { getStructurePlacementById, markStructurePlacementRemoved } from '@/lib/structure-placements'
import { runBridgeJson } from '@/lib/server-bridge'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type BridgeResponse = {
  ok: boolean
  world?: string | null
  kind?: string | null
  error?: string
}

async function removeTrackedFallback(req: NextRequest, placementId: string, serverId: string) {
  const placement = getStructurePlacementById(placementId, serverId)
  if (!placement || placement.removed_at) return null

  const isNative = placement.source_kind === 'native'
  const command = isNative
    ? `structures clear ${placement.world} ${placement.origin_x} ${placement.origin_y} ${placement.origin_z} ${placement.max_x - placement.min_x + 1} ${placement.max_y - placement.min_y + 1} ${placement.max_z - placement.min_z + 1} ${placement.rotation}`
    : `structures remove ${placement.bridge_ref} ${placement.world} ${placement.origin_x} ${placement.origin_y} ${placement.origin_z} ${placement.rotation} ${placement.include_air ? 'air' : 'noair'}`

  const bridge = await runBridgeJson<BridgeResponse>(req, command)
  if (!bridge.ok || bridge.data.ok === false) return null

  markStructurePlacementRemoved(placement.id, serverId)
  return { placement, world: bridge.data.world ?? placement.world }
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

  const { placementId, structureLabel, world } = await req.json().catch(() => ({})) as Record<string, unknown>
  if (!placementId || typeof placementId !== 'string') {
    return Response.json({ ok: false, error: 'Placement id is required' }, { status: 400 })
  }

  const bridge = await runBridgeJson<BridgeResponse>(req, `structures remove ${placementId}`)
  let resolvedWorld: string | null = null

  if (bridge.ok && bridge.data.ok !== false) {
    resolvedWorld = bridge.data.world ?? (typeof world === 'string' ? world : null)
  } else {
    const fallback = await removeTrackedFallback(req, placementId, serverId)
    if (!fallback) {
      return Response.json(
        { ok: false, error: bridge.ok ? bridge.data.error || 'Failed to remove structure' : bridge.error },
        { status: 502 },
      )
    }
    resolvedWorld = fallback.world
  }

  const userId = await getSessionUserId(req)
  if (userId) {
    logAudit(
      userId,
      'structure_remove',
      typeof structureLabel === 'string' && structureLabel.trim() ? structureLabel.trim() : placementId,
      resolvedWorld ?? placementId,
      serverId,
    )
  }

  return Response.json({ ok: true, placementId, world: resolvedWorld })
}
