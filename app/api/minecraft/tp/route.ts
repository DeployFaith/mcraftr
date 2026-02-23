import { NextRequest } from 'next/server'
import { rconForRequest, getSessionUserId } from '@/lib/rcon'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const PLAYER_RE = /^[a-zA-Z0-9_]{1,16}$/

export async function POST(req: NextRequest) {
  if (!await getSessionUserId(req)) return Response.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
  try {
    const { from, to } = await req.json()
    if (!from || typeof from !== 'string') return Response.json({ ok: false, error: 'Missing "from" player' }, { status: 400 })
    if (!PLAYER_RE.test(from)) return Response.json({ ok: false, error: 'Invalid "from" player name' }, { status: 400 })
    if (!to   || typeof to   !== 'string') return Response.json({ ok: false, error: 'Missing "to" player' },   { status: 400 })
    if (!PLAYER_RE.test(to)) return Response.json({ ok: false, error: 'Invalid "to" player name' }, { status: 400 })
    if (from === to) return Response.json({ ok: false, error: 'Cannot teleport a player to themselves' }, { status: 400 })

    const result = await rconForRequest(req, `tp ${from} ${to}`)
    if (!result.ok) return Response.json({ ok: false, error: result.error || 'RCON error' })
    return Response.json({ ok: true, message: `Teleported ${from} → ${to}` })
  } catch (e: unknown) {
    return Response.json({ ok: false, error: e instanceof Error ? e.message : 'Server error' }, { status: 500 })
  }
}
