import type { NextRequest } from 'next/server'
import { requireTerminalAccess, requireTerminalReadAccess } from '@/lib/terminal-access'
import { listTerminalFavorites, saveTerminalFavorite } from '@/lib/terminal'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const access = await requireTerminalReadAccess(req)
  if (!access.ok) return access.response

  return Response.json({
    ok: true,
    favorites: listTerminalFavorites(access.context.userId, access.context.serverId),
  })
}

export async function POST(req: NextRequest) {
  const access = await requireTerminalAccess(req)
  if (!access.ok) return access.response

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
