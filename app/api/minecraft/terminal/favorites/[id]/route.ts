import type { NextRequest } from 'next/server'
import { requireTerminalAccess } from '@/lib/terminal-access'
import { deleteTerminalFavorite } from '@/lib/terminal'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const access = await requireTerminalAccess(req)
  if (!access.ok) return access.response
  if (access.context.readOnly) {
    return Response.json({ ok: false, error: 'Public demo terminal access is read-only.' }, { status: 403 })
  }

  const { id } = await params
  const deleted = deleteTerminalFavorite(access.context.userId, access.context.serverId, id)
  if (!deleted) {
    return Response.json({ ok: false, error: 'Favorite not found' }, { status: 404 })
  }
  return Response.json({ ok: true })
}
