import { NextRequest } from 'next/server'
import { createUserServer, deleteUserServer, getUserById, updateUserServer } from '@/lib/users'
import { DEFAULT_MINECRAFT_VERSION, normalizeMinecraftVersion } from '@/lib/minecraft-version'
import { testRconConnection, getSessionUserId } from '@/lib/rcon'
import { testBeaconConnection, testBridgeConnection } from '@/lib/server-bridge'
import { sanitizeBridgePrefix } from '@/lib/public-branding'
import { getServerStackDescription, getServerStackLabel } from '@/lib/server-stack'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function isBlockedHost(host: string): boolean {
  const h = host.trim().toLowerCase()
  if (h === 'host.docker.internal') return true
  if (h === 'localhost' || h === 'localhost.') return true
  const stripped = h.startsWith('[') && h.endsWith(']') ? h.slice(1, -1) : h
  if (stripped === '::' || stripped === '::1') return true
  if (stripped === '::ffff:0:0' || stripped.startsWith('::ffff:')) return true
  if (stripped.startsWith('fe80')) return true
  if (stripped.startsWith('fc') || stripped.startsWith('fd')) return true
  const ipv4 = stripped.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/)
  if (ipv4) {
    const [, a, b] = ipv4.map(Number)
    if (a === 0 || a === 127 || a === 10) return true
    if (a === 172 && b >= 16 && b <= 31) return true
    if (a === 192 && b === 168) return true
    if (a === 169 && b === 254) return true
    if (a === 100 && b >= 64 && b <= 127) return true
  }
  return false
}

function parsePort(raw: unknown, fallback = 25575): number {
  const n = parseInt(String(raw))
  if (!Number.isInteger(n) || n < 1 || n > 65535) return fallback
  return n
}

export async function POST(req: NextRequest) {
  const userId = await getSessionUserId(req)
  if (!userId) return Response.json({ ok: false, error: 'Not authenticated' }, { status: 401 })

  try {
    const { host, port, password, label } = await req.json()
    if (!host || typeof host !== 'string') return Response.json({ ok: false, error: 'Server address is required' }, { status: 400 })
    if (isBlockedHost(host)) return Response.json({ ok: false, error: 'That server address is not allowed' }, { status: 400 })
    if (!password || typeof password !== 'string') return Response.json({ ok: false, error: 'RCON password is required' }, { status: 400 })

    const server = createUserServer(userId, {
      label: typeof label === 'string' ? label.trim() : null,
      host: host.trim(),
      port: parsePort(port),
      password,
    })
    return Response.json({ ok: true, server: { id: server.id, label: server.label, host: server.host, port: server.port }, activeServerId: getUserById(userId)?.activeServerId ?? server.id })
  } catch (e: unknown) {
    return Response.json({ ok: false, error: e instanceof Error ? e.message : 'Failed to save server' }, { status: 500 })
  }
}

export async function GET(req: NextRequest) {
  const userId = await getSessionUserId(req)
  if (!userId) return Response.json({ ok: false, error: 'Not authenticated' }, { status: 401 })
  const user = getUserById(userId)
  if (!user) return Response.json({ ok: false, error: 'User not found' }, { status: 404 })
  const activeServer = user.servers.find(server => server.id === user.activeServerId) ?? null
  return Response.json({
    ok: true,
    configured: !!user.server,
    id: user.activeServerId,
    label: user.serverLabel,
    host: user.server?.host ?? null,
    port: user.server?.port ?? 25575,
    stackMode: activeServer?.stackMode ?? 'quick',
    stackLabel: getServerStackLabel(activeServer?.stackMode ?? 'quick'),
    stackDescription: getServerStackDescription(activeServer?.stackMode ?? 'quick'),
    minecraftVersion: activeServer?.minecraftVersion ?? {
      override: null,
      resolved: DEFAULT_MINECRAFT_VERSION,
      source: 'fallback',
      detectedAt: null,
    },
  })
}

export async function DELETE(req: NextRequest) {
  const userId = await getSessionUserId(req)
  if (!userId) return Response.json({ ok: false, error: 'Not authenticated' }, { status: 401 })
  try {
    const user = getUserById(userId)
    if (!user?.activeServerId) return Response.json({ ok: true })
    const next = deleteUserServer(userId, user.activeServerId)
    return Response.json({ ok: true, activeServerId: next.activeServerId, hasServer: next.servers.length > 0 })
  } catch (e: unknown) {
    return Response.json({ ok: false, error: e instanceof Error ? e.message : 'Failed to disconnect' }, { status: 500 })
  }
}

export async function PUT(req: NextRequest) {
  const userId = await getSessionUserId(req)
  if (!userId) return Response.json({ ok: false, error: 'Not authenticated' }, { status: 401 })

  try {
    const {
      host,
      port,
      password,
      bridgeEnabled,
      bridgeCommandPrefix,
      sidecarEnabled,
      sidecarUrl,
      sidecarToken,
      stackMode,
      minecraftVersionOverride,
    } = await req.json()
    if (!host || !password) {
      return Response.json({ ok: false, error: 'Host and password are required' }, { status: 400 })
    }
    if (isBlockedHost(host)) {
      return Response.json({ ok: false, error: 'That server address is not allowed' }, { status: 400 })
    }

    const result = await testRconConnection(host.trim(), parsePort(port), password)
    if (!result.ok) {
      return Response.json({ ok: false, error: `Couldn't connect: ${result.error || 'Connection refused'}` })
    }

    const clean = (result.stdout || 'OK').replace(/§./g, '')
    const fullStackRequested = stackMode === 'full'
    const bridgeRequested = fullStackRequested || bridgeEnabled === true || bridgeEnabled === 'true' || bridgeEnabled === 1
    if (!bridgeRequested) {
      const override = normalizeMinecraftVersion(minecraftVersionOverride)
      return Response.json({
        ok: true,
        message: `Connected! ${clean}`,
        minecraftVersion: {
          override,
          resolved: override ?? DEFAULT_MINECRAFT_VERSION,
          source: override ? 'manual' : 'fallback',
          detectedAt: override ? Math.floor(Date.now() / 1000) : null,
        },
      })
    }

    const bridge = await testBridgeConnection(
      host.trim(),
      parsePort(port),
      password,
      typeof bridgeCommandPrefix === 'string' ? bridgeCommandPrefix : 'mcraftr',
    )
    if (!bridge.ok) {
      return Response.json({
        ok: false,
        error: `RCON connected, but ${bridge.error || 'the bridge test failed'}`,
        bridge,
      })
    }

    const beaconRequested = fullStackRequested || sidecarEnabled === true || sidecarEnabled === 'true' || sidecarEnabled === 1
    if (!beaconRequested) {
      const override = normalizeMinecraftVersion(minecraftVersionOverride)
      return Response.json({
        ok: true,
          message: `Connected! ${clean} Bridge prefix "${sanitizeBridgePrefix(typeof bridgeCommandPrefix === 'string' ? bridgeCommandPrefix : 'bridge')}" responded successfully.`,
        bridge,
        minecraftVersion: {
          override,
          resolved: override ?? bridge.serverVersion ?? DEFAULT_MINECRAFT_VERSION,
          source: override ? 'manual' : (bridge.serverVersion ? 'bridge' : 'fallback'),
          detectedAt: override || bridge.serverVersion ? Math.floor(Date.now() / 1000) : null,
        },
      })
    }

    if (!sidecarUrl || typeof sidecarUrl !== 'string' || !sidecarUrl.trim()) {
      return Response.json({ ok: false, error: 'Beacon URL is required for the Full Mcraftr Stack' }, { status: 400 })
    }

    const beacon = await testBeaconConnection(
      sidecarUrl.trim(),
      typeof sidecarToken === 'string' ? sidecarToken : null,
    )
    if (!beacon.ok) {
      return Response.json({
        ok: false,
        error: `RCON and Bridge connected, but ${beacon.error || 'the Beacon test failed'}`,
        bridge,
        beacon,
      })
    }

    return Response.json({
      ok: true,
      message: `Connected! ${clean} Full Mcraftr Stack responded successfully.`,
      bridge,
      beacon,
      minecraftVersion: {
        override: normalizeMinecraftVersion(minecraftVersionOverride),
        resolved: normalizeMinecraftVersion(minecraftVersionOverride) ?? bridge.serverVersion ?? DEFAULT_MINECRAFT_VERSION,
        source: normalizeMinecraftVersion(minecraftVersionOverride) ? 'manual' : (bridge.serverVersion ? 'bridge' : 'fallback'),
        detectedAt: normalizeMinecraftVersion(minecraftVersionOverride) || bridge.serverVersion ? Math.floor(Date.now() / 1000) : null,
      },
    })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Test failed'
    return Response.json({ ok: false, error: msg }, { status: 500 })
  }
}
