import crypto from 'crypto'
import bcrypt from 'bcryptjs'
import { NextRequest } from 'next/server'
import { createUser } from '@/lib/users'
import { getDb } from '@/lib/db'
import { checkRateLimit } from '@/lib/ratelimit'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const rl = await checkRateLimit(req, 'register')
  if (rl.limited) return rl.response

  try {
    const { email, password } = await req.json()

    if (
      !email || typeof email !== 'string' ||
      email.length > 254 ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
    ) {
      return Response.json({ ok: false, error: 'A valid email address is required' }, { status: 400 })
    }
    if (!password || typeof password !== 'string' || password.length < 8) {
      return Response.json({ ok: false, error: 'Password must be at least 8 characters' }, { status: 400 })
    }
    if (password.length > 128) {
      return Response.json({ ok: false, error: 'Password must be 128 characters or fewer' }, { status: 400 })
    }

    const normalized = email.toLowerCase().trim()
    const db = getDb()
    const userCount = (db.prepare('SELECT COUNT(*) as n FROM users').get() as { n: number }).n

    if (userCount === 0) {
      // First account ever — automatically admin, no env var required
      db.prepare(`INSERT INTO users (id, email, password_hash, role) VALUES (?, ?, ?, 'admin')`)
        .run(crypto.randomUUID(), normalized, bcrypt.hashSync(password, 10))
      return Response.json({ ok: true, firstUser: true })
    }

    if (process.env.ALLOW_REGISTRATION !== 'true') {
      return Response.json({ ok: false, error: 'Registration is not enabled' }, { status: 403 })
    }

    createUser(normalized, password)
    return Response.json({ ok: true })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Registration failed'
    return Response.json({ ok: false, error: msg }, { status: 400 })
  }
}
