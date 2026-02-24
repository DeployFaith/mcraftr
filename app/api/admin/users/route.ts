import { NextRequest } from 'next/server'
import { getToken } from 'next-auth/jwt'
import { getUserById, getUserFeatures, listUsers, createUserByAdmin } from '@/lib/users'
import { logAudit } from '@/lib/audit'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

async function requireAdmin(req: NextRequest): Promise<string | null> {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET, cookieName: 'authjs.session-token' })
  const userId = token?.id as string | undefined
  if (!userId) return null
  const user = getUserById(userId)
  if (!user || user.role !== 'admin') return null
  return userId
}

export async function GET(req: NextRequest) {
  const adminId = await requireAdmin(req)
  if (!adminId) return Response.json({ ok: false, error: 'Forbidden' }, { status: 403 })

  const features = getUserFeatures(adminId)
  if (!features.enable_admin_user_management) return Response.json({ ok: false, error: 'Feature disabled by admin' }, { status: 403 })

  const users = listUsers()
  return Response.json({ ok: true, users })
}

export async function POST(req: NextRequest) {
  const adminId = await requireAdmin(req)
  if (!adminId) return Response.json({ ok: false, error: 'Forbidden' }, { status: 403 })

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
