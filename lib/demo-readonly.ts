import type { NextRequest } from 'next/server'
import { getToken } from 'next-auth/jwt'
import { isDemoRestrictedUser } from '@/lib/demo-policy'
import { getUserById } from '@/lib/users'

export type DemoReadonlyAccess = {
  userId: string
  serverId: string | null
  isAdmin: boolean
  demoReadOnly: boolean
}

export async function getDemoReadonlyAccess(req: NextRequest): Promise<DemoReadonlyAccess | null> {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET, cookieName: 'authjs.session-token' })
  const userId = token?.id as string | undefined
  if (!userId) return null
  const user = getUserById(userId)
  if (!user) return null

  return {
    userId,
    serverId: typeof token?.activeServerId === 'string' ? token.activeServerId : null,
    isAdmin: user.role === 'admin',
    demoReadOnly: isDemoRestrictedUser(user),
  }
}

export function requireAdminReadable(access: DemoReadonlyAccess | null) {
  if (!access) {
    return { ok: false as const, response: Response.json({ ok: false, error: 'Unauthorized' }, { status: 401 }) }
  }
  if (!access.isAdmin && !access.demoReadOnly) {
    return { ok: false as const, response: Response.json({ ok: false, error: 'Admin only' }, { status: 403 }) }
  }
  return { ok: true as const, access }
}

export function rejectDemoReadonlyWrite(access: DemoReadonlyAccess) {
  if (!access.demoReadOnly) return null
  return Response.json({ ok: false, error: 'Public demo access is read-only here. Self-host Mcraftr to use these controls.' }, { status: 403 })
}
