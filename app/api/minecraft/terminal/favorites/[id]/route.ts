import type { NextRequest } from 'next/server'
import { requireTerminalAccess } from '@/lib/terminal-access'
import { deleteTerminalFavorite } from '@/lib/terminal'
import { checkFeatureAccess, getUserFeatureFlags } from '@/lib/rcon'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const access = await requireTerminalAccess(req)
  if (!access.ok) return access.response

  const features = await getUserFeatureFlags(req)
  if (!checkFeatureAccess(features, 'enable_rcon') || !checkFeatureAccess(features, 'enable_terminal_favorites')) {
    return Response.json({ ok: false, error: 'Feature disabled by admin' }, { status: 403 })
  }

  const { id } = await params
  const deleted = deleteTerminalFavorite(access.context.userId, access.context.serverId, id)
  if (!deleted) {
    return Response.json({ ok: false, error: 'Favorite not found' }, { status: 404 })
  }
  return Response.json({ ok: true })
}
