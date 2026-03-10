import { NextRequest } from 'next/server'
import { checkFeatureAccess, getSessionActiveServerId, getSessionUserId, getUserFeatureFlags } from '@/lib/rcon'
import { logAudit } from '@/lib/audit'
import { runBridgeJson } from '@/lib/server-bridge'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type BridgeResponse = {
  ok: boolean
  world?: string
  spawn?: { x: number; y: number; z: number }
  error?: string
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const features = await getUserFeatureFlags(req)
  if (!checkFeatureAccess(features, 'enable_world_spawn_tools')) {
    return Response.json({ ok: false, error: 'Feature disabled by admin' }, { status: 403 })
  }

  const { id } = await params
  const body = await req.json()
  const locationMode = body.locationMode === 'coords' ? 'coords' : 'player'
  let command = `worlds setspawn ${id}`

  if (locationMode === 'player') {
    const player = typeof body.player === 'string' ? body.player.trim() : ''
    if (!player) return Response.json({ ok: false, error: 'Player target is required' }, { status: 400 })
    command += ` player ${player}`
  } else {
    const x = Number(body.x)
    const y = Number(body.y)
    const z = Number(body.z)
    if (!isFiniteNumber(x) || !isFiniteNumber(y) || !isFiniteNumber(z)) {
      return Response.json({ ok: false, error: 'Coordinates are required' }, { status: 400 })
    }
    command += ` coords ${x} ${y} ${z}`
  }

  const bridge = await runBridgeJson<BridgeResponse>(req, command)
  if (!bridge.ok || bridge.data.ok === false) {
    return Response.json({ ok: false, error: bridge.ok ? bridge.data.error || 'Failed to update world spawn' : bridge.error }, { status: 502 })
  }

  const userId = await getSessionUserId(req)
  const serverId = await getSessionActiveServerId(req)
  if (userId) {
    logAudit(userId, 'world_spawn', id, locationMode === 'player' ? `player=${body.player}` : `coords=${body.x},${body.y},${body.z}`, serverId)
  }

  return Response.json({ ok: true, world: bridge.data.world ?? id, spawn: bridge.data.spawn ?? null })
}
