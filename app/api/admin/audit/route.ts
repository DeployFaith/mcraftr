import { NextRequest } from 'next/server'
import { getAuditLog } from '@/lib/audit'
import { getUserFeatures } from '@/lib/users'
import { getDemoReadonlyAccess, requireAdminReadable } from '@/lib/demo-readonly'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const auth = requireAdminReadable(await getDemoReadonlyAccess(req))
  if (!auth.ok) return auth.response
  const { access } = auth

  const features = getUserFeatures(access.userId)
  if (!access.demoReadOnly && !features.enable_admin_audit) return Response.json({ ok: false, error: 'Feature disabled by admin' }, { status: 403 })

  const limitParam = req.nextUrl.searchParams.get('limit')
  const limit = Math.min(parseInt(limitParam ?? '100'), 500)
  const entries = getAuditLog(limit, access.serverId ?? null)
  return Response.json({ ok: true, entries, readOnly: access.demoReadOnly })
}
