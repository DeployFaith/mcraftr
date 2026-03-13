import { NextRequest } from 'next/server'
import { createUserServer, getUserById, listUserServers, updateServerBridgeHealth, updateServerMinecraftVersion, updateServerSidecarHealth } from '@/lib/users'
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
    id: server.id,
    label: server.label,
    host: server.host,
    port: server.port,
    stackMode: server.stackMode,
    stackLabel: getServerStackLabel(server.stackMode),
    stackDescription: getServerStackDescription(server.stackMode),
    minecraftVersion: {
      override: server.minecraftVersion.override,
      resolved: server.minecraftVersion.resolved,
      source: server.minecraftVersion.source,
      detectedAt: server.minecraftVersion.detectedAt,
    },
    bridge: {
      enabled: server.bridge.enabled,
      commandPrefix: server.bridge.commandPrefix,
      providerId: server.bridge.providerId,
      providerLabel: server.bridge.providerLabel,
      protocolVersion: server.bridge.protocolVersion,
      lastSeen: server.bridge.lastSeen,
      lastError: server.bridge.lastError,
      capabilities: server.bridge.capabilities,
    },
    sidecar: {
      enabled: server.sidecar.enabled,
      url: server.sidecar.url,
      lastSeen: server.sidecar.lastSeen,
      capabilities: server.sidecar.capabilities,
      structureRoots: server.sidecar.structureRoots,
      entityPresetRoots: server.sidecar.entityPresetRoots,
    },
    createdAt: server.createdAt,
    updatedAt: server.updatedAt,
  }
}

export async function GET(req: NextRequest) {
  const userId = await getSessionUserId(req)
  if (!userId) return Response.json({ ok: false, error: 'Not authenticated' }, { status: 401 })
  const user = getUserById(userId)
  if (!user) return Response.json({ ok: false, error: 'User not found' }, { status: 404 })
  return Response.json({
    ok: true,
    activeServerId: user.activeServerId,
    servers: listUserServers(userId).map(mapSavedServer),
  })
}

export async function POST(req: NextRequest) {
  const userId = await getSessionUserId(req)
  if (!userId) return Response.json({ ok: false, error: 'Not authenticated' }, { status: 401 })
  try {
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
    const created = createUserServer(userId, {
      label: typeof label === 'string' ? label.trim() : null,
      host: host.trim(),
      port: parsePort(port),
      password,
      bridge: {
        enabled: parseFlag(bridgeEnabled),
        commandPrefix: typeof bridgeCommandPrefix === 'string' ? bridgeCommandPrefix.trim() : 'mcraftr',
      },
      minecraftVersion: {
        override: normalizeMinecraftVersion(minecraftVersionOverride),
      },
      sidecar: {
        enabled: parseFlag(sidecarEnabled),
        url: typeof sidecarUrl === 'string' ? sidecarUrl.trim() : null,
        token: typeof sidecarToken === 'string' ? sidecarToken : null,
        structureRoots: parseStringArray(sidecarStructureRoots),
        entityPresetRoots: parseStringArray(sidecarEntityPresetRoots),
      },
    })
    const warnings: string[] = []
    if (created.bridge.enabled) {
      const bridge = await testBridgeConnection(created.host, created.port, password, created.bridge.commandPrefix)
      updateServerBridgeHealth(userId, created.id, {
        lastSeen: bridge.ok ? Math.floor(Date.now() / 1000) : null,
        lastError: bridge.ok ? null : bridge.error || 'Bridge test failed',
        capabilities: bridge.ok ? (bridge.capabilities ?? []) : [],
        providerId: bridge.ok ? (bridge.providerId ?? null) : undefined,
        providerLabel: bridge.ok ? (bridge.providerLabel ?? null) : undefined,
        protocolVersion: bridge.ok ? (bridge.protocolVersion ?? null) : undefined,
      })
      if (created.minecraftVersion.override) {
        updateServerMinecraftVersion(userId, created.id, {
          override: created.minecraftVersion.override,
          detectedAt: Math.floor(Date.now() / 1000),
        })
      } else if (bridge.ok && bridge.serverVersion) {
        updateServerMinecraftVersion(userId, created.id, {
          override: null,
          resolved: bridge.serverVersion,
          source: 'bridge',
          detectedAt: Math.floor(Date.now() / 1000),
        })
      } else {
        updateServerMinecraftVersion(userId, created.id, {
          override: null,
          resolved: null,
          source: null,
          detectedAt: null,
        })
      }
      if (!bridge.ok) warnings.push(bridge.error || 'Bridge test failed')
    } else {
      updateServerBridgeHealth(userId, created.id, { lastSeen: null, lastError: null, capabilities: [] })
      updateServerMinecraftVersion(userId, created.id, created.minecraftVersion.override
        ? {
            override: created.minecraftVersion.override,
            detectedAt: Math.floor(Date.now() / 1000),
          }
        : {
            override: null,
            resolved: null,
            source: null,
            detectedAt: null,
          })
    }
    if (created.sidecar.enabled && created.sidecar.url) {
      const beacon = await testBeaconConnection(created.sidecar.url, created.sidecar.token)
      updateServerSidecarHealth(userId, created.id, {
        lastSeen: beacon.ok ? Math.floor(Date.now() / 1000) : null,
        capabilities: beacon.ok ? (beacon.capabilities ?? []) : [],
      })
      if (!beacon.ok) warnings.push(beacon.error || 'Beacon test failed')
    } else {
      updateServerSidecarHealth(userId, created.id, { lastSeen: null, capabilities: [] })
    }
    const server = listUserServers(userId).find(entry => entry.id === created.id) ?? created
    return Response.json({
      ok: true,
      warnings,
      server: mapSavedServer(server),
    })
  } catch (e: unknown) {
    return Response.json({ ok: false, error: e instanceof Error ? e.message : 'Failed to save server' }, { status: 500 })
  }
}
