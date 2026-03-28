import { NextRequest } from 'next/server'
import { checkFeatureAccess, getUserFeatureFlags } from '@/lib/rcon'
import { requireServerCapability } from '@/lib/server-capability'
import { runBridgeJson } from '@/lib/server-bridge'
import { getSessionUserId } from '@/lib/rcon'
import { getActiveServer } from '@/lib/users'

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
      imageUrl?: string | null
    }>
  totalEntities?: number
  truncated?: boolean
  limit?: number
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

function resolveLiveEntityTotal(payload: LiveEntityResponse | undefined | null) {
  if (typeof payload?.totalEntities === 'number' && Number.isFinite(payload.totalEntities)) {
    return Math.max(0, Math.floor(payload.totalEntities))
  }
  return normalizeLiveEntities(payload).length
}

function isLiveEntityPayloadTruncated(payload: LiveEntityResponse | undefined | null) {
  return payload?.truncated === true
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
    return { entities: [], totalEntities: 0, truncated: false, partial: false }
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
  const totalEntities = results.reduce((sum, entry) => (
    entry.result.ok && entry.result.data.ok !== false
      ? sum + resolveLiveEntityTotal(entry.result.data)
      : sum
  ), 0)
  const truncated = results.some(entry => (
    entry.result.ok && entry.result.data.ok !== false && isLiveEntityPayloadTruncated(entry.result.data)
  ))

  const successfulWorlds = results.filter(entry => entry.result.ok && entry.result.data.ok !== false).length

  if (successfulWorlds === 0) {
    return null
  }

  return {
    entities,
    totalEntities,
    truncated,
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

  const userId = await getSessionUserId(req)
  const minecraftVersion = userId ? getActiveServer(userId)?.minecraftVersion.resolved ?? null : null
  const artVersion = minecraftVersion ?? 'entity-icons'

  const world = req.nextUrl.searchParams.get('world')?.trim() ?? ''
  const command = world ? `entities live ${world}` : 'entities live'
  const bridge = await runBridgeJson<LiveEntityResponse>(req, command)
  if (!bridge.ok || bridge.data.ok === false) {
    if (!world && !bridge.ok && bridge.code === 'bridge_json_parse_failed') {
      const fallback = await loadLiveEntitiesByWorld(req)
      if (fallback) {
        const limitedEntities = fallback.entities.slice(0, MAX_LIVE_ENTITIES)
        const withArt = limitedEntities.map(entity => ({
          ...entity,
          imageUrl: `/api/minecraft/art/entity/${encodeURIComponent(artVersion)}/${encodeURIComponent(entity.id)}`,
        }))
        const totalEntities = Math.max(fallback.totalEntities, fallback.entities.length)
        const responseTruncated = fallback.truncated || totalEntities > limitedEntities.length
           return Response.json({
            ok: true,
            entities: withArt,
            totalEntities,
            truncated: responseTruncated,
            warning: fallback.partial
            ? 'Some worlds returned too much Relay data, so the live entity picker is only showing worlds that responded successfully. Spawn actions may still work.'
            : (responseTruncated
                ? `Showing the first ${limitedEntities.length} live entities out of ${totalEntities}.`
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

  const entities = normalizeLiveEntities(bridge.data)
  const totalEntities = Math.max(resolveLiveEntityTotal(bridge.data), entities.length)
  const limitedEntities = entities.slice(0, MAX_LIVE_ENTITIES)
  const withArt = limitedEntities.map(entity => ({
    ...entity,
    imageUrl: `/api/minecraft/art/entity/${encodeURIComponent(artVersion)}/${encodeURIComponent(entity.id)}`,
  }))
  const truncated = isLiveEntityPayloadTruncated(bridge.data) || totalEntities > limitedEntities.length

  return Response.json({
    ok: true,
    entities: withArt,
    totalEntities,
    truncated,
    warning: truncated
      ? `Showing the first ${limitedEntities.length} live entities out of ${totalEntities}.`
      : null,
  })
}
