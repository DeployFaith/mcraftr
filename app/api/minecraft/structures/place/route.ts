import { NextRequest } from 'next/server'
import { checkFeatureAccess, getSessionActiveServerId, getSessionUserId, getUserFeatureFlags, rconForRequest } from '@/lib/rcon'
import { logAudit } from '@/lib/audit'
import { requireServerCapability } from '@/lib/server-capability'
import { createStructurePlacement } from '@/lib/structure-placements'
import { callSidecarForRequest, runBridgeJson } from '@/lib/server-bridge'
import type { BridgeErrorCode } from '@/lib/server-bridge'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type BridgeResponse = {
  ok: boolean
  world?: string
  origin?: { x: number; y: number; z: number }
  bounds?: { minX: number; minY: number; minZ: number; maxX: number; maxY: number; maxZ: number }
  error?: string
}

type PlayerLocateResponse = {
  ok: boolean
  world?: string
  location?: { x: number; y: number; z: number }
  error?: string
}

type StructureMetadataResponse = {
  ok: boolean
  dimensions?: { width: number | null; height: number | null; length: number | null } | null
}

function relayStructureFailureMessage(code: BridgeErrorCode | undefined, fallbackError?: string) {
  if (code === 'bridge_json_parse_failed') {
    return 'Relay-backed structure placement failed because the Relay response could not be parsed.'
  }
  if (code === 'bridge_non_json_response') {
    return 'Relay-backed structure placement failed because Relay did not return valid JSON.'
  }
  if (code === 'bridge_transport_failed') {
    return 'Relay-backed structure placement failed because Relay could not be reached over RCON.'
  }
  if (code === 'bridge_command_rejected' || code === 'bridge_invalid_prefix') {
    return 'Relay-backed structure placement failed because the server rejected the Relay command.'
  }
  return fallbackError || 'Relay-backed structure placement failed.'
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

function normalizeDimensions(dimensions: StructureMetadataResponse['dimensions']) {
  if (!dimensions) return null
  if (!isFiniteNumber(dimensions.width) || !isFiniteNumber(dimensions.height) || !isFiniteNumber(dimensions.length)) {
    return null
  }
  return {
    width: dimensions.width,
    height: dimensions.height,
    length: dimensions.length,
  }
}

async function loadStructureDimensions(req: NextRequest, bridgeRef: string) {
  const metadata = await callSidecarForRequest<StructureMetadataResponse>(
    req,
    `/structures/metadata?resourceKey=${encodeURIComponent(bridgeRef)}`,
  )
  return metadata.ok ? normalizeDimensions(metadata.data.dimensions) : null
}

async function resolvePlayerOrigin(req: NextRequest, player: string, expectedWorld?: string) {
  const locate = await runBridgeJson<PlayerLocateResponse>(req, `player locate ${player}`)
  if (!locate.ok || locate.data.ok === false || !locate.data.location || typeof locate.data.world !== 'string') {
    return null
  }
  if (expectedWorld && locate.data.world !== expectedWorld) {
    return null
  }
  return {
    world: locate.data.world,
    origin: locate.data.location,
  }
}

async function resolveTrackedPlacementFallback(
  req: NextRequest,
  options: {
    bridgeRef: string
    locationMode: 'coords' | 'player'
    player: string
    world: string
    x: number
    y: number
    z: number
    rotation: number
    bridgeWorld?: string | null
    bridgeOrigin?: BridgeResponse['origin']
    bridgeBounds?: BridgeResponse['bounds']
  },
) {
  if (
    options.bridgeWorld
    && options.bridgeOrigin
    && options.bridgeBounds
  ) {
    return {
      world: options.bridgeWorld,
      origin: options.bridgeOrigin,
      bounds: options.bridgeBounds,
    }
  }

  const dimensions = await loadStructureDimensions(req, options.bridgeRef)
  if (!dimensions) return null

  if (options.locationMode === 'coords') {
    const origin = { x: options.x, y: options.y, z: options.z }
    return {
      world: options.world,
      origin,
      bounds: boundsFromDimensions(origin, options.rotation, dimensions),
    }
  }

  const playerOrigin = await resolvePlayerOrigin(req, options.player, options.bridgeWorld ?? undefined)
  if (!playerOrigin) return null

  return {
    world: playerOrigin.world,
    origin: playerOrigin.origin,
    bounds: boundsFromDimensions(playerOrigin.origin, options.rotation, dimensions),
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
      return Response.json({ ok: false, placed: false, tracked: false, provider: 'vanilla-rcon', placementKind, error: placed.error || 'Failed to place native structure' }, { status: 502 })
    }

    if (placementKind === 'native-template' && userId && serverId) {
      const trackedPlacement = await resolveTrackedPlacementFallback(req, {
        bridgeRef,
        locationMode,
        player,
        world,
        x,
        y,
        z,
        rotation,
      })
      if (trackedPlacement) {
        const placementId = createStructurePlacement({
          userId,
          serverId,
          world: trackedPlacement.world,
          structureId,
          structureLabel,
          sourceKind,
          bridgeRef,
          origin: trackedPlacement.origin,
          rotation,
          includeAir,
          bounds: trackedPlacement.bounds,
          metadata: {
            placementKind,
            resourceKey: bridgeRef,
          },
        })
        logAudit(
          userId,
          'structure_place',
          structureLabel,
          `${trackedPlacement.world} @ ${trackedPlacement.origin.x},${trackedPlacement.origin.y},${trackedPlacement.origin.z}`,
          serverId,
        )
        return Response.json({ ok: true, placed: true, tracked: true, provider: 'vanilla-rcon', placementKind, placementId, world: trackedPlacement.world, origin: trackedPlacement.origin, bounds: trackedPlacement.bounds })
      }
    }

    if (locationMode === 'coords') {
      if (userId) {
        logAudit(userId, 'structure_place', structureLabel, `${world} @ ${x},${y},${z}`, serverId)
      }
      return Response.json({ ok: true, placed: true, tracked: false, provider: 'vanilla-rcon', placementKind, warning: 'Structure placed successfully, but precise tracked bounds could not be resolved.', world, origin: { x, y, z }, bounds: null })
    }

    return Response.json({ ok: true, placed: true, tracked: false, provider: 'vanilla-rcon', placementKind, warning: 'Structure placed successfully, but precise tracked bounds could not be resolved.', world: null, origin: null, bounds: null })
  }

  let command = `structures place ${bridgeRef} ${rotation} ${includeAir ? 'air' : 'noair'}`
  if (locationMode === 'player') {
    command += ` player ${player}`
  } else {
    command += ` coords ${world} ${x} ${y} ${z}`
  }

  const bridge = await runBridgeJson<BridgeResponse>(req, command)
  if (!bridge.ok || bridge.data.ok === false) {
    return Response.json({
      ok: false,
      placed: false,
      tracked: false,
      provider: 'relay',
      placementKind,
      failureCode: bridge.ok ? 'relay_place_failed' : bridge.code,
      error: bridge.ok ? bridge.data.error || 'Failed to place structure' : relayStructureFailureMessage(bridge.code, bridge.error),
    }, { status: 502 })
  }

  if (userId && serverId) {
    const trackedPlacement = await resolveTrackedPlacementFallback(req, {
      bridgeRef,
      locationMode,
      player,
      world,
      x,
      y,
      z,
      rotation,
      bridgeWorld: bridge.data.world ?? null,
      bridgeOrigin: bridge.data.origin,
      bridgeBounds: bridge.data.bounds,
    })
    if (trackedPlacement) {
    const placementId = createStructurePlacement({
      userId,
      serverId,
      world: trackedPlacement.world,
      structureId,
      structureLabel,
      sourceKind,
      bridgeRef,
      origin: trackedPlacement.origin,
      rotation,
      includeAir,
      bounds: trackedPlacement.bounds,
      metadata: {
        locationMode,
      },
    })
      logAudit(
        userId,
        'structure_place',
        structureLabel,
        `${trackedPlacement.world} @ ${trackedPlacement.origin.x},${trackedPlacement.origin.y},${trackedPlacement.origin.z}`,
        serverId,
      )
        return Response.json({ ok: true, placed: true, tracked: true, provider: 'relay', placementKind, placementId, world: trackedPlacement.world, origin: trackedPlacement.origin, bounds: trackedPlacement.bounds })
     }
   }

  return Response.json({ ok: true, placed: true, tracked: false, provider: 'relay', placementKind, warning: 'Structure placed successfully, but tracked bounds could not be resolved.', world: bridge.data.world ?? null, origin: bridge.data.origin ?? null, bounds: bridge.data.bounds ?? null })
}
