import { NextRequest } from 'next/server'
import { createUser } from '@/lib/users'
import { checkRateLimit } from '@/lib/ratelimit'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  if (process.env.ALLOW_REGISTRATION !== 'true') {
    return Response.json({ ok: false, error: 'Registration is not enabled' }, { status: 403 })
  }

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

    createUser(email.toLowerCase().trim(), password)
    return Response.json({ ok: true })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Registration failed'
    return Response.json({ ok: false, error: msg }, { status: 400 })
  }
}
