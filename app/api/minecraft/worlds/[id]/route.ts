import { NextRequest } from 'next/server'
import { logAudit } from '@/lib/audit'
import { checkFeatureAccess, getSessionActiveServerId, getSessionUserId, getUserFeatureFlags } from '@/lib/rcon'
import { runBridgeJson } from '@/lib/server-bridge'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type WorldSettings = Record<string, unknown> & {
  name: string
  gamerules?: Record<string, boolean | null> | null
}

type WorldSettingsResponse = {
  ok: boolean
  world?: WorldSettings
  changed?: {
    kind?: string
    key?: string
    value?: string | boolean | null
  }
  error?: string
}

const WORLD_GAMERULES = new Set([
  'keepInventory',
  'mobGriefing',
  'pvp',
  'doDaylightCycle',
  'doWeatherCycle',
  'doFireTick',
  'doMobSpawning',
  'naturalRegeneration',
  'announceAdvancements',
  'commandBlockOutput',
  'sendCommandFeedback',
  'showDeathMessages',
  'doImmediateRespawn',
  'forgiveDeadPlayers',
  'universalAnger',
])

const WORLD_SETTINGS = new Set(['alias', 'pvp', 'flight', 'weather', 'hidden', 'autoload', 'difficulty'])

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const features = await getUserFeatureFlags(req)
  if (!checkFeatureAccess(features, 'enable_world_inventory')) {
    return Response.json({ ok: false, error: 'Feature disabled by admin' }, { status: 403 })
  }

  const { id } = await params
  const bridge = await runBridgeJson<WorldSettingsResponse>(req, `worlds settings ${id}`)
  if (!bridge.ok || bridge.data.ok === false) {
    return Response.json({ ok: false, error: bridge.ok ? bridge.data.error || 'Failed to load world settings' : bridge.error }, { status: 502 })
  }

  const world = bridge.data.world
  if (!world || typeof world.name !== 'string' || world.name.toLowerCase() !== id.toLowerCase()) {
    return Response.json({ ok: false, error: 'World not found' }, { status: 404 })
  }

  return Response.json({ ok: true, world })
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const features = await getUserFeatureFlags(req)
  const { id } = await params
  const body = await req.json().catch(() => ({}))
  const key = typeof body.key === 'string' ? body.key.trim() : ''
  const requestedKind = typeof body.kind === 'string' ? body.kind.trim().toLowerCase() : ''
  const value = body.value

  if (!key) {
    return Response.json({ ok: false, error: 'Setting key is required' }, { status: 400 })
  }

  const isWorldSetting = WORLD_SETTINGS.has(key)
  const isKnownGamerule = WORLD_GAMERULES.has(key)
  const isGamerule = requestedKind === 'gamerule'
    ? isKnownGamerule
    : requestedKind === 'setting'
      ? false
      : !isWorldSetting && isKnownGamerule

  if (!isWorldSetting && !isKnownGamerule) {
    return Response.json({ ok: false, error: 'Feature disabled by admin or unsupported setting' }, { status: 403 })
  }

  if (isGamerule) {
    if (!checkFeatureAccess(features, 'enable_admin_rules')) {
      return Response.json({ ok: false, error: 'Feature disabled by admin' }, { status: 403 })
    }
  } else if (!checkFeatureAccess(features, 'enable_world_build_tools')) {
    return Response.json({ ok: false, error: 'Feature disabled by admin or unsupported setting' }, { status: 403 })
  }

  const command = isGamerule
    ? `worlds set ${id} gamerule ${key} ${value === true || value === 'true' ? 'true' : 'false'}`
    : `worlds set ${id} ${key} ${String(value ?? '').trim()}`

  const bridge = await runBridgeJson<WorldSettingsResponse>(req, command)
  if (!bridge.ok || bridge.data.ok === false) {
    return Response.json({
      ok: false,
      error: bridge.ok ? bridge.data.error || 'Failed to update world setting' : bridge.error,
    }, { status: 502 })
  }

  const userId = await getSessionUserId(req)
  const serverId = await getSessionActiveServerId(req)
  if (userId) {
    logAudit(userId, 'world_setting', id, `${key}=${String(value)}`, serverId)
  }

  return Response.json({ ok: true, world: bridge.data.world ?? null, changed: bridge.data.changed ?? null })
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const features = await getUserFeatureFlags(req)
  if (!checkFeatureAccess(features, 'enable_world_build_tools')) {
    return Response.json({ ok: false, error: 'Feature disabled by admin' }, { status: 403 })
  }

  const { id } = await params
  const bridge = await runBridgeJson<{ ok: boolean; world?: string; error?: string }>(req, `worlds delete ${id}`)
  if (!bridge.ok || bridge.data.ok === false) {
    return Response.json({
      ok: false,
      error: bridge.ok ? bridge.data.error || 'Failed to delete world' : bridge.error,
    }, { status: 502 })
  }

  const userId = await getSessionUserId(req)
  const serverId = await getSessionActiveServerId(req)
  if (userId) {
    logAudit(userId, 'world_delete', id, undefined, serverId)
  }

  return Response.json({ ok: true, world: bridge.data.world ?? id })
}
