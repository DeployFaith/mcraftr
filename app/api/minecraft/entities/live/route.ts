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

const MAX_LIVE_ENTITIES = 200

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
