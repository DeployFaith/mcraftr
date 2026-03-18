import { NextRequest } from 'next/server'
import { rconForRequest, getSessionUserId, getUserFeatureFlags, checkFeatureAccess } from '@/lib/rcon'
import { getDemoSyntheticCommandError } from '@/lib/demo-synthetic-player'
import { getUserById } from '@/lib/users'
import { getDemoPlayerActionError } from '@/lib/demo-policy'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const PLAYER_RE = /^\.?[a-zA-Z0-9_]{1,16}$/

export async function POST(req: NextRequest) {
  const userId = await getSessionUserId(req)
  if (!userId) return Response.json({ ok: false, error: 'Unauthorized' }, { status: 401 })

  const features = await getUserFeatureFlags(req)
  if (!checkFeatureAccess(features, 'enable_teleport')) {
    return Response.json({ ok: false, error: 'Feature disabled by admin' }, { status: 403 })
  }

  try {
    const { from, to } = await req.json()
    if (!from || typeof from !== 'string') return Response.json({ ok: false, error: 'Missing "from" player' }, { status: 400 })
    if (!PLAYER_RE.test(from)) return Response.json({ ok: false, error: 'Invalid "from" player name' }, { status: 400 })
    if (!to   || typeof to   !== 'string') return Response.json({ ok: false, error: 'Missing "to" player' },   { status: 400 })
    if (!PLAYER_RE.test(to)) return Response.json({ ok: false, error: 'Invalid "to" player name' }, { status: 400 })
    if (from === to) return Response.json({ ok: false, error: 'Cannot teleport a player to themselves' }, { status: 400 })

    const user = getUserById(userId)
    const selfCookie = req.cookies.get('mcraftr.demo-self-player')?.value ?? null
    const restrictedError = getDemoPlayerActionError(user, from, selfCookie) || getDemoPlayerActionError(user, to, selfCookie)
    if (restrictedError) return Response.json({ ok: false, error: restrictedError }, { status: 403 })

    const syntheticError = getDemoSyntheticCommandError(userId, from, 'Teleport') || getDemoSyntheticCommandError(userId, to, 'Teleport')
    if (syntheticError) return Response.json({ ok: false, error: syntheticError }, { status: 400 })

    const result = await rconForRequest(req, `tp ${from} ${to}`)
    if (!result.ok) return Response.json({ ok: false, error: result.error || 'RCON error' })
    return Response.json({ ok: true, message: `Teleported ${from} → ${to}` })
  } catch (e: unknown) {
    return Response.json({ ok: false, error: e instanceof Error ? e.message : 'Server error' }, { status: 500 })
  }
}
