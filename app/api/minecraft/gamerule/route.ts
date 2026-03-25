import { NextRequest } from 'next/server'
import { getSessionUserId } from '@/lib/rcon'
import { getToken } from 'next-auth/jwt'
import { getUserById, getUserFeatures } from '@/lib/users'
import { runBridgeCommand } from '@/lib/server-bridge'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const ADMIN_GAMERULES = ['keepInventory', 'mobGriefing', 'doDaylightCycle', 'doWeatherCycle', 'pvp', 'doFireTick', 'doMobSpawning', 'naturalRegeneration', 'announceAdvancements', 'commandBlockOutput', 'sendCommandFeedback', 'showDeathMessages', 'doImmediateRespawn', 'forgiveDeadPlayers', 'universalAnger']

const SAFE_GAMERULE = /^[a-zA-Z]+$/

export async function GET(req: NextRequest) {
  const userId = await getSessionUserId(req)
  if (!userId) return Response.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
  if (!getUserFeatures(userId).enable_admin_rules) {
    return Response.json({ ok: false, error: 'Feature disabled by admin' }, { status: 403 })
  }

  try {
    const results = await Promise.all(
      ADMIN_GAMERULES.map(rule => runBridgeCommand(req, `gamerule get ${rule}`))
    )
    const firstError = results.find(result => !result.ok)
    if (firstError && !firstError.ok) {
      return Response.json({ ok: false, error: firstError.error || 'Relay request failed', code: firstError.code }, { status: 502 })
    }
    const gamerules: Record<string, string> = {}
    ADMIN_GAMERULES.forEach((rule, i) => {
      const res = results[i]
      if (res.ok) {
        const m = res.stdout.match(/set to:\s*(\S+)/i)
        if (m) gamerules[rule] = m[1]
      }
    })
    return Response.json({ ok: true, gamerules })
  } catch (e: unknown) {
    return Response.json({ ok: false, error: e instanceof Error ? e.message : 'Server error' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET, cookieName: 'authjs.session-token' })
  const userId = token?.id as string | undefined
  if (!userId) return Response.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
  const user = getUserById(userId)
  if (!user || user.role !== 'admin') return Response.json({ ok: false, error: 'Admin only' }, { status: 403 })
  if (!getUserFeatures(userId).enable_admin_rules) return Response.json({ ok: false, error: 'Feature disabled by admin' }, { status: 403 })

  try {
    const { rule, value } = await req.json()
    if (!rule || !SAFE_GAMERULE.test(rule) || !ADMIN_GAMERULES.includes(rule)) {
      return Response.json({ ok: false, error: 'Invalid gamerule' }, { status: 400 })
    }
    if (value !== 'true' && value !== 'false') {
      return Response.json({ ok: false, error: 'Value must be true or false' }, { status: 400 })
    }
    const result = await runBridgeCommand(req, `gamerule set ${rule} ${value}`)
    if (!result.ok) return Response.json({ ok: false, error: result.error, code: result.code }, { status: 502 })
    return Response.json({ ok: true, message: `${rule} set to ${value}` })
  } catch (e: unknown) {
    return Response.json({ ok: false, error: e instanceof Error ? e.message : 'Server error' }, { status: 500 })
  }
}
