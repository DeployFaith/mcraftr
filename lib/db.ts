import fs from 'fs'
import path from 'path'
import Database from 'better-sqlite3'

// ── Shared SQLite singleton ───────────────────────────────────────────────────

const DATA_DIR = process.env.DATA_DIR || '/app/data'
const DB_FILE  = path.join(DATA_DIR, 'mcraftr.db')

let _db: Database.Database | null = null

export function getDb(): Database.Database {
  if (_db) return _db

  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true })

  _db = new Database(DB_FILE)
  _db.pragma('journal_mode = WAL')
  _db.pragma('foreign_keys = ON')

  _db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id           TEXT PRIMARY KEY,
      email        TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role         TEXT NOT NULL DEFAULT 'user',
      use_sidecar  INTEGER NOT NULL DEFAULT 0,
      created_at   INTEGER NOT NULL DEFAULT (unixepoch())
    );

    CREATE TABLE IF NOT EXISTS servers (
      user_id      TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      host         TEXT NOT NULL,
      port         INTEGER NOT NULL DEFAULT 25575,
      password_enc TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS player_sessions (
      user_id     TEXT NOT NULL,
      player_name TEXT NOT NULL,
      joined_at   INTEGER NOT NULL,
      PRIMARY KEY (user_id, player_name)
    );

    CREATE TABLE IF NOT EXISTS player_directory (
      user_id     TEXT NOT NULL,
      player_name TEXT NOT NULL,
      last_seen   INTEGER NOT NULL DEFAULT (unixepoch()),
      PRIMARY KEY (user_id, player_name)
    );

    CREATE TABLE IF NOT EXISTS chat_log (
      id        INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id   TEXT NOT NULL,
      type      TEXT NOT NULL,
      player    TEXT,
      message   TEXT NOT NULL,
      ts        INTEGER NOT NULL DEFAULT (unixepoch())
    );

    CREATE TABLE IF NOT EXISTS user_features (
      user_id           TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      enable_chat       INTEGER NOT NULL DEFAULT 1,
      enable_chat_read  INTEGER NOT NULL DEFAULT 1,
      enable_chat_write INTEGER NOT NULL DEFAULT 1,
      enable_teleport   INTEGER NOT NULL DEFAULT 1,
      enable_inventory  INTEGER NOT NULL DEFAULT 1,
      enable_rcon       INTEGER NOT NULL DEFAULT 1,
      enable_admin      INTEGER NOT NULL DEFAULT 1,
      updated_at        INTEGER NOT NULL DEFAULT (unixepoch())
    );
  `)

  return _db
}
