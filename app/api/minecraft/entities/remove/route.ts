import { NextRequest } from 'next/server'
import { logAudit } from '@/lib/audit'
import { checkFeatureAccess, getSessionActiveServerId, getSessionUserId, getUserFeatureFlags, rconForRequest } from '@/lib/rcon'
import { requireServerCapability } from '@/lib/server-capability'
import { runBridgeJson } from '@/lib/server-bridge'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type BridgeResponse = {
  ok: boolean
  world?: string | null
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
  const uuid = typeof body.uuid === 'string' ? body.uuid.trim() : ''
  const world = typeof body.world === 'string' && body.world.trim() ? body.world.trim() : null
  const label = typeof body.label === 'string' && body.label.trim() ? body.label.trim() : uuid

  if (!UUID_RE.test(uuid)) {
    return Response.json({ ok: false, error: 'A valid entity UUID is required' }, { status: 400 })
  }

  const result = await rconForRequest(req, `kill ${uuidToSelector(uuid)}`)
  if (!result.ok) {
    const bridge = await runBridgeJson<BridgeResponse>(req, `entities remove ${uuid}`)
    if (!bridge.ok || bridge.data.ok === false) {
      return Response.json(
        { ok: false, error: bridge.ok ? bridge.data.error || result.error || 'Failed to remove entity' : bridge.error || result.error || 'Failed to remove entity' },
        { status: 502 },
      )
    }
    const serverId = await getSessionActiveServerId(req)
    const resolvedWorld = bridge.data.world ?? world
    logAudit(userId, 'entity_remove', label, resolvedWorld ? `${resolvedWorld} · ${uuid}` : uuid, serverId)
    return Response.json({ ok: true, uuid, world: bridge.data.world ?? world, provider: 'relay' })
  }

  const serverId = await getSessionActiveServerId(req)
  logAudit(userId, 'entity_remove', label, world ? `${world} · ${uuid}` : uuid, serverId)

  return Response.json({ ok: true, uuid, world, provider: 'vanilla-rcon' })
}
