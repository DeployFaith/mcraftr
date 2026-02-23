import { NextRequest } from 'next/server'
import { getToken } from 'next-auth/jwt'
import { getUserById, setUserRole, deleteUser, updatePassword } from '@/lib/users'
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

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const adminId = await requireAdmin(req)
  if (!adminId) return Response.json({ ok: false, error: 'Forbidden' }, { status: 403 })

  const { id } = await params

  try {
    const body = await req.json()

    if (body.role !== undefined) {
      if (body.role !== 'admin' && body.role !== 'user') {
        return Response.json({ ok: false, error: 'Invalid role' }, { status: 400 })
      }
      if (id === adminId && body.role === 'user') {
        return Response.json({ ok: false, error: 'Cannot demote yourself' }, { status: 400 })
      }
      setUserRole(id, body.role)
      const target = getUserById(id)
      logAudit(adminId, 'set_role', target?.email, body.role)
      return Response.json({ ok: true })
    }

    if (body.password !== undefined) {
      if (typeof body.password !== 'string' || body.password.length < 8) {
        return Response.json({ ok: false, error: 'Password must be at least 8 characters' }, { status: 400 })
      }
      updatePassword(id, body.password)
      return Response.json({ ok: true })
    }

    return Response.json({ ok: false, error: 'Nothing to update' }, { status: 400 })
  } catch (e: unknown) {
    return Response.json({ ok: false, error: e instanceof Error ? e.message : 'Failed' }, { status: 400 })
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const adminId = await requireAdmin(req)
  if (!adminId) return Response.json({ ok: false, error: 'Forbidden' }, { status: 403 })

  const { id } = await params

  if (id === adminId) {
    return Response.json({ ok: false, error: 'Cannot delete your own account from here' }, { status: 400 })
  }

  try {
    const target = getUserById(id)
    deleteUser(id)
    logAudit(adminId, 'delete_user', target?.email)
    return Response.json({ ok: true })
  } catch (e: unknown) {
    return Response.json({ ok: false, error: e instanceof Error ? e.message : 'Failed' }, { status: 400 })
  }
}
