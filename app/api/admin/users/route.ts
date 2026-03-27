import { NextRequest } from 'next/server'
import { getUserFeatures, listUsers, createUserByAdmin } from '@/lib/users'
import { logAudit } from '@/lib/audit'
import { getAdminAccess, requireAdminReadable } from '@/lib/admin-access'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const auth = requireAdminReadable(await getAdminAccess(req))
  if (!auth.ok) return auth.response
  const { access } = auth

  const features = getUserFeatures(access.userId)
  if (!features.enable_admin_user_management) return Response.json({ ok: false, error: 'Feature disabled by admin' }, { status: 403 })

  const users = listUsers()
  return Response.json({ ok: true, users, readOnly: false })
}

export async function POST(req: NextRequest) {
  const access = await getAdminAccess(req)
  if (!access || !access.isAdmin) return Response.json({ ok: false, error: 'Forbidden' }, { status: 403 })

  const adminId = access.userId
  const features = getUserFeatures(adminId)
  if (!features.enable_admin_user_management) return Response.json({ ok: false, error: 'Feature disabled by admin' }, { status: 403 })

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

    const user = createUserByAdmin(email.toLowerCase().trim(), password)
    logAudit(adminId, 'create_user', user.email)
    return Response.json({ ok: true, user: { id: user.id, email: user.email, role: user.role } })
  } catch (e: unknown) {
    return Response.json({ ok: false, error: e instanceof Error ? e.message : 'Failed' }, { status: 400 })
  }
}
