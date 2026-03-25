import { NextRequest } from 'next/server'
import { checkFeatureAccess, getSessionActiveServerId, getSessionUserId, getUserFeatureFlags } from '@/lib/rcon'
import { requireServerCapability } from '@/lib/server-capability'
import { callSidecarForRequest, runBridgeJson } from '@/lib/server-bridge'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type BridgeWorld = {
  name: string
  alias: string | null
  environment: string
  loaded: boolean
  players: number
  difficulty: string | null
  pvp: boolean | null
  allowFlight: boolean | null
  allowWeather: boolean | null
  hidden: boolean | null
  autoLoad: boolean | null
  seed: number | null
  spawn: { x: number; y: number; z: number; yaw: number; pitch: number } | null
}

type WorldsBridgeResponse = {
  ok: boolean
  defaultWorld: string | null
  multiverseLoaded: boolean
  worlds: BridgeWorld[]
}

type SidecarWorldResponse = {
  ok: boolean
  capabilities?: string[]
  worlds?: Array<{
    name: string
    path: string
    sizeBytes: number | null
    mapUrl: string | null
    hasBlueMap: boolean
    hasDynmap: boolean
    source: string
  }>
}

export async function GET(req: NextRequest) {
  const userId = await getSessionUserId(req)
  const serverId = await getSessionActiveServerId(req)
  if (!userId) return Response.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
  if (!serverId) return Response.json({ ok: false, error: 'No active server selected' }, { status: 400 })

  const features = await getUserFeatureFlags(req)
  if (!checkFeatureAccess(features, 'enable_world_inventory')) {
    return Response.json({ ok: false, error: 'Feature disabled by admin' }, { status: 403 })
  }

  const capability = await requireServerCapability(req, 'full')
  if (!capability.ok) return capability.response

  const [bridge, sidecar] = await Promise.all([
    runBridgeJson<WorldsBridgeResponse>(req, 'worlds list'),
    callSidecarForRequest<SidecarWorldResponse>(req, '/worlds'),
  ])

  if (!bridge.ok) {
    return Response.json({ ok: false, error: bridge.error }, { status: 502 })
  }

  const sidecarWorlds = sidecar.ok ? sidecar.data.worlds ?? [] : []
  const sidecarByName = new Map(sidecarWorlds.map(world => [world.name.toLowerCase(), world]))

  return Response.json({
    ok: true,
    defaultWorld: bridge.data.defaultWorld,
    multiverseLoaded: bridge.data.multiverseLoaded,
    worlds: bridge.data.worlds.map(world => {
      const fsWorld = sidecarByName.get(world.name.toLowerCase())
      return {
        ...world,
        fs: fsWorld
          ? {
              path: fsWorld.path,
              sizeBytes: fsWorld.sizeBytes,
              mapUrl: fsWorld.mapUrl,
              hasBlueMap: fsWorld.hasBlueMap,
              hasDynmap: fsWorld.hasDynmap,
              source: fsWorld.source,
            }
          : null,
      }
    }),
    sidecar: sidecar.ok
      ? { ok: true, capabilities: sidecar.data.capabilities ?? [] }
      : { ok: false, error: sidecar.error },
  })
}
