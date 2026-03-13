import { NextRequest } from 'next/server'
import { checkFeatureAccess, getSessionActiveServerId, getSessionUserId, getUserFeatureFlags } from '@/lib/rcon'
import { getActiveServer, updateServerMinecraftVersion } from '@/lib/users'
import { resolveMinecraftVersion } from '@/lib/minecraft-version'
import { callSidecarForRequest, runBridgeJson } from '@/lib/server-bridge'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type BridgeStackResponse = {
  ok: boolean
   protocolVersion?: string | null
  serverVersion: string | null
  plugins: Array<{
    key: string
    name: string
    installed: boolean
    enabled: boolean
    version: string | null
    source: string
  }>
}

type SidecarStackResponse = {
  ok: boolean
  capabilities?: string[]
  plugins?: Array<{
    name: string
    version: string | null
    filename: string
    detectedFrom: string
  }>
}

export async function GET(req: NextRequest) {
  const userId = await getSessionUserId(req)
  const serverId = await getSessionActiveServerId(req)
  if (!userId) return Response.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
  if (!serverId) return Response.json({ ok: false, error: 'No active server selected' }, { status: 400 })

  const features = await getUserFeatureFlags(req)
  if (!checkFeatureAccess(features, 'enable_plugin_stack_status')) {
    return Response.json({ ok: false, error: 'Feature disabled by admin' }, { status: 403 })
  }

  const activeServer = getActiveServer(userId)
  if (!activeServer) return Response.json({ ok: false, error: 'No active server configured' }, { status: 400 })

  const [bridge, sidecar] = await Promise.all([
    runBridgeJson<BridgeStackResponse>(req, 'stack status'),
    callSidecarForRequest<SidecarStackResponse>(req, '/plugin-stack'),
  ])

  const effectiveMinecraftVersion = activeServer.minecraftVersion.override
    ? activeServer.minecraftVersion
    : bridge.ok && bridge.data.serverVersion
      ? resolveMinecraftVersion({
          override: null,
          resolved: bridge.data.serverVersion,
          source: 'bridge',
          detectedAt: Math.floor(Date.now() / 1000),
        })
      : activeServer.minecraftVersion

  if (!activeServer.minecraftVersion.override && bridge.ok && bridge.data.serverVersion) {
    updateServerMinecraftVersion(userId, serverId, {
      override: null,
      resolved: bridge.data.serverVersion,
      source: 'bridge',
      detectedAt: Math.floor(Date.now() / 1000),
    })
  }

  return Response.json({
    ok: true,
    server: {
      id: serverId,
      label: activeServer.label,
      host: activeServer.host,
      port: activeServer.port,
      minecraftVersion: effectiveMinecraftVersion,
    },
    bridge: bridge.ok ? bridge.data : { ok: false, error: bridge.error },
    sidecar: sidecar.ok
      ? {
          ok: true,
          capabilities: sidecar.data.capabilities ?? activeServer.sidecar.capabilities,
          plugins: sidecar.data.plugins ?? [],
        }
      : {
          ok: false,
          error: sidecar.error,
          capabilities: activeServer.sidecar.capabilities,
        },
  })
}
