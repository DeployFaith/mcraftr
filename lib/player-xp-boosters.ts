import crypto from 'crypto'
import { getDb } from './db'
import { logAudit } from './audit'
import { decryptPassword } from './users'
import { rconDirect } from './rcon-client'

export type PlayerXpBooster = {
  id: string
  userId: string
  serverId: string
  playerName: string
  label: string
  durationHours: number
  bonusPoints: number
  intervalSeconds: number
  endsAt: number
  lastRunAt: number | null
  cancelledAt: number | null
  createdAt: number
}

type PlayerXpBoosterRow = {
  id: string
  user_id: string
  server_id: string
  player_name: string
  label: string
  duration_hours: number
  bonus_points: number
  interval_seconds: number
  ends_at: number
  last_run_at: number | null
  cancelled_at: number | null
  created_at: number
}

type DueBoosterRow = PlayerXpBoosterRow & {
  host: string
  port: number
  password_enc: string
}

let boosterRunnerStarted = false

function rowToBooster(row: PlayerXpBoosterRow): PlayerXpBooster {
  return {
    id: row.id,
    userId: row.user_id,
    serverId: row.server_id,
    playerName: row.player_name,
    label: row.label,
    durationHours: row.duration_hours,
    bonusPoints: row.bonus_points,
    intervalSeconds: row.interval_seconds,
    endsAt: row.ends_at,
    lastRunAt: row.last_run_at,
    cancelledAt: row.cancelled_at,
    createdAt: row.created_at,
  }
}

export function listActivePlayerXpBoosters(userId: string, serverId: string, playerName: string): PlayerXpBooster[] {
  const db = getDb()
  const now = Math.floor(Date.now() / 1000)
  const rows = db.prepare(`
    SELECT *
    FROM player_xp_boosters
    WHERE user_id = ?
      AND server_id = ?
      AND player_name = ?
      AND cancelled_at IS NULL
      AND ends_at > ?
    ORDER BY ends_at ASC, created_at ASC
  `).all(userId, serverId, playerName, now) as PlayerXpBoosterRow[]
  return rows.map(rowToBooster)
}

export function createPlayerXpBooster(input: {
  userId: string
  serverId: string
  playerName: string
  label: string
  durationHours: number
  bonusPoints: number
  intervalSeconds?: number
}): PlayerXpBooster {
  const db = getDb()
  const now = Math.floor(Date.now() / 1000)
  const intervalSeconds = Number.isFinite(input.intervalSeconds) ? Math.max(60, Math.floor(input.intervalSeconds as number)) : 300
  const durationHours = Math.max(1, Math.floor(input.durationHours))
  const bonusPoints = Math.max(1, Math.floor(input.bonusPoints))
  const id = crypto.randomUUID()
  const endsAt = now + durationHours * 3600

  db.prepare(`
    INSERT INTO player_xp_boosters (
      id,
      user_id,
      server_id,
      player_name,
      label,
      duration_hours,
      bonus_points,
      interval_seconds,
      ends_at,
      created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    input.userId,
    input.serverId,
    input.playerName,
    input.label.trim().slice(0, 80),
    durationHours,
    bonusPoints,
    intervalSeconds,
    endsAt,
    now,
  )

  logAudit(input.userId, 'xp_booster', input.playerName, `start:${input.label}:${durationHours}h:+${bonusPoints}/${intervalSeconds}s`, input.serverId)

  return {
    id,
    userId: input.userId,
    serverId: input.serverId,
    playerName: input.playerName,
    label: input.label.trim().slice(0, 80),
    durationHours,
    bonusPoints,
    intervalSeconds,
    endsAt,
    lastRunAt: null,
    cancelledAt: null,
    createdAt: now,
  }
}

export function cancelPlayerXpBooster(userId: string, serverId: string, boosterId: string): boolean {
  const db = getDb()
  const now = Math.floor(Date.now() / 1000)
  const existing = db.prepare(`
    SELECT *
    FROM player_xp_boosters
    WHERE id = ? AND user_id = ? AND server_id = ? AND cancelled_at IS NULL
  `).get(boosterId, userId, serverId) as PlayerXpBoosterRow | undefined

  if (!existing) return false

  db.prepare('UPDATE player_xp_boosters SET cancelled_at = ? WHERE id = ?').run(now, boosterId)
  logAudit(userId, 'xp_booster', existing.player_name, `cancel:${existing.label}`, serverId)
  return true
}

async function tickBoosters() {
  const db = getDb()
  const now = Math.floor(Date.now() / 1000)
  const rows = db.prepare(`
    SELECT b.*, ss.host, ss.port, ss.password_enc
    FROM player_xp_boosters b
    JOIN saved_servers ss ON ss.id = b.server_id AND ss.user_id = b.user_id
    WHERE b.cancelled_at IS NULL
      AND b.ends_at > ?
      AND COALESCE(b.last_run_at, 0) + b.interval_seconds <= ?
    ORDER BY b.created_at ASC
  `).all(now, now) as DueBoosterRow[]

  if (rows.length === 0) return

  const markRan = db.prepare('UPDATE player_xp_boosters SET last_run_at = ? WHERE id = ?')

  for (const row of rows) {
    try {
      const result = await rconDirect(
        row.host,
        row.port,
        decryptPassword(row.password_enc),
        `xp add ${row.player_name} ${row.bonus_points} points`,
      )
      if (result.ok) {
        markRan.run(now, row.id)
      }
    } catch (error) {
      console.warn('[mcraftr] player xp booster tick failed', {
        boosterId: row.id,
        player: row.player_name,
        error: error instanceof Error ? error.message : 'Unknown error',
      })
    }
  }
}

export function ensurePlayerXpBoosterRunnerStarted() {
  if (boosterRunnerStarted) return
  boosterRunnerStarted = true
  void tickBoosters()
  setInterval(() => {
    void tickBoosters()
  }, 60_000)
}
