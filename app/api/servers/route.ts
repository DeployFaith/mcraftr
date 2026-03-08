import { NextRequest } from 'next/server'
import { createUserServer, getUserById, listUserServers } from '@/lib/users'
import { getSessionUserId } from '@/lib/rcon'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function parsePort(raw: unknown, fallback = 25575): number {
  const n = parseInt(String(raw))
  if (!Number.isInteger(n) || n < 1 || n > 65535) return fallback
  return n
}

export async function GET(req: NextRequest) {
  const userId = await getSessionUserId(req)
  if (!userId) return Response.json({ ok: false, error: 'Not authenticated' }, { status: 401 })
  const user = getUserById(userId)
  if (!user) return Response.json({ ok: false, error: 'User not found' }, { status: 404 })
  return Response.json({
    ok: true,
    activeServerId: user.activeServerId,
    servers: listUserServers(userId).map(server => ({
      id: server.id,
      label: server.label,
      host: server.host,
      port: server.port,
      createdAt: server.createdAt,
      updatedAt: server.updatedAt,
    })),
  })
}

export async function POST(req: NextRequest) {
  const userId = await getSessionUserId(req)
  if (!userId) return Response.json({ ok: false, error: 'Not authenticated' }, { status: 401 })
  try {
    const { label, host, port, password } = await req.json()
    if (!host || typeof host !== 'string' || !password || typeof password !== 'string') {
      return Response.json({ ok: false, error: 'Host and password are required' }, { status: 400 })
    }
    const server = createUserServer(userId, {
      label: typeof label === 'string' ? label.trim() : null,
      host: host.trim(),
      port: parsePort(port),
      password,
    })
    return Response.json({
      ok: true,
      server: {
        id: server.id,
        label: server.label,
        host: server.host,
        port: server.port,
        createdAt: server.createdAt,
        updatedAt: server.updatedAt,
      },
    })
  } catch (e: unknown) {
    return Response.json({ ok: false, error: e instanceof Error ? e.message : 'Failed to save server' }, { status: 500 })
  }
}
