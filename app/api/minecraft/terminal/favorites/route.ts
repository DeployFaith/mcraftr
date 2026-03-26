import type { NextRequest } from 'next/server'
import { requireTerminalAccess, requireTerminalReadAccess } from '@/lib/terminal-access'
import { listTerminalFavorites, saveTerminalFavorite } from '@/lib/terminal'
import { checkFeatureAccess, getUserFeatureFlags } from '@/lib/rcon'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const access = await requireTerminalReadAccess(req)
  if (!access.ok) return access.response

  const features = await getUserFeatureFlags(req)
  if (!checkFeatureAccess(features, 'enable_rcon') || !checkFeatureAccess(features, 'enable_terminal_favorites')) {
    return Response.json({ ok: false, error: 'Feature disabled by admin' }, { status: 403 })
  }

  return Response.json({
    ok: true,
    favorites: listTerminalFavorites(access.context.userId, access.context.serverId),
  })
}

export async function POST(req: NextRequest) {
  const access = await requireTerminalAccess(req)
  if (!access.ok) return access.response

  const features = await getUserFeatureFlags(req)
  if (!checkFeatureAccess(features, 'enable_rcon') || !checkFeatureAccess(features, 'enable_terminal_favorites')) {
    return Response.json({ ok: false, error: 'Feature disabled by admin' }, { status: 403 })
  }

  const body = await req.json().catch(() => ({}))
  const command = typeof body.command === 'string' ? body.command : ''
  const label = typeof body.label === 'string' && body.label.trim()
    ? body.label.trim()
    : command.replace(/^\/+/, '').slice(0, 48)

  if (!command.trim()) {
    return Response.json({ ok: false, error: 'Command is required' }, { status: 400 })
  }
  if (!label) {
    return Response.json({ ok: false, error: 'Label is required' }, { status: 400 })
  }

  const favorite = saveTerminalFavorite({
    userId: access.context.userId,
    serverId: access.context.serverId,
    id: typeof body.id === 'string' ? body.id : null,
    label,
    command,
    description: typeof body.description === 'string' ? body.description : null,
    groupName: typeof body.groupName === 'string' ? body.groupName : null,
    icon: typeof body.icon === 'string' ? body.icon : null,
  })

  return Response.json({ ok: true, favorite })
}
