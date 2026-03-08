import { NextRequest } from 'next/server'
import { deleteUserServer, getUserById, updateUserServer } from '@/lib/users'
import { getSessionUserId } from '@/lib/rcon'

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

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const userId = await getSessionUserId(req)
  if (!userId) return Response.json({ ok: false, error: 'Not authenticated' }, { status: 401 })
  try {
    const { id } = await params
    const {
      label,
      host,
      port,
      password,
      sidecarEnabled,
      sidecarUrl,
      sidecarToken,
      sidecarStructureRoots,
      sidecarEntityPresetRoots,
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
      sidecar: {
        enabled: parseFlag(sidecarEnabled),
        url: typeof sidecarUrl === 'string' ? sidecarUrl.trim() : null,
        token: typeof sidecarToken === 'string' ? sidecarToken : null,
        structureRoots: parseStringArray(sidecarStructureRoots),
        entityPresetRoots: parseStringArray(sidecarEntityPresetRoots),
      },
    })
    const server = user.servers.find(entry => entry.id === id)
    return Response.json({ ok: true, server })
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
  return Response.json({ ok: true, server })
}
