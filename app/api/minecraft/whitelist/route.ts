import { NextRequest } from 'next/server'
import { rconForRequest, getSessionUserId } from '@/lib/rcon'
import { getUserById } from '@/lib/users'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Optional leading dot for Bedrock/Geyser players (e.g. ".calico")
const PLAYER_RE = /^\.?[a-zA-Z0-9_]{1,16}$/

// Parse "whitelist list" output.
// Vanilla: "There are N whitelisted players: name1, name2"
// Paper:   same format, or empty list message
function parseWhitelistOutput(stdout: string): string[] {
  // Find everything after the colon
  const m = stdout.match(/:\s*(.+)$/)
  if (!m) return []
  return m[1].split(',').map(n => n.trim()).filter(Boolean)
}

export async function GET(req: NextRequest) {
  if (!await getSessionUserId(req)) return Response.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
  try {
    const result = await rconForRequest(req, 'whitelist list')
    if (!result.ok) return Response.json({ ok: false, error: result.error || 'RCON error' })

    const players = parseWhitelistOutput(result.stdout)
    return Response.json({ ok: true, players })
  } catch (e: unknown) {
    return Response.json({ ok: false, error: e instanceof Error ? e.message : 'Server error' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const userId = await getSessionUserId(req)
  if (!userId) return Response.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
  // Whitelist changes are server management — admin only
  if (getUserById(userId)?.role !== 'admin') {
    return Response.json({ ok: false, error: 'Admin role required' }, { status: 403 })
  }
  try {
    const { player, action } = await req.json()
    if (!player || typeof player !== 'string') {
      return Response.json({ ok: false, error: 'Player name is required' }, { status: 400 })
    }
    if (!PLAYER_RE.test(player)) {
      return Response.json({ ok: false, error: 'Invalid player name' }, { status: 400 })
    }
    if (action !== 'add' && action !== 'remove') {
      return Response.json({ ok: false, error: 'Action must be "add" or "remove"' }, { status: 400 })
    }

    const result = await rconForRequest(req, `whitelist ${action} ${player}`)
    if (!result.ok) return Response.json({ ok: false, error: result.error || 'RCON error' })

    return Response.json({
      ok: true,
      message: action === 'add' ? `Added ${player} to whitelist` : `Removed ${player} from whitelist`,
    })
  } catch (e: unknown) {
    return Response.json({ ok: false, error: e instanceof Error ? e.message : 'Server error' }, { status: 500 })
  }
}
