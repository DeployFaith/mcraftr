import { NextRequest } from 'next/server'
import { rconForRequest, getSessionUserId } from '@/lib/rcon'
import { getToken } from 'next-auth/jwt'
import { getUserById, getUserFeatures } from '@/lib/users'

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
    // Fetch all gamerules in parallel
    const results = await Promise.all(
      ADMIN_GAMERULES.map(rule => rconForRequest(req, `gamerule ${rule}`))
    )
    const gamerules: Record<string, string> = {}
    ADMIN_GAMERULES.forEach((rule, i) => {
      const res = results[i]
      if (res.ok) {
        // "Gamerule keepInventory is currently set to: false"
        const m = res.stdout.match(/set to:\s*(\S+)/)
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
    const result = await rconForRequest(req, `gamerule ${rule} ${value}`)
    if (!result.ok) return Response.json({ ok: false, error: result.error })
    return Response.json({ ok: true, message: `${rule} set to ${value}` })
  } catch (e: unknown) {
    return Response.json({ ok: false, error: e instanceof Error ? e.message : 'Server error' }, { status: 500 })
  }
}
