import { NextRequest } from 'next/server'
import { getSessionUserId, getUserFeatureFlags, checkFeatureAccess } from '@/lib/rcon'
import { VALID_ITEM_IDS } from '@/lib/items'
import { giveItemViaRcon } from '@/lib/minecraft-give'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const PLAYER_RE = /^\.?[a-zA-Z0-9_]{1,16}$/
export async function POST(req: NextRequest) {
  const userId = await getSessionUserId(req)
  if (!userId) return Response.json({ ok: false, error: 'Unauthorized' }, { status: 401 })

  const features = await getUserFeatureFlags(req)
  if (!checkFeatureAccess(features, 'enable_item_catalog')) {
    return Response.json({ ok: false, error: 'Feature disabled by admin' }, { status: 403 })
  }

  try {
    const { player, item, qty } = await req.json()
    if (!player || typeof player !== 'string') return Response.json({ ok: false, error: 'Missing player' }, { status: 400 })
    if (!PLAYER_RE.test(player)) return Response.json({ ok: false, error: 'Invalid player name' }, { status: 400 })
    if (!item   || typeof item   !== 'string') return Response.json({ ok: false, error: 'Missing item' },   { status: 400 })
    if (!VALID_ITEM_IDS.has(item)) return Response.json({ ok: false, error: 'Invalid item' }, { status: 400 })

    const result = await giveItemViaRcon(req, player, item, parseInt(qty) || 1)
    if (!result.ok) return Response.json({ ok: false, error: result.error })

    return Response.json({ ok: true, message: `Gave ${result.given}× ${item} to ${player}` })
  } catch (e: unknown) {
    return Response.json({ ok: false, error: e instanceof Error ? e.message : 'Server error' }, { status: 500 })
  }
}
