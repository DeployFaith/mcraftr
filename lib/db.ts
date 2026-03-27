import fs from 'fs'
import path from 'path'
import Database from 'better-sqlite3'

// ── Shared SQLite singleton ───────────────────────────────────────────────────

const DATA_DIR = process.env.DATA_DIR || '/app/data'
const DB_FILE  = path.join(DATA_DIR, 'mcraftr.db')

let _db: Database.Database | null = null

function hasColumn(db: Database.Database, table: string, column: string): boolean {
  const rows = db.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>
  return rows.some(row => row.name === column)
}

function hasTable(db: Database.Database, table: string): boolean {
  const row = db.prepare(
    `SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?`
  ).get(table) as { name?: string } | undefined
  return !!row?.name
}

function ensureColumn(db: Database.Database, table: string, column: string, ddl: string): void {
  if (!hasTable(db, table) || hasColumn(db, table, column)) return
  db.exec(`ALTER TABLE ${table} ADD COLUMN ${ddl}`)
}

function migratePlayerTables(db: Database.Database): void {
  const hasLegacyPlayerSessions = hasTable(db, 'player_sessions') && !hasColumn(db, 'player_sessions', 'server_id')
  if (hasLegacyPlayerSessions) {
    db.exec(`
      ALTER TABLE player_sessions RENAME TO player_sessions_legacy;
      CREATE TABLE player_sessions (
        user_id     TEXT NOT NULL,
        server_id   TEXT NOT NULL,
        player_name TEXT NOT NULL,
        joined_at   INTEGER NOT NULL,
        PRIMARY KEY (user_id, server_id, player_name)
      );
    `)
    db.prepare(`
      INSERT INTO player_sessions (user_id, server_id, player_name, joined_at)
      SELECT ps.user_id, COALESCE(u.active_server_id, ''), ps.player_name, ps.joined_at
      FROM player_sessions_legacy ps
      LEFT JOIN users u ON u.id = ps.user_id
      WHERE COALESCE(u.active_server_id, '') != ''
    `).run()
    db.exec('DROP TABLE player_sessions_legacy')
  }

  const hasLegacyPlayerDirectory = hasTable(db, 'player_directory') && !hasColumn(db, 'player_directory', 'server_id')
  if (hasLegacyPlayerDirectory) {
    db.exec(`
      ALTER TABLE player_directory RENAME TO player_directory_legacy;
      CREATE TABLE player_directory (
        user_id     TEXT NOT NULL,
        server_id   TEXT NOT NULL,
        player_name TEXT NOT NULL,
        last_seen   INTEGER NOT NULL DEFAULT (unixepoch()),
        PRIMARY KEY (user_id, server_id, player_name)
      );
    `)
    db.prepare(`
      INSERT INTO player_directory (user_id, server_id, player_name, last_seen)
      SELECT pd.user_id, COALESCE(u.active_server_id, ''), pd.player_name, pd.last_seen
      FROM player_directory_legacy pd
      LEFT JOIN users u ON u.id = pd.user_id
      WHERE COALESCE(u.active_server_id, '') != ''
    `).run()
    db.exec('DROP TABLE player_directory_legacy')
  }
}

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
      is_temporary INTEGER NOT NULL DEFAULT 0,
      temporary_last_used_at INTEGER,
      avatar_type  TEXT,
      avatar_value TEXT,
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
      server_id   TEXT NOT NULL,
      player_name TEXT NOT NULL,
      joined_at   INTEGER NOT NULL,
      PRIMARY KEY (user_id, server_id, player_name)
    );

    CREATE TABLE IF NOT EXISTS player_directory (
      user_id     TEXT NOT NULL,
      server_id   TEXT NOT NULL,
      player_name TEXT NOT NULL,
      last_seen   INTEGER NOT NULL DEFAULT (unixepoch()),
      PRIMARY KEY (user_id, server_id, player_name)
    );

    CREATE TABLE IF NOT EXISTS chat_log (
      id        INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id   TEXT NOT NULL,
      server_id TEXT,
      type      TEXT NOT NULL,
      player    TEXT,
      message   TEXT NOT NULL,
      ts        INTEGER NOT NULL DEFAULT (unixepoch())
    );

    CREATE TABLE IF NOT EXISTS custom_kits (
      id          TEXT PRIMARY KEY,
      user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      label       TEXT NOT NULL,
      icon_type   TEXT NOT NULL,
      icon_value  TEXT NOT NULL,
      items_json  TEXT NOT NULL,
      created_at  INTEGER NOT NULL DEFAULT (unixepoch()),
      updated_at  INTEGER NOT NULL DEFAULT (unixepoch())
    );

    CREATE TABLE IF NOT EXISTS scheduled_tasks (
      id            TEXT PRIMARY KEY,
      user_id       TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      server_id     TEXT NOT NULL,
      label         TEXT NOT NULL,
      enabled       INTEGER NOT NULL DEFAULT 1,
      cadence       TEXT NOT NULL,
      timezone      TEXT NOT NULL,
      time_of_day   TEXT NOT NULL,
      day_of_week   INTEGER,
      day_of_month  INTEGER,
      action_type   TEXT NOT NULL,
      action_payload TEXT NOT NULL,
      last_run_at   INTEGER,
      next_run_at   INTEGER NOT NULL,
      created_at    INTEGER NOT NULL DEFAULT (unixepoch()),
      updated_at    INTEGER NOT NULL DEFAULT (unixepoch())
    );

    CREATE INDEX IF NOT EXISTS idx_scheduled_tasks_server
      ON scheduled_tasks(user_id, server_id, enabled, next_run_at);

    CREATE TABLE IF NOT EXISTS scheduled_task_runs (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      task_id     TEXT NOT NULL REFERENCES scheduled_tasks(id) ON DELETE CASCADE,
      user_id     TEXT NOT NULL,
      server_id   TEXT NOT NULL,
      status      TEXT NOT NULL,
      output      TEXT,
      started_at  INTEGER NOT NULL,
      finished_at INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_scheduled_task_runs_task
      ON scheduled_task_runs(task_id, started_at DESC);

    CREATE TABLE IF NOT EXISTS saved_servers (
      id           TEXT PRIMARY KEY,
      user_id      TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      label        TEXT,
      host         TEXT NOT NULL,
      port         INTEGER NOT NULL DEFAULT 25575,
      password_enc TEXT NOT NULL,
      bridge_enabled INTEGER NOT NULL DEFAULT 0,
      bridge_command_prefix TEXT NOT NULL DEFAULT 'mcraftr',
      bridge_provider_id TEXT,
      bridge_provider_label TEXT,
      bridge_protocol_version TEXT,
      minecraft_version_override TEXT,
      minecraft_version_resolved TEXT,
      minecraft_version_source TEXT,
      minecraft_version_detected_at INTEGER,
      bridge_last_seen INTEGER,
      bridge_last_error TEXT,
      bridge_capabilities_json TEXT,
      sidecar_enabled INTEGER NOT NULL DEFAULT 0,
      sidecar_url TEXT,
      sidecar_token_enc TEXT,
      sidecar_last_seen INTEGER,
      sidecar_capabilities_json TEXT,
      sidecar_structure_roots_json TEXT,
      sidecar_entity_roots_json TEXT,
      created_at   INTEGER NOT NULL DEFAULT (unixepoch()),
      updated_at   INTEGER NOT NULL DEFAULT (unixepoch())
    );

    CREATE INDEX IF NOT EXISTS idx_saved_servers_user_id
      ON saved_servers(user_id, updated_at DESC, created_at DESC);

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

    CREATE TABLE IF NOT EXISTS user_feature_flags (
      user_id      TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      feature_key  TEXT NOT NULL,
      enabled      INTEGER NOT NULL,
      updated_at   INTEGER NOT NULL DEFAULT (unixepoch()),
      PRIMARY KEY (user_id, feature_key)
    );

    CREATE TABLE IF NOT EXISTS audit_log (
      id        INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id   TEXT NOT NULL,
      server_id TEXT,
      action    TEXT NOT NULL,
      target    TEXT,
      detail    TEXT,
      ts        INTEGER NOT NULL DEFAULT (unixepoch())
    );

    CREATE TABLE IF NOT EXISTS world_structure_placements (
      id            TEXT PRIMARY KEY,
      user_id       TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      server_id     TEXT NOT NULL,
      world         TEXT NOT NULL,
      structure_id  TEXT NOT NULL,
      structure_label TEXT NOT NULL,
      source_kind   TEXT NOT NULL,
      bridge_ref    TEXT NOT NULL,
      origin_x      REAL NOT NULL,
      origin_y      REAL NOT NULL,
      origin_z      REAL NOT NULL,
      rotation      INTEGER NOT NULL DEFAULT 0,
      include_air   INTEGER NOT NULL DEFAULT 0,
      min_x         INTEGER NOT NULL,
      min_y         INTEGER NOT NULL,
      min_z         INTEGER NOT NULL,
      max_x         INTEGER NOT NULL,
      max_y         INTEGER NOT NULL,
      max_z         INTEGER NOT NULL,
      metadata_json TEXT,
      created_at    INTEGER NOT NULL DEFAULT (unixepoch()),
      removed_at    INTEGER
    );

    CREATE INDEX IF NOT EXISTS idx_world_structure_placements_server
      ON world_structure_placements(server_id, world, removed_at, created_at DESC);

    CREATE TABLE IF NOT EXISTS terminal_state (
      user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      server_id   TEXT NOT NULL,
      layout_json TEXT NOT NULL,
      updated_at  INTEGER NOT NULL DEFAULT (unixepoch()),
      PRIMARY KEY (user_id, server_id)
    );

    CREATE TABLE IF NOT EXISTS terminal_history (
      id                 TEXT PRIMARY KEY,
      user_id            TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      server_id          TEXT NOT NULL,
      command            TEXT NOT NULL,
      normalized_command TEXT NOT NULL,
      output_text        TEXT NOT NULL,
      output_json        TEXT,
      ok                 INTEGER NOT NULL DEFAULT 0,
      duration_ms        INTEGER NOT NULL DEFAULT 0,
      risk_level         TEXT NOT NULL DEFAULT 'low',
      source             TEXT NOT NULL DEFAULT 'manual',
      wizard_id          TEXT,
      truncated          INTEGER NOT NULL DEFAULT 0,
      created_at         INTEGER NOT NULL DEFAULT (unixepoch())
    );

    CREATE INDEX IF NOT EXISTS idx_terminal_history_server
      ON terminal_history(user_id, server_id, created_at DESC);

    CREATE TABLE IF NOT EXISTS terminal_saved_commands (
      id           TEXT PRIMARY KEY,
      user_id      TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      server_id    TEXT NOT NULL,
      label        TEXT NOT NULL,
      command      TEXT NOT NULL,
      description  TEXT,
      group_name   TEXT,
      icon         TEXT,
      created_at   INTEGER NOT NULL DEFAULT (unixepoch()),
      updated_at   INTEGER NOT NULL DEFAULT (unixepoch()),
      last_used_at INTEGER
    );

    CREATE INDEX IF NOT EXISTS idx_terminal_saved_commands_server
      ON terminal_saved_commands(user_id, server_id, COALESCE(last_used_at, 0) DESC, updated_at DESC);

    CREATE TABLE IF NOT EXISTS player_xp_boosters (
      id               TEXT PRIMARY KEY,
      user_id          TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      server_id        TEXT NOT NULL,
      player_name      TEXT NOT NULL,
      label            TEXT NOT NULL,
      duration_hours   INTEGER NOT NULL,
      bonus_points     INTEGER NOT NULL,
      interval_seconds INTEGER NOT NULL DEFAULT 300,
      ends_at          INTEGER NOT NULL,
      last_run_at      INTEGER,
      cancelled_at     INTEGER,
      created_at       INTEGER NOT NULL DEFAULT (unixepoch())
    );

    CREATE INDEX IF NOT EXISTS idx_player_xp_boosters_active
      ON player_xp_boosters(user_id, server_id, player_name, cancelled_at, ends_at);

    CREATE TABLE IF NOT EXISTS server_integration_preferences (
      user_id         TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      server_id       TEXT NOT NULL,
      preference_key  TEXT NOT NULL,
      integration_id  TEXT NOT NULL,
      reason          TEXT,
      created_at      INTEGER NOT NULL DEFAULT (unixepoch()),
      updated_at      INTEGER NOT NULL DEFAULT (unixepoch()),
      PRIMARY KEY (user_id, server_id, preference_key)
    );

    CREATE INDEX IF NOT EXISTS idx_server_integration_preferences_lookup
      ON server_integration_preferences(user_id, server_id, updated_at DESC);
  `)

  ensureColumn(_db, 'users', 'active_server_id', 'active_server_id TEXT')
  ensureColumn(_db, 'users', 'is_temporary', 'is_temporary INTEGER NOT NULL DEFAULT 0')
  ensureColumn(_db, 'users', 'temporary_last_used_at', 'temporary_last_used_at INTEGER')
  ensureColumn(_db, 'users', 'avatar_type', 'avatar_type TEXT')
  ensureColumn(_db, 'users', 'avatar_value', 'avatar_value TEXT')
  ensureColumn(_db, 'saved_servers', 'bridge_enabled', 'bridge_enabled INTEGER')
  ensureColumn(_db, 'saved_servers', 'bridge_command_prefix', 'bridge_command_prefix TEXT')
  ensureColumn(_db, 'saved_servers', 'bridge_provider_id', 'bridge_provider_id TEXT')
  ensureColumn(_db, 'saved_servers', 'bridge_provider_label', 'bridge_provider_label TEXT')
  ensureColumn(_db, 'saved_servers', 'bridge_protocol_version', 'bridge_protocol_version TEXT')
  ensureColumn(_db, 'saved_servers', 'minecraft_version_override', 'minecraft_version_override TEXT')
  ensureColumn(_db, 'saved_servers', 'minecraft_version_resolved', 'minecraft_version_resolved TEXT')
  ensureColumn(_db, 'saved_servers', 'minecraft_version_source', 'minecraft_version_source TEXT')
  ensureColumn(_db, 'saved_servers', 'minecraft_version_detected_at', 'minecraft_version_detected_at INTEGER')
  ensureColumn(_db, 'saved_servers', 'bridge_last_seen', 'bridge_last_seen INTEGER')
  ensureColumn(_db, 'saved_servers', 'bridge_last_error', 'bridge_last_error TEXT')
  ensureColumn(_db, 'saved_servers', 'bridge_capabilities_json', 'bridge_capabilities_json TEXT')
  ensureColumn(_db, 'saved_servers', 'sidecar_enabled', 'sidecar_enabled INTEGER NOT NULL DEFAULT 0')
  ensureColumn(_db, 'saved_servers', 'sidecar_url', 'sidecar_url TEXT')
  ensureColumn(_db, 'saved_servers', 'sidecar_token_enc', 'sidecar_token_enc TEXT')
  ensureColumn(_db, 'saved_servers', 'sidecar_last_seen', 'sidecar_last_seen INTEGER')
  ensureColumn(_db, 'saved_servers', 'sidecar_capabilities_json', 'sidecar_capabilities_json TEXT')
  ensureColumn(_db, 'saved_servers', 'sidecar_structure_roots_json', 'sidecar_structure_roots_json TEXT')
  ensureColumn(_db, 'saved_servers', 'sidecar_entity_roots_json', 'sidecar_entity_roots_json TEXT')
  ensureColumn(_db, 'chat_log', 'server_id', 'server_id TEXT')
  ensureColumn(_db, 'audit_log', 'server_id', 'server_id TEXT')
  _db.exec(`
    UPDATE saved_servers
    SET
      bridge_enabled = COALESCE(bridge_enabled, 1),
      bridge_command_prefix = COALESCE(NULLIF(TRIM(bridge_command_prefix), ''), '${(process.env.MCRAFTR_LEGACY_BRIDGE_PREFIX || 'mcraftr').replace(/'/g, "''")}')
    WHERE bridge_enabled IS NULL OR bridge_command_prefix IS NULL
  `)
  migratePlayerTables(_db)

  return _db
}
