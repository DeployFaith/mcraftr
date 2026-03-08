import { NextRequest } from 'next/server'
import { getUserById, setActiveUserServer } from '@/lib/users'
import { getSessionUserId } from '@/lib/rcon'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const userId = await getSessionUserId(req)
  if (!userId) return Response.json({ ok: false, error: 'Not authenticated' }, { status: 401 })
  try {
    const { serverId } = await req.json()
    if (!serverId || typeof serverId !== 'string') {
      return Response.json({ ok: false, error: 'Server id is required' }, { status: 400 })
    }
    const user = setActiveUserServer(userId, serverId)
    return Response.json({
      ok: true,
      activeServerId: user.activeServerId,
      activeServerLabel: user.serverLabel,
      hasServer: user.servers.length > 0,
    })
  } catch (e: unknown) {
    return Response.json({ ok: false, error: e instanceof Error ? e.message : 'Failed to switch server' }, { status: 500 })
  }
}

export async function GET(req: NextRequest) {
  const userId = await getSessionUserId(req)
  if (!userId) return Response.json({ ok: false, error: 'Not authenticated' }, { status: 401 })
  const user = getUserById(userId)
  if (!user) return Response.json({ ok: false, error: 'User not found' }, { status: 404 })
  return Response.json({ ok: true, activeServerId: user.activeServerId, activeServerLabel: user.serverLabel })
}
