import { NextRequest } from 'next/server'
import { deleteUserServer, getUserById, listUserServers, updateServerBridgeHealth, updateServerMinecraftVersion, updateServerSidecarHealth, updateUserServer } from '@/lib/users'
import { normalizeMinecraftVersion } from '@/lib/minecraft-version'
import { getSessionUserId } from '@/lib/rcon'
import { testBeaconConnection, testBridgeConnection } from '@/lib/server-bridge'
import { getServerStackDescription, getServerStackLabel } from '@/lib/server-stack'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function parsePort(raw: unknown, fallback = 25575): number {
  const n = parseInt(String(raw))
  if (!Number.isInteger(n) || n < 1 || n > 65535) return fallback
  return n
}

function parseFlag(raw: unknown): boolean {
  if (typeof raw === 'boolean') return raw
  if (typeof raw === 'number') return raw !== 0
  if (typeof raw === 'string') {
    const normalized = raw.trim().toLowerCase()
    return normalized === '1' || normalized === 'true' || normalized === 'yes' || normalized === 'on'
  }
  return false
}

function parseStringArray(raw: unknown): string[] {
  if (Array.isArray(raw)) {
    return Array.from(new Set(raw
      .filter((entry): entry is string => typeof entry === 'string')
      .map(entry => entry.trim())
      .filter(Boolean)))
  }
  if (typeof raw === 'string') {
    return Array.from(new Set(raw
      .split('\n')
      .map(entry => entry.trim())
      .filter(Boolean)))
  }
  return []
}

function mapSavedServer(server: ReturnType<typeof listUserServers>[number]) {
  return {
    ...server,
    stackLabel: getServerStackLabel(server.stackMode),
    stackDescription: getServerStackDescription(server.stackMode),
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const userId = await getSessionUserId(req)
  if (!userId) return Response.json({ ok: false, error: 'Not authenticated' }, { status: 401 })
  try {
    const currentUser = getUserById(userId)
    if (!currentUser) return Response.json({ ok: false, error: 'User not found' }, { status: 404 })

    const { id } = await params
    const {
      label,
      host,
      port,
      password,
      bridgeEnabled,
      bridgeCommandPrefix,
      sidecarEnabled,
      sidecarUrl,
      sidecarToken,
      sidecarStructureRoots,
      sidecarEntityPresetRoots,
      minecraftVersionOverride,
    } = await req.json()
    if (!host || typeof host !== 'string' || !password || typeof password !== 'string') {
      return Response.json({ ok: false, error: 'Host and password are required' }, { status: 400 })
    }
    const user = updateUserServer(userId, {
      serverId: id,
      label: typeof label === 'string' ? label.trim() : null,
      host: host.trim(),
      port: parsePort(port),
      password,
      minecraftVersion: {
        override: normalizeMinecraftVersion(minecraftVersionOverride),
      },
      bridge: {
        enabled: parseFlag(bridgeEnabled),
        commandPrefix: typeof bridgeCommandPrefix === 'string' ? bridgeCommandPrefix.trim() : 'mcraftr',
      },
      sidecar: {
        enabled: parseFlag(sidecarEnabled),
        url: typeof sidecarUrl === 'string' ? sidecarUrl.trim() : null,
        token: typeof sidecarToken === 'string' ? sidecarToken : null,
        structureRoots: parseStringArray(sidecarStructureRoots),
        entityPresetRoots: parseStringArray(sidecarEntityPresetRoots),
      },
    })
    const updated = user.servers.find(entry => entry.id === id)
    const warnings: string[] = []
    if (updated?.bridge.enabled) {
      const bridge = await testBridgeConnection(updated.host, updated.port, password, updated.bridge.commandPrefix)
      updateServerBridgeHealth(userId, id, {
        lastSeen: bridge.ok ? Math.floor(Date.now() / 1000) : null,
        lastError: bridge.ok ? null : bridge.error || 'Bridge test failed',
        capabilities: bridge.ok ? (bridge.capabilities ?? []) : [],
        providerId: bridge.ok ? (bridge.providerId ?? null) : undefined,
        providerLabel: bridge.ok ? (bridge.providerLabel ?? null) : undefined,
        protocolVersion: bridge.ok ? (bridge.protocolVersion ?? null) : undefined,
      })
      if (updated.minecraftVersion.override) {
        updateServerMinecraftVersion(userId, id, {
          override: updated.minecraftVersion.override,
          detectedAt: Math.floor(Date.now() / 1000),
        })
      } else if (bridge.ok && bridge.serverVersion) {
        updateServerMinecraftVersion(userId, id, {
          override: null,
          resolved: bridge.serverVersion,
          source: 'bridge',
          detectedAt: Math.floor(Date.now() / 1000),
        })
      } else if (updated.minecraftVersion.source !== 'fallback' && updated.minecraftVersion.resolved) {
        updateServerMinecraftVersion(userId, id, {
          override: null,
          resolved: updated.minecraftVersion.resolved,
          source: updated.minecraftVersion.source,
          detectedAt: updated.minecraftVersion.detectedAt,
        })
      } else {
        updateServerMinecraftVersion(userId, id, {
          override: null,
          resolved: null,
          source: null,
          detectedAt: null,
        })
      }
      if (!bridge.ok) warnings.push(bridge.error || 'Bridge test failed')
    } else {
      updateServerBridgeHealth(userId, id, { lastSeen: null, lastError: null, capabilities: [] })
      updateServerMinecraftVersion(userId, id, updated?.minecraftVersion.override
        ? {
            override: updated.minecraftVersion.override,
            detectedAt: Math.floor(Date.now() / 1000),
          }
        : {
            override: null,
            resolved: null,
            source: null,
            detectedAt: null,
          })
    }
    if (updated?.sidecar.enabled && updated.sidecar.url) {
      const beacon = await testBeaconConnection(updated.sidecar.url, updated.sidecar.token)
      updateServerSidecarHealth(userId, id, {
        lastSeen: beacon.ok ? Math.floor(Date.now() / 1000) : null,
        capabilities: beacon.ok ? (beacon.capabilities ?? []) : [],
      })
      if (!beacon.ok) warnings.push(beacon.error || 'Beacon test failed')
    } else {
      updateServerSidecarHealth(userId, id, { lastSeen: null, capabilities: [] })
    }
    const server = listUserServers(userId).find(entry => entry.id === id) ?? updated ?? null
    return Response.json({
      ok: true,
      warnings,
      server: server ? mapSavedServer(server) : null,
    })
  } catch (e: unknown) {
    return Response.json({ ok: false, error: e instanceof Error ? e.message : 'Failed to update server' }, { status: 500 })
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const userId = await getSessionUserId(req)
  if (!userId) return Response.json({ ok: false, error: 'Not authenticated' }, { status: 401 })
  try {
    const currentUser = getUserById(userId)
    if (!currentUser) return Response.json({ ok: false, error: 'User not found' }, { status: 404 })

    const { id } = await params
    const user = deleteUserServer(userId, id)
    return Response.json({ ok: true, activeServerId: user.activeServerId, hasServer: user.servers.length > 0 })
  } catch (e: unknown) {
    return Response.json({ ok: false, error: e instanceof Error ? e.message : 'Failed to delete server' }, { status: 500 })
  }
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const userId = await getSessionUserId(req)
  if (!userId) return Response.json({ ok: false, error: 'Not authenticated' }, { status: 401 })
  const { id } = await params
  const user = getUserById(userId)
  const server = user?.servers.find(entry => entry.id === id)
  if (!server) return Response.json({ ok: false, error: 'Server not found' }, { status: 404 })
  return Response.json({
    ok: true,
    server: mapSavedServer(server),
  })
}
