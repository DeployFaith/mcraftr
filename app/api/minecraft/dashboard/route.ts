import { NextRequest } from 'next/server'
import { getSessionUserId, rconForRequest, getUserFeatureFlags, checkFeatureAccess, getSessionActiveServerId } from '@/lib/rcon'
import { getActiveServer, getUserById } from '@/lib/users'
import { getAuditLog } from '@/lib/audit'
import { getDb } from '@/lib/db'
import { ensureScheduleRunnerStarted } from '@/lib/schedules'
import { callSidecarForRequest, runBridgeJson } from '@/lib/server-bridge'
import { getServerStackDescription, getServerStackLabel } from '@/lib/server-stack'

type DashboardWorldSettingsResponse = {
  ok: boolean
  world?: {
    name: string
    pvp?: boolean | null
    gamerules?: Record<string, boolean | null> | null
  }
  error?: string
}

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function parseList(raw: string): { online: number; max: number; players: string[] } {
  const m = raw.match(/There are (\d+)\s+(?:of a max(?:\s+of)?|out of maximum)\s+(\d+)/)
  const playersMatch = raw.match(/online[.:]+\s*([\s\S]+)/)
  const players = playersMatch
    ? playersMatch[1].split(',').map(entry => entry.trim().replace(/^\w+:\s*/, '')).filter(Boolean)
    : []
  return {
    online: m ? parseInt(m[1], 10) : players.length,
    max: m ? parseInt(m[2], 10) : 0,
    players,
  }
}

function parseVersion(raw: string): string {
  const firstLine = raw.split('\n')[0].trim()
  const paperNew = firstLine.match(/running Paper version (\d+\.\d+[\d.]*)/)
  if (paperNew) return paperNew[1]
  const mc = firstLine.match(/\(MC:\s*([^)]+)\)/)
  if (mc) return mc[1].trim()
  const van = firstLine.match(/version\s+(\S+)/)
  if (van) return van[1].trim()
  return firstLine.slice(0, 60) || 'Unknown'
}

function parseTps(raw: string): number | null {
  const m = raw.match(/:\s*([\d.]+)/)
  if (!m) return null
  const n = parseFloat(m[1])
  return Number.isNaN(n) ? null : Math.min(n, 20)
}

function parseWeather(raw: string): string | null {
  if (raw.toLowerCase().includes('clear')) return 'clear'
  if (raw.toLowerCase().includes('thunder')) return 'thunder'
  if (raw.toLowerCase().includes('rain')) return 'rain'
  return null
}

function parseTime(raw: string): number | null {
  const m = raw.match(/The time is (\d+)/)
  return m ? parseInt(m[1], 10) : null
}

function timeOfDay(ticks: number): string {
  const t = ticks % 24000
  if (t < 1000) return 'Dawn'
  if (t < 6000) return 'Morning'
  if (t < 9000) return 'Noon'
  if (t < 12000) return 'Afternoon'
  if (t < 13000) return 'Dusk'
  if (t < 18000) return 'Night'
  return 'Midnight'
}

function parseDifficulty(raw: string): string | null {
  const m = raw.toLowerCase().match(/difficulty is\s+(\w+)/)
  return m ? m[1] : null
}

function parseWhitelistCount(raw: string): number {
  const m = raw.match(/There are (\d+) whitelisted players/i)
  return m ? parseInt(m[1], 10) : 0
}

export async function GET(req: NextRequest) {
  ensureScheduleRunnerStarted()

  const userId = await getSessionUserId(req)
  const serverId = await getSessionActiveServerId(req)
  if (!userId) return Response.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
  if (!serverId) return Response.json({ ok: false, error: 'No active server selected' }, { status: 400 })

  const features = await getUserFeatureFlags(req)
  if (!checkFeatureAccess(features, 'enable_dashboard_tab')) {
    return Response.json({ ok: false, error: 'Feature disabled by admin' }, { status: 403 })
  }

  const user = getUserById(userId)
  const server = getActiveServer(userId)
  if (!user || !server) return Response.json({ ok: false, error: 'No active server configured' }, { status: 400 })
  const fullStackMode = server.stackMode === 'full'

  const [listRes, versionRes, tpsRes, weatherRes, timeRes, difficultyRes, whitelistRes] = await Promise.all([
    rconForRequest(req, 'list'),
    rconForRequest(req, 'version'),
    rconForRequest(req, 'tps'),
    rconForRequest(req, 'weather query'),
    rconForRequest(req, 'time query daytime'),
    rconForRequest(req, 'difficulty'),
    rconForRequest(req, 'whitelist list'),
  ])

  if (!listRes.ok && !versionRes.ok) {
    return Response.json({ ok: false, error: listRes.error || versionRes.error || 'RCON error' }, { status: 502 })
  }

  const { online, max, players } = parseList(listRes.stdout)
  const db = getDb()
  const recentChat = db.prepare(
    'SELECT id, type, player, message, ts FROM chat_log WHERE user_id = ? AND server_id = ? ORDER BY ts DESC LIMIT 6'
  ).all(userId, serverId) as Array<{ id: number; type: string; player: string | null; message: string; ts: number }>

  const recentAudit = user.role === 'admin' && checkFeatureAccess(features, 'enable_admin_audit')
    ? getAuditLog(6, serverId)
    : []

  const [stackBridge, sidecarMaps] = fullStackMode
    ? await Promise.all([
        runBridgeJson<{ ok: boolean; defaultWorld?: string | null; worlds?: unknown[] }>(req, 'worlds list'),
        callSidecarForRequest<{ ok: boolean; maps?: unknown[] }>(req, '/maps'),
      ])
    : [
        { ok: false as const, error: 'Upgrade this server to the Full Mcraftr Stack to unlock Worlds.' },
        { ok: false as const, error: 'Upgrade this server to the Full Mcraftr Stack to unlock Beacon-backed surfaces.' },
      ]

  const defaultWorldName = fullStackMode && stackBridge.ok
    ? typeof stackBridge.data.defaultWorld === 'string' && stackBridge.data.defaultWorld.trim()
      ? stackBridge.data.defaultWorld.trim()
      : Array.isArray(stackBridge.data.worlds) && stackBridge.data.worlds.length > 0 && typeof (stackBridge.data.worlds[0] as { name?: unknown }).name === 'string'
        ? ((stackBridge.data.worlds[0] as { name: string }).name)
        : null
    : null

  const worldSettings = fullStackMode && defaultWorldName
    ? await runBridgeJson<DashboardWorldSettingsResponse>(req, `worlds settings ${defaultWorldName}`)
    : null

  const worldRuleState = worldSettings?.ok && worldSettings.data.ok !== false ? worldSettings.data.world ?? null : null
  const worldGamerules = worldRuleState?.gamerules ?? null
  const keepInventory = typeof worldGamerules?.keepInventory === 'boolean'
    ? String(worldGamerules.keepInventory)
    : null
  const mobGriefing = typeof worldGamerules?.mobGriefing === 'boolean'
    ? String(worldGamerules.mobGriefing)
    : null
  const pvp = typeof worldRuleState?.pvp === 'boolean'
    ? String(worldRuleState.pvp)
    : null
  const bridgeError = fullStackMode
    ? (worldSettings && !worldSettings.ok ? worldSettings.error : worldSettings && worldSettings.data.ok === false ? worldSettings.data.error || 'Failed to load world settings' : null)
    : null

  return Response.json({
    ok: true,
    server: {
      id: serverId,
      label: user.serverLabel,
      host: server.host,
      port: server.port,
      stackMode: server.stackMode,
      stackLabel: getServerStackLabel(server.stackMode),
    },
    overview: {
      online,
      max,
      players,
      version: versionRes.ok ? parseVersion(versionRes.stdout) : null,
      tps: tpsRes.ok ? parseTps(tpsRes.stdout) : null,
      weather: weatherRes.ok ? (parseWeather(weatherRes.stdout) ?? 'clear') : 'clear',
      timeOfDay: timeRes.ok && parseTime(timeRes.stdout) !== null ? timeOfDay(parseTime(timeRes.stdout)!) : null,
      difficulty: difficultyRes.ok ? parseDifficulty(difficultyRes.stdout) : null,
    },
    rules: {
      keepInventory,
      mobGriefing,
      pvp,
      whitelistCount: whitelistRes.ok ? parseWhitelistCount(whitelistRes.stdout) : null,
      bridgeError,
    },
    recentChat,
    recentAudit,
    stack: {
      mode: server.stackMode,
      modeLabel: getServerStackLabel(server.stackMode),
      modeDescription: getServerStackDescription(server.stackMode),
      upgradeRecommended: !fullStackMode,
      bridgeOk: stackBridge.ok,
      bridgeError: stackBridge.ok ? null : stackBridge.error,
      sidecarOk: sidecarMaps.ok,
      sidecarError: sidecarMaps.ok ? null : sidecarMaps.error,
      worldCount: stackBridge.ok && Array.isArray(stackBridge.data.worlds) ? stackBridge.data.worlds.length : 0,
      mapCount: sidecarMaps.ok && Array.isArray(sidecarMaps.data.maps) ? sidecarMaps.data.maps.length : 0,
    },
  })
}
