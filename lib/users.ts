import fs from 'fs'
import path from 'path'
import crypto from 'crypto'
import bcrypt from 'bcryptjs'
import Database from 'better-sqlite3'
import { getDb } from './db'

// ── Types ────────────────────────────────────────────────────────────────────

export type ServerConfig = {
  host: string
  port: number
  password: string  // decrypted in-memory; always encrypted at rest
}

export type User = {
  id: string
  email: string
  passwordHash: string
  role: 'admin' | 'user'
  server: ServerConfig | null
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
}

type ServerRow = {
  user_id: string
  host: string
  port: number
  password_enc: string
}

function rowToUser(row: UserRow, serverRow: ServerRow | undefined | null): User {
  return {
    id:           row.id,
    email:        row.email,
    passwordHash: row.password_hash,
    role:         row.role,
    server:       serverRow
      ? { host: serverRow.host, port: serverRow.port, password: decryptPassword(serverRow.password_enc) }
      : null,
  }
}

// ── Public API ────────────────────────────────────────────────────────────────

export function getUserByEmail(email: string): User | undefined {
  const db = initDb()
  const row = db.prepare('SELECT * FROM users WHERE email = ?').get(email) as UserRow | undefined
  if (!row) return undefined
  const srv = db.prepare('SELECT * FROM servers WHERE user_id = ?').get(row.id) as ServerRow | undefined
  return rowToUser(row, srv)
}

export function getUserById(id: string): User | undefined {
  const db = initDb()
  const row = db.prepare('SELECT * FROM users WHERE id = ?').get(id) as UserRow | undefined
  if (!row) return undefined
  const srv = db.prepare('SELECT * FROM servers WHERE user_id = ?').get(id) as ServerRow | undefined
  return rowToUser(row, srv)
}

export function updateUserServer(id: string, server: ServerConfig): User {
  const db = initDb()
  const row = db.prepare('SELECT * FROM users WHERE id = ?').get(id) as UserRow | undefined
  if (!row) throw new Error('User not found')

  const passwordEnc = encryptPassword(server.password)

  db.prepare(`
    INSERT INTO servers (user_id, host, port, password_enc)
    VALUES (@userId, @host, @port, @passwordEnc)
    ON CONFLICT(user_id) DO UPDATE SET
      host         = excluded.host,
      port         = excluded.port,
      password_enc = excluded.password_enc
  `).run({
    userId:      id,
    host:        server.host,
    port:        server.port,
    passwordEnc: passwordEnc,
  })

  return rowToUser(row, { user_id: id, host: server.host, port: server.port, password_enc: passwordEnc })
}

export function clearUserServer(id: string): User {
  const db = initDb()
  const row = db.prepare('SELECT * FROM users WHERE id = ?').get(id) as UserRow | undefined
  if (!row) throw new Error('User not found')
  db.prepare('DELETE FROM servers WHERE user_id = ?').run(id)
  return rowToUser(row, null)
}

export function createUser(email: string, password: string): User {
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
    passwordHash: '',  // not needed after creation
    role: 'user',
    server: null,
  }
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
  // servers row cascades via FK ON DELETE CASCADE
  const result = db.prepare('DELETE FROM users WHERE id = ?').run(id)
  if (result.changes === 0) throw new Error('User not found')
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

  return { id, email, passwordHash: '', role: 'user', server: null }
}

export type UserFeatures = {
  enable_chat: boolean
  enable_chat_read: boolean
  enable_chat_write: boolean
  enable_teleport: boolean
  enable_inventory: boolean
  enable_rcon: boolean
  enable_admin: boolean
}

export function getUserFeatures(id: string): UserFeatures {
  const db = initDb()
  const row = db.prepare('SELECT * FROM user_features WHERE user_id = ?').get(id) as {
    enable_chat: number
    enable_chat_read: number
    enable_chat_write: number
    enable_teleport: number
    enable_inventory: number
    enable_rcon: number
    enable_admin: number
  } | undefined
  if (!row) {
    return {
      enable_chat: true,
      enable_chat_read: true,
      enable_chat_write: true,
      enable_teleport: true,
      enable_inventory: true,
      enable_rcon: true,
      enable_admin: true,
    }
  }
  return {
    enable_chat: !!row.enable_chat,
    enable_chat_read: !!row.enable_chat_read,
    enable_chat_write: !!row.enable_chat_write,
    enable_teleport: !!row.enable_teleport,
    enable_inventory: !!row.enable_inventory,
    enable_rcon: !!row.enable_rcon,
    enable_admin: !!row.enable_admin,
  }
}

export function updateUserFeatures(id: string, features: Partial<UserFeatures>): void {
  const db = initDb()
  const current = getUserFeatures(id)
  const next: UserFeatures = {
    enable_chat: features.enable_chat ?? current.enable_chat,
    enable_chat_read: features.enable_chat_read ?? current.enable_chat_read,
    enable_chat_write: features.enable_chat_write ?? current.enable_chat_write,
    enable_teleport: features.enable_teleport ?? current.enable_teleport,
    enable_inventory: features.enable_inventory ?? current.enable_inventory,
    enable_rcon: features.enable_rcon ?? current.enable_rcon,
    enable_admin: features.enable_admin ?? current.enable_admin,
  }

  db.prepare(`
    INSERT INTO user_features (
      user_id,
      enable_chat,
      enable_chat_read,
      enable_chat_write,
      enable_teleport,
      enable_inventory,
      enable_rcon,
      enable_admin,
      updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, unixepoch())
    ON CONFLICT(user_id) DO UPDATE SET
      enable_chat = excluded.enable_chat,
      enable_chat_read = excluded.enable_chat_read,
      enable_chat_write = excluded.enable_chat_write,
      enable_teleport = excluded.enable_teleport,
      enable_inventory = excluded.enable_inventory,
      enable_rcon = excluded.enable_rcon,
      enable_admin = excluded.enable_admin,
      updated_at = unixepoch()
  `).run(
    id,
    next.enable_chat ? 1 : 0,
    next.enable_chat_read ? 1 : 0,
    next.enable_chat_write ? 1 : 0,
    next.enable_teleport ? 1 : 0,
    next.enable_inventory ? 1 : 0,
    next.enable_rcon ? 1 : 0,
    next.enable_admin ? 1 : 0,
  )
}
