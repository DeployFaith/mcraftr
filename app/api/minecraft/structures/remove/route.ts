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

type RelayStructuresResponse = {
  ok: boolean
  items?: Array<{ id?: string }>
  error?: string
}

async function removeTrackedFallback(req: NextRequest, placementId: string, serverId: string) {
  const placement = getStructurePlacementById(placementId, serverId)
  if (!placement || placement.removed_at) return null

  const isNative = placement.source_kind === 'native'
  const command = isNative
    ? `execute in ${placement.world} run fill ${placement.min_x} ${placement.min_y} ${placement.min_z} ${placement.max_x} ${placement.max_y} ${placement.max_z} minecraft:air replace`
    : `structures remove ${placement.bridge_ref} ${placement.world} ${placement.origin_x} ${placement.origin_y} ${placement.origin_z} ${placement.rotation} ${placement.include_air ? 'air' : 'noair'}`

  const bridge = await runBridgeJson<BridgeResponse>(req, command)
  if (!bridge.ok || bridge.data.ok === false) return null
  return { placement, world: bridge.data.world ?? placement.world }
}

async function verifyStructureRemoved(req: NextRequest, placementId: string, serverId: string, world: string | null, origin?: { x: number; y: number; z: number } | null) {
  const tracked = getStructurePlacementById(placementId, serverId)
  if (tracked && !tracked.removed_at) return false
  if (!world || !origin) return false
  const radius = 4
  const command = origin
    ? `structures list ${world} radius ${origin.x} ${origin.y} ${origin.z} ${radius}`
    : `structures list ${world}`
  const bridge = await runBridgeJson<RelayStructuresResponse>(req, command)
  if (!bridge.ok || bridge.data.ok === false) return false
  const items = Array.isArray(bridge.data.items) ? bridge.data.items : []
  return !items.some(item => item.id === placementId)
}

async function removePlacementFromPayload(req: NextRequest, payload: {
  sourceKind: string | null
  bridgeRef: string | null
  world: string | null
  originX: number | null
  originY: number | null
  originZ: number | null
  minX: number | null
  minY: number | null
  minZ: number | null
  maxX: number | null
  maxY: number | null
  maxZ: number | null
  rotation: number | null
  includeAir: boolean
}) {
  if (!payload.world || payload.originX === null || payload.originY === null || payload.originZ === null || payload.rotation === null) return null
  if (payload.sourceKind === 'native') {
    if (payload.minX === null || payload.minY === null || payload.minZ === null || payload.maxX === null || payload.maxY === null || payload.maxZ === null) return null
    const command = `execute in ${payload.world} run fill ${payload.minX} ${payload.minY} ${payload.minZ} ${payload.maxX} ${payload.maxY} ${payload.maxZ} minecraft:air replace`
    const bridge = await runBridgeJson<BridgeResponse>(req, command)
    if (!bridge.ok || bridge.data.ok === false) return null
    return { world: bridge.data.world ?? payload.world }
  }
  if (!payload.bridgeRef) return null
  const command = `structures remove ${payload.bridgeRef} ${payload.world} ${payload.originX} ${payload.originY} ${payload.originZ} ${payload.rotation} ${payload.includeAir ? 'air' : 'noair'}`
  const bridge = await runBridgeJson<BridgeResponse>(req, command)
  if (!bridge.ok || bridge.data.ok === false) return null
  return { world: bridge.data.world ?? payload.world }
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

  const body = await req.json().catch(() => ({})) as Record<string, unknown>
  const { placementId, structureLabel, world } = body
  if (!placementId || typeof placementId !== 'string') {
    return Response.json({ ok: false, error: 'Placement id is required' }, { status: 400 })
  }

  const bridge = await runBridgeJson<BridgeResponse>(req, `structures remove ${placementId}`)
  let resolvedWorld: string | null = null
  const origin = typeof body.originX === 'number' && typeof body.originY === 'number' && typeof body.originZ === 'number'
    ? { x: body.originX, y: body.originY, z: body.originZ }
    : null

  if (bridge.ok && bridge.data.ok !== false) {
    resolvedWorld = bridge.data.world ?? (typeof world === 'string' ? world : null)
    const verified = await verifyStructureRemoved(req, placementId, serverId, resolvedWorld, origin)
    if (!verified) {
      const trackedFallback = await removeTrackedFallback(req, placementId, serverId)
      const payloadFallback = trackedFallback ?? await removePlacementFromPayload(req, {
        sourceKind: typeof body.sourceKind === 'string' ? body.sourceKind : null,
        bridgeRef: typeof body.bridgeRef === 'string' && body.bridgeRef.trim() ? body.bridgeRef.trim() : null,
        world: typeof world === 'string' ? world.trim() : null,
        originX: typeof body.originX === 'number' ? body.originX : null,
        originY: typeof body.originY === 'number' ? body.originY : null,
        originZ: typeof body.originZ === 'number' ? body.originZ : null,
        minX: typeof body.minX === 'number' ? body.minX : null,
        minY: typeof body.minY === 'number' ? body.minY : null,
        minZ: typeof body.minZ === 'number' ? body.minZ : null,
        maxX: typeof body.maxX === 'number' ? body.maxX : null,
        maxY: typeof body.maxY === 'number' ? body.maxY : null,
        maxZ: typeof body.maxZ === 'number' ? body.maxZ : null,
        rotation: typeof body.rotation === 'number' ? body.rotation : null,
        includeAir: body.includeAir === true || body.includeAir === 1,
      })
      if (!payloadFallback) {
        return Response.json({ ok: false, error: 'Structure removal command completed, but the placement is still present.' }, { status: 409 })
      }
      resolvedWorld = payloadFallback.world
    }
    markStructurePlacementRemoved(placementId, serverId)
  } else {
    const fallback = await removeTrackedFallback(req, placementId, serverId)
    const payloadFallback = fallback ?? await removePlacementFromPayload(req, {
      sourceKind: typeof body.sourceKind === 'string' ? body.sourceKind : null,
      bridgeRef: typeof body.bridgeRef === 'string' && body.bridgeRef.trim() ? body.bridgeRef.trim() : null,
      world: typeof world === 'string' ? world.trim() : null,
      originX: typeof body.originX === 'number' ? body.originX : null,
      originY: typeof body.originY === 'number' ? body.originY : null,
      originZ: typeof body.originZ === 'number' ? body.originZ : null,
      minX: typeof body.minX === 'number' ? body.minX : null,
      minY: typeof body.minY === 'number' ? body.minY : null,
      minZ: typeof body.minZ === 'number' ? body.minZ : null,
      maxX: typeof body.maxX === 'number' ? body.maxX : null,
      maxY: typeof body.maxY === 'number' ? body.maxY : null,
      maxZ: typeof body.maxZ === 'number' ? body.maxZ : null,
      rotation: typeof body.rotation === 'number' ? body.rotation : null,
      includeAir: body.includeAir === true || body.includeAir === 1,
    })
    if (!payloadFallback) {
      return Response.json(
        { ok: false, error: bridge.ok ? bridge.data.error || 'Failed to remove structure. This placement may not have been tracked precisely enough for automated removal.' : bridge.error || 'Failed to remove structure. This placement may not have been tracked precisely enough for automated removal.' },
        { status: 502 },
      )
    }
    resolvedWorld = payloadFallback.world
    markStructurePlacementRemoved(placementId, serverId)
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
