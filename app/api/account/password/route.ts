import { NextRequest } from 'next/server'
import { auth } from '@/auth'
import { getUserById, validatePassword, updatePassword } from '@/lib/users'
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
    const { currentPassword, newPassword } = await req.json()

    if (!currentPassword || !newPassword) {
      return Response.json({ ok: false, error: 'Both current and new password are required' }, { status: 400 })
    }
    if (typeof newPassword !== 'string' || newPassword.length < 8) {
      return Response.json({ ok: false, error: 'New password must be at least 8 characters' }, { status: 400 })
    }
    if (newPassword.length > 128) {
      return Response.json({ ok: false, error: 'Password must be 128 characters or fewer' }, { status: 400 })
    }
    if (currentPassword === newPassword) {
      return Response.json({ ok: false, error: 'New password must be different from current password' }, { status: 400 })
    }

    const user = getUserById(session.user.id)
    if (!user) {
      return Response.json({ ok: false, error: 'User not found' }, { status: 404 })
    }
    if (!validatePassword(user, currentPassword)) {
      return Response.json({ ok: false, error: 'Current password is incorrect' }, { status: 403 })
    }

    updatePassword(session.user.id, newPassword)
    return Response.json({ ok: true })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Failed to update password'
    return Response.json({ ok: false, error: msg }, { status: 500 })
  }
}
