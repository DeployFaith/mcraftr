import type { NextRequest } from 'next/server'
import { getToken } from 'next-auth/jwt'
import { getUserById } from '@/lib/users'

export type AdminAccess = {
  userId: string
  serverId: string | null
  isAdmin: boolean
}

export async function getAdminAccess(req: NextRequest): Promise<AdminAccess | null> {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET, cookieName: 'authjs.session-token' })
  const userId = token?.id as string | undefined
  if (!userId) return null
  const user = getUserById(userId)
  if (!user) return null

  return {
    userId,
    serverId: typeof token?.activeServerId === 'string' ? token.activeServerId : null,
    isAdmin: user.role === 'admin',
  }
}

export function requireAdminReadable(access: AdminAccess | null) {
  if (!access) {
    return { ok: false as const, response: Response.json({ ok: false, error: 'Unauthorized' }, { status: 401 }) }
  }
  if (!access.isAdmin) {
    return { ok: false as const, response: Response.json({ ok: false, error: 'Admin only' }, { status: 403 }) }
  }
  return { ok: true as const, access }
}
