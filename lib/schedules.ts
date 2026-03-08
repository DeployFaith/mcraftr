import crypto from 'crypto'
import { getDb } from './db'
import { logAudit } from './audit'
import { decryptPassword } from './users'
import { rconDirect } from './rcon-client'

export type ScheduleCadence = 'daily' | 'weekly' | 'monthly'
export type ScheduleActionType = 'broadcast' | 'save_all' | 'time' | 'weather' | 'difficulty' | 'gamerule'

export type ScheduleActionPayload =
  | { message: string }
  | { value: 'day' | 'night' }
  | { value: 'clear' | 'storm' }
  | { value: 'peaceful' | 'easy' | 'normal' | 'hard' }
  | { rule: string; value: 'true' | 'false' }
  | Record<string, never>

export type ScheduleRecord = {
  id: string
  userId: string
  serverId: string
  label: string
  enabled: boolean
  cadence: ScheduleCadence
  timezone: string
  timeOfDay: string
  dayOfWeek: number | null
  dayOfMonth: number | null
  actionType: ScheduleActionType
  actionPayload: ScheduleActionPayload
  lastRunAt: number | null
  nextRunAt: number
  createdAt: number
  updatedAt: number
}

export type ScheduleRunRecord = {
  id: number
  taskId: string
  userId: string
  serverId: string
  status: 'ok' | 'error'
  output: string | null
  startedAt: number
  finishedAt: number
}

type ScheduleRow = {
  id: string
  user_id: string
  server_id: string
  label: string
  enabled: number
  cadence: ScheduleCadence
  timezone: string
  time_of_day: string
  day_of_week: number | null
  day_of_month: number | null
  action_type: ScheduleActionType
  action_payload: string
  last_run_at: number | null
  next_run_at: number
  created_at: number
  updated_at: number
}

type ScheduleRunRow = {
  id: number
  task_id: string
  user_id: string
  server_id: string
  status: 'ok' | 'error'
  output: string | null
  started_at: number
  finished_at: number
}

type DueScheduleRow = ScheduleRow & {
  host: string
  port: number
  password_enc: string
}

type ScheduleInput = {
  label: string
  enabled: boolean
  cadence: ScheduleCadence
  timezone: string
  timeOfDay: string
  dayOfWeek: number | null
  dayOfMonth: number | null
  actionType: ScheduleActionType
  actionPayload: ScheduleActionPayload
}

const ADMIN_GAMERULES = new Set([
  'keepInventory',
  'mobGriefing',
  'pvp',
  'doDaylightCycle',
  'doWeatherCycle',
  'doFireTick',
  'doMobSpawning',
  'naturalRegeneration',
])

function rowToSchedule(row: ScheduleRow): ScheduleRecord {
  return {
    id: row.id,
    userId: row.user_id,
    serverId: row.server_id,
    label: row.label,
    enabled: !!row.enabled,
    cadence: row.cadence,
    timezone: row.timezone,
    timeOfDay: row.time_of_day,
    dayOfWeek: row.day_of_week,
    dayOfMonth: row.day_of_month,
    actionType: row.action_type,
    actionPayload: JSON.parse(row.action_payload) as ScheduleActionPayload,
    lastRunAt: row.last_run_at,
    nextRunAt: row.next_run_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function rowToRun(row: ScheduleRunRow): ScheduleRunRecord {
  return {
    id: row.id,
    taskId: row.task_id,
    userId: row.user_id,
    serverId: row.server_id,
    status: row.status,
    output: row.output,
    startedAt: row.started_at,
    finishedAt: row.finished_at,
  }
}

function assertTimeOfDay(value: string): string {
  if (!/^\d{2}:\d{2}$/.test(value)) throw new Error('Time must be HH:MM')
  const [hour, minute] = value.split(':').map(Number)
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) throw new Error('Time must be HH:MM')
  return value
}

function assertTimezone(value: string): string {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: value }).format(new Date())
    return value
  } catch {
    throw new Error('Invalid timezone')
  }
}

function normalizeLabel(value: string): string {
  const label = value.trim().slice(0, 80)
  if (!label) throw new Error('Label is required')
  return label
}

function sanitizeActionPayload(actionType: ScheduleActionType, payload: ScheduleActionPayload): ScheduleActionPayload {
  if (actionType === 'broadcast') {
    const message = String((payload as { message?: string }).message ?? '').replace(/[^\x20-\x7E]/g, '').trim().slice(0, 256)
    if (!message) throw new Error('Broadcast message is required')
    return { message }
  }
  if (actionType === 'save_all') return {}
  if (actionType === 'time') {
    const value = (payload as { value?: string }).value
    if (value !== 'day' && value !== 'night') throw new Error('Invalid time value')
    return { value }
  }
  if (actionType === 'weather') {
    const value = (payload as { value?: string }).value
    if (value !== 'clear' && value !== 'storm') throw new Error('Invalid weather value')
    return { value }
  }
  if (actionType === 'difficulty') {
    const value = (payload as { value?: string }).value
    if (!['peaceful', 'easy', 'normal', 'hard'].includes(value ?? '')) throw new Error('Invalid difficulty')
    return { value: value as 'peaceful' | 'easy' | 'normal' | 'hard' }
  }
  if (actionType === 'gamerule') {
    const rule = String((payload as { rule?: string }).rule ?? '')
    const value = (payload as { value?: string }).value
    if (!ADMIN_GAMERULES.has(rule)) throw new Error('Invalid gamerule')
    if (value !== 'true' && value !== 'false') throw new Error('Invalid gamerule value')
    return { rule, value }
  }
  throw new Error('Invalid schedule action')
}

function normalizeScheduleInput(input: ScheduleInput): ScheduleInput {
  const cadence = input.cadence
  if (!['daily', 'weekly', 'monthly'].includes(cadence)) throw new Error('Invalid cadence')
  const timezone = assertTimezone(input.timezone)
  const timeOfDay = assertTimeOfDay(input.timeOfDay)

  let dayOfWeek: number | null = null
  let dayOfMonth: number | null = null
  if (cadence === 'weekly') {
    dayOfWeek = Number.isInteger(input.dayOfWeek) ? Number(input.dayOfWeek) : NaN
    if (dayOfWeek < 0 || dayOfWeek > 6) throw new Error('Weekly schedules need a day of week')
  }
  if (cadence === 'monthly') {
    dayOfMonth = Number.isInteger(input.dayOfMonth) ? Number(input.dayOfMonth) : NaN
    if (dayOfMonth < 1 || dayOfMonth > 31) throw new Error('Monthly schedules need a day of month')
  }

  return {
    label: normalizeLabel(input.label),
    enabled: !!input.enabled,
    cadence,
    timezone,
    timeOfDay,
    dayOfWeek,
    dayOfMonth,
    actionType: input.actionType,
    actionPayload: sanitizeActionPayload(input.actionType, input.actionPayload),
  }
}

function getZonedParts(ts: number, timeZone: string) {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    weekday: 'short',
    hourCycle: 'h23',
  })
  const parts = formatter.formatToParts(new Date(ts))
  const map = Object.fromEntries(parts.filter(part => part.type !== 'literal').map(part => [part.type, part.value]))
  const weekdayMap: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  }
  return {
    year: Number(map.year),
    month: Number(map.month),
    day: Number(map.day),
    hour: Number(map.hour),
    minute: Number(map.minute),
    second: Number(map.second),
    weekday: weekdayMap[map.weekday],
  }
}

function zonedTimeToUtcMs(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  timeZone: string,
): number {
  let guess = Date.UTC(year, month - 1, day, hour, minute, 0, 0)
  for (let i = 0; i < 4; i++) {
    const parts = getZonedParts(guess, timeZone)
    const desired = Date.UTC(year, month - 1, day, hour, minute, 0, 0)
    const actual = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, 0, 0)
    const diff = actual - desired
    if (diff === 0) break
    guess -= diff
  }
  return guess
}

function lastDayOfMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate()
}

function shiftMonth(year: number, month: number) {
  if (month === 12) return { year: year + 1, month: 1 }
  return { year, month: month + 1 }
}

function parseTimeParts(timeOfDay: string) {
  const [hour, minute] = timeOfDay.split(':').map(Number)
  return { hour, minute }
}

function computeNextRunAt(input: ScheduleInput, fromMs: number): number {
  const { hour, minute } = parseTimeParts(input.timeOfDay)
  const now = fromMs + 1000
  const parts = getZonedParts(now, input.timezone)

  if (input.cadence === 'daily') {
    let candidate = zonedTimeToUtcMs(parts.year, parts.month, parts.day, hour, minute, input.timezone)
    if (candidate <= now) {
      const tomorrow = new Date(Date.UTC(parts.year, parts.month - 1, parts.day + 1, 12, 0, 0))
      const nextParts = getZonedParts(tomorrow.getTime(), input.timezone)
      candidate = zonedTimeToUtcMs(nextParts.year, nextParts.month, nextParts.day, hour, minute, input.timezone)
    }
    return candidate
  }

  if (input.cadence === 'weekly') {
    const deltaDays = ((input.dayOfWeek ?? 0) - parts.weekday + 7) % 7
    let base = new Date(Date.UTC(parts.year, parts.month - 1, parts.day + deltaDays, 12, 0, 0))
    let targetParts = getZonedParts(base.getTime(), input.timezone)
    let candidate = zonedTimeToUtcMs(targetParts.year, targetParts.month, targetParts.day, hour, minute, input.timezone)
    if (candidate <= now) {
      base = new Date(Date.UTC(targetParts.year, targetParts.month - 1, targetParts.day + 7, 12, 0, 0))
      targetParts = getZonedParts(base.getTime(), input.timezone)
      candidate = zonedTimeToUtcMs(targetParts.year, targetParts.month, targetParts.day, hour, minute, input.timezone)
    }
    return candidate
  }

  let year = parts.year
  let month = parts.month
  let day = Math.min(input.dayOfMonth ?? 1, lastDayOfMonth(year, month))
  let candidate = zonedTimeToUtcMs(year, month, day, hour, minute, input.timezone)
  if (candidate <= now) {
    const shifted = shiftMonth(year, month)
    year = shifted.year
    month = shifted.month
    day = Math.min(input.dayOfMonth ?? 1, lastDayOfMonth(year, month))
    candidate = zonedTimeToUtcMs(year, month, day, hour, minute, input.timezone)
  }
  return candidate
}

function buildScheduleCommand(task: ScheduleRecord): string {
  const payload = task.actionPayload
  if (task.actionType === 'broadcast') return `fgmc broadcast ${(payload as { message: string }).message}`
  if (task.actionType === 'save_all') return 'save-all'
  if (task.actionType === 'time') return `fgmc world time ${(payload as { value: string }).value}`
  if (task.actionType === 'weather') return `fgmc world weather ${(payload as { value: string }).value}`
  if (task.actionType === 'difficulty') return `difficulty ${(payload as { value: string }).value}`
  if (task.actionType === 'gamerule') {
    const gamerule = payload as { rule: string; value: string }
    return `fgmc gamerule set ${gamerule.rule} ${gamerule.value}`
  }
  throw new Error('Unsupported schedule action')
}

export function listSchedules(userId: string, serverId: string): ScheduleRecord[] {
  const db = getDb()
  const rows = db.prepare(
    'SELECT * FROM scheduled_tasks WHERE user_id = ? AND server_id = ? ORDER BY enabled DESC, next_run_at ASC, created_at ASC'
  ).all(userId, serverId) as ScheduleRow[]
  return rows.map(rowToSchedule)
}

export function listScheduleRuns(userId: string, serverId: string, limit = 20): ScheduleRunRecord[] {
  const db = getDb()
  const rows = db.prepare(
    'SELECT * FROM scheduled_task_runs WHERE user_id = ? AND server_id = ? ORDER BY started_at DESC LIMIT ?'
  ).all(userId, serverId, limit) as ScheduleRunRow[]
  return rows.map(rowToRun)
}

export function createSchedule(userId: string, serverId: string, input: ScheduleInput): ScheduleRecord {
  const db = getDb()
  const normalized = normalizeScheduleInput(input)
  const id = crypto.randomUUID()
  const nextRunAt = computeNextRunAt(normalized, Date.now())
  db.prepare(`
    INSERT INTO scheduled_tasks (
      id, user_id, server_id, label, enabled, cadence, timezone, time_of_day,
      day_of_week, day_of_month, action_type, action_payload, last_run_at,
      next_run_at, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, unixepoch(), unixepoch())
  `).run(
    id,
    userId,
    serverId,
    normalized.label,
    normalized.enabled ? 1 : 0,
    normalized.cadence,
    normalized.timezone,
    normalized.timeOfDay,
    normalized.dayOfWeek,
    normalized.dayOfMonth,
    normalized.actionType,
    JSON.stringify(normalized.actionPayload),
    nextRunAt,
  )
  logAudit(userId, 'schedule_create', normalized.label, normalized.actionType, serverId)
  return listSchedules(userId, serverId).find(entry => entry.id === id)!
}

export function updateSchedule(userId: string, serverId: string, scheduleId: string, input: ScheduleInput): ScheduleRecord {
  const db = getDb()
  const existing = db.prepare(
    'SELECT * FROM scheduled_tasks WHERE id = ? AND user_id = ? AND server_id = ?'
  ).get(scheduleId, userId, serverId) as ScheduleRow | undefined
  if (!existing) throw new Error('Schedule not found')
  const normalized = normalizeScheduleInput(input)
  const nextRunAt = normalized.enabled
    ? computeNextRunAt(normalized, Date.now())
    : existing.next_run_at
  const result = db.prepare(`
    UPDATE scheduled_tasks
    SET label = ?, enabled = ?, cadence = ?, timezone = ?, time_of_day = ?,
        day_of_week = ?, day_of_month = ?, action_type = ?, action_payload = ?,
        next_run_at = ?, updated_at = unixepoch()
    WHERE id = ? AND user_id = ? AND server_id = ?
  `).run(
    normalized.label,
    normalized.enabled ? 1 : 0,
    normalized.cadence,
    normalized.timezone,
    normalized.timeOfDay,
    normalized.dayOfWeek,
    normalized.dayOfMonth,
    normalized.actionType,
    JSON.stringify(normalized.actionPayload),
    nextRunAt,
    scheduleId,
    userId,
    serverId,
  )
  if (result.changes === 0) throw new Error('Schedule not found')
  logAudit(userId, 'schedule_update', normalized.label, normalized.actionType, serverId)
  return listSchedules(userId, serverId).find(entry => entry.id === scheduleId)!
}

export function deleteSchedule(userId: string, serverId: string, scheduleId: string): void {
  const db = getDb()
  const existing = db.prepare(
    'SELECT label FROM scheduled_tasks WHERE id = ? AND user_id = ? AND server_id = ?'
  ).get(scheduleId, userId, serverId) as { label: string } | undefined
  if (!existing) throw new Error('Schedule not found')
  const result = db.prepare(
    'DELETE FROM scheduled_tasks WHERE id = ? AND user_id = ? AND server_id = ?'
  ).run(scheduleId, userId, serverId)
  if (result.changes === 0) throw new Error('Schedule not found')
  logAudit(userId, 'schedule_delete', existing.label, undefined, serverId)
}

function recordScheduleRun(task: ScheduleRecord, status: 'ok' | 'error', output: string | null, startedAt: number, finishedAt: number) {
  const db = getDb()
  db.prepare(`
    INSERT INTO scheduled_task_runs (task_id, user_id, server_id, status, output, started_at, finished_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(task.id, task.userId, task.serverId, status, output, startedAt, finishedAt)
}

function resyncOverdueSchedules(now = Date.now()) {
  const db = getDb()
  const overdue = db.prepare('SELECT * FROM scheduled_tasks WHERE enabled = 1 AND next_run_at < ?').all(now) as ScheduleRow[]
  const update = db.prepare('UPDATE scheduled_tasks SET next_run_at = ?, updated_at = unixepoch() WHERE id = ?')
  for (const row of overdue) {
    const task = rowToSchedule(row)
    update.run(computeNextRunAt({
      label: task.label,
      enabled: task.enabled,
      cadence: task.cadence,
      timezone: task.timezone,
      timeOfDay: task.timeOfDay,
      dayOfWeek: task.dayOfWeek,
      dayOfMonth: task.dayOfMonth,
      actionType: task.actionType,
      actionPayload: task.actionPayload,
    }, now), task.id)
  }
}

let runnerStarted = false
let runnerBusy = false

async function executeDueSchedules() {
  if (runnerBusy) return
  runnerBusy = true
  try {
    const now = Date.now()
    const db = getDb()
    const rows = db.prepare(`
      SELECT st.*, ss.host, ss.port, ss.password_enc
      FROM scheduled_tasks st
      JOIN saved_servers ss
        ON ss.id = st.server_id AND ss.user_id = st.user_id
      WHERE st.enabled = 1 AND st.next_run_at <= ?
      ORDER BY st.next_run_at ASC
    `).all(now) as DueScheduleRow[]

    for (const row of rows) {
      const task = rowToSchedule(row)
      const command = buildScheduleCommand(task)
      const startedAt = Date.now()
      let status: 'ok' | 'error' = 'ok'
      let output = ''
      try {
        const result = await rconDirect(row.host, row.port, decryptPassword(row.password_enc), command)
        if (!result.ok) {
          status = 'error'
          output = result.error || 'RCON error'
        } else {
          output = result.stdout || 'ok'
        }
      } catch (error) {
        status = 'error'
        output = error instanceof Error ? error.message : 'Schedule failed'
      }
      const finishedAt = Date.now()
      const nextRunAt = computeNextRunAt({
        label: task.label,
        enabled: task.enabled,
        cadence: task.cadence,
        timezone: task.timezone,
        timeOfDay: task.timeOfDay,
        dayOfWeek: task.dayOfWeek,
        dayOfMonth: task.dayOfMonth,
        actionType: task.actionType,
        actionPayload: task.actionPayload,
      }, finishedAt)
      db.prepare(`
        UPDATE scheduled_tasks
        SET last_run_at = ?, next_run_at = ?, updated_at = unixepoch()
        WHERE id = ?
      `).run(finishedAt, nextRunAt, task.id)
      recordScheduleRun(task, status, output.slice(0, 500), startedAt, finishedAt)
      logAudit(task.userId, 'schedule_run', task.label, `${task.actionType}:${status}`, task.serverId)
    }
  } finally {
    runnerBusy = false
  }
}

export function ensureScheduleRunnerStarted() {
  if (runnerStarted) return
  runnerStarted = true
  resyncOverdueSchedules(Date.now())
  setInterval(() => {
    void executeDueSchedules()
  }, 30_000)
}
