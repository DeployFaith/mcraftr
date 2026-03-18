import crypto from 'crypto'
import { cookies } from 'next/headers'

export type DemoAccountCookie = {
  userId: string
  email: string
  password: string
}

type DemoSelfPlayerCookie = {
  player: string
}

const DEMO_COOKIE = 'mcraftr.demo-account'
const DEMO_SELF_PLAYER_COOKIE = 'mcraftr.demo-self-player'
const ALGO = 'aes-256-gcm'
const MAX_AGE_SECONDS = 60 * 60 * 24 * 14

function getCookieOptions() {
  return {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: MAX_AGE_SECONDS,
  }
}

function getDemoCookieKey(): Buffer {
  const raw = process.env.NEXTAUTH_SECRET
  if (!raw) throw new Error('NEXTAUTH_SECRET is not set')
  return Buffer.from(crypto.hkdfSync('sha256', raw, '', 'mcraftr-demo-access-v1', 32))
}

function encryptPayload(value: object): string {
  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv(ALGO, getDemoCookieKey(), iv)
  const payload = Buffer.from(JSON.stringify(value), 'utf8')
  const encrypted = Buffer.concat([cipher.update(payload), cipher.final()])
  const tag = cipher.getAuthTag()
  return `${iv.toString('hex')}:${tag.toString('hex')}:${encrypted.toString('hex')}`
}

function decryptPayload<T>(value: string): T | null {
  try {
    const [ivHex, tagHex, encryptedHex] = value.split(':')
    if (!ivHex || !tagHex || !encryptedHex) return null
    const decipher = crypto.createDecipheriv(ALGO, getDemoCookieKey(), Buffer.from(ivHex, 'hex'))
    decipher.setAuthTag(Buffer.from(tagHex, 'hex'))
    const decrypted = Buffer.concat([
      decipher.update(Buffer.from(encryptedHex, 'hex')),
      decipher.final(),
    ])
    return JSON.parse(decrypted.toString('utf8')) as T
  } catch {
    return null
  }
}

export function parseDemoSelfPlayerCookieValue(raw: string | null | undefined): string | null {
  const parsed = raw ? decryptPayload<DemoSelfPlayerCookie>(raw) : null
  if (!parsed || typeof parsed.player !== 'string' || !/^\.?[a-zA-Z0-9_]{1,16}$/.test(parsed.player)) {
    return null
  }
  return parsed.player
}

export async function readDemoAccountCookie(): Promise<DemoAccountCookie | null> {
  const cookieStore = await cookies()
  const raw = cookieStore.get(DEMO_COOKIE)?.value
  const parsed = raw ? decryptPayload<DemoAccountCookie>(raw) : null
  if (!parsed || typeof parsed.userId !== 'string' || typeof parsed.email !== 'string' || typeof parsed.password !== 'string') {
    return null
  }
  return parsed
}

export async function writeDemoAccountCookie(value: DemoAccountCookie): Promise<void> {
  const cookieStore = await cookies()
  cookieStore.set(DEMO_COOKIE, encryptPayload(value), getCookieOptions())
}

export async function clearDemoAccountCookie(): Promise<void> {
  const cookieStore = await cookies()
  cookieStore.delete(DEMO_COOKIE)
}

export async function readDemoSelfPlayerCookie(): Promise<string | null> {
  const cookieStore = await cookies()
  const raw = cookieStore.get(DEMO_SELF_PLAYER_COOKIE)?.value
  return parseDemoSelfPlayerCookieValue(raw)
}

export async function writeDemoSelfPlayerCookie(player: string): Promise<void> {
  const cookieStore = await cookies()
  cookieStore.set(DEMO_SELF_PLAYER_COOKIE, encryptPayload({ player }), getCookieOptions())
}

export async function clearDemoSelfPlayerCookie(): Promise<void> {
  const cookieStore = await cookies()
  cookieStore.delete(DEMO_SELF_PLAYER_COOKIE)
}

export function createTemporaryDemoEmail(): string {
  const suffix = crypto.randomBytes(6).toString('hex')
  const domain = (process.env.MCRAFTR_DEMO_ACCOUNT_DOMAIN || 'demo.mcraftr.local').trim().toLowerCase()
  return `guest-${suffix}@${domain.replace(/^@+/, '')}`
}

export function createTemporaryDemoPassword(): string {
  return crypto.randomBytes(18).toString('base64url')
}

export function getDemoTemplateEmail(): string {
  return (process.env.MCRAFTR_DEMO_TEMPLATE_EMAIL || 'demo@mcraftr.local').trim().toLowerCase()
}

export function normalizeDemoReturnTo(raw: string | null | undefined): string {
  const value = typeof raw === 'string' ? raw.trim() : ''
  if (!value.startsWith('/')) return '/minecraft'
  if (value.startsWith('//')) return '/minecraft'
  if (value.startsWith('/api/')) return '/minecraft'
  return value
}
