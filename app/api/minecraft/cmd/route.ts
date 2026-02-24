import { NextRequest } from 'next/server'
import { rconForRequest, getSessionUserId, getUserFeatureFlags, checkFeatureAccess } from '@/lib/rcon'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const COMMANDS: Record<string, { cmds: string[]; label: string; requiresPlayer: boolean }> = {
  day:           { requiresPlayer: false, label: 'Day',          cmds: ['time set day'] },
  night:         { requiresPlayer: false, label: 'Night',        cmds: ['time set night'] },
  clear_weather: { requiresPlayer: false, label: 'Clear sky',    cmds: ['weather clear 6000'] },
  storm:         { requiresPlayer: false, label: 'Storm',        cmds: ['weather thunder 6000'] },
  creative:      { requiresPlayer: true,  label: 'Creative',     cmds: ['gamemode creative {player}'] },
  survival:      { requiresPlayer: true,  label: 'Survival',     cmds: ['gamemode survival {player}'] },
  adventure:     { requiresPlayer: true,  label: 'Adventure',    cmds: ['gamemode adventure {player}'] },
  fly:           { requiresPlayer: true,  label: 'Fly',          cmds: ['fly {player}'] },
  heal:          { requiresPlayer: true,  label: 'Heal',         cmds: ['heal {player}', 'feed {player}'] },
  night_vision:  { requiresPlayer: true,  label: 'Night Vision', cmds: ['effect give {player} minecraft:night_vision 300 1'] },
  speed:         { requiresPlayer: true,  label: 'Speed',        cmds: ['effect give {player} minecraft:speed 120 3'] },
  invisibility:  { requiresPlayer: true,  label: 'Invisible',    cmds: ['effect give {player} minecraft:invisibility 120 1'] },
  jump:          { requiresPlayer: true,  label: 'Super Jump',   cmds: ['effect give {player} minecraft:jump_boost 120 5'] },
  strength:      { requiresPlayer: true,  label: 'Strength',     cmds: ['effect give {player} minecraft:strength 120 2'] },
  haste:         { requiresPlayer: true,  label: 'Haste',        cmds: ['effect give {player} minecraft:haste 120 2'] },
  clear_fx:      { requiresPlayer: true,  label: 'Clear FX',     cmds: ['effect clear {player}'] },
}

export async function POST(req: NextRequest) {
  const userId = await getSessionUserId(req)
  if (!userId) return Response.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
  try {
    const { command, player } = await req.json()

    const PLAYER_RE = /^[a-zA-Z0-9_]{1,16}$/

    const def = COMMANDS[command]
    if (!def) return Response.json({ ok: false, error: `Unknown command: ${command}` }, { status: 400 })

    const features = await getUserFeatureFlags(req)
    if (def.requiresPlayer) {
      if (!checkFeatureAccess(features, 'enable_player_commands')) {
        return Response.json({ ok: false, error: 'Feature disabled by admin' }, { status: 403 })
      }
    } else if (!checkFeatureAccess(features, 'enable_world')) {
      return Response.json({ ok: false, error: 'Feature disabled by admin' }, { status: 403 })
    }

    if (def.requiresPlayer && !player) return Response.json({ ok: false, error: 'This command requires a player' }, { status: 400 })
    if (player && !PLAYER_RE.test(player)) return Response.json({ ok: false, error: 'Invalid player name' }, { status: 400 })

    const errors: string[] = []
    const outputs: string[] = []
    for (const template of def.cmds) {
      const cmd = player ? template.replaceAll('{player}', player) : template
      const result = await rconForRequest(req, cmd)
      if (!result.ok) errors.push(result.error || cmd)
      if (result.stdout) outputs.push(result.stdout)
    }

    if (errors.length > 0) return Response.json({ ok: false, error: errors.join('; ') })

    const target   = player ? ` → ${player}` : ''
    const combined = outputs.join(' ')

    let activated: boolean | null = null
    if (command === 'fly') {
      if (/enabled/i.test(combined))  activated = true
      if (/disabled/i.test(combined)) activated = false
    } else if (['night_vision','speed','invisibility','jump','strength','haste'].includes(command)) {
      activated = true
    } else if (command === 'clear_fx') {
      activated = false
    }

    const verb    = activated === true ? 'Activated' : activated === false ? 'Deactivated' : ''
    const message = verb ? `${verb}: ${def.label}${target}` : `${def.label}${target}`
    return Response.json({ ok: true, message, activated })
  } catch (e: unknown) {
    return Response.json({ ok: false, error: e instanceof Error ? e.message : 'Server error' }, { status: 500 })
  }
}
