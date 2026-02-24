import { NextRequest } from 'next/server'
import { getUserById, updateUserServer, clearUserServer } from '@/lib/users'
import { testRconConnection, getSessionUserId } from '@/lib/rcon'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * Reject hosts that would route RCON connections to internal infrastructure.
 * Covers: loopback, RFC-1918, link-local, Tailscale CGNAT, Docker host alias,
 * 0.0.0.0/any-address, IPv4-mapped IPv6, IPv6 ULA, and IPv6 link-local.
 *
 * NOTE: Does not prevent DNS-rebinding (a hostname could resolve to a private IP).
 * Treat this as defense-in-depth; the RCON client will still attempt the connection
 * if an attacker-controlled domain resolves to a blocked range.
 */
function isBlockedHost(host: string): boolean {
  const h = host.trim().toLowerCase()

  // Docker host alias and bare loopback names
  if (h === 'host.docker.internal') return true
  if (h === 'localhost' || h === 'localhost.') return true

  // Strip brackets from IPv6 literals (e.g. [::1] → ::1)
  const stripped = h.startsWith('[') && h.endsWith(']') ? h.slice(1, -1) : h

  // IPv6 special addresses
  if (stripped === '::' || stripped === '::1') return true        // any-address / loopback
  if (stripped === '::ffff:0:0' || stripped.startsWith('::ffff:')) return true  // IPv4-mapped
  if (stripped.startsWith('fe80')) return true                    // fe80::/10 link-local
  if (stripped.startsWith('fc') || stripped.startsWith('fd')) return true  // fc00::/7 ULA

  // IPv4 dotted-decimal
  const ipv4 = stripped.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/)
  if (ipv4) {
    const [, a, b] = ipv4.map(Number)
    if (a === 0) return true                              // 0.0.0.0/8 (any-address)
    if (a === 127) return true                            // 127.0.0.0/8 loopback
    if (a === 10) return true                             // 10.0.0.0/8
    if (a === 172 && b >= 16 && b <= 31) return true     // 172.16.0.0/12
    if (a === 192 && b === 168) return true               // 192.168.0.0/16
    if (a === 169 && b === 254) return true               // 169.254.0.0/16 link-local
    if (a === 100 && b >= 64 && b <= 127) return true    // 100.64.0.0/10 Tailscale CGNAT
    return false
  }

  return false
}

/**
 * Validate that a port number is a valid TCP port (1–65535).
 */
function parsePort(raw: unknown, fallback = 25575): number {
  const n = parseInt(String(raw))
  if (!Number.isInteger(n) || n < 1 || n > 65535) return fallback
  return n
}

// POST /api/server — save server config for the logged-in user
export async function POST(req: NextRequest) {
  const userId = await getSessionUserId(req)
  if (!userId) {
    return Response.json({ ok: false, error: 'Not authenticated' }, { status: 401 })
  }

  try {
    const { host, port, password } = await req.json()

    if (!host || typeof host !== 'string') {
      return Response.json({ ok: false, error: 'Server address is required' }, { status: 400 })
    }
    if (isBlockedHost(host)) {
      return Response.json({ ok: false, error: 'That server address is not allowed' }, { status: 400 })
    }
    if (!password || typeof password !== 'string') {
      return Response.json({ ok: false, error: 'RCON password is required' }, { status: 400 })
    }

    const rconPort = parsePort(port)

    updateUserServer(userId, {
      host: host.trim(),
      port: rconPort,
      password,
    })

    return new Response(JSON.stringify({ ok: true }), {
      headers: {
        'Content-Type': 'application/json',
        'Set-Cookie': `mcraftr_has_server=1; Path=/; HttpOnly; SameSite=Lax; Max-Age=604800${process.env.NODE_ENV === 'production' ? '; Secure' : ''}`,
      },
    })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Failed to save server'
    return Response.json({ ok: false, error: msg }, { status: 500 })
  }
}

// GET /api/server — return current user's server config (no password)
export async function GET(req: NextRequest) {
  const userId = await getSessionUserId(req)
  if (!userId) {
    return Response.json({ ok: false, error: 'Not authenticated' }, { status: 401 })
  }

  const user = getUserById(userId)
  if (!user) return Response.json({ ok: false, error: 'User not found' }, { status: 404 })

  return Response.json({
    ok: true,
    configured: !!user.server,
    host: user.server?.host ?? null,
    port: user.server?.port ?? 25575,
  })
}

// DELETE /api/server — clear the user's server config
export async function DELETE(req: NextRequest) {
  const userId = await getSessionUserId(req)
  if (!userId) {
    return Response.json({ ok: false, error: 'Not authenticated' }, { status: 401 })
  }
  try {
    clearUserServer(userId)
    return new Response(JSON.stringify({ ok: true }), {
      headers: {
        'Content-Type': 'application/json',
        'Set-Cookie': `mcraftr_has_server=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`,
      },
    })
  } catch (e: unknown) {
    return Response.json({ ok: false, error: e instanceof Error ? e.message : 'Failed to disconnect' }, { status: 500 })
  }
}

// PUT /api/server — test a connection without saving
export async function PUT(req: NextRequest) {
  const userId = await getSessionUserId(req)
  if (!userId) {
    return Response.json({ ok: false, error: 'Not authenticated' }, { status: 401 })
  }

  try {
    const { host, port, password } = await req.json()
    if (!host || !password) {
      return Response.json({ ok: false, error: 'Host and password are required' }, { status: 400 })
    }
    if (isBlockedHost(host)) {
      return Response.json({ ok: false, error: 'That server address is not allowed' }, { status: 400 })
    }

    const result = await testRconConnection(host.trim(), parsePort(port), password)
    if (!result.ok) {
      return Response.json({
        ok: false,
        error: `Couldn't connect: ${result.error || 'Connection refused'}`,
      })
    }

    // Strip Minecraft color codes (§ followed by any character)
    const clean = (result.stdout || 'OK').replace(/§./g, '')
    return Response.json({ ok: true, message: `Connected! ${clean}` })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Test failed'
    return Response.json({ ok: false, error: msg }, { status: 500 })
  }
}


