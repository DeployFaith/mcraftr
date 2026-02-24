import { NextRequest } from 'next/server'
import { rconForRequest, getSessionUserId } from '@/lib/rcon'
import { getUserFeatures } from '@/lib/users'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function parseBanList(raw: string): string[] {
  // Minecraft ban list format: "Banned players:\n- PlayerName: reason"
  // or "There are no bans." 
  if (!raw || raw.includes('There are no bans') || raw.includes('Banned players:\n\n')) return []
  const lines = raw.split('\n').slice(1) // skip "Banned players:" header
  return lines
    .map(l => l.replace(/^-\s*/, '').split(':')[0].trim())
    .filter(Boolean)
}

export async function GET(req: NextRequest) {
  const userId = await getSessionUserId(req)
  if (!userId) return Response.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
  if (!getUserFeatures(userId).enable_admin_moderation) return Response.json({ ok: false, error: 'Feature disabled by admin' }, { status: 403 })

  try {
    const result = await rconForRequest(req, 'banlist players')
    if (!result.ok) return Response.json({ ok: false, error: result.error || 'RCON error' })
    const players = parseBanList(result.stdout)
    return Response.json({ ok: true, players, raw: result.stdout })
  } catch (e: unknown) {
    return Response.json({ ok: false, error: e instanceof Error ? e.message : 'Server error' }, { status: 500 })
  }
}
