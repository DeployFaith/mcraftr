import { NextRequest } from 'next/server'
import { logAudit } from '@/lib/audit'
import { checkFeatureAccess, getSessionActiveServerId, getSessionUserId, getUserFeatureFlags } from '@/lib/rcon'
import { requireServerCapability } from '@/lib/server-capability'
import { runBridgeJson } from '@/lib/server-bridge'
import { listAllStructurePlacements, markStructurePlacementRemoved, type StructurePlacement } from '@/lib/structure-placements'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type BridgeResponse = {
  ok: boolean
  matchedCount?: number
  removedCount?: number
  failedCount?: number
  world?: string | null
  radius?: number | null
  warning?: string | null
  error?: string
}

async function removeTrackedPlacement(req: NextRequest, placement: StructurePlacement) {
  const isNative = placement.source_kind === 'native'
  const command = isNative
    ? `structures clear ${placement.world} ${placement.origin_x} ${placement.origin_y} ${placement.origin_z} ${placement.max_x - placement.min_x + 1} ${placement.max_y - placement.min_y + 1} ${placement.max_z - placement.min_z + 1} ${placement.rotation}`
    : `structures remove ${placement.bridge_ref} ${placement.world} ${placement.origin_x} ${placement.origin_y} ${placement.origin_z} ${placement.rotation} ${placement.include_air ? 'air' : 'noair'}`
  return runBridgeJson<BridgeResponse>(req, command)
}

async function removeListedStructures(req: NextRequest, ids: string[]) {
  let removedCount = 0
  for (const id of ids) {
    const bridge = await runBridgeJson<{ ok: boolean; error?: string }>(req, `structures remove ${id}`)
    if (bridge.ok && bridge.data.ok !== false) removedCount += 1
  }

  return {
    ok: removedCount > 0 || ids.length === 0,
    matchedCount: ids.length,
    removedCount,
    failedCount: Math.max(0, ids.length - removedCount),
    warning: ids.length > removedCount ? `${ids.length - removedCount} listed structures could not be removed.` : null,
  }
}

async function clearTrackedFallback(req: NextRequest, serverId: string, world: string | null, mode: string) {
  if (mode === 'radius') return null
  const placements = listAllStructurePlacements(serverId, mode === 'all' ? undefined : world ?? undefined)
  let removedCount = 0
  for (const placement of placements) {
    const bridge = await removeTrackedPlacement(req, placement)
    if (bridge.ok && bridge.data.ok !== false) {
      markStructurePlacementRemoved(placement.id, serverId)
      removedCount += 1
    }
  }
  return {
    ok: removedCount > 0 || placements.length === 0,
    matchedCount: placements.length,
    removedCount,
    failedCount: Math.max(0, placements.length - removedCount),
    warning: placements.length > removedCount ? `${placements.length - removedCount} tracked structures could not be removed.` : 'Relay structure indexing is unavailable, so Mcraftr removed tracked placements only.',
  }
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

  const serverId = await getSessionActiveServerId(req)
  if (!serverId) {
    return Response.json({ ok: false, error: 'No active server selected' }, { status: 400 })
  }

  const body = await req.json().catch(() => ({})) as Record<string, unknown>
  const world = typeof body.world === 'string' && body.world.trim() ? body.world.trim() : null
  const mode = typeof body.mode === 'string' ? body.mode.trim() : 'listed'
  const radius = typeof body.radius === 'number' && Number.isFinite(body.radius) ? Math.max(1, Math.floor(body.radius)) : null
  const x = typeof body.x === 'number' && Number.isFinite(body.x) ? body.x : null
  const y = typeof body.y === 'number' && Number.isFinite(body.y) ? body.y : null
  const z = typeof body.z === 'number' && Number.isFinite(body.z) ? body.z : null
  const structureIds = Array.isArray(body.structureIds)
    ? Array.from(new Set(body.structureIds.filter((value: unknown): value is string => typeof value === 'string' && value.trim().length > 0)))
    : []

  let result:
    | BridgeResponse
    | {
        ok: boolean
        matchedCount: number
        removedCount: number
        failedCount: number
        warning: string | null
      }

  if (mode === 'listed') {
    if (structureIds.length === 0) {
      return Response.json({ ok: false, error: 'At least one structure id is required' }, { status: 400 })
    }
    result = await removeListedStructures(req, structureIds)
  } else if (mode === 'radius') {
    if (!world || x === null || y === null || z === null || radius === null) {
      return Response.json({ ok: false, error: 'World, coordinates, and radius are required for radius clears' }, { status: 400 })
    }
    const bridge = await runBridgeJson<BridgeResponse>(req, `structures clear radius ${world} ${x} ${y} ${z} ${radius}`)
    if (!bridge.ok || bridge.data.ok === false) {
      const fallback = await clearTrackedFallback(req, serverId, world, mode)
      if (!fallback) {
        return Response.json(
          { ok: false, error: bridge.ok ? bridge.data.error || 'Failed to clear structures in radius' : bridge.error },
          { status: 502 },
        )
      }
      result = fallback
    } else {
      result = bridge.data
    }
  } else if (mode === 'world' || mode === 'all') {
    const scope = mode === 'all' ? '*' : world
    if (!scope) {
      return Response.json({ ok: false, error: 'World is required for world clears' }, { status: 400 })
    }
    const bridge = await runBridgeJson<BridgeResponse>(req, `structures clear ${scope}`)
    if (!bridge.ok || bridge.data.ok === false) {
      const fallback = await clearTrackedFallback(req, serverId, world, mode)
      if (!fallback) {
        return Response.json(
          { ok: false, error: bridge.ok ? bridge.data.error || 'Failed to clear structures' : bridge.error },
          { status: 502 },
        )
      }
      result = fallback
    } else {
      result = bridge.data
    }
  } else {
    return Response.json({ ok: false, error: 'Unsupported clear mode' }, { status: 400 })
  }

  if (!result.ok) {
    return Response.json({ ok: false, error: 'Failed to clear structures' }, { status: 502 })
  }

  const removedCount = typeof result.removedCount === 'number' ? result.removedCount : 0
  const failedCount = typeof result.failedCount === 'number' ? result.failedCount : 0
  const userId = await getSessionUserId(req)
  if (userId) {
    const scopeLabel =
      mode === 'listed'
        ? world ?? 'listed-structures'
        : mode === 'radius'
          ? `${world} radius ${radius}`
          : mode === 'world'
            ? world ?? 'world'
            : 'all-worlds'
    logAudit(
      userId,
      'structure_clear',
      scopeLabel,
      `${removedCount} structure${removedCount === 1 ? '' : 's'} removed${failedCount > 0 ? ` (${failedCount} failed)` : ''}`,
      serverId,
    )
  }

  return Response.json({
    ok: true,
    matchedCount: typeof result.matchedCount === 'number' ? result.matchedCount : removedCount + failedCount,
    removedCount,
    failedCount,
    world: 'world' in result ? (result.world ?? world) : world,
    radius: 'radius' in result ? (result.radius ?? radius) : radius,
    warning: 'warning' in result ? (result.warning ?? null) : null,
  })
}
