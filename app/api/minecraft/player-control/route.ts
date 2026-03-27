import { NextRequest } from 'next/server'
import { checkFeatureAccess, getSessionActiveServerId, getSessionUserId, getUserFeatureFlags, rconForRequest } from '@/lib/rcon'
import { cancelPlayerXpBooster, createPlayerXpBooster, ensurePlayerXpBoosterRunnerStarted, listActivePlayerXpBoosters } from '@/lib/player-xp-boosters'
import { logAudit } from '@/lib/audit'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const PLAYER_RE = /^\.?[a-zA-Z0-9_]{1,16}$/

const DIMENSION_IDS = {
  Overworld: 'minecraft:overworld',
  Nether: 'minecraft:the_nether',
  'The End': 'minecraft:the_end',
} as const

const HUNGER_PROFILES = {
  full: {
    label: 'Full Belly',
    commands: (player: string) => [`effect clear ${player} minecraft:hunger`, `feed ${player}`],
  },
  trail: {
    label: 'Trail Rations',
    commands: (player: string) => [`feed ${player}`, `effect give ${player} minecraft:hunger 6 0 true`],
  },
  low: {
    label: 'Running Low',
    commands: (player: string) => [`feed ${player}`, `effect give ${player} minecraft:hunger 14 1 true`],
  },
  starve: {
    label: 'Near Starving',
    commands: (player: string) => [`feed ${player}`, `effect give ${player} minecraft:hunger 24 2 true`],
  },
} as const

const XP_BOOSTER_PRESETS = {
  '1h': { label: 'Spark Hour', durationHours: 1, bonusPoints: 40, intervalSeconds: 300 },
  '3h': { label: 'Momentum Run', durationHours: 3, bonusPoints: 75, intervalSeconds: 300 },
  '5h': { label: 'Overdrive Shift', durationHours: 5, bonusPoints: 110, intervalSeconds: 300 },
} as const

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

function xpBarCapacity(level: number) {
  if (level <= 15) return 2 * level + 7
  if (level <= 30) return 5 * level - 38
  return 9 * level - 158
}

async function assertAccess(req: NextRequest, action: string) {
  const features = await getUserFeatureFlags(req)
  if (!checkFeatureAccess(features, 'enable_players_tab')) {
    throw new Error('Players tab disabled by admin')
  }

  const commandActions = new Set(['set_gamemode', 'set_dimension'])
  const vitalsActions = new Set(['set_health', 'set_hunger_profile', 'set_experience', 'boost_xp', 'start_xp_booster', 'cancel_xp_booster'])

  if (commandActions.has(action) && !checkFeatureAccess(features, 'enable_player_commands')) {
    throw new Error('Player commands disabled by admin')
  }
  if (vitalsActions.has(action) && !checkFeatureAccess(features, 'enable_player_vitals')) {
    throw new Error('Player vitals disabled by admin')
  }
}

async function runCommands(req: NextRequest, commands: string[]) {
  const outputs: string[] = []
  for (const command of commands) {
    const result = await rconForRequest(req, command)
    if (!result.ok) {
      throw new Error(result.error || `Command failed: ${command}`)
    }
    if (result.stdout) outputs.push(result.stdout)
  }
  return outputs
}

export async function GET(req: NextRequest) {
  ensurePlayerXpBoosterRunnerStarted()

  const userId = await getSessionUserId(req)
  const serverId = await getSessionActiveServerId(req)
  if (!userId) return Response.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
  if (!serverId) return Response.json({ ok: false, error: 'No active server selected' }, { status: 400 })

  const player = req.nextUrl.searchParams.get('player')?.trim()
  if (!player) return Response.json({ ok: false, error: 'Missing player' }, { status: 400 })
  if (!PLAYER_RE.test(player)) return Response.json({ ok: false, error: 'Invalid player name' }, { status: 400 })

  try {
    await assertAccess(req, 'start_xp_booster')
    return Response.json({
      ok: true,
      boosters: listActivePlayerXpBoosters(userId, serverId, player),
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to load player controls'
    return Response.json({ ok: false, error: message }, { status: 403 })
  }
}

export async function POST(req: NextRequest) {
  ensurePlayerXpBoosterRunnerStarted()

  const userId = await getSessionUserId(req)
  const serverId = await getSessionActiveServerId(req)
  if (!userId) return Response.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
  if (!serverId) return Response.json({ ok: false, error: 'No active server selected' }, { status: 400 })

  try {
    const body = await req.json()
    const action = String(body.action ?? '').trim()
    const player = String(body.player ?? '').trim()

    if (!action) return Response.json({ ok: false, error: 'Missing action' }, { status: 400 })
    if (!PLAYER_RE.test(player)) return Response.json({ ok: false, error: 'Invalid player name' }, { status: 400 })

    await assertAccess(req, action)

    if (action === 'set_gamemode') {
      const gamemode = String(body.gamemode ?? '').trim().toLowerCase()
      if (!['survival', 'creative', 'adventure', 'spectator'].includes(gamemode)) {
        return Response.json({ ok: false, error: 'Invalid gamemode' }, { status: 400 })
      }
      await runCommands(req, [`gamemode ${gamemode} ${player}`])
      logAudit(userId, 'player_control', player, `gamemode:${gamemode}`, serverId)
      return Response.json({ ok: true, message: `${player} is now in ${gamemode}.` })
    }

    if (action === 'set_dimension') {
      const dimension = String(body.dimension ?? '').trim() as keyof typeof DIMENSION_IDS
      const pos = body.pos as { x?: unknown; y?: unknown; z?: unknown } | null | undefined
      if (!(dimension in DIMENSION_IDS)) {
        return Response.json({ ok: false, error: 'Invalid dimension' }, { status: 400 })
      }
      if (!pos || !isFiniteNumber(pos.x) || !isFiniteNumber(pos.y) || !isFiniteNumber(pos.z)) {
        return Response.json({ ok: false, error: 'Current position is required for dimension changes' }, { status: 400 })
      }
      const x = Math.round(pos.x)
      const y = Math.round(pos.y)
      const z = Math.round(pos.z)
      await runCommands(req, [`execute in ${DIMENSION_IDS[dimension]} run teleport ${player} ${x} ${y} ${z}`])
      logAudit(userId, 'player_control', player, `dimension:${dimension}:${x},${y},${z}`, serverId)
      return Response.json({ ok: true, message: `${player} moved to ${dimension}.` })
    }

    if (action === 'set_health') {
      const health = Number(body.health)
      if (!Number.isFinite(health) || health < 1 || health > 20) {
        return Response.json({ ok: false, error: 'Health must be between 1 and 20' }, { status: 400 })
      }
      const rounded = Math.round(health * 2) / 2
      const damage = Math.max(0, 20 - rounded)
      const commands = [`heal ${player}`]
      if (damage > 0) commands.push(`damage ${player} ${damage} minecraft:generic`)
      await runCommands(req, commands)
      logAudit(userId, 'player_control', player, `health:${rounded}`, serverId)
      return Response.json({ ok: true, message: `${player} health tuned to ${rounded}.` })
    }

    if (action === 'set_hunger_profile') {
      const profile = String(body.profile ?? '').trim() as keyof typeof HUNGER_PROFILES
      if (!(profile in HUNGER_PROFILES)) {
        return Response.json({ ok: false, error: 'Invalid hunger profile' }, { status: 400 })
      }
      await runCommands(req, HUNGER_PROFILES[profile].commands(player))
      logAudit(userId, 'player_control', player, `hunger:${profile}`, serverId)
      return Response.json({ ok: true, message: `${HUNGER_PROFILES[profile].label} applied to ${player}.` })
    }

    if (action === 'set_experience') {
      const level = Math.max(0, Math.floor(Number(body.level)))
      const progress = Math.min(99, Math.max(0, Math.floor(Number(body.progress))))
      if (!Number.isFinite(level) || !Number.isFinite(progress)) {
        return Response.json({ ok: false, error: 'Invalid experience payload' }, { status: 400 })
      }
      const points = Math.floor((xpBarCapacity(level) * progress) / 100)
      await runCommands(req, [`xp set ${player} ${level} levels`, `xp set ${player} ${points} points`])
      logAudit(userId, 'player_control', player, `xp:${level}:${progress}%`, serverId)
      return Response.json({ ok: true, message: `${player} experience updated to Lv.${level} at ${progress}%.` })
    }

    if (action === 'boost_xp') {
      const mode = body.mode === 'levels' ? 'levels' : 'points'
      const amount = Math.max(1, Math.floor(Number(body.amount)))
      await runCommands(req, [`xp add ${player} ${amount} ${mode}`])
      logAudit(userId, 'player_control', player, `xp-boost:${amount}:${mode}`, serverId)
      return Response.json({ ok: true, message: `Boosted ${player} by ${amount} ${mode}.` })
    }

    if (action === 'start_xp_booster') {
      const tier = String(body.tier ?? '').trim() as keyof typeof XP_BOOSTER_PRESETS
      const preset = XP_BOOSTER_PRESETS[tier]
      if (!preset) {
        return Response.json({ ok: false, error: 'Invalid booster preset' }, { status: 400 })
      }
      const booster = createPlayerXpBooster({
        userId,
        serverId,
        playerName: player,
        label: preset.label,
        durationHours: preset.durationHours,
        bonusPoints: preset.bonusPoints,
        intervalSeconds: preset.intervalSeconds,
      })
      return Response.json({ ok: true, booster, message: `${preset.label} started for ${player}.` })
    }

    if (action === 'cancel_xp_booster') {
      const boosterId = String(body.boosterId ?? '').trim()
      if (!boosterId) {
        return Response.json({ ok: false, error: 'Missing booster id' }, { status: 400 })
      }
      const cancelled = cancelPlayerXpBooster(userId, serverId, boosterId)
      if (!cancelled) {
        return Response.json({ ok: false, error: 'Booster not found' }, { status: 404 })
      }
      return Response.json({ ok: true, message: 'Booster cancelled.' })
    }

    return Response.json({ ok: false, error: `Unknown action: ${action}` }, { status: 400 })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Server error'
    const status = /disabled by admin/i.test(message) ? 403 : 500
    return Response.json({ ok: false, error: message }, { status })
  }
}
