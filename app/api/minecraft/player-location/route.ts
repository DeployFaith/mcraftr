import { NextRequest } from 'next/server'
import { getSessionUserId } from '@/lib/rcon'
import { runBridgeJson } from '@/lib/server-bridge'
import { getDemoSyntheticLocationError } from '@/lib/demo-synthetic-player'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const PLAYER_RE = /^\.?[a-zA-Z0-9_]{1,16}$/

export async function GET(req: NextRequest) {
  const userId = await getSessionUserId(req)
  if (!userId) {
    return Response.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
  }

  const player = req.nextUrl.searchParams.get('player')?.trim()
  if (!player) {
    return Response.json({ ok: false, error: 'Missing player' }, { status: 400 })
  }
  if (!PLAYER_RE.test(player)) {
    return Response.json({ ok: false, error: 'Invalid player name' }, { status: 400 })
  }

  const syntheticError = getDemoSyntheticLocationError(userId, player)
  if (syntheticError) {
    return Response.json({ ok: false, error: syntheticError }, { status: 400 })
  }

  const result = await runBridgeJson<Record<string, unknown>>(req, `player locate ${player}`)
  if (!result.ok) {
    return Response.json({ ok: false, error: result.error || 'Bridge request failed', code: result.code }, { status: 502 })
  }
  const payload = result.data
  return Response.json(payload, { status: payload.ok === true ? 200 : 400 })
}
