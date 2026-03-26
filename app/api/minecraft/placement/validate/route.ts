import { NextRequest } from 'next/server'
import { getSessionUserId } from '@/lib/rcon'
import { getActiveServer } from '@/lib/users'
import { validatePlacementCoordinates, type PlacementKind } from '@/lib/placement-randomize'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

export async function POST(req: NextRequest) {
  const userId = await getSessionUserId(req)
  if (!userId) {
    return Response.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
  }

  const server = getActiveServer(userId)
  if (!server) {
    return Response.json({ ok: false, error: 'No active server selected' }, { status: 400 })
  }

  const body = await req.json()
  const kind = body.kind === 'structure' ? 'structure' : 'entity'
  const world = typeof body.world === 'string' ? body.world.trim() : ''
  const x = Number(body.x)
  const y = Number(body.y)
  const z = Number(body.z)

  if (!world || !isFiniteNumber(x) || !isFiniteNumber(y) || !isFiniteNumber(z)) {
    return Response.json({ ok: false, error: 'World and coordinates are required' }, { status: 400 })
  }

  const result = await validatePlacementCoordinates({
    host: server.host,
    port: server.port,
    password: server.password,
    world,
    kind: kind as PlacementKind,
    width: isFiniteNumber(body.width) ? Math.max(1, Math.floor(body.width)) : 1,
    height: isFiniteNumber(body.height) ? Math.max(1, Math.floor(body.height)) : 1,
    length: isFiniteNumber(body.length) ? Math.max(1, Math.floor(body.length)) : 1,
    rotation: isFiniteNumber(body.rotation) ? body.rotation : 0,
  }, x, y, z)

  return Response.json({ ...result, world })
}
