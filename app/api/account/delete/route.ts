import { NextRequest } from 'next/server'
import { auth } from '@/auth'
import { signOut } from '@/auth.node'
import { getUserById, validatePassword, deleteUser } from '@/lib/users'
import { checkRateLimit } from '@/lib/ratelimit'
import { isProtectedAccountEmail } from '@/lib/protected-accounts'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function DELETE(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return Response.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
  }

  const rl = await checkRateLimit(req, 'account', session.user.id)
  if (rl.limited) return rl.response

  try {
    const { currentPassword } = await req.json()

    if (!currentPassword) {
      return Response.json({ ok: false, error: 'Password is required to delete your account' }, { status: 400 })
    }

    const user = getUserById(session.user.id)
    if (!user) {
      return Response.json({ ok: false, error: 'User not found' }, { status: 404 })
    }
    if (user.isTemporary) {
      return Response.json({ ok: false, error: 'Temporary demo accounts are cleaned up automatically and cannot be deleted here' }, { status: 403 })
    }
    if (isProtectedAccountEmail(user.email)) {
      return Response.json({ ok: false, error: 'Profile changes are disabled for this account' }, { status: 403 })
    }
    if (!validatePassword(user, currentPassword)) {
      return Response.json({ ok: false, error: 'Password is incorrect' }, { status: 403 })
    }

    deleteUser(session.user.id)

    // Sign out — this clears the session cookie
    await signOut({ redirect: false })

    return Response.json({ ok: true })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Failed to delete account'
    return Response.json({ ok: false, error: msg }, { status: 500 })
  }
}
