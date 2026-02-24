import { NextRequest } from 'next/server'
import { rconForRequest, getSessionUserId, getUserFeatureFlags, checkFeatureAccess } from '@/lib/rcon'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const EFFECT_IDS: Record<string, string> = {
  night_vision: 'minecraft:night_vision',
  speed:        'minecraft:speed',
  invisibility: 'minecraft:invisibility',
  jump:         'minecraft:jump_boost',
  strength:     'minecraft:strength',
  haste:        'minecraft:haste',
}

// Optional leading dot for Bedrock/Geyser players (e.g. ".calico")
const PLAYER_RE = /^\.?[a-zA-Z0-9_]{1,16}$/

export async function GET(req: NextRequest) {
  const userId = await getSessionUserId(req)
  if (!userId) return Response.json({ ok: false, error: 'Unauthorized' }, { status: 401 })

  const features = await getUserFeatureFlags(req)
  if (!checkFeatureAccess(features, 'enable_player_commands')) {
    return Response.json({ ok: false, error: 'Feature disabled by admin' }, { status: 403 })
  }

  const player = req.nextUrl.searchParams.get('player')
  if (!player) return Response.json({ ok: false, error: 'Missing player' }, { status: 400 })
  if (!PLAYER_RE.test(player)) return Response.json({ ok: false, error: 'Invalid player name' }, { status: 400 })

  try {
    const [effectsRes, abilitiesRes] = await Promise.all([
      rconForRequest(req, `data get entity ${player} active_effects`),
      rconForRequest(req, `data get entity ${player} abilities`),
    ])

    const activeEffects = new Set<string>()
    if (effectsRes.ok && effectsRes.stdout) {
      for (const [key, id] of Object.entries(EFFECT_IDS)) {
        if (effectsRes.stdout.includes(`"${id}"`)) activeEffects.add(key)
      }
    }

    let flying = false
    if (abilitiesRes.ok && abilitiesRes.stdout) {
      flying = /mayfly: 1b/.test(abilitiesRes.stdout)
    }
    if (flying) activeEffects.add('fly')

    return Response.json({ ok: true, active: Array.from(activeEffects) })
  } catch (e: unknown) {
    return Response.json({ ok: false, error: e instanceof Error ? e.message : 'Server error' }, { status: 500 })
  }
}
