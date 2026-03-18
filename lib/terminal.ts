import crypto from 'crypto'
import { getDb } from './db'
import {
  classifyCommandRisk,
  getDefaultTerminalState,
  normalizeServerCommand,
  wizardIdForCommand,
  type TerminalCatalogEntry,
  type TerminalEntrySource,
  type TerminalFavorite,
  type TerminalHistoryEntry,
  type TerminalRiskLevel,
  type TerminalState,
  type TerminalStructuredOutput,
} from './terminal-shared'
import { sanitizePublicText } from './public-branding'

type TerminalHistoryRow = {
  id: string
  user_id: string
  server_id: string
  command: string
  normalized_command: string
  output_text: string
  output_json: string | null
  ok: number
  duration_ms: number
  risk_level: TerminalRiskLevel
  source: TerminalEntrySource
  wizard_id: string | null
  truncated: number
  created_at: number
}

type TerminalFavoriteRow = {
  id: string
  user_id: string
  server_id: string
  label: string
  command: string
  description: string | null
  group_name: string | null
  icon: string | null
  created_at: number
  updated_at: number
  last_used_at: number | null
}

type TerminalStateRow = {
  user_id: string
  server_id: string
  layout_json: string
  updated_at: number
}

const MAX_HISTORY_ROWS = 500
const MAX_OUTPUT_BYTES = 32 * 1024

function parseJsonMaybe(raw: string | null): TerminalStructuredOutput {
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as unknown
    if (Array.isArray(parsed) || (parsed && typeof parsed === 'object')) {
      return parsed as TerminalStructuredOutput
    }
  } catch {}
  return null
}

function extractJsonPayload(raw: string): TerminalStructuredOutput {
  const trimmed = raw.trim()
  if (!trimmed) return null
  const lines = trimmed.split('\n').map(line => line.trim()).filter(Boolean)
  for (let i = lines.length - 1; i >= 0; i -= 1) {
    const line = lines[i]
    if ((line.startsWith('{') && line.endsWith('}')) || (line.startsWith('[') && line.endsWith(']'))) {
      return parseJsonMaybe(line)
    }
  }
  const objectStart = trimmed.indexOf('{')
  if (objectStart >= 0) return parseJsonMaybe(trimmed.slice(objectStart))
  const arrayStart = trimmed.indexOf('[')
  if (arrayStart >= 0) return parseJsonMaybe(trimmed.slice(arrayStart))
  return null
}

function truncateOutput(value: string) {
  const bytes = Buffer.byteLength(value, 'utf8')
  if (bytes <= MAX_OUTPUT_BYTES) {
    return { output: value, truncated: false }
  }
  const buffer = Buffer.from(value, 'utf8')
  return {
    output: `${buffer.subarray(0, MAX_OUTPUT_BYTES).toString('utf8')}\n… [truncated]`,
    truncated: true,
  }
}

function historyRowToEntry(row: TerminalHistoryRow): TerminalHistoryEntry {
  return {
    id: row.id,
    userId: row.user_id,
    serverId: row.server_id,
    command: row.command,
    normalizedCommand: row.normalized_command,
    output: row.output_text,
    structuredOutput: parseJsonMaybe(row.output_json),
    ok: row.ok === 1,
    durationMs: row.duration_ms,
    riskLevel: row.risk_level,
    source: row.source,
    wizardId: row.wizard_id,
    truncated: row.truncated === 1,
    createdAt: row.created_at,
  }
}

function favoriteRowToEntry(row: TerminalFavoriteRow): TerminalFavorite {
  return {
    id: row.id,
    userId: row.user_id,
    serverId: row.server_id,
    label: row.label,
    command: row.command,
    description: row.description,
    groupName: row.group_name,
    icon: row.icon,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    lastUsedAt: row.last_used_at,
  }
}

function mergeState(next: Partial<TerminalState>): TerminalState {
  return {
    ...getDefaultTerminalState(),
    ...next,
  }
}

export function extractStructuredOutput(raw: string): TerminalStructuredOutput {
  return extractJsonPayload(raw)
}

export function getTerminalState(userId: string, serverId: string): TerminalState {
  const db = getDb()
  const row = db
    .prepare('SELECT * FROM terminal_state WHERE user_id = ? AND server_id = ?')
    .get(userId, serverId) as TerminalStateRow | undefined
  if (!row) return getDefaultTerminalState()
  try {
    return mergeState(JSON.parse(row.layout_json) as Partial<TerminalState>)
  } catch {
    return getDefaultTerminalState()
  }
}

export function saveTerminalState(userId: string, serverId: string, next: Partial<TerminalState>): TerminalState {
  const db = getDb()
  const merged = mergeState({ ...getTerminalState(userId, serverId), ...next })
  db.prepare(`
    INSERT INTO terminal_state (user_id, server_id, layout_json, updated_at)
    VALUES (?, ?, ?, unixepoch())
    ON CONFLICT(user_id, server_id)
    DO UPDATE SET layout_json = excluded.layout_json, updated_at = unixepoch()
  `).run(userId, serverId, JSON.stringify(merged))
  return merged
}

export function listTerminalHistory(userId: string, serverId: string, limit = 100, before?: number | null) {
  const db = getDb()
  const safeLimit = Math.max(1, Math.min(200, limit))
  const rows = before
    ? db
        .prepare(`
          SELECT *
          FROM terminal_history
          WHERE user_id = ? AND server_id = ? AND created_at < ?
          ORDER BY created_at DESC
          LIMIT ?
        `)
        .all(userId, serverId, before, safeLimit) as TerminalHistoryRow[]
    : db
        .prepare(`
          SELECT *
          FROM terminal_history
          WHERE user_id = ? AND server_id = ?
          ORDER BY created_at DESC
          LIMIT ?
        `)
        .all(userId, serverId, safeLimit) as TerminalHistoryRow[]
  return rows.map(historyRowToEntry)
}

export function appendTerminalHistory(input: {
  userId: string
  serverId: string
  command: string
  normalizedCommand: string
  output: string
  ok: boolean
  durationMs: number
  riskLevel?: TerminalRiskLevel
  source?: TerminalEntrySource
  wizardId?: string | null
}) {
  const db = getDb()
  const id = crypto.randomUUID()
  const riskLevel = input.riskLevel ?? classifyCommandRisk(input.normalizedCommand || input.command)
  const structured = extractStructuredOutput(input.output)
  const { output, truncated } = truncateOutput(input.output)
  db.prepare(`
    INSERT INTO terminal_history (
      id, user_id, server_id, command, normalized_command, output_text, output_json,
      ok, duration_ms, risk_level, source, wizard_id, truncated, created_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, unixepoch())
  `).run(
    id,
    input.userId,
    input.serverId,
    input.command,
    input.normalizedCommand,
    output,
    structured ? JSON.stringify(structured) : null,
    input.ok ? 1 : 0,
    Math.max(0, Math.round(input.durationMs)),
    riskLevel,
    input.source ?? 'manual',
    input.wizardId ?? null,
    truncated ? 1 : 0,
  )
  db.prepare(`
    DELETE FROM terminal_history
    WHERE id IN (
      SELECT id
      FROM terminal_history
      WHERE user_id = ? AND server_id = ?
      ORDER BY created_at DESC
      LIMIT -1 OFFSET ?
    )
  `).run(input.userId, input.serverId, MAX_HISTORY_ROWS)
  const row = db.prepare('SELECT * FROM terminal_history WHERE id = ?').get(id) as TerminalHistoryRow
  return historyRowToEntry(row)
}

export function listTerminalFavorites(userId: string, serverId: string): TerminalFavorite[] {
  const db = getDb()
  const rows = db
    .prepare(`
      SELECT *
      FROM terminal_saved_commands
      WHERE user_id = ? AND server_id = ?
      ORDER BY COALESCE(last_used_at, 0) DESC, updated_at DESC, created_at DESC
    `)
    .all(userId, serverId) as TerminalFavoriteRow[]
  return rows.map(favoriteRowToEntry)
}

export function saveTerminalFavorite(input: {
  userId: string
  serverId: string
  id?: string | null
  label: string
  command: string
  description?: string | null
  groupName?: string | null
  icon?: string | null
}) {
  const db = getDb()
  const id = input.id?.trim() || crypto.randomUUID()
  db.prepare(`
    INSERT INTO terminal_saved_commands (
      id, user_id, server_id, label, command, description, group_name, icon,
      created_at, updated_at, last_used_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, unixepoch(), unixepoch(), NULL)
    ON CONFLICT(id)
    DO UPDATE SET
      label = excluded.label,
      command = excluded.command,
      description = excluded.description,
      group_name = excluded.group_name,
      icon = excluded.icon,
      updated_at = unixepoch()
  `).run(
    id,
    input.userId,
    input.serverId,
    input.label.trim(),
    normalizeServerCommand(input.command),
    input.description?.trim() || null,
    input.groupName?.trim() || null,
    input.icon?.trim() || null,
  )
  const row = db.prepare('SELECT * FROM terminal_saved_commands WHERE id = ?').get(id) as TerminalFavoriteRow
  return favoriteRowToEntry(row)
}

export function deleteTerminalFavorite(userId: string, serverId: string, id: string) {
  const db = getDb()
  const result = db
    .prepare('DELETE FROM terminal_saved_commands WHERE id = ? AND user_id = ? AND server_id = ?')
    .run(id, userId, serverId)
  return result.changes > 0
}

export function touchTerminalFavorite(userId: string, serverId: string, id: string) {
  const db = getDb()
  db.prepare(`
    UPDATE terminal_saved_commands
    SET last_used_at = unixepoch(), updated_at = updated_at
    WHERE id = ? AND user_id = ? AND server_id = ?
  `).run(id, userId, serverId)
}

export function mapTerminalCatalogEntries(raw: unknown): TerminalCatalogEntry[] {
  if (!Array.isArray(raw)) return []
  const entries: TerminalCatalogEntry[] = []
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue
    const row = item as Record<string, unknown>
    const name = sanitizePublicText(typeof row.name === 'string' ? row.name.trim() : '') || ''
    if (!name) continue
    entries.push({
      name,
      namespacedName: typeof row.namespacedName === 'string' && row.namespacedName.trim() ? sanitizePublicText(row.namespacedName.trim()) : null,
      aliases: Array.isArray(row.aliases) ? row.aliases.filter((entry): entry is string => typeof entry === 'string').map(entry => sanitizePublicText(entry.trim()) || '').filter(Boolean) : [],
      description: typeof row.description === 'string' && row.description.trim() ? sanitizePublicText(row.description.trim()) : null,
      usage: typeof row.usage === 'string' && row.usage.trim() ? row.usage.trim() : null,
      permission: typeof row.permission === 'string' && row.permission.trim() ? row.permission.trim() : null,
      source: typeof row.source === 'string' && row.source.trim() ? sanitizePublicText(row.source.trim()) : null,
      riskLevel: classifyCommandRisk(name),
      wizardId: wizardIdForCommand(name),
    })
  }
  return entries.sort((a, b) => a.name.localeCompare(b.name))
}
