import { NextRequest } from 'next/server'
import { getSessionUserId } from '@/lib/rcon'
import { getActiveServer } from '@/lib/users'
import { randomizePlacementCoordinates, type PlacementKind } from '@/lib/placement-randomize'
import { runBridgeJson } from '@/lib/server-bridge'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type PlayerLocateResponse = {
  ok: boolean
  world?: string
  location?: { x: number; y: number; z: number }
}

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
  let world = typeof body.world === 'string' ? body.world.trim() : ''
  const player = typeof body.player === 'string' ? body.player.trim() : ''
  let anchorX = isFiniteNumber(body.anchorX) ? body.anchorX : null
  let anchorY = isFiniteNumber(body.anchorY) ? body.anchorY : null
  let anchorZ = isFiniteNumber(body.anchorZ) ? body.anchorZ : null

  if (player) {
    const locate = await runBridgeJson<PlayerLocateResponse>(req, `player locate ${player}`)
    if (locate.ok && locate.data.ok && locate.data.location && typeof locate.data.world === 'string') {
      world = locate.data.world
      anchorX = locate.data.location.x
      anchorY = locate.data.location.y
      anchorZ = locate.data.location.z
    }
  }

  if (!world) {
    return Response.json({ ok: false, error: 'World is required for coordinate randomization' }, { status: 400 })
  }

  const result = await randomizePlacementCoordinates({
    host: server.host,
    port: server.port,
    password: server.password,
    world,
    kind: kind as PlacementKind,
    anchorX,
    anchorY,
    anchorZ,
    width: isFiniteNumber(body.width) ? Math.max(1, Math.floor(body.width)) : 1,
    height: isFiniteNumber(body.height) ? Math.max(1, Math.floor(body.height)) : 1,
    length: isFiniteNumber(body.length) ? Math.max(1, Math.floor(body.length)) : 1,
    rotation: isFiniteNumber(body.rotation) ? body.rotation : 0,
  })

  return Response.json({ ...result, world })
}
