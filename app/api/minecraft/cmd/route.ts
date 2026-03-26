import { NextRequest } from 'next/server'
import { rconForRequest, getSessionUserId, getUserFeatureFlags, checkFeatureAccess } from '@/lib/rcon'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type CommandStep = { command: string }

const COMMANDS: Record<string, { cmds: CommandStep[]; label: string; requiresPlayer: boolean }> = {
  day:           { requiresPlayer: false, label: 'Day',          cmds: [{ command: 'time set day' }] },
  night:         { requiresPlayer: false, label: 'Night',        cmds: [{ command: 'time set night' }] },
  clear_weather: { requiresPlayer: false, label: 'Clear sky',    cmds: [{ command: 'weather clear' }] },
  storm:         { requiresPlayer: false, label: 'Storm',        cmds: [{ command: 'weather thunder' }] },
  creative:      { requiresPlayer: true,  label: 'Creative',     cmds: [{ command: 'gamemode creative {player}' }] },
  survival:      { requiresPlayer: true,  label: 'Survival',     cmds: [{ command: 'gamemode survival {player}' }] },
  adventure:     { requiresPlayer: true,  label: 'Adventure',    cmds: [{ command: 'gamemode adventure {player}' }] },
  fly:           { requiresPlayer: true,  label: 'Fly',          cmds: [{ command: 'fly {player}' }] },
  heal:          { requiresPlayer: true,  label: 'Heal',         cmds: [{ command: 'heal {player}' }, { command: 'feed {player}' }] },
  night_vision:  { requiresPlayer: true,  label: 'Night Vision', cmds: [{ command: 'effect give {player} minecraft:night_vision 300 1' }] },
  speed:         { requiresPlayer: true,  label: 'Speed',        cmds: [{ command: 'effect give {player} minecraft:speed 120 3' }] },
  invisibility:  { requiresPlayer: true,  label: 'Invisible',    cmds: [{ command: 'effect give {player} minecraft:invisibility 120 1' }] },
  jump:          { requiresPlayer: true,  label: 'Super Jump',   cmds: [{ command: 'effect give {player} minecraft:jump_boost 120 5' }] },
  strength:      { requiresPlayer: true,  label: 'Strength',     cmds: [{ command: 'effect give {player} minecraft:strength 120 2' }] },
  haste:         { requiresPlayer: true,  label: 'Haste',        cmds: [{ command: 'effect give {player} minecraft:haste 120 2' }] },
  clear_fx:      { requiresPlayer: true,  label: 'Clear FX',     cmds: [{ command: 'effect clear {player}' }] },
}

export async function POST(req: NextRequest) {
  const userId = await getSessionUserId(req)
  if (!userId) return Response.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
  try {
    const { command, player } = await req.json()

    const PLAYER_RE = /^\.?[a-zA-Z0-9_]{1,16}$/

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
    for (const step of def.cmds) {
      const cmd = buildCommand(step.command, player)
      const result = await rconForRequest(req, cmd)
      if (!result.ok) errors.push(result.error || cmd)
      if (result.stdout) outputs.push(result.stdout)
    }

    if (errors.length > 0) {
      console.warn('[mcraftr] /api/minecraft/cmd failed', { command, player, errors })
      return Response.json({ ok: false, error: errors.join('; ') }, { status: 502 })
    }

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
    const message = combined || (verb ? `${verb}: ${def.label}${target}` : `${def.label}${target}`)
    return Response.json({ ok: true, message, activated })
  } catch (e: unknown) {
    const error = e instanceof Error ? e.message : 'Server error'
    console.warn('[mcraftr] /api/minecraft/cmd exception', { error })
    return Response.json({ ok: false, error }, { status: 500 })
  }
}

function buildCommand(template: string, player?: string): string {
  if (!player) return template
  if (template.includes('{player}')) return template.replaceAll('{player}', player)
  return `${template} ${player}`
}
