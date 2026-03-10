import { NextRequest } from 'next/server'
import { checkFeatureAccess, getUserFeatureFlags } from '@/lib/rcon'
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

export async function GET(req: NextRequest) {
  const features = await getUserFeatureFlags(req)
  if (!checkFeatureAccess(features, 'enable_entity_catalog')) {
    return Response.json({ ok: false, error: 'Feature disabled by admin' }, { status: 403 })
  }

  const world = req.nextUrl.searchParams.get('world')?.trim() ?? ''
  const command = world ? `entities live ${world}` : 'entities live'
  const bridge = await runBridgeJson<LiveEntityResponse>(req, command)
  if (!bridge.ok || bridge.data.ok === false) {
    return Response.json({
      ok: false,
      error: bridge.ok ? bridge.data.error || 'Failed to load live entities' : bridge.error,
    }, { status: 502 })
  }

  return Response.json({ ok: true, entities: bridge.data.entities ?? [] })
}
