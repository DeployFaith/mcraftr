import { getDb } from './db'

export type AuditAction = 
  | 'ban' | 'kick' | 'pardon' | 'op' | 'deop' 
  | 'give' | 'clear_item' | 'gamemode' | 'difficulty'
  | 'gamerule' | 'save_all' | 'stop_server' | 'tp'
  | 'whitelist_add' | 'whitelist_remove' | 'broadcast' | 'cmd'

export type AuditEntry = {
  id: number
  user_id: string
  action: AuditAction
  target: string | null
  detail: string | null
  ts: number
}

export function logAudit(userId: string, action: AuditAction, target?: string, detail?: string): void {
  try {
    const db = getDb()
    db.prepare(`
      CREATE TABLE IF NOT EXISTS audit_log (
        id      INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id TEXT NOT NULL,
        action  TEXT NOT NULL,
        target  TEXT,
        detail  TEXT,
        ts      INTEGER NOT NULL DEFAULT (unixepoch())
      )
    `).run()
    db.prepare(
      'INSERT INTO audit_log (user_id, action, target, detail) VALUES (?, ?, ?, ?)'
    ).run(userId, action, target ?? null, detail ?? null)
  } catch (e) {
    // Audit logging is best-effort — never crash the main request
    console.error('[mcraftr] audit log error:', e)
  }
}

export function getAuditLog(limit = 100): AuditEntry[] {
  try {
    const db = getDb()
    db.prepare(`
      CREATE TABLE IF NOT EXISTS audit_log (
        id      INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id TEXT NOT NULL,
        action  TEXT NOT NULL,
        target  TEXT,
        detail  TEXT,
        ts      INTEGER NOT NULL DEFAULT (unixepoch())
      )
    `).run()
    return db.prepare(
      'SELECT * FROM audit_log ORDER BY ts DESC LIMIT ?'
    ).all(limit) as AuditEntry[]
  } catch {
    return []
  }
}
