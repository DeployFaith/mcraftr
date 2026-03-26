import { NextRequest } from 'next/server'
import { checkFeatureAccess, getSessionActiveServerId, getSessionUserId, getUserFeatureFlags, rconForRequest } from '@/lib/rcon'
import { logAudit } from '@/lib/audit'
import { requireServerCapability } from '@/lib/server-capability'
import { createStructurePlacement } from '@/lib/structure-placements'
import { callSidecarForRequest, runBridgeJson } from '@/lib/server-bridge'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type BridgeResponse = {
  ok: boolean
  world?: string
  origin?: { x: number; y: number; z: number }
  bounds?: { minX: number; minY: number; minZ: number; maxX: number; maxY: number; maxZ: number }
  error?: string
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

function rotationKeyword(rotation: number) {
  switch (rotation) {
    case 90: return 'clockwise_90'
    case 180: return 'clockwise_180'
    case 270: return 'counterclockwise_90'
    default: return 'none'
  }
}

function boundsFromDimensions(origin: { x: number; y: number; z: number }, rotation: number, dimensions: { width: number; height: number; length: number }) {
  const width = rotation === 90 || rotation === 270 ? dimensions.length : dimensions.width
  const length = rotation === 90 || rotation === 270 ? dimensions.width : dimensions.length
  return {
    minX: Math.floor(origin.x),
    minY: Math.floor(origin.y),
    minZ: Math.floor(origin.z),
    maxX: Math.floor(origin.x) + Math.max(1, width) - 1,
    maxY: Math.floor(origin.y) + Math.max(1, dimensions.height) - 1,
    maxZ: Math.floor(origin.z) + Math.max(1, length) - 1,
  }
}

export async function POST(req: NextRequest) {
  const userId = await getSessionUserId(req)
  const serverId = await getSessionActiveServerId(req)
  const features = await getUserFeatureFlags(req)
  if (!checkFeatureAccess(features, 'enable_structure_catalog')) {
    return Response.json({ ok: false, error: 'Feature disabled by admin' }, { status: 403 })
  }
  if (!checkFeatureAccess(features, 'enable_structure_place')) {
    return Response.json({ ok: false, error: 'Feature disabled by admin' }, { status: 403 })
  }

  const capability = await requireServerCapability(req, 'full')
  if (!capability.ok) return capability.response

  const body = await req.json()
  const structureId = typeof body.structureId === 'string' ? body.structureId.trim() : ''
  const structureLabel = typeof body.structureLabel === 'string' ? body.structureLabel.trim() : structureId
  const bridgeRef = typeof body.bridgeRef === 'string' ? body.bridgeRef.trim() : ''
  const sourceKind = typeof body.sourceKind === 'string' ? body.sourceKind.trim() : 'server'
  const placementKind = typeof body.placementKind === 'string' ? body.placementKind.trim() : 'schematic'
  const locationMode = body.locationMode === 'coords' ? 'coords' : 'player'
  const rotation = [0, 90, 180, 270].includes(Number(body.rotation)) ? Number(body.rotation) : 0
  const includeAir = body.includeAir === true

  if (!structureId || !bridgeRef) {
    return Response.json({ ok: false, error: 'Structure reference is required' }, { status: 400 })
  }

  const player = typeof body.player === 'string' ? body.player.trim() : ''
  const world = typeof body.world === 'string' ? body.world.trim() : ''
  const x = Number(body.x)
  const y = Number(body.y)
  const z = Number(body.z)
  if (locationMode === 'player' && !player) {
    return Response.json({ ok: false, error: 'Player target is required' }, { status: 400 })
  }
  if (locationMode === 'coords' && (!world || !isFiniteNumber(x) || !isFiniteNumber(y) || !isFiniteNumber(z))) {
    return Response.json({ ok: false, error: 'World and coordinates are required' }, { status: 400 })
  }

  if (placementKind === 'native-worldgen' || placementKind === 'native-template') {
    const vanillaCommand = placementKind === 'native-worldgen'
      ? (locationMode === 'player'
          ? `execute as ${player} at ${player} run place structure ${bridgeRef}`
          : `execute in ${world} run place structure ${bridgeRef} ${x} ${y} ${z}`)
      : (locationMode === 'player'
          ? `execute as ${player} at ${player} run place template ${bridgeRef} ~ ~ ~ ${rotationKeyword(rotation)} none 1.0 0`
          : `execute in ${world} run place template ${bridgeRef} ${x} ${y} ${z} ${rotationKeyword(rotation)} none 1.0 0`)
    const placed = await rconForRequest(req, vanillaCommand)
    if (!placed.ok) {
      return Response.json({ ok: false, error: placed.error || 'Failed to place native structure' }, { status: 502 })
    }

    if (placementKind === 'native-template' && userId && serverId && locationMode === 'coords') {
      const metadata = await callSidecarForRequest<{ ok: boolean; dimensions?: { width: number | null; height: number | null; length: number | null } | null }>(
        req,
        `/structures/metadata?resourceKey=${encodeURIComponent(bridgeRef)}`,
      )
      const dimensions = metadata.ok && metadata.data.dimensions
        && isFiniteNumber(metadata.data.dimensions.width)
        && isFiniteNumber(metadata.data.dimensions.height)
        && isFiniteNumber(metadata.data.dimensions.length)
        ? metadata.data.dimensions
        : null
      if (dimensions) {
        const origin = { x, y, z }
        const width = dimensions.width as number
        const height = dimensions.height as number
        const length = dimensions.length as number
        const bounds = boundsFromDimensions(origin, rotation, {
          width,
          height,
          length,
        })
        const placementId = createStructurePlacement({
          userId,
          serverId,
          world,
          structureId,
          structureLabel,
          sourceKind,
          bridgeRef,
          origin,
          rotation,
          includeAir,
          bounds,
          metadata: {
            placementKind,
            resourceKey: bridgeRef,
          },
        })
        logAudit(userId, 'structure_place', structureLabel, `${world} @ ${x},${y},${z}`, serverId)
        return Response.json({ ok: true, placementId, world, origin, bounds })
      }
    }

    if (locationMode === 'coords') {
      if (userId) {
        logAudit(userId, 'structure_place', structureLabel, `${world} @ ${x},${y},${z}`, serverId)
      }
      return Response.json({ ok: true, world, origin: { x, y, z }, bounds: null })
    }

    return Response.json({ ok: true, world: null, origin: null, bounds: null })
  }

  let command = `structures place ${bridgeRef} ${rotation} ${includeAir ? 'air' : 'noair'}`
  if (locationMode === 'player') {
    command += ` player ${player}`
  } else {
    command += ` coords ${world} ${x} ${y} ${z}`
  }

  const bridge = await runBridgeJson<BridgeResponse>(req, command)
  if (!bridge.ok || bridge.data.ok === false) {
    return Response.json({ ok: false, error: bridge.ok ? bridge.data.error || 'Failed to place structure' : bridge.error }, { status: 502 })
  }

  if (userId && serverId && bridge.data.world && bridge.data.origin && bridge.data.bounds) {
    const placementId = createStructurePlacement({
      userId,
      serverId,
      world: bridge.data.world,
      structureId,
      structureLabel,
      sourceKind,
      bridgeRef,
      origin: bridge.data.origin,
      rotation,
      includeAir,
      bounds: bridge.data.bounds,
      metadata: {
        locationMode,
      },
    })
    logAudit(userId, 'structure_place', structureLabel, `${bridge.data.world} @ ${bridge.data.origin.x},${bridge.data.origin.y},${bridge.data.origin.z}`, serverId)
    return Response.json({ ok: true, placementId, world: bridge.data.world, origin: bridge.data.origin, bounds: bridge.data.bounds })
  }

  return Response.json({ ok: true, world: bridge.data.world ?? null, origin: bridge.data.origin ?? null, bounds: bridge.data.bounds ?? null })
}
