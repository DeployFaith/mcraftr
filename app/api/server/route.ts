import { NextRequest } from 'next/server'
import { createUserServer, deleteUserServer, getUserById, updateUserServer } from '@/lib/users'
import { testRconConnection, getSessionUserId } from '@/lib/rcon'

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
  return Response.json({
    ok: true,
    configured: !!user.server,
    id: user.activeServerId,
    label: user.serverLabel,
    host: user.server?.host ?? null,
    port: user.server?.port ?? 25575,
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
    const { host, port, password } = await req.json()
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
    return Response.json({ ok: true, message: `Connected! ${clean}` })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Test failed'
    return Response.json({ ok: false, error: msg }, { status: 500 })
  }
}
