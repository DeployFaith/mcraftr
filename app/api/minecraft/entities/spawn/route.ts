import { NextRequest } from 'next/server'
import { checkFeatureAccess, getSessionActiveServerId, getSessionUserId, getUserFeatureFlags, rconForRequest } from '@/lib/rcon'
import { logAudit } from '@/lib/audit'
import { requireServerCapability } from '@/lib/server-capability'
import { runBridgeJson } from '@/lib/server-bridge'
import { buildPresetSnbt, normalizeEntityPresetInput } from '@/lib/entity-presets'
import type { BridgeErrorCode } from '@/lib/server-bridge'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type BridgeResponse = {
  ok: boolean
  world?: string
  entity?: string
  count?: number
  error?: string
}

type LiveEntitiesResponse = {
  ok: boolean
  entities?: Array<{
    id: string
    world: string
    location?: { x: number; y: number; z: number } | null
  }>
}

function shouldUseVanillaEntitySpawnFallback(code: BridgeErrorCode | undefined) {
  return code === 'bridge_json_parse_failed'
    || code === 'bridge_non_json_response'
    || code === 'bridge_transport_failed'
    || code === 'bridge_command_rejected'
}

async function runNativeEntitySpawnFallback(req: NextRequest, options: {
  entityId: string
  count: number
  locationMode: 'coords' | 'player'
  player: string
  world: string
  x: number
  y: number
  z: number
}) {
  const command = options.locationMode === 'player'
    ? `execute as ${options.player} at ${options.player} run summon ${options.entityId} ~ ~ ~`
    : `execute in ${options.world} run summon ${options.entityId} ${options.x} ${options.y} ${options.z}`

  for (let i = 0; i < options.count; i += 1) {
    const result = await rconForRequest(req, command)
    if (!result.ok) {
      return { ok: false as const, error: result.error || 'Failed to spawn entity via vanilla fallback' }
    }
  }

  return {
    ok: true as const,
    provider: 'vanilla-rcon',
    warning: 'Relay spawn fallback was used because Relay data could not be parsed reliably.',
  }
}

function nearTarget(entity: { id: string; location?: { x: number; y: number; z: number } | null }, entityId: string, x: number, y: number, z: number) {
  if (entity.id !== entityId || !entity.location) return false
  return Math.abs(entity.location.x - x) <= 6
    && Math.abs(entity.location.y - y) <= 6
    && Math.abs(entity.location.z - z) <= 6
}

async function verifyEntitySpawn(req: NextRequest, options: { world: string; entityId: string; x: number; y: number; z: number }) {
  const live = await runBridgeJson<LiveEntitiesResponse>(req, `entities live ${options.world}`)
  if (!live.ok || live.data.ok === false) {
    return {
      verified: false,
      warning: 'Spawn command completed, but Mcraftr could not verify the entity because Relay live-entity data was unavailable for that world.',
    }
  }
  const entities = Array.isArray(live.data.entities) ? live.data.entities : []
  const matched = entities.some(entity => nearTarget(entity, options.entityId, options.x, options.y, options.z))
  return matched
    ? { verified: true, warning: null }
    : { verified: false, warning: `Spawn command completed, but Mcraftr could not verify ${options.entityId} near ${options.world} ${options.x} ${options.y} ${options.z}.` }
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

export async function POST(req: NextRequest) {
  const userId = await getSessionUserId(req)
  const serverId = await getSessionActiveServerId(req)
  const features = await getUserFeatureFlags(req)
  if (!checkFeatureAccess(features, 'enable_entity_catalog')) {
    return Response.json({ ok: false, error: 'Feature disabled by admin' }, { status: 403 })
  }
  if (!checkFeatureAccess(features, 'enable_entity_spawn')) {
    return Response.json({ ok: false, error: 'Feature disabled by admin' }, { status: 403 })
  }

  const body = await req.json()
  const entityId = typeof body.entityId === 'string' ? body.entityId.trim() : ''
  const sourceKind = typeof body.sourceKind === 'string' ? body.sourceKind.trim() : 'native'
  const locationMode = body.locationMode === 'coords' ? 'coords' : 'player'
  const requestedCount = Math.max(1, Math.min(64, Number(body.count) || 1))
  const count = requestedCount
  if (!entityId) {
    return Response.json({ ok: false, error: 'Entity id is required' }, { status: 400 })
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

    if (sourceKind !== 'native') {
    const preset = normalizeEntityPresetInput(body)
    const snbt = buildPresetSnbt(preset)
    const command = locationMode === 'player'
      ? `execute as ${player} at ${player} run summon ${preset.entityId} ~ ~ ~${snbt ? ` ${snbt}` : ''}`
      : `execute in ${world} run summon ${preset.entityId} ${x} ${y} ${z}${snbt ? ` ${snbt}` : ''}`
    for (let i = 0; i < count; i += 1) {
      const result = await rconForRequest(req, command)
      if (!result.ok) {
        return Response.json({ ok: false, error: result.error || 'Failed to spawn entity preset' }, { status: 502 })
      }
    }
    if (userId) {
      logAudit(userId, 'entity_spawn', preset.label, `${locationMode === 'player' ? player : world} count=${count}`.trim(), serverId)
    }
    if (locationMode === 'coords') {
      const verification = await verifyEntitySpawn(req, { world, entityId: preset.entityId, x, y, z })
      return Response.json({ ok: true, entity: preset.entityId, count, world, origin: { x, y, z }, provider: 'vanilla-rcon', verified: verification.verified, warning: verification.warning })
    }
    return Response.json({ ok: true, entity: preset.entityId, count, world: null, provider: 'vanilla-rcon', verified: true, warning: null })
  }

  const capability = await requireServerCapability(req, 'relay')
  if (!capability.ok) return capability.response

  let command = `entities spawn ${entityId} ${count}`
  if (locationMode === 'player') {
    command += ` player ${player}`
  } else {
    command += ` coords ${world} ${x} ${y} ${z}`
  }

  const bridge = await runBridgeJson<BridgeResponse>(req, command)
  if (!bridge.ok || bridge.data.ok === false) {
    if (!bridge.ok && shouldUseVanillaEntitySpawnFallback(bridge.code)) {
      const fallback = await runNativeEntitySpawnFallback(req, { entityId, count, locationMode, player, world, x, y, z })
      if (fallback.ok) {
        const verification = locationMode === 'coords'
          ? await verifyEntitySpawn(req, { world, entityId, x, y, z })
          : { verified: true, warning: fallback.warning }
        if (userId) {
          logAudit(userId, 'entity_spawn', entityId, `${locationMode === 'player' ? player : world} count=${count} provider=vanilla-rcon`.trim(), serverId)
        }
        return Response.json({ ok: true, entity: entityId, count, world: locationMode === 'coords' ? world : null, origin: locationMode === 'coords' ? { x, y, z } : null, provider: fallback.provider, fallbackUsed: true, verified: verification.verified, warning: verification.warning ?? fallback.warning })
      }
      return Response.json({ ok: false, error: `Failed to spawn ${entityId} in ${world} at ${x} ${y} ${z}: Relay failed and vanilla fallback also failed: ${fallback.error}` }, { status: 502 })
    }
    return Response.json({ ok: false, error: bridge.ok ? bridge.data.error || `Failed to spawn ${entityId} in ${world} at ${x} ${y} ${z}.` : `Failed to spawn ${entityId} in ${world} at ${x} ${y} ${z}: ${bridge.error}`, failureCode: bridge.ok ? 'relay_place_failed' : bridge.code }, { status: 502 })
  }

  if (userId) {
    logAudit(userId, 'entity_spawn', entityId, `${bridge.data.world ?? ''} count=${count} provider=relay`.trim(), serverId)
  }

  if (locationMode === 'coords') {
    const verification = await verifyEntitySpawn(req, { world, entityId, x, y, z })
    return Response.json({ ok: true, entity: bridge.data.entity ?? entityId, count: bridge.data.count ?? count, world: bridge.data.world ?? world, origin: { x, y, z }, provider: 'relay', fallbackUsed: false, verified: verification.verified, warning: verification.warning })
  }

  return Response.json({ ok: true, entity: bridge.data.entity ?? entityId, count: bridge.data.count ?? count, world: bridge.data.world ?? null, provider: 'relay', fallbackUsed: false, verified: true, warning: null })
}
