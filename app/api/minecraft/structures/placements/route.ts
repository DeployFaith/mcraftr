import { NextRequest } from 'next/server'
import { checkFeatureAccess, getSessionActiveServerId, getUserFeatureFlags } from '@/lib/rcon'
import { requireServerCapability } from '@/lib/server-capability'
import { runBridgeJson } from '@/lib/server-bridge'
import { listStructurePlacements } from '@/lib/structure-placements'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type RelayStructureItem = {
  id?: string
  world?: string
  structureId?: string
  structureLabel?: string
  sourceKind?: string
  bridgeRef?: string | null
  originX?: number
  originY?: number
  originZ?: number
  rotation?: number
  includeAir?: boolean
  minX?: number
  minY?: number
  minZ?: number
  maxX?: number
  maxY?: number
  maxZ?: number
  createdAt?: number
}

type RelayStructuresResponse = {
  ok: boolean
  items?: RelayStructureItem[]
  total?: number
  indexing?: unknown
  error?: string
}

function normalizePlacement(item: RelayStructureItem) {
  if (!item.id || !item.world || !item.structureId || !item.structureLabel) return null
  return {
    id: item.id,
    world: item.world,
    structure_id: item.structureId,
    structure_label: item.structureLabel,
    source_kind: typeof item.sourceKind === 'string' ? item.sourceKind : 'tracked',
    bridge_ref: typeof item.bridgeRef === 'string' ? item.bridgeRef : '',
    placement_kind: typeof item.sourceKind === 'string' && item.sourceKind === 'native' ? 'native-template' : null,
    origin_x: typeof item.originX === 'number' ? item.originX : 0,
    origin_y: typeof item.originY === 'number' ? item.originY : 0,
    origin_z: typeof item.originZ === 'number' ? item.originZ : 0,
    rotation: typeof item.rotation === 'number' ? item.rotation : 0,
    include_air: item.includeAir ? 1 : 0,
    min_x: typeof item.minX === 'number' ? item.minX : 0,
    min_y: typeof item.minY === 'number' ? item.minY : 0,
    min_z: typeof item.minZ === 'number' ? item.minZ : 0,
    max_x: typeof item.maxX === 'number' ? item.maxX : 0,
    max_y: typeof item.maxY === 'number' ? item.maxY : 0,
    max_z: typeof item.maxZ === 'number' ? item.maxZ : 0,
    created_at: typeof item.createdAt === 'number' ? item.createdAt : Date.now(),
  }
}

export async function GET(req: NextRequest) {
  const features = await getUserFeatureFlags(req)
  if (!checkFeatureAccess(features, 'enable_structure_catalog')) {
    return Response.json({ ok: false, error: 'Feature disabled by admin' }, { status: 403 })
  }

  const capability = await requireServerCapability(req, 'full')
  if (!capability.ok) return capability.response

  const serverId = await getSessionActiveServerId(req)
  if (!serverId) {
    return Response.json({ ok: false, error: 'No active server selected' }, { status: 400 })
  }

  const world = req.nextUrl.searchParams.get('world')?.trim() || null
  const x = req.nextUrl.searchParams.get('x')
  const y = req.nextUrl.searchParams.get('y')
  const z = req.nextUrl.searchParams.get('z')
  const radius = req.nextUrl.searchParams.get('radius')

  const hasPoint = world && x !== null && y !== null && z !== null
  const point =
    hasPoint
      ? {
          x: Number(x),
          y: Number(y),
          z: Number(z),
        }
      : null
  const radiusValue = hasPoint && radius !== null ? Number(radius) : null

  const command =
    hasPoint && radiusValue && Number.isFinite(radiusValue) && radiusValue > 0
      ? `structures list ${world} radius ${point!.x} ${point!.y} ${point!.z} ${Math.max(1, Math.floor(radiusValue))}`
      : `structures list ${world ?? '*'}`

  const bridge = await runBridgeJson<RelayStructuresResponse>(req, command)
  if (bridge.ok && bridge.data.ok !== false) {
    let placements = Array.isArray(bridge.data.items)
      ? bridge.data.items.map(normalizePlacement).filter((entry): entry is NonNullable<ReturnType<typeof normalizePlacement>> => !!entry)
      : []

    if (point) {
      placements = placements.filter(entry =>
        point.x >= entry.min_x
        && point.x <= entry.max_x
        && point.y >= entry.min_y
        && point.y <= entry.max_y
        && point.z >= entry.min_z
        && point.z <= entry.max_z,
      )
    }

    return Response.json({
      ok: true,
      placements,
      total: typeof bridge.data.total === 'number' ? bridge.data.total : placements.length,
      indexing: bridge.data.indexing ?? null,
      warning: null,
    })
  }

  const placements = listStructurePlacements(serverId, world ?? undefined, point ?? undefined)
  return Response.json({
    ok: true,
    placements,
    total: placements.length,
    indexing: null,
    warning: 'Relay structure indexing is unavailable, so Mcraftr is showing tracked placements only.',
  })
}
