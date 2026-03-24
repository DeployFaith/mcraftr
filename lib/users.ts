import fs from 'fs'
import path from 'path'
import crypto from 'crypto'
import bcrypt from 'bcryptjs'
import Database from 'better-sqlite3'
import { getDb } from './db'
import { DEFAULT_FEATURES, FEATURE_KEYS, type FeatureKey } from './features'
import { buildStoredMinecraftVersion, normalizeMinecraftVersion, resolveMinecraftVersion, type MinecraftVersionSource, type MinecraftVersionState } from './minecraft-version'
import { getServerStackMode, type ServerStackMode } from './server-stack'

// ── Types ────────────────────────────────────────────────────────────────────

export type ServerConfig = {
  host: string
  port: number
  password: string  // decrypted in-memory; always encrypted at rest
}

export type SidecarConfig = {
  enabled: boolean
  url: string | null
  token: string | null
  lastSeen: number | null
  capabilities: string[]
  structureRoots: string[]
  entityPresetRoots: string[]
}

export type BridgeConfig = {
  enabled: boolean
  commandPrefix: string
  providerId: string | null
  providerLabel: string | null
  protocolVersion: string | null
  lastSeen: number | null
  lastError: string | null
  capabilities: string[]
}

export type SavedServer = ServerConfig & {
  id: string
  userId: string
  label: string | null
  stackMode: ServerStackMode
  minecraftVersion: MinecraftVersionState
  bridge: BridgeConfig
  sidecar: SidecarConfig
  createdAt: number
  updatedAt: number
}

export type User = {
  id: string
  email: string
  passwordHash: string
  role: 'admin' | 'user'
  isTemporary: boolean
  temporaryLastUsedAt: number | null
  avatar: UserAvatar
  activeServerId: string | null
  servers: SavedServer[]
  server: ServerConfig | null
  serverLabel: string | null
}

export type UserAvatar = {
  type: 'none' | 'builtin' | 'upload'
  value: string | null
}

// ── Encryption helpers ────────────────────────────────────────────────────────
// AES-256-GCM — authenticated encryption, safe for RCON passwords at rest.
//
// Key derivation: uses MCRAFTR_ENC_KEY if set (preferred — allows independent
// rotation from NEXTAUTH_SECRET). Falls back to NEXTAUTH_SECRET for existing
// deployments. In both cases, HKDF-SHA256 with a fixed context label is used
// to produce a proper 32-byte key with domain separation.

const ALGO = 'aes-256-gcm'

function getEncKey(): Buffer {
  const raw = process.env.MCRAFTR_ENC_KEY || process.env.NEXTAUTH_SECRET
  if (!raw) throw new Error('MCRAFTR_ENC_KEY (or NEXTAUTH_SECRET) is not set')
  // HKDF-SHA256: salt=empty (key material is already secret),
  // info label provides domain separation so this key can never be
  // confused with the JWT signing key even if the same secret is used.
  return Buffer.from(crypto.hkdfSync('sha256', raw, '', 'craftr-rcon-enc-v1', 32))
}

export function encryptPassword(plain: string): string {
  const key = getEncKey()
  const iv  = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv(ALGO, key, iv)
  const enc  = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()])
  const tag  = cipher.getAuthTag()
  // Format: hex(iv):hex(tag):hex(ciphertext)
  return `${iv.toString('hex')}:${tag.toString('hex')}:${enc.toString('hex')}`
}

export const encryptSecret = encryptPassword

// Legacy key derivation (SHA-256, no KDF) — used only during re-encryption migration.
function getLegacyEncKey(): Buffer {
  const secret = process.env.NEXTAUTH_SECRET
  if (!secret) throw new Error('NEXTAUTH_SECRET is not set')
  return crypto.createHash('sha256').update(secret).digest()
}

// Attempt to decrypt with a specific key — returns null if auth tag fails.
function tryDecrypt(stored: string, key: Buffer): string | null {
  try {
    const [ivHex, tagHex, encHex] = stored.split(':')
    const iv  = Buffer.from(ivHex, 'hex')
    const tag = Buffer.from(tagHex, 'hex')
    const enc = Buffer.from(encHex, 'hex')
    const decipher = crypto.createDecipheriv(ALGO, key, iv)
    decipher.setAuthTag(tag)
    return decipher.update(enc).toString('utf8') + decipher.final('utf8')
  } catch {
    return null
  }
}

export function decryptPassword(stored: string): string {
  // Reject plaintext values outright. All passwords must be AES-256-GCM
  // encrypted (format: hex(iv):hex(tag):hex(ciphertext)). A value with no
  // colons is either a pre-encryption legacy record or a manually-inserted
  // value — both are errors that must be fixed in the database, not silently
  // worked around by returning the raw value.
  if (!stored.includes(':')) {
    throw new Error('[mcraftr] Refusing to use plaintext RCON password — re-encrypt the servers table row before using this account.')
  }
  const result = tryDecrypt(stored, getEncKey())
  if (result !== null) return result
  // Current key failed — try the legacy SHA-256 key (old deployments before HKDF migration)
  const legacy = tryDecrypt(stored, getLegacyEncKey())
  if (legacy !== null) return legacy
  throw new Error('Failed to decrypt RCON password — key may have changed without re-encryption')
}

export const decryptSecret = decryptPassword

// ── Database setup ────────────────────────────────────────────────────────────

const DATA_DIR    = process.env.DATA_DIR || '/app/data'
const LEGACY_JSON = path.join(DATA_DIR, 'users.json')

let _initialized = false

function initDb(): Database.Database {
  const db = getDb()
  if (_initialized) return db
  _initialized = true

  // Migrate from users.json if it exists and DB is empty
  migrateFromJson(db)

  // Re-encrypt any server passwords still using the legacy SHA-256 key
  reEncryptLegacyPasswords(db)

  migrateServersToSavedServers(db)

  // Seed admin if table is still empty
  seedAdmin(db)

  return db
}

// ── Re-encryption migration ───────────────────────────────────────────────────
// On first boot after MCRAFTR_ENC_KEY is introduced, server rows encrypted with
// the old SHA-256-derived key are silently unreadable. This migration detects
// those rows (new HKDF key fails, legacy key succeeds), decrypts with the old
// key, and re-encrypts with the new key.

function reEncryptLegacyPasswords(db: Database.Database): void {
  const rows = db.prepare('SELECT user_id, password_enc FROM servers').all() as { user_id: string; password_enc: string }[]
  if (rows.length === 0) return

  const newKey    = getEncKey()
  const legacyKey = getLegacyEncKey()
  const update    = db.prepare('UPDATE servers SET password_enc = ? WHERE user_id = ?')

  let migrated = 0
  for (const row of rows) {
    if (!row.password_enc.includes(':')) continue  // plaintext — handled elsewhere
    if (tryDecrypt(row.password_enc, newKey) !== null) continue  // already on new key

    const plain = tryDecrypt(row.password_enc, legacyKey)
    if (plain === null) {
      console.error(`[mcraftr] Could not decrypt password for user_id=${row.user_id} with any known key — skipping`)
      continue
    }
    update.run(encryptPassword(plain), row.user_id)
    migrated++
  }

  if (migrated > 0) {
    console.log(`[mcraftr] Re-encrypted ${migrated} server password(s) to new key`)
  }
}

function migrateServersToSavedServers(db: Database.Database): void {
  const legacyRows = db.prepare('SELECT user_id, host, port, password_enc FROM servers').all() as ServerRow[]
  if (legacyRows.length === 0) return

  const countSavedServers = db.prepare('SELECT COUNT(*) as n FROM saved_servers').get() as { n: number }
  if (countSavedServers.n > 0) {
    db.prepare(`
      UPDATE chat_log
      SET server_id = (
        SELECT active_server_id FROM users WHERE users.id = chat_log.user_id
      )
      WHERE server_id IS NULL
    `).run()
    db.prepare(`
      UPDATE audit_log
      SET server_id = (
        SELECT active_server_id FROM users WHERE users.id = audit_log.user_id
      )
      WHERE server_id IS NULL
    `).run()
    return
  }

  const insertSaved = db.prepare(`
    INSERT INTO saved_servers (id, user_id, label, host, port, password_enc, created_at, updated_at)
    VALUES (?, ?, NULL, ?, ?, ?, unixepoch(), unixepoch())
  `)
  const updateActive = db.prepare('UPDATE users SET active_server_id = ? WHERE id = ?')
  const tx = db.transaction(() => {
    for (const row of legacyRows) {
      const serverId = crypto.randomUUID()
      insertSaved.run(serverId, row.user_id, row.host, row.port, row.password_enc)
      updateActive.run(serverId, row.user_id)
    }

    db.prepare(`
      UPDATE chat_log
      SET server_id = (
        SELECT active_server_id FROM users WHERE users.id = chat_log.user_id
      )
      WHERE server_id IS NULL
    `).run()
    db.prepare(`
      UPDATE audit_log
      SET server_id = (
        SELECT active_server_id FROM users WHERE users.id = audit_log.user_id
      )
      WHERE server_id IS NULL
    `).run()
  })

  tx()
}

// ── Migration from users.json ─────────────────────────────────────────────────

function migrateFromJson(db: Database.Database): void {
  if (!fs.existsSync(LEGACY_JSON)) return

  const count = (db.prepare('SELECT COUNT(*) as n FROM users').get() as { n: number }).n
  if (count > 0) return  // DB already populated — skip

  let legacy: User[]
  try {
    legacy = JSON.parse(fs.readFileSync(LEGACY_JSON, 'utf8')) as User[]
  } catch {
    return
  }

  const insertUser = db.prepare(`
    INSERT OR IGNORE INTO users (id, email, password_hash, role)
    VALUES (@id, @email, @passwordHash, @role)
  `)
  const insertServer = db.prepare(`
    INSERT OR IGNORE INTO servers (user_id, host, port, password_enc)
    VALUES (@userId, @host, @port, @passwordEnc)
  `)

  const migrate = db.transaction((users: User[]) => {
    for (const u of users) {
      insertUser.run({
        id:           u.id,
        email:        u.email,
        passwordHash: u.passwordHash,
        role:         u.role,
      })
      if (u.server) {
        insertServer.run({
          userId:      u.id,
          host:        u.server.host,
          port:        u.server.port,
          // Encrypt the plaintext password from the JSON
          passwordEnc: encryptPassword(u.server.password),
        })
      }
    }
  })

  migrate(legacy)

  // Rename the old file so we don't re-migrate
  fs.renameSync(LEGACY_JSON, LEGACY_JSON + '.migrated')
  console.log('[mcraftr] Migrated users.json → mcraftr.db')
}

// ── Seeding ───────────────────────────────────────────────────────────────────

function seedAdmin(db: Database.Database): void {
  const adminEmail = process.env.MCRAFTR_ADMIN_USER || ''
  const adminPass  = process.env.MCRAFTR_ADMIN_PASS  || ''
  if (!adminEmail || !adminPass) return

  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(adminEmail)
  if (existing) return

  db.prepare(`
    INSERT INTO users (id, email, password_hash, role)
    VALUES (?, ?, ?, 'admin')
  `).run(crypto.randomUUID(), adminEmail, bcrypt.hashSync(adminPass, 10))

  console.log('[mcraftr] Seeded admin user:', adminEmail)
}

// ── Internal row types ────────────────────────────────────────────────────────

type UserRow = {
  id: string
  email: string
  password_hash: string
  role: 'admin' | 'user'
  is_temporary?: number | null
  temporary_last_used_at?: number | null
  avatar_type?: string | null
  avatar_value?: string | null
  active_server_id?: string | null
}

type ServerRow = {
  user_id: string
  host: string
  port: number
  password_enc: string
}

type SavedServerRow = {
  id: string
  user_id: string
  label: string | null
  host: string
  port: number
  password_enc: string
  bridge_enabled?: number | null
  bridge_command_prefix?: string | null
  bridge_provider_id?: string | null
  bridge_provider_label?: string | null
  bridge_protocol_version?: string | null
  minecraft_version_override?: string | null
  minecraft_version_resolved?: string | null
  minecraft_version_source?: string | null
  minecraft_version_detected_at?: number | null
  bridge_last_seen?: number | null
  bridge_last_error?: string | null
  bridge_capabilities_json?: string | null
  sidecar_enabled?: number
  sidecar_url?: string | null
  sidecar_token_enc?: string | null
  sidecar_last_seen?: number | null
  sidecar_capabilities_json?: string | null
  sidecar_structure_roots_json?: string | null
  sidecar_entity_roots_json?: string | null
  created_at: number
  updated_at: number
}

function parseSidecarCapabilities(raw: string | null | undefined): string[] {
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw) as unknown
    return Array.isArray(parsed) ? parsed.filter((entry): entry is string => typeof entry === 'string') : []
  } catch {
    return []
  }
}

function parseStringArray(raw: string | null | undefined): string[] {
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []
    return Array.from(new Set(parsed
      .filter((entry): entry is string => typeof entry === 'string')
      .map(entry => entry.trim())
      .filter(Boolean)))
  } catch {
    return []
  }
}

function normalizeBridgeCommandPrefix(value: string | null | undefined): string {
  const trimmed = value?.trim().replace(/^\/+/, '') || ''
  return trimmed || 'mcraftr'
}

function rowToSavedServer(row: SavedServerRow): SavedServer {
  return {
    id: row.id,
    userId: row.user_id,
    label: row.label,
    host: row.host,
    port: row.port,
    password: decryptPassword(row.password_enc),
    stackMode: getServerStackMode({ bridgeEnabled: !!row.bridge_enabled, sidecarEnabled: !!row.sidecar_enabled }),
    minecraftVersion: resolveMinecraftVersion({
      override: row.minecraft_version_override,
      resolved: row.minecraft_version_resolved,
      source: row.minecraft_version_source,
      detectedAt: row.minecraft_version_detected_at,
    }),
    bridge: {
      enabled: !!row.bridge_enabled,
      commandPrefix: normalizeBridgeCommandPrefix(row.bridge_command_prefix),
      providerId: row.bridge_provider_id ?? null,
      providerLabel: row.bridge_provider_label ?? null,
      protocolVersion: row.bridge_protocol_version ?? null,
      lastSeen: row.bridge_last_seen ?? null,
      lastError: row.bridge_last_error ?? null,
      capabilities: parseSidecarCapabilities(row.bridge_capabilities_json),
    },
    sidecar: {
      enabled: !!row.sidecar_enabled,
      url: row.sidecar_url ?? null,
      token: row.sidecar_token_enc ? decryptSecret(row.sidecar_token_enc) : null,
      lastSeen: row.sidecar_last_seen ?? null,
      capabilities: parseSidecarCapabilities(row.sidecar_capabilities_json),
      structureRoots: parseStringArray(row.sidecar_structure_roots_json),
      entityPresetRoots: parseStringArray(row.sidecar_entity_roots_json),
    },
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function rowToUser(row: UserRow, savedServerRows: SavedServerRow[]): User {
  const servers = savedServerRows.map(rowToSavedServer)
  const active = row.active_server_id
    ? servers.find(server => server.id === row.active_server_id) ?? null
    : (servers[0] ?? null)
  return {
    id:           row.id,
    email:        row.email,
    passwordHash: row.password_hash,
    role:         row.role,
    isTemporary:  row.is_temporary === 1,
    temporaryLastUsedAt: row.temporary_last_used_at ?? null,
    avatar: {
      type: row.avatar_type === 'builtin' || row.avatar_type === 'upload' ? row.avatar_type : 'none',
      value: row.avatar_type === 'builtin' || row.avatar_type === 'upload' ? row.avatar_value ?? null : null,
    },
    activeServerId: active?.id ?? null,
    servers,
    server: active ? { host: active.host, port: active.port, password: active.password } : null,
    serverLabel: active?.label ?? null,
  }
}

// ── Public API ────────────────────────────────────────────────────────────────

export function getUserByEmail(email: string): User | undefined {
  const db = initDb()
  const row = db.prepare('SELECT * FROM users WHERE email = ?').get(email) as UserRow | undefined
  if (!row) return undefined
  const servers = db.prepare(
    'SELECT * FROM saved_servers WHERE user_id = ? ORDER BY updated_at DESC, created_at DESC'
  ).all(row.id) as SavedServerRow[]
  return rowToUser(row, servers)
}

export function getUserById(id: string): User | undefined {
  const db = initDb()
  const row = db.prepare('SELECT * FROM users WHERE id = ?').get(id) as UserRow | undefined
  if (!row) return undefined
  const servers = db.prepare(
    'SELECT * FROM saved_servers WHERE user_id = ? ORDER BY updated_at DESC, created_at DESC'
  ).all(id) as SavedServerRow[]
  return rowToUser(row, servers)
}

export function listUserServers(id: string): SavedServer[] {
  const db = initDb()
  const rows = db.prepare(
    'SELECT * FROM saved_servers WHERE user_id = ? ORDER BY updated_at DESC, created_at DESC'
  ).all(id) as SavedServerRow[]
  return rows.map(rowToSavedServer)
}

export function getActiveServer(id: string): SavedServer | null {
  const user = getUserById(id)
  if (!user?.activeServerId) return null
  return user.servers.find(server => server.id === user.activeServerId) ?? null
}

export function createUserServer(
  userId: string,
  server: ServerConfig & {
    label?: string | null
    minecraftVersion?: Partial<Pick<MinecraftVersionState, 'override' | 'resolved' | 'source' | 'detectedAt'>>
    bridge?: Partial<Pick<BridgeConfig, 'enabled' | 'commandPrefix' | 'providerId' | 'providerLabel' | 'protocolVersion' | 'lastSeen' | 'lastError' | 'capabilities'>>
    sidecar?: Partial<Pick<SidecarConfig, 'enabled' | 'url' | 'token' | 'lastSeen' | 'capabilities' | 'structureRoots' | 'entityPresetRoots'>>
  },
): SavedServer {
  const db = initDb()
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId) as UserRow | undefined
  if (!user) throw new Error('User not found')

  const serverId = crypto.randomUUID()
  const passwordEnc = encryptPassword(server.password)
  const bridgeEnabled = server.bridge?.enabled ? 1 : 0
  const bridgeCommandPrefix = normalizeBridgeCommandPrefix(server.bridge?.commandPrefix)
  const bridgeProviderId = server.bridge?.providerId?.trim() || null
  const bridgeProviderLabel = server.bridge?.providerLabel?.trim() || null
  const bridgeProtocolVersion = server.bridge?.protocolVersion?.trim() || null
  const storedMinecraftVersion = buildStoredMinecraftVersion(server.minecraftVersion ?? {})
  const bridgeLastSeen = server.bridge?.lastSeen ?? null
  const bridgeLastError = server.bridge?.lastError?.trim() || null
  const bridgeCapabilitiesJson = server.bridge?.capabilities?.length ? JSON.stringify(server.bridge.capabilities) : null
  const sidecarEnabled = server.sidecar?.enabled ? 1 : 0
  const sidecarUrl = server.sidecar?.url?.trim() || null
  const sidecarTokenEnc = server.sidecar?.token?.trim() ? encryptSecret(server.sidecar.token.trim()) : null
  const sidecarLastSeen = server.sidecar?.lastSeen ?? null
  const sidecarCapabilitiesJson = server.sidecar?.capabilities?.length ? JSON.stringify(server.sidecar.capabilities) : null
  const sidecarStructureRootsJson = server.sidecar?.structureRoots?.length ? JSON.stringify(Array.from(new Set(server.sidecar.structureRoots.map(entry => entry.trim()).filter(Boolean)))) : null
  const sidecarEntityRootsJson = server.sidecar?.entityPresetRoots?.length ? JSON.stringify(Array.from(new Set(server.sidecar.entityPresetRoots.map(entry => entry.trim()).filter(Boolean)))) : null
  db.prepare(`
    INSERT INTO saved_servers (
      id, user_id, label, host, port, password_enc,
      bridge_enabled, bridge_command_prefix, bridge_provider_id, bridge_provider_label, bridge_protocol_version, bridge_last_seen, bridge_last_error, bridge_capabilities_json,
      minecraft_version_override, minecraft_version_resolved, minecraft_version_source, minecraft_version_detected_at,
      sidecar_enabled, sidecar_url, sidecar_token_enc, sidecar_last_seen, sidecar_capabilities_json,
      sidecar_structure_roots_json, sidecar_entity_roots_json,
      created_at, updated_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, unixepoch(), unixepoch())
  `).run(
    serverId,
    userId,
    server.label?.trim() || null,
    server.host,
    server.port,
    passwordEnc,
    bridgeEnabled,
    bridgeCommandPrefix,
    bridgeProviderId,
    bridgeProviderLabel,
    bridgeProtocolVersion,
    bridgeLastSeen,
    bridgeLastError,
    bridgeCapabilitiesJson,
    storedMinecraftVersion.override,
    storedMinecraftVersion.resolved,
    storedMinecraftVersion.source,
    storedMinecraftVersion.detectedAt,
    sidecarEnabled,
    sidecarUrl,
    sidecarTokenEnc,
    sidecarLastSeen,
    sidecarCapabilitiesJson,
    sidecarStructureRootsJson,
    sidecarEntityRootsJson,
  )

  if (!user.active_server_id) {
    db.prepare('UPDATE users SET active_server_id = ? WHERE id = ?').run(serverId, userId)
  }

  const row = db.prepare('SELECT * FROM saved_servers WHERE id = ? AND user_id = ?').get(serverId, userId) as SavedServerRow
  return rowToSavedServer(row)
}

export function updateUserServer(
  userId: string,
  server: ServerConfig & {
    label?: string | null
    serverId?: string | null
    minecraftVersion?: Partial<Pick<MinecraftVersionState, 'override'>>
    bridge?: Partial<Pick<BridgeConfig, 'enabled' | 'commandPrefix' | 'providerId' | 'providerLabel' | 'protocolVersion' | 'lastSeen' | 'lastError' | 'capabilities'>>
    sidecar?: Partial<Pick<SidecarConfig, 'enabled' | 'url' | 'token' | 'lastSeen' | 'capabilities' | 'structureRoots' | 'entityPresetRoots'>>
  },
): User {
  const db = initDb()
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId) as UserRow | undefined
  if (!user) throw new Error('User not found')

  const passwordEnc = encryptPassword(server.password)
  if (server.serverId) {
    const existing = db.prepare('SELECT * FROM saved_servers WHERE id = ? AND user_id = ?').get(server.serverId, userId) as SavedServerRow | undefined
    if (!existing) throw new Error('Server not found')
    const nextSidecarTokenEnc = server.sidecar?.token?.trim()
      ? encryptSecret(server.sidecar.token.trim())
      : existing.sidecar_token_enc ?? null
    const nextBridgeCommandPrefix = normalizeBridgeCommandPrefix(server.bridge?.commandPrefix ?? existing.bridge_command_prefix)
    const nextMinecraftVersionOverride = Object.prototype.hasOwnProperty.call(server.minecraftVersion ?? {}, 'override')
      ? normalizeMinecraftVersion(server.minecraftVersion?.override ?? null)
      : (existing.minecraft_version_override ?? null)
    const nextStructureRootsJson = server.sidecar?.structureRoots
      ? JSON.stringify(Array.from(new Set(server.sidecar.structureRoots.map(entry => entry.trim()).filter(Boolean))))
      : existing.sidecar_structure_roots_json ?? null
    const nextEntityRootsJson = server.sidecar?.entityPresetRoots
      ? JSON.stringify(Array.from(new Set(server.sidecar.entityPresetRoots.map(entry => entry.trim()).filter(Boolean))))
      : existing.sidecar_entity_roots_json ?? null
    const result = db.prepare(`
      UPDATE saved_servers
      SET
        label = ?,
        host = ?,
        port = ?,
        password_enc = ?,
        bridge_enabled = ?,
        bridge_command_prefix = ?,
        bridge_provider_id = ?,
        bridge_provider_label = ?,
        bridge_protocol_version = ?,
        minecraft_version_override = ?,
        bridge_last_seen = ?,
        bridge_last_error = ?,
        bridge_capabilities_json = ?,
        sidecar_enabled = ?,
        sidecar_url = ?,
        sidecar_token_enc = ?,
        sidecar_last_seen = ?,
        sidecar_capabilities_json = ?,
        sidecar_structure_roots_json = ?,
        sidecar_entity_roots_json = ?,
        updated_at = unixepoch()
      WHERE id = ? AND user_id = ?
    `).run(
      server.label?.trim() || null,
      server.host,
      server.port,
      passwordEnc,
      server.bridge?.enabled ? 1 : 0,
      nextBridgeCommandPrefix,
      (server.bridge?.providerId?.trim() || existing.bridge_provider_id) ?? null,
      (server.bridge?.providerLabel?.trim() || existing.bridge_provider_label) ?? null,
      (server.bridge?.protocolVersion?.trim() || existing.bridge_protocol_version) ?? null,
      nextMinecraftVersionOverride,
      server.bridge?.lastSeen ?? existing.bridge_last_seen ?? null,
      server.bridge?.lastError?.trim() ?? existing.bridge_last_error ?? null,
      server.bridge?.capabilities?.length ? JSON.stringify(server.bridge.capabilities) : existing.bridge_capabilities_json ?? null,
      server.sidecar?.enabled ? 1 : 0,
      server.sidecar?.url?.trim() || null,
      nextSidecarTokenEnc,
      server.sidecar?.lastSeen ?? existing.sidecar_last_seen ?? null,
      server.sidecar?.capabilities?.length ? JSON.stringify(server.sidecar.capabilities) : existing.sidecar_capabilities_json ?? null,
      nextStructureRootsJson,
      nextEntityRootsJson,
      server.serverId,
      userId,
    )
    if (result.changes === 0) throw new Error('Server not found')
  } else {
    const created = createUserServer(userId, server)
    if (!user.active_server_id) {
      db.prepare('UPDATE users SET active_server_id = ? WHERE id = ?').run(created.id, userId)
    }
  }

  return getUserById(userId)!
}

export function setActiveUserServer(userId: string, serverId: string): User {
  const db = initDb()
  const result = db.prepare(`
    UPDATE users
    SET active_server_id = ?
    WHERE id = ? AND EXISTS (
      SELECT 1 FROM saved_servers WHERE id = ? AND user_id = ?
    )
  `).run(serverId, userId, serverId, userId)
  if (result.changes === 0) throw new Error('Server not found')
  return getUserById(userId)!
}

function deleteServerScopedData(db: Database.Database, userId: string, serverId: string): void {
  db.prepare('DELETE FROM scheduled_task_runs WHERE user_id = ? AND server_id = ?').run(userId, serverId)
  db.prepare('DELETE FROM scheduled_tasks WHERE user_id = ? AND server_id = ?').run(userId, serverId)
  db.prepare('DELETE FROM world_structure_placements WHERE user_id = ? AND server_id = ?').run(userId, serverId)
  db.prepare('DELETE FROM chat_log WHERE user_id = ? AND server_id = ?').run(userId, serverId)
  db.prepare('DELETE FROM player_sessions WHERE user_id = ? AND server_id = ?').run(userId, serverId)
  db.prepare('DELETE FROM player_directory WHERE user_id = ? AND server_id = ?').run(userId, serverId)
  db.prepare('DELETE FROM audit_log WHERE user_id = ? AND server_id = ?').run(userId, serverId)
  db.prepare('DELETE FROM terminal_state WHERE user_id = ? AND server_id = ?').run(userId, serverId)
  db.prepare('DELETE FROM terminal_history WHERE user_id = ? AND server_id = ?').run(userId, serverId)
  db.prepare('DELETE FROM terminal_saved_commands WHERE user_id = ? AND server_id = ?').run(userId, serverId)
}

export function deleteUserServer(id: string, serverId: string): User {
  const db = initDb()
  const row = db.prepare('SELECT * FROM users WHERE id = ?').get(id) as UserRow | undefined
  if (!row) throw new Error('User not found')
  const result = db.prepare('DELETE FROM saved_servers WHERE id = ? AND user_id = ?').run(serverId, id)
  if (result.changes === 0) throw new Error('Server not found')

  const remaining = db.prepare(
    'SELECT id FROM saved_servers WHERE user_id = ? ORDER BY updated_at DESC, created_at DESC LIMIT 1'
  ).get(id) as { id: string } | undefined
  const nextActive = remaining?.id ?? null
  db.prepare('UPDATE users SET active_server_id = ? WHERE id = ?').run(nextActive, id)

  deleteServerScopedData(db, id, serverId)

  return getUserById(id)!
}

export function clearUserServer(id: string): User {
  const active = getUserById(id)?.activeServerId
  if (!active) return getUserById(id)!
  return deleteUserServer(id, active)
}

export function updateServerSidecarHealth(
  userId: string,
  serverId: string,
  next: { lastSeen?: number | null; capabilities?: string[] | null },
): void {
  const db = initDb()
  db.prepare(`
    UPDATE saved_servers
    SET sidecar_last_seen = ?, sidecar_capabilities_json = ?, updated_at = updated_at
    WHERE id = ? AND user_id = ?
  `).run(
    next.lastSeen ?? null,
    next.capabilities ? JSON.stringify(next.capabilities) : null,
    serverId,
    userId,
  )
}

export function updateServerMinecraftVersion(
  userId: string,
  serverId: string,
  next: {
    override?: string | null
    resolved?: string | null
    source?: MinecraftVersionSource | null
    detectedAt?: number | null
  },
): void {
  const db = initDb()
  const existing = db.prepare(`
    SELECT minecraft_version_override, minecraft_version_resolved, minecraft_version_source, minecraft_version_detected_at
    FROM saved_servers
    WHERE id = ? AND user_id = ?
  `).get(serverId, userId) as {
    minecraft_version_override?: string | null
    minecraft_version_resolved?: string | null
    minecraft_version_source?: string | null
    minecraft_version_detected_at?: number | null
  } | undefined
  if (!existing) return

  const has = (key: string) => Object.prototype.hasOwnProperty.call(next, key)
  const persisted = buildStoredMinecraftVersion({
    override: has('override') ? (next.override ?? null) : (existing.minecraft_version_override ?? null),
    resolved: has('resolved') ? (next.resolved ?? null) : (existing.minecraft_version_resolved ?? null),
    source: has('source') ? (next.source ?? null) : (existing.minecraft_version_source ?? null),
    detectedAt: has('detectedAt') ? (next.detectedAt ?? null) : (existing.minecraft_version_detected_at ?? null),
  })

  db.prepare(`
    UPDATE saved_servers
    SET
      minecraft_version_override = ?,
      minecraft_version_resolved = ?,
      minecraft_version_source = ?,
      minecraft_version_detected_at = ?,
      updated_at = updated_at
    WHERE id = ? AND user_id = ?
  `).run(
    persisted.override,
    persisted.resolved,
    persisted.source,
    persisted.detectedAt,
    serverId,
    userId,
  )
}

export function updateServerBridgeHealth(
  userId: string,
  serverId: string,
    next: {
    lastSeen?: number | null
    lastError?: string | null
    capabilities?: string[] | null
    providerId?: string | null
    providerLabel?: string | null
    protocolVersion?: string | null
  },
): void {
  const db = initDb()
  const existing = db.prepare(`
    SELECT bridge_last_seen, bridge_last_error, bridge_capabilities_json, bridge_provider_id, bridge_provider_label, bridge_protocol_version
    FROM saved_servers
    WHERE id = ? AND user_id = ?
  `).get(serverId, userId) as {
    bridge_last_seen?: number | null
    bridge_last_error?: string | null
    bridge_capabilities_json?: string | null
    bridge_provider_id?: string | null
    bridge_provider_label?: string | null
    bridge_protocol_version?: string | null
  } | undefined
  if (!existing) return

  const has = (key: string) => Object.prototype.hasOwnProperty.call(next, key)
  db.prepare(`
    UPDATE saved_servers
    SET
      bridge_last_seen = ?,
      bridge_last_error = ?,
      bridge_capabilities_json = ?,
      bridge_provider_id = ?,
      bridge_provider_label = ?,
      bridge_protocol_version = ?,
      updated_at = updated_at
    WHERE id = ? AND user_id = ?
  `).run(
    has('lastSeen') ? (next.lastSeen ?? null) : (existing.bridge_last_seen ?? null),
    has('lastError') ? (next.lastError ?? null) : (existing.bridge_last_error ?? null),
    has('capabilities')
      ? (next.capabilities ? JSON.stringify(next.capabilities) : null)
      : (existing.bridge_capabilities_json ?? null),
    has('providerId') ? (next.providerId ?? null) : (existing.bridge_provider_id ?? null),
    has('providerLabel') ? (next.providerLabel ?? null) : (existing.bridge_provider_label ?? null),
    has('protocolVersion') ? (next.protocolVersion ?? null) : (existing.bridge_protocol_version ?? null),
    serverId,
    userId,
  )
}

export function createUser(email: string, password: string): User {
  return createUserWithOptions(email, password)
}

export function createUserWithOptions(
  email: string,
  password: string,
  options?: {
    temporary?: boolean
    temporaryLastUsedAt?: number | null
  },
): User {
  const db = initDb()
  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email)
  if (existing) throw new Error('An account with that email already exists')

  const id = crypto.randomUUID()
  const isTemporary = options?.temporary === true ? 1 : 0
  const temporaryLastUsedAt = options?.temporary === true
    ? (options?.temporaryLastUsedAt ?? Math.floor(Date.now() / 1000))
    : null
  db.prepare(`
    INSERT INTO users (id, email, password_hash, role, is_temporary, temporary_last_used_at)
    VALUES (?, ?, ?, 'user', ?, ?)
  `).run(id, email, bcrypt.hashSync(password, 10), isTemporary, temporaryLastUsedAt)

  return {
    id,
    email,
    passwordHash: '',  // not needed after creation
    role: 'user',
    isTemporary: isTemporary === 1,
    temporaryLastUsedAt,
    avatar: { type: 'none', value: null },
    activeServerId: null,
    servers: [],
    server: null,
    serverLabel: null,
  }
}

export function touchTemporaryUser(id: string, timestamp = Math.floor(Date.now() / 1000)): void {
  const db = initDb()
  db.prepare(`
    UPDATE users
    SET temporary_last_used_at = ?
    WHERE id = ? AND is_temporary = 1
  `).run(timestamp, id)
}

export function validatePassword(user: User, password: string): boolean {
  return bcrypt.compareSync(password, user.passwordHash)
}

export function updatePassword(id: string, newPassword: string): void {
  const db = initDb()
  const hash = bcrypt.hashSync(newPassword, 10)
  const result = db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hash, id)
  if (result.changes === 0) throw new Error('User not found')
}

export function updateEmail(id: string, newEmail: string): void {
  const db = initDb()
  const existing = db.prepare('SELECT id FROM users WHERE email = ? AND id != ?').get(newEmail, id)
  if (existing) throw new Error('That email is already in use')
  const result = db.prepare('UPDATE users SET email = ? WHERE id = ?').run(newEmail, id)
  if (result.changes === 0) throw new Error('User not found')
}

export function deleteUser(id: string): void {
  const db = initDb()
  const existing = db.prepare('SELECT id FROM users WHERE id = ?').get(id) as { id: string } | undefined
  if (!existing) throw new Error('User not found')

  const serverRows = db.prepare('SELECT id FROM saved_servers WHERE user_id = ?').all(id) as { id: string }[]
  const tx = db.transaction(() => {
    for (const server of serverRows) {
      deleteServerScopedData(db, id, server.id)
    }
    db.prepare('DELETE FROM scheduled_task_runs WHERE user_id = ?').run(id)
    db.prepare('DELETE FROM chat_log WHERE user_id = ?').run(id)
    db.prepare('DELETE FROM player_sessions WHERE user_id = ?').run(id)
    db.prepare('DELETE FROM player_directory WHERE user_id = ?').run(id)
    db.prepare('DELETE FROM audit_log WHERE user_id = ?').run(id)
    db.prepare('DELETE FROM users WHERE id = ?').run(id)
  })
  tx()
}

export function cloneActiveServerToUser(sourceUserId: string, targetUserId: string): SavedServer {
  const source = getActiveServer(sourceUserId)
  if (!source) throw new Error('Source user has no active server configured')

  return createUserServer(targetUserId, {
    label: source.label,
    host: source.host,
    port: source.port,
    password: source.password,
    minecraftVersion: source.minecraftVersion,
    bridge: source.bridge,
    sidecar: source.sidecar,
  })
}

export type UserSummary = {
  id: string
  email: string
  role: 'admin' | 'user'
  created_at: number
}

export function listUsers(): UserSummary[] {
  const db = initDb()
  return db.prepare('SELECT id, email, role, created_at FROM users ORDER BY created_at ASC').all() as UserSummary[]
}

export function purgeTemporaryUsersOlderThan(cutoffUnix: number): number {
  const db = initDb()
  const rows = db.prepare(`
    SELECT id
    FROM users
    WHERE is_temporary = 1
      AND COALESCE(temporary_last_used_at, created_at) < ?
  `).all(cutoffUnix) as { id: string }[]

  for (const row of rows) {
    deleteUser(row.id)
  }

  return rows.length
}

export function setUserRole(id: string, role: 'admin' | 'user'): void {
  const db = initDb()
  if (role === 'user') {
    const adminCount = (db.prepare("SELECT COUNT(*) as n FROM users WHERE role = 'admin'").get() as { n: number }).n
    const target = db.prepare('SELECT role FROM users WHERE id = ?').get(id) as { role: string } | undefined
    if (!target) throw new Error('User not found')
    if (target.role === 'admin' && adminCount <= 1) throw new Error('Cannot demote the last admin')
  }
  const result = db.prepare('UPDATE users SET role = ? WHERE id = ?').run(role, id)
  if (result.changes === 0) throw new Error('User not found')
}

export function createUserByAdmin(email: string, password: string): User {
  const db = initDb()
  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email)
  if (existing) throw new Error('An account with that email already exists')

  const id = crypto.randomUUID()
  db.prepare(`
    INSERT INTO users (id, email, password_hash, role)
    VALUES (?, ?, ?, 'user')
  `).run(id, email, bcrypt.hashSync(password, 10))

  return {
    id,
    email,
    passwordHash: '',
    role: 'user',
    isTemporary: false,
    temporaryLastUsedAt: null,
    avatar: { type: 'none', value: null },
    activeServerId: null,
    servers: [],
    server: null,
    serverLabel: null,
  }
}

export function updateUserAvatar(id: string, avatar: UserAvatar): void {
  const db = initDb()
  const type = avatar.type === 'builtin' || avatar.type === 'upload' ? avatar.type : null
  const value = type ? avatar.value ?? null : null
  const result = db.prepare('UPDATE users SET avatar_type = ?, avatar_value = ? WHERE id = ?').run(type, value, id)
  if (result.changes === 0) throw new Error('User not found')
}

export type UserFeatures = Record<FeatureKey, boolean>

const LEGACY_KEYS: FeatureKey[] = [
  'enable_chat',
  'enable_chat_read',
  'enable_chat_write',
  'enable_teleport',
  'enable_inventory',
  'enable_rcon',
  'enable_admin',
]

export function getUserFeatures(id: string): UserFeatures {
  const db = initDb()
  const features: UserFeatures = { ...DEFAULT_FEATURES }

  const legacy = db.prepare('SELECT * FROM user_features WHERE user_id = ?').get(id) as Record<string, number> | undefined
  if (legacy) {
    for (const k of LEGACY_KEYS) {
      if (legacy[k] !== undefined) features[k] = !!legacy[k]
    }
  }

  const rows = db.prepare('SELECT feature_key, enabled FROM user_feature_flags WHERE user_id = ?').all(id) as { feature_key: string; enabled: number }[]
  for (const row of rows) {
    if (FEATURE_KEYS.includes(row.feature_key as FeatureKey)) {
      features[row.feature_key as FeatureKey] = !!row.enabled
    }
  }

  return features
}

export function updateUserFeatures(id: string, updates: Partial<UserFeatures>): void {
  const db = initDb()
  const keys = Object.keys(updates).filter((k): k is FeatureKey => FEATURE_KEYS.includes(k as FeatureKey))
  if (keys.length === 0) return

  const upsert = db.prepare(`
    INSERT INTO user_feature_flags (user_id, feature_key, enabled, updated_at)
    VALUES (?, ?, ?, unixepoch())
    ON CONFLICT(user_id, feature_key) DO UPDATE SET
      enabled = excluded.enabled,
      updated_at = unixepoch()
  `)

  const upsertLegacy = db.prepare(`
    INSERT INTO user_features (user_id, updated_at)
    VALUES (?, unixepoch())
    ON CONFLICT(user_id) DO UPDATE SET
      updated_at = unixepoch()
  `)

  const tx = db.transaction(() => {
    for (const key of keys) {
      upsert.run(id, key, updates[key] ? 1 : 0)
    }

    const legacyUpdates = keys.filter(k => LEGACY_KEYS.includes(k))
    if (legacyUpdates.length > 0) {
      upsertLegacy.run(id)
      for (const key of legacyUpdates) {
        db.prepare(`UPDATE user_features SET ${key} = ?, updated_at = unixepoch() WHERE user_id = ?`).run(updates[key] ? 1 : 0, id)
      }
    }
  })

  tx()
}
