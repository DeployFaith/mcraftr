import { NextRequest } from 'next/server'
import { checkFeatureAccess, getSessionActiveServerId, getSessionUserId, getUserFeatureFlags, rconForRequest } from '@/lib/rcon'
import { logAudit } from '@/lib/audit'
import { requireServerCapability } from '@/lib/server-capability'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

export async function POST(req: NextRequest) {
  const features = await getUserFeatureFlags(req)
  if (!checkFeatureAccess(features, 'enable_structure_catalog')) {
    return Response.json({ ok: false, error: 'Feature disabled by admin' }, { status: 403 })
  }
  if (!checkFeatureAccess(features, 'enable_structure_remove')) {
    return Response.json({ ok: false, error: 'Feature disabled by admin' }, { status: 403 })
  }

  const capability = await requireServerCapability(req, 'full')
  if (!capability.ok) return capability.response

  const { world, x, y, z, width, height, length } = await req.json()
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

  const result = await rconForRequest(
    req,
    `execute in ${world.trim()} run fill ${x} ${y} ${z} ${x + Math.max(1, Math.floor(width)) - 1} ${y + Math.max(1, Math.floor(height)) - 1} ${z + Math.max(1, Math.floor(length)) - 1} minecraft:air replace`,
  )
  if (!result.ok) {
    return Response.json({ ok: false, error: result.error || 'Failed to clear structure area' }, { status: 502 })
  }

  const userId = await getSessionUserId(req)
  const serverId = await getSessionActiveServerId(req)
  if (userId) {
    logAudit(userId, 'structure_clear', world.trim(), `${x},${y},${z} size=${width}x${height}x${length}`, serverId)
  }

  return Response.json({ ok: true, world: world.trim() })
}
