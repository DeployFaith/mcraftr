import { NextRequest } from 'next/server'
import { checkFeatureAccess, getUserFeatureFlags } from '@/lib/rcon'
import { requireServerCapability } from '@/lib/server-capability'
import { runBridgeJson } from '@/lib/server-bridge'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type LiveEntityResponse = {
  ok: boolean
  entities?: Array<{
    uuid: string
    id: string
    label: string
    category: string
    dangerous: boolean
    world: string
    location?: {
      x: number
      y: number
      z: number
      yaw?: number
      pitch?: number
    } | null
    customName?: string | null
    persistent?: boolean
    glowing?: boolean
    invulnerable?: boolean
    silent?: boolean
    gravity?: boolean
    health?: number | null
  }>
  error?: string
}

type WorldsListResponse = {
  ok: boolean
  worlds?: Array<{
    name: string
    loaded: boolean
  }>
  error?: string
}

const MAX_LIVE_ENTITIES = 200

function normalizeLiveEntities(payload: LiveEntityResponse | undefined | null) {
  return Array.isArray(payload?.entities) ? payload.entities : []
}

async function loadLiveEntitiesByWorld(req: NextRequest) {
  const worlds = await runBridgeJson<WorldsListResponse>(req, 'worlds list')
  if (!worlds.ok || worlds.data.ok === false) {
    return null
  }

  const loadedWorlds = (Array.isArray(worlds.data.worlds) ? worlds.data.worlds : [])
    .filter(world => world && typeof world.name === 'string' && world.name.trim() && world.loaded)
    .map(world => world.name.trim())

  if (loadedWorlds.length === 0) {
    return { entities: [], partial: false }
  }

  const results = await Promise.all(loadedWorlds.map(async world => ({
    world,
    result: await runBridgeJson<LiveEntityResponse>(req, `entities live ${world}`),
  })))

  const entities = results.flatMap(entry => (
    entry.result.ok && entry.result.data.ok !== false
      ? normalizeLiveEntities(entry.result.data)
      : []
  ))

  const successfulWorlds = results.filter(entry => entry.result.ok && entry.result.data.ok !== false).length

  if (successfulWorlds === 0) {
    return null
  }

  return {
    entities,
    partial: successfulWorlds < loadedWorlds.length,
  }
}

export async function GET(req: NextRequest) {
  const features = await getUserFeatureFlags(req)
  if (!checkFeatureAccess(features, 'enable_entity_catalog')) {
    return Response.json({ ok: false, error: 'Feature disabled by admin' }, { status: 403 })
  }
  if (!checkFeatureAccess(features, 'enable_entity_live_tools')) {
    return Response.json({ ok: false, error: 'Feature disabled by admin' }, { status: 403 })
  }

  const capability = await requireServerCapability(req, 'relay')
  if (!capability.ok) return capability.response

  const world = req.nextUrl.searchParams.get('world')?.trim() ?? ''
  const command = world ? `entities live ${world}` : 'entities live'
  const bridge = await runBridgeJson<LiveEntityResponse>(req, command)
  if (!bridge.ok || bridge.data.ok === false) {
    if (!world && !bridge.ok && bridge.code === 'bridge_json_parse_failed') {
      const fallback = await loadLiveEntitiesByWorld(req)
      if (fallback) {
        const limitedEntities = fallback.entities.slice(0, MAX_LIVE_ENTITIES)
        return Response.json({
          ok: true,
          entities: limitedEntities,
          totalEntities: fallback.entities.length,
          truncated: fallback.entities.length > limitedEntities.length,
          warning: fallback.partial
            ? 'Some worlds returned too much Relay data, so the live entity picker is showing the worlds that responded successfully.'
            : (fallback.entities.length > limitedEntities.length
                ? `Showing the first ${limitedEntities.length} live entities out of ${fallback.entities.length}.`
                : null),
          warningCode: fallback.partial ? 'bridge_json_parse_failed' : null,
        })
      }
    }
    if (!bridge.ok && bridge.code === 'bridge_json_parse_failed') {
      return Response.json({
        ok: true,
        entities: [],
        totalEntities: 0,
        truncated: false,
        warning: 'Live entity targeting is temporarily unavailable because the Relay entity list is too large to parse right now. Player teleports still work.',
        warningCode: bridge.code,
      })
    }
    return Response.json({
      ok: false,
      error: bridge.ok ? bridge.data.error || 'Failed to load live entities' : bridge.error,
    }, { status: 502 })
  }

  const entities = Array.isArray(bridge.data.entities) ? bridge.data.entities : []
  const limitedEntities = entities.slice(0, MAX_LIVE_ENTITIES)

  return Response.json({
    ok: true,
    entities: limitedEntities,
    totalEntities: entities.length,
    truncated: entities.length > limitedEntities.length,
    warning: entities.length > limitedEntities.length
      ? `Showing the first ${limitedEntities.length} live entities out of ${entities.length}.`
      : null,
  })
}
