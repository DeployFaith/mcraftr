import { NextRequest } from 'next/server'
import { rconForRequest, getSessionUserId } from '@/lib/rcon'
import Database from 'better-sqlite3'
import path from 'path'
import fs from 'fs'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// ── Session tracking — SQLite-backed ─────────────────────────────────────────
// Persists player join timestamps across container restarts.
// Uses the same DB file as users/servers; schema is additive (CREATE IF NOT EXISTS).

const DATA_DIR = process.env.DATA_DIR || '/app/data'
const DB_FILE  = path.join(DATA_DIR, 'mcraftr.db')

let _db: Database.Database | null = null

function getDb(): Database.Database {
  if (_db) return _db
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true })
  _db = new Database(DB_FILE)
  _db.pragma('journal_mode = WAL')
  _db.exec(`
    CREATE TABLE IF NOT EXISTS player_sessions (
      user_id     TEXT NOT NULL,
      player_name TEXT NOT NULL,
      joined_at   INTEGER NOT NULL,
      PRIMARY KEY (user_id, player_name)
    )
  `)
  return _db
}

function getSessionStarts(userId: string, playerList: string[]): Record<string, number> {
  const db  = getDb()
  const now = Date.now()

  if (playerList.length === 0) {
    db.prepare('DELETE FROM player_sessions WHERE user_id = ?').run(userId)
    return {}
  }

  // Upsert new players — IGNORE preserves existing join time for returning players
  const insert = db.prepare(
    'INSERT OR IGNORE INTO player_sessions (user_id, player_name, joined_at) VALUES (?, ?, ?)'
  )
  db.transaction((names: string[]) => {
    for (const name of names) insert.run(userId, name, now)
  })(playerList)

  // Remove players who left
  const placeholders = playerList.map(() => '?').join(', ')
  db.prepare(
    `DELETE FROM player_sessions WHERE user_id = ? AND player_name NOT IN (${placeholders})`
  ).run(userId, ...playerList)

  // Read back persisted join times
  const rows = db.prepare(
    `SELECT player_name, joined_at FROM player_sessions WHERE user_id = ? AND player_name IN (${placeholders})`
  ).all(userId, ...playerList) as { player_name: string; joined_at: number }[]

  const result: Record<string, number> = {}
  for (const row of rows) result[row.player_name] = row.joined_at
  return result
}

// ── Route ─────────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const userId = await getSessionUserId(req)
  if (!userId) {
    return Response.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
  }
  try {
    const data = await rconForRequest(req, 'list')

    if (!data.ok) {
      return Response.json({ count: 0, players: '', ts: Date.now(), sessionStarts: {}, error: data.error || 'RCON error' })
    }

    const raw   = data.stdout
    const match = raw.match(/There are (\d+)/)
    const count = match ? parseInt(match[1]) : 0

    const playersMatch = raw.match(/online[.:]+\s*([\s\S]+)/)
    let playerList: string[] = []
    if (playersMatch && count > 0) {
      playerList = playersMatch[1]
        .split(',')
        .map((n: string) => n.trim().replace(/^\w+:\s*/, ''))  // strip "Geyser: " prefix incl. trailing space
        .filter(Boolean)
    }

    const sessionStarts = getSessionStarts(userId, playerList)

    return Response.json({
      count,
      players: playerList.join(', '),
      ts:      Date.now(),
      sessionStarts,  // { [playerName]: joinedAtMs }
    })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Server unreachable'
    return Response.json({ count: 0, players: '', ts: Date.now(), sessionStarts: {}, error: msg })
  }
}
