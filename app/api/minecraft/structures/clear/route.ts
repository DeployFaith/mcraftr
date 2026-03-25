import { NextRequest } from 'next/server'
import { checkFeatureAccess, getSessionActiveServerId, getSessionUserId, getUserFeatureFlags } from '@/lib/rcon'
import { logAudit } from '@/lib/audit'
import { requireServerCapability } from '@/lib/server-capability'
import { runBridgeJson } from '@/lib/server-bridge'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type BridgeResponse = {
  ok: boolean
  world?: string
  error?: string
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

export async function POST(req: NextRequest) {
  const features = await getUserFeatureFlags(req)
  if (!checkFeatureAccess(features, 'enable_structure_catalog')) {
    return Response.json({ ok: false, error: 'Feature disabled by admin' }, { status: 403 })
  }

  const capability = await requireServerCapability(req, 'full')
  if (!capability.ok) return capability.response

  const { world, x, y, z, width, height, length, rotation } = await req.json()
  if (
    typeof world !== 'string' ||
    !isFiniteNumber(x) ||
    !isFiniteNumber(y) ||
    !isFiniteNumber(z) ||
    !isFiniteNumber(width) ||
    !isFiniteNumber(height) ||
    !isFiniteNumber(length)
  ) {
    return Response.json({ ok: false, error: 'World, coords, and dimensions are required' }, { status: 400 })
  }

  const bridge = await runBridgeJson<BridgeResponse>(
    req,
    `structures clear ${world.trim()} ${x} ${y} ${z} ${Math.max(1, Math.floor(width))} ${Math.max(1, Math.floor(height))} ${Math.max(1, Math.floor(length))} ${[0, 90, 180, 270].includes(Number(rotation)) ? Number(rotation) : 0}`,
  )
  if (!bridge.ok || bridge.data.ok === false) {
    return Response.json({ ok: false, error: bridge.ok ? bridge.data.error || 'Failed to clear structure area' : bridge.error }, { status: 502 })
  }

  const userId = await getSessionUserId(req)
  const serverId = await getSessionActiveServerId(req)
  if (userId) {
    logAudit(userId, 'structure_clear', world.trim(), `${x},${y},${z} size=${width}x${height}x${length}`, serverId)
  }

  return Response.json({ ok: true, world: bridge.data.world ?? world.trim() })
}
