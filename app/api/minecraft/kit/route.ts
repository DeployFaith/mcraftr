import { NextRequest } from 'next/server'
import { rconForRequest, getSessionUserId, getUserFeatureFlags, checkFeatureAccess } from '@/lib/rcon'
import { getUserById } from '@/lib/users'
import { KITS_BY_ID } from '@/lib/kits'

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
    if (!kit) {
      return Response.json({ ok: false, error: `Unknown kit: ${kitId}` }, { status: 400 })
    }

    // Admin kit requires admin role — reuse the userId already verified above
    if (kit.adminOnly) {
      const user = getUserById(userId)
      if (user?.role !== 'admin') {
        return Response.json({ ok: false, error: 'Admin kit requires admin role' }, { status: 403 })
      }
    }

    // Run all commands in parallel
    const commands = kit.commands.map(cmd => cmd.replaceAll('{player}', player))
    const results = await Promise.all(commands.map(cmd => rconForRequest(req, cmd)))
    const errors = results.filter(r => !r.ok).map(r => r.error || 'unknown')

    if (errors.length > 0) {
      return Response.json({ ok: false, error: `${errors.length} command(s) failed`, details: errors })
    }
    return Response.json({ ok: true, message: `${kit.label} kit issued to ${player}` })
  } catch (e: unknown) {
    return Response.json({ ok: false, error: e instanceof Error ? e.message : 'Server error' }, { status: 500 })
  }
}
