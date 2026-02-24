import { NextRequest } from 'next/server'
import { rconForRequest, getSessionUserId, getUserFeatureFlags, checkFeatureAccess } from '@/lib/rcon'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// ── Parsers ───────────────────────────────────────────────────────────────────

// Vanilla/Spigot ≤1.20.4: "There are 3 of a max of 20 players online: ..."
// Paper 1.21.4+:           "There are 3 out of maximum 20 players online."
function parseList(raw: string): { online: number; max: number } {
  const m = raw.match(/There are (\d+)\s+(?:of a max(?:\s+of)?|out of maximum)\s+(\d+)/)
  if (m) return { online: parseInt(m[1], 10), max: parseInt(m[2], 10) }
  return { online: 0, max: 0 }
}

// Paper 1.21.4+: "This server is running Paper version 1.21.4-232-ver/... (Implementing API version ...)"
//                followed on a later line by "Previous version: 1.21.11-... (MC: 1.21.11)"
// Older Paper/Spigot: "... (MC: 1.20.4) ..." on the first line
// Vanilla: "This server is running Minecraft server version 1.20.4"
//
// Only inspect the first line to avoid matching the "Previous version" line.
function parseVersion(raw: string): string {
  const firstLine = raw.split('\n')[0].trim()
  // Paper 1.21+: no (MC:...) on first line — extract from "Paper version X.Y.Z-..."
  const paperNew = firstLine.match(/running Paper version (\d+\.\d+[\d.]*)/)
  if (paperNew) return paperNew[1]
  // Older Paper/Spigot/Bukkit: (MC: X.Y.Z) on the first line
  const mc = firstLine.match(/\(MC:\s*([^)]+)\)/)
  if (mc) return mc[1].trim()
  // Vanilla fallback
  const van = firstLine.match(/version\s+(\S+)/)
  if (van) return van[1].trim()
  return firstLine.slice(0, 60) || 'Unknown'
}

// Paper TPS: "TPS from last 1m, 5m, 15m: 20.0, 19.98, 19.95"
// Match the first number AFTER the colon — old regex matched "1" from "1m".
function parseTps(raw: string): number | null {
  const m = raw.match(/:\s*([\d.]+)/)
  if (!m) return null
  const n = parseFloat(m[1])
  return isNaN(n) ? null : Math.min(n, 20)
}

function parseWeather(raw: string): string | null {
  if (raw.toLowerCase().includes('clear')) return 'clear'
  if (raw.toLowerCase().includes('thunder')) return 'thunder'
  if (raw.toLowerCase().includes('rain')) return 'rain'
  return null
}

function parseTime(raw: string): number | null {
  const m = raw.match(/The time is (\d+)/)
  if (!m) return null
  return parseInt(m[1], 10)
}

function timeOfDay(ticks: number): string {
  // 0=dawn, 6000=noon, 12000=dusk, 18000=midnight
  const t = ticks % 24000
  if (t < 1000)  return 'Dawn'
  if (t < 6000)  return 'Morning'
  if (t < 9000)  return 'Noon'
  if (t < 12000) return 'Afternoon'
  if (t < 13000) return 'Dusk'
  if (t < 18000) return 'Night'
  return 'Midnight'
}

// ── Route ─────────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const userId = await getSessionUserId(req)
  if (!userId) {
    return Response.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
  }

  const features = await getUserFeatureFlags(req)
  if (!checkFeatureAccess(features, 'enable_admin_server_info')) {
    return Response.json({ ok: false, error: 'Feature disabled by admin' }, { status: 403 })
  }

  try {
    // Fire all five in parallel — each opens its own RCON connection
    const [listRes, versionRes, tpsRes, weatherRes, timeRes] = await Promise.all([
      rconForRequest(req, 'list'),
      rconForRequest(req, 'version'),
      rconForRequest(req, 'tps'),
      rconForRequest(req, 'weather'),
      rconForRequest(req, 'time query daytime'),
    ])

    if (!listRes.ok && !versionRes.ok) {
      return Response.json({ ok: false, error: listRes.error || 'RCON error' })
    }

    const { online, max } = parseList(listRes.stdout)
    const version = versionRes.ok ? parseVersion(versionRes.stdout) : null
    // tps command only exists on Paper/Spigot — graceful degradation if absent
    const tps = tpsRes.ok ? parseTps(tpsRes.stdout) : null
    const weather = weatherRes.ok ? parseWeather(weatherRes.stdout) : null
    const timeTicks = timeRes.ok ? parseTime(timeRes.stdout) : null
    const tod = timeTicks !== null ? timeOfDay(timeTicks) : null

    return Response.json({ ok: true, online, max, version, tps, weather, timeOfDay: tod })
  } catch (e: unknown) {
    return Response.json(
      { ok: false, error: e instanceof Error ? e.message : 'Server error' },
      { status: 500 }
    )
  }
}
