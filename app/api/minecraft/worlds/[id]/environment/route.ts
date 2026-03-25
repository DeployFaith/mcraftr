import { NextRequest } from 'next/server'
import { logAudit } from '@/lib/audit'
import { checkFeatureAccess, getSessionActiveServerId, getSessionUserId, getUserFeatureFlags, rconForRequest } from '@/lib/rcon'
import { requireServerCapability } from '@/lib/server-capability'
import { runBridgeJson } from '@/lib/server-bridge'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type EnvironmentResponse = {
  ok: boolean
  world?: Record<string, unknown>
  changed?: {
    kind?: string
    key?: string
    value?: string | number | null
  }
  error?: string
}

type WorldsListResponse = {
  ok: boolean
  defaultWorld: string | null
}

const TIME_PRESETS = new Set(['sunrise', 'day', 'noon', 'sunset', 'night', 'midnight'])
const WEATHER_PRESETS = new Set(['clear', 'rain', 'thunder', 'storm'])

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const features = await getUserFeatureFlags(req)
  if (!checkFeatureAccess(features, 'enable_world')) {
    return Response.json({ ok: false, error: 'Feature disabled by admin' }, { status: 403 })
  }

  const capability = await requireServerCapability(req, 'full')
  if (!capability.ok) return capability.response

  const { id } = await params
  const body = await req.json().catch(() => ({}))
  const kind = typeof body.kind === 'string' ? body.kind.trim().toLowerCase() : ''
  const value = typeof body.value === 'string' || typeof body.value === 'number' ? String(body.value).trim().toLowerCase() : ''

  if (kind !== 'time' && kind !== 'weather') {
    return Response.json({ ok: false, error: 'Unsupported environment control' }, { status: 400 })
  }

  let normalizedValue = value
  if (kind === 'time') {
    const numeric = Number.parseInt(value, 10)
    if (!TIME_PRESETS.has(value) && (!Number.isFinite(numeric) || numeric < 0 || numeric > 23999)) {
      return Response.json({ ok: false, error: 'Time must be a preset or a value between 0 and 23999' }, { status: 400 })
    }
    if (value === 'sunrise') normalizedValue = '23000'
    if (value === 'noon') normalizedValue = '6000'
    if (value === 'sunset') normalizedValue = '12000'
    if (value === 'midnight') normalizedValue = '18000'
  }

  if (kind === 'weather' && !WEATHER_PRESETS.has(value)) {
    return Response.json({ ok: false, error: 'Weather must be clear, rain, thunder, or storm' }, { status: 400 })
  }

  if (kind === 'weather' && value === 'storm') {
    normalizedValue = 'thunder'
  }

  const worldsList = await runBridgeJson<WorldsListResponse>(req, 'worlds list')
  const defaultWorld = worldsList.ok ? worldsList.data.defaultWorld?.trim() || null : null
  const targetsDefaultWorld = defaultWorld ? defaultWorld.toLowerCase() === id.toLowerCase() : false

  if (targetsDefaultWorld) {
    const command = kind === 'time'
      ? `time set ${normalizedValue}`
      : `weather ${normalizedValue}`
    const result = await rconForRequest(req, command)
    if (!result.ok) {
      return Response.json({ ok: false, error: result.error || 'Failed to update world environment' }, { status: 502 })
    }

    const userId = await getSessionUserId(req)
    const serverId = await getSessionActiveServerId(req)
    if (userId) {
      logAudit(userId, 'world_setting', id, `${kind}=${normalizedValue}`, serverId)
    }

    return Response.json({
      ok: true,
      world: null,
      changed: { kind, key: kind, value: normalizedValue },
      message: `${kind === 'time' ? 'Time' : 'Weather'} updated for ${id}`,
    })
  }

  const command = `worlds set ${id} ${kind} ${normalizedValue}`
  const bridge = await runBridgeJson<EnvironmentResponse>(req, command)
  if (!bridge.ok || bridge.data.ok === false) {
    return Response.json({ ok: false, error: bridge.ok ? bridge.data.error || 'Per-world time/weather controls are not available for this world on the current bridge.' : bridge.error }, { status: 502 })
  }

  const userId = await getSessionUserId(req)
  const serverId = await getSessionActiveServerId(req)
  if (userId) {
    logAudit(userId, 'world_setting', id, `${kind}=${normalizedValue}`, serverId)
  }

  return Response.json({ ok: true, world: bridge.data.world ?? null, changed: bridge.data.changed ?? { kind, key: kind, value: normalizedValue } })
}
