import { NextRequest } from 'next/server'
import { checkFeatureAccess, getSessionActiveServerId, getSessionUserId, getUserFeatureFlags, rconForRequest } from '@/lib/rcon'
import { logAudit } from '@/lib/audit'
import { runFgmcJson } from '@/lib/world-stack'
import { buildPresetSnbt, normalizeEntityPresetInput } from '@/lib/entity-presets'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type BridgeResponse = {
  ok: boolean
  world?: string
  entity?: string
  count?: number
  error?: string
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

export async function POST(req: NextRequest) {
  const features = await getUserFeatureFlags(req)
  if (!checkFeatureAccess(features, 'enable_entity_catalog')) {
    return Response.json({ ok: false, error: 'Feature disabled by admin' }, { status: 403 })
  }

  const body = await req.json()
  const entityId = typeof body.entityId === 'string' ? body.entityId.trim() : ''
  const sourceKind = typeof body.sourceKind === 'string' ? body.sourceKind.trim() : 'native'
  const locationMode = body.locationMode === 'coords' ? 'coords' : 'player'
  const count = Math.max(1, Math.min(64, Number(body.count) || 1))
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
    const userId = await getSessionUserId(req)
    const serverId = await getSessionActiveServerId(req)
    if (userId) {
      logAudit(userId, 'entity_spawn', preset.label, `${locationMode === 'player' ? player : world} count=${count}`.trim(), serverId)
    }
    return Response.json({ ok: true, entity: preset.entityId, count, world: locationMode === 'coords' ? world : null })
  }

  let command = `entities spawn ${entityId} ${count}`
  if (locationMode === 'player') {
    command += ` player ${player}`
  } else {
    command += ` coords ${world} ${x} ${y} ${z}`
  }

  const bridge = await runFgmcJson<BridgeResponse>(req, command)
  if (!bridge.ok || bridge.data.ok === false) {
    return Response.json({ ok: false, error: bridge.ok ? bridge.data.error || 'Failed to spawn entity' : bridge.error }, { status: 502 })
  }

  const userId = await getSessionUserId(req)
  const serverId = await getSessionActiveServerId(req)
  if (userId) {
    logAudit(userId, 'entity_spawn', entityId, `${bridge.data.world ?? ''} count=${count}`.trim(), serverId)
  }

  return Response.json({ ok: true, entity: bridge.data.entity ?? entityId, count: bridge.data.count ?? count, world: bridge.data.world ?? null })
}
