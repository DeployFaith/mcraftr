import { NextRequest } from 'next/server'
import { auth } from '@/auth'
import { getUserById, validatePassword, updateEmail } from '@/lib/users'
import { checkRateLimit } from '@/lib/ratelimit'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function PUT(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return Response.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
  }

  const rl = await checkRateLimit(req, 'account', session.user.id)
  if (rl.limited) return rl.response

  try {
    const { newEmail, currentPassword } = await req.json()

    if (
      !newEmail || typeof newEmail !== 'string' ||
      newEmail.length > 254 ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newEmail)
    ) {
      return Response.json({ ok: false, error: 'A valid email address is required' }, { status: 400 })
    }
    if (!currentPassword) {
      return Response.json({ ok: false, error: 'Current password is required to change email' }, { status: 400 })
    }

    const user = getUserById(session.user.id)
    if (!user) {
      return Response.json({ ok: false, error: 'User not found' }, { status: 404 })
    }
    if (!validatePassword(user, currentPassword)) {
      return Response.json({ ok: false, error: 'Current password is incorrect' }, { status: 403 })
    }

    const normalized = newEmail.toLowerCase().trim()
    if (normalized === user.email) {
      return Response.json({ ok: false, error: 'That is already your email address' }, { status: 400 })
    }

    updateEmail(session.user.id, normalized)
    return Response.json({ ok: true, email: normalized })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Failed to update email'
    return Response.json({ ok: false, error: msg }, { status: 400 })
  }
}
