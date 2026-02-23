import { NextRequest } from 'next/server'
import { getToken } from 'next-auth/jwt'
import { getUserById } from '@/lib/users'
import { getAuditLog } from '@/lib/audit'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET, cookieName: 'authjs.session-token' })
  const userId = token?.id as string | undefined
  if (!userId) return Response.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
  const user = getUserById(userId)
  if (!user || user.role !== 'admin') return Response.json({ ok: false, error: 'Admin only' }, { status: 403 })

  const limitParam = req.nextUrl.searchParams.get('limit')
  const limit = Math.min(parseInt(limitParam ?? '100'), 500)
  const entries = getAuditLog(limit)
  return Response.json({ ok: true, entries })
}
