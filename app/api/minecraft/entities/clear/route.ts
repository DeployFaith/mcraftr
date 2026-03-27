import { NextRequest } from 'next/server'
import { logAudit } from '@/lib/audit'
import { checkFeatureAccess, getSessionActiveServerId, getSessionUserId, getUserFeatureFlags, rconForRequest } from '@/lib/rcon'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

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

  const body = await req.json().catch(() => ({})) as Record<string, unknown>
  const world = typeof body.world === 'string' && body.world.trim() ? body.world.trim() : null
  const uuids = Array.isArray(body.uuids)
    ? Array.from(new Set(body.uuids.filter((value: unknown): value is string => typeof value === 'string' && UUID_RE.test(value))))
    : []

  if (uuids.length === 0) {
    return Response.json({ ok: false, error: 'At least one valid entity UUID is required' }, { status: 400 })
  }

  let removedCount = 0
  for (const uuid of uuids) {
    const result = await rconForRequest(req, `kill ${uuidToSelector(uuid)}`)
    if (result.ok) removedCount += 1
  }

  if (removedCount === 0) {
    return Response.json({ ok: false, error: 'Failed to remove any listed entities' }, { status: 502 })
  }

  const failedCount = uuids.length - removedCount
  const serverId = await getSessionActiveServerId(req)
  logAudit(
    userId,
    'entity_clear',
    world ?? 'all-loaded-worlds',
    `${removedCount} listed entit${removedCount === 1 ? 'y' : 'ies'} removed${failedCount > 0 ? ` (${failedCount} failed)` : ''}`,
    serverId,
  )

  return Response.json({
    ok: true,
    removedCount,
    failedCount,
    world,
    warning: failedCount > 0 ? `${failedCount} listed entities could not be removed.` : null,
  })
}
