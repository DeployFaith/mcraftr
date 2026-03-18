import { NextRequest } from 'next/server'
import { getSessionUserId } from '@/lib/rcon'
import { getUserById } from '@/lib/users'
import { getDemoSyntheticPlayerName } from '@/lib/demo-synthetic-player'
import { clearDemoSelfPlayerCookie, readDemoSelfPlayerCookie, writeDemoSelfPlayerCookie } from '@/lib/demo-access'
import { isDemoRestrictedUser } from '@/lib/demo-policy'

const PLAYER_RE = /^\.?[a-zA-Z0-9_]{1,16}$/

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const userId = await getSessionUserId(req)
  if (!userId) return Response.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
  const user = getUserById(userId)
  if (!user) return Response.json({ ok: false, error: 'User not found' }, { status: 404 })

  return Response.json({
    ok: true,
    enabled: isDemoRestrictedUser(user),
    selfPlayer: await readDemoSelfPlayerCookie(),
    demoPlayer: getDemoSyntheticPlayerName(user.id),
  })
}

export async function POST(req: NextRequest) {
  const userId = await getSessionUserId(req)
  if (!userId) return Response.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
  const user = getUserById(userId)
  if (!user) return Response.json({ ok: false, error: 'User not found' }, { status: 404 })
  if (!isDemoRestrictedUser(user)) return Response.json({ ok: false, error: 'Not available for this account' }, { status: 403 })

  const body = await req.json().catch(() => ({}))
  const player = typeof body?.player === 'string' ? body.player.trim() : ''
  if (!PLAYER_RE.test(player)) {
    return Response.json({ ok: false, error: 'Invalid player name' }, { status: 400 })
  }

  await writeDemoSelfPlayerCookie(player)
  return Response.json({ ok: true, selfPlayer: player, demoPlayer: getDemoSyntheticPlayerName(user.id) })
}

export async function DELETE(req: NextRequest) {
  const userId = await getSessionUserId(req)
  if (!userId) return Response.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
  const user = getUserById(userId)
  if (!user) return Response.json({ ok: false, error: 'User not found' }, { status: 404 })
  if (!isDemoRestrictedUser(user)) return Response.json({ ok: false, error: 'Not available for this account' }, { status: 403 })

  await clearDemoSelfPlayerCookie()
  return Response.json({ ok: true })
}
