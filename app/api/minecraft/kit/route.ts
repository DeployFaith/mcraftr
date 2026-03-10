import { NextRequest } from 'next/server'
import { getSessionUserId, getUserFeatureFlags, checkFeatureAccess } from '@/lib/rcon'
import { getUserById } from '@/lib/users'
import { KITS_BY_ID } from '@/lib/kits'
import { getDb } from '@/lib/db'
import { giveItemViaRcon } from '@/lib/minecraft-give'
import type { CustomKitItem } from '@/lib/custom-kits'
import { runBridgeCommand } from '@/lib/server-bridge'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const userId = await getSessionUserId(req)
  if (!userId) {
    return Response.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
  }

  const features = await getUserFeatureFlags(req)
  if (!checkFeatureAccess(features, 'enable_kits')) {
    return Response.json({ ok: false, error: 'Feature disabled by admin' }, { status: 403 })
  }

  try {
    const { player, kit: kitId } = await req.json()
    if (!player || typeof player !== 'string') {
      return Response.json({ ok: false, error: 'Missing player' }, { status: 400 })
    }
    if (!/^\.?[a-zA-Z0-9_]{1,16}$/.test(player)) {
      return Response.json({ ok: false, error: 'Invalid player name' }, { status: 400 })
    }

    const kit = KITS_BY_ID[kitId]
    if (!kit && !checkFeatureAccess(features, 'enable_custom_kits')) {
      return Response.json({ ok: false, error: 'Custom kits are disabled by admin' }, { status: 403 })
    }
    const customKit = !kit
      ? getDb().prepare(`
          SELECT id, label, items_json
          FROM custom_kits
          WHERE id = ? AND user_id = ?
        `).get(kitId, userId) as { id: string; label: string; items_json: string } | undefined
      : undefined

    if (!kit && !customKit) {
      return Response.json({ ok: false, error: `Unknown kit: ${kitId}` }, { status: 400 })
    }

    // Admin kit requires admin role — reuse the userId already verified above
    if (kit?.adminOnly) {
      const user = getUserById(userId)
      if (user?.role !== 'admin') {
        return Response.json({ ok: false, error: 'Admin kit requires admin role' }, { status: 403 })
      }
    }

    if (kit) {
      const result = await runBridgeCommand(req, `kit ${player} ${kitId}`)
      if (!result.ok) {
        console.warn('[mcraftr] /api/minecraft/kit failed', { player, kitId, error: result.error || 'RCON error' })
        return Response.json({ ok: false, error: result.error || 'RCON error', code: result.code }, { status: 502 })
      }
      return Response.json({ ok: true, message: result.stdout || `${kit.label} kit issued to ${player}` })
    }

    const items = JSON.parse(customKit!.items_json) as CustomKitItem[]
    for (const item of items) {
      const result = await giveItemViaRcon(req, player, item.itemId, item.qty)
      if (!result.ok) {
        console.warn('[mcraftr] /api/minecraft/kit failed', { player, kitId, error: result.error || 'RCON error' })
        return Response.json({ ok: false, error: result.error || 'RCON error' })
      }
    }

    return Response.json({ ok: true, message: `${customKit!.label} kit issued to ${player}` })
  } catch (e: unknown) {
    const error = e instanceof Error ? e.message : 'Server error'
    console.warn('[mcraftr] /api/minecraft/kit exception', { error })
    return Response.json({ ok: false, error }, { status: 500 })
  }
}
