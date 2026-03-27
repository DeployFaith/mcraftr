import { NextRequest } from 'next/server'
import { logAudit } from '@/lib/audit'
import { checkFeatureAccess, getSessionActiveServerId, getSessionUserId, getUserFeatureFlags, rconForRequest } from '@/lib/rcon'
import { requireServerCapability } from '@/lib/server-capability'
import { runBridgeJson } from '@/lib/server-bridge'

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

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function uuidToSelector(uuid: string) {
  const hex = uuid.replace(/-/g, '')
  const ints: number[] = []
  for (let index = 0; index < 4; index += 1) {
    const chunk = hex.slice(index * 8, (index + 1) * 8)
    let value = Number.parseInt(chunk, 16)
    if (value > 0x7fffffff) value -= 0x100000000
    ints.push(value)
  }
  return `@e[nbt={UUID:[I;${ints.join(',')}]}]`
}

async function removeListedEntities(req: NextRequest, uuids: string[]) {
  let removedCount = 0
  for (const uuid of uuids) {
    const bridge = await runBridgeJson<{ ok: boolean; error?: string }>(req, `entities remove ${uuid}`)
    if (bridge.ok && bridge.data.ok !== false) {
      removedCount += 1
      continue
    }
    const result = await rconForRequest(req, `kill ${uuidToSelector(uuid)}`)
    if (result.ok) removedCount += 1
  }

  return {
    ok: removedCount > 0 || uuids.length === 0,
    matchedCount: uuids.length,
    removedCount,
    failedCount: Math.max(0, uuids.length - removedCount),
    warning: uuids.length > removedCount ? `${uuids.length - removedCount} listed entities could not be removed.` : null,
  }
}

export async function POST(req: NextRequest) {
  const userId = await getSessionUserId(req)
  if (!userId) return Response.json({ ok: false, error: 'Unauthorized' }, { status: 401 })

  const features = await getUserFeatureFlags(req)
  if (!checkFeatureAccess(features, 'enable_entity_catalog')) {
    return Response.json({ ok: false, error: 'Feature disabled by admin' }, { status: 403 })
  }
  if (!checkFeatureAccess(features, 'enable_entity_live_tools')) {
    return Response.json({ ok: false, error: 'Feature disabled by admin' }, { status: 403 })
  }

  const capability = await requireServerCapability(req, 'full')
  if (!capability.ok) return capability.response

  const body = await req.json().catch(() => ({})) as Record<string, unknown>
  const world = typeof body.world === 'string' && body.world.trim() ? body.world.trim() : null
  const mode = typeof body.mode === 'string' ? body.mode.trim() : 'listed'
  const radius = typeof body.radius === 'number' && Number.isFinite(body.radius) ? Math.max(1, Math.floor(body.radius)) : null
  const x = typeof body.x === 'number' && Number.isFinite(body.x) ? body.x : null
  const y = typeof body.y === 'number' && Number.isFinite(body.y) ? body.y : null
  const z = typeof body.z === 'number' && Number.isFinite(body.z) ? body.z : null
  const uuids = Array.isArray(body.uuids)
    ? Array.from(new Set(body.uuids.filter((value: unknown): value is string => typeof value === 'string' && UUID_RE.test(value))))
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
    if (uuids.length === 0) {
      return Response.json({ ok: false, error: 'At least one valid entity UUID is required' }, { status: 400 })
    }
    result = await removeListedEntities(req, uuids)
  } else if (mode === 'radius') {
    if (!world || x === null || y === null || z === null || radius === null) {
      return Response.json({ ok: false, error: 'World, coordinates, and radius are required for radius clears' }, { status: 400 })
    }
    const bridge = await runBridgeJson<BridgeResponse>(req, `entities clear radius ${world} ${x} ${y} ${z} ${radius}`)
    if (!bridge.ok || bridge.data.ok === false) {
      return Response.json(
        { ok: false, error: bridge.ok ? bridge.data.error || 'Failed to clear entities in radius' : bridge.error },
        { status: 502 },
      )
    }
    result = bridge.data
  } else if (mode === 'world' || mode === 'all') {
    const scope = mode === 'all' ? '*' : world
    if (!scope) {
      return Response.json({ ok: false, error: 'World is required for world clears' }, { status: 400 })
    }
    const bridge = await runBridgeJson<BridgeResponse>(req, `entities clear ${scope}`)
    if (!bridge.ok || bridge.data.ok === false) {
      return Response.json(
        { ok: false, error: bridge.ok ? bridge.data.error || 'Failed to clear entities' : bridge.error },
        { status: 502 },
      )
    }
    result = bridge.data
  } else {
    return Response.json({ ok: false, error: 'Unsupported clear mode' }, { status: 400 })
  }

  if (!result.ok) {
    return Response.json({ ok: false, error: 'Failed to clear entities' }, { status: 502 })
  }

  const removedCount = typeof result.removedCount === 'number' ? result.removedCount : 0
  const failedCount = typeof result.failedCount === 'number' ? result.failedCount : 0
  const serverId = await getSessionActiveServerId(req)

  const scopeLabel =
    mode === 'listed'
      ? world ?? 'listed-live-entities'
      : mode === 'radius'
        ? `${world} radius ${radius}`
        : mode === 'world'
          ? world ?? 'world'
          : 'all-worlds'
  logAudit(
    userId,
    'entity_clear',
    scopeLabel,
    `${removedCount} entit${removedCount === 1 ? 'y' : 'ies'} removed${failedCount > 0 ? ` (${failedCount} failed)` : ''}`,
    serverId,
  )

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
