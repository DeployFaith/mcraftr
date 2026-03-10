import { getDb } from './db'

export type AuditAction = 
  | 'ban' | 'kick' | 'pardon' | 'op' | 'deop' 
  | 'give' | 'clear_item' | 'gamemode' | 'difficulty'
  | 'gamerule' | 'save_all' | 'stop_server' | 'tp'
  | 'whitelist_add' | 'whitelist_remove' | 'broadcast' | 'msg' | 'cmd'
  | 'world_create' | 'world_clone' | 'world_load' | 'world_unload' | 'world_tp' | 'world_spawn' | 'world_setting' | 'world_delete' | 'worldedit'
  | 'structure_place' | 'structure_remove' | 'structure_clear'
  | 'entity_spawn'
  | 'terminal_cmd'
  | 'create_user' | 'delete_user' | 'set_role'
  | 'schedule_create' | 'schedule_update' | 'schedule_delete' | 'schedule_run'

export type AuditEntry = {
  id: number
  user_id: string
  server_id: string | null
  action: AuditAction
  target: string | null
  detail: string | null
  ts: number
}

export function logAudit(userId: string, action: AuditAction, target?: string, detail?: string, serverId?: string | null): void {
  try {
    const db = getDb()
    db.prepare(`
      CREATE TABLE IF NOT EXISTS audit_log (
        id      INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id TEXT NOT NULL,
        server_id TEXT,
        action  TEXT NOT NULL,
        target  TEXT,
        detail  TEXT,
        ts      INTEGER NOT NULL DEFAULT (unixepoch())
      )
    `).run()
    db.prepare(
      'INSERT INTO audit_log (user_id, server_id, action, target, detail) VALUES (?, ?, ?, ?, ?)'
    ).run(userId, serverId ?? null, action, target ?? null, detail ?? null)
  } catch (e) {
    // Audit logging is best-effort — never crash the main request
    console.error('[mcraftr] audit log error:', e)
  }
}

export function getAuditLog(limit = 100, serverId?: string | null): AuditEntry[] {
  try {
    const db = getDb()
    db.prepare(`
      CREATE TABLE IF NOT EXISTS audit_log (
        id      INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id TEXT NOT NULL,
        server_id TEXT,
        action  TEXT NOT NULL,
        target  TEXT,
        detail  TEXT,
        ts      INTEGER NOT NULL DEFAULT (unixepoch())
      )
    `).run()
    if (serverId) {
      return db.prepare(
        'SELECT * FROM audit_log WHERE server_id = ? ORDER BY ts DESC LIMIT ?'
      ).all(serverId, limit) as AuditEntry[]
    }
    return db.prepare('SELECT * FROM audit_log ORDER BY ts DESC LIMIT ?').all(limit) as AuditEntry[]
  } catch {
    return []
  }
}
