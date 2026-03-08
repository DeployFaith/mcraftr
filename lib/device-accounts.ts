import crypto from 'crypto'
import { cookies } from 'next/headers'

export type DeviceAccountMeta = {
  userId: string
  email: string
  lastUsedAt: number
}

type DeviceAccountEntry = DeviceAccountMeta & {
  token: string
}

const META_COOKIE = 'mcraftr.saved-accounts'
const SECURE_COOKIE = 'mcraftr.saved-accounts.secure'
const SESSION_COOKIE = 'authjs.session-token'
const MAX_DEVICE_ACCOUNTS = 5
const MAX_AGE_SECONDS = 60 * 60 * 24 * 180
const ALGO = 'aes-256-gcm'

function getCookieOptions(httpOnly: boolean) {
  return {
    httpOnly,
    sameSite: 'lax' as const,
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: MAX_AGE_SECONDS,
  }
}

function getDeviceAccountKey(): Buffer {
  const raw = process.env.NEXTAUTH_SECRET
  if (!raw) throw new Error('NEXTAUTH_SECRET is not set')
  return Buffer.from(crypto.hkdfSync('sha256', raw, '', 'mcraftr-device-accounts-v1', 32))
}

function encryptStore(entries: DeviceAccountEntry[]): string {
  const key = getDeviceAccountKey()
  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv(ALGO, key, iv)
  const payload = Buffer.from(JSON.stringify(entries), 'utf8')
  const encrypted = Buffer.concat([cipher.update(payload), cipher.final()])
  const tag = cipher.getAuthTag()
  return `${iv.toString('hex')}:${tag.toString('hex')}:${encrypted.toString('hex')}`
}

function decryptStore(value: string): DeviceAccountEntry[] {
  try {
    const [ivHex, tagHex, encryptedHex] = value.split(':')
    if (!ivHex || !tagHex || !encryptedHex) return []
    const key = getDeviceAccountKey()
    const decipher = crypto.createDecipheriv(ALGO, key, Buffer.from(ivHex, 'hex'))
    decipher.setAuthTag(Buffer.from(tagHex, 'hex'))
    const decrypted = Buffer.concat([
      decipher.update(Buffer.from(encryptedHex, 'hex')),
      decipher.final(),
    ])
    const parsed = JSON.parse(decrypted.toString('utf8')) as DeviceAccountEntry[]
    if (!Array.isArray(parsed)) return []
    return parsed.filter(entry =>
      !!entry
      && typeof entry.userId === 'string'
      && typeof entry.email === 'string'
      && typeof entry.token === 'string'
      && typeof entry.lastUsedAt === 'number'
    )
  } catch {
    return []
  }
}

async function readEntries(): Promise<DeviceAccountEntry[]> {
  const cookieStore = await cookies()
  const raw = cookieStore.get(SECURE_COOKIE)?.value
  return raw ? decryptStore(raw) : []
}

async function writeEntries(entries: DeviceAccountEntry[]): Promise<void> {
  const cookieStore = await cookies()
  const next = entries
    .sort((a, b) => b.lastUsedAt - a.lastUsedAt)
    .slice(0, MAX_DEVICE_ACCOUNTS)

  if (next.length === 0) {
    cookieStore.delete(META_COOKIE)
    cookieStore.delete(SECURE_COOKIE)
    return
  }

  cookieStore.set(SECURE_COOKIE, encryptStore(next), getCookieOptions(true))
  cookieStore.set(
    META_COOKIE,
    JSON.stringify(next.map(({ userId, email, lastUsedAt }) => ({ userId, email, lastUsedAt }))),
    getCookieOptions(false),
  )
}

export async function listDeviceAccounts(): Promise<DeviceAccountMeta[]> {
  const entries = await readEntries()
  return entries.map(({ userId, email, lastUsedAt }) => ({ userId, email, lastUsedAt }))
}

export async function syncCurrentDeviceAccount(userId: string, email: string): Promise<DeviceAccountMeta[]> {
  const cookieStore = await cookies()
  const token = cookieStore.get(SESSION_COOKIE)?.value
  if (!token) throw new Error('No active session token found')

  const now = Date.now()
  const current: DeviceAccountEntry = { userId, email, token, lastUsedAt: now }
  const existing = (await readEntries()).filter(entry => entry.userId !== userId)
  await writeEntries([current, ...existing])
  return listDeviceAccounts()
}

export async function removeDeviceAccount(userId: string): Promise<DeviceAccountMeta[]> {
  const existing = await readEntries()
  await writeEntries(existing.filter(entry => entry.userId !== userId))
  return listDeviceAccounts()
}

export async function switchDeviceAccount(userId: string): Promise<DeviceAccountMeta[]> {
  const cookieStore = await cookies()
  const entries = await readEntries()
  const target = entries.find(entry => entry.userId === userId)
  if (!target) throw new Error('Saved account not found on this device')

  const now = Date.now()
  const reordered = entries.map(entry => entry.userId === userId ? { ...entry, lastUsedAt: now } : entry)
  await writeEntries(reordered)
  cookieStore.set(SESSION_COOKIE, target.token, getCookieOptions(true))

  return listDeviceAccounts()
}
