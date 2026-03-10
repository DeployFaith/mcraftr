import type { NextRequest } from 'next/server'
import { checkFeatureAccess, getSessionActiveServerId, getSessionUserId, getUserFeatureFlags } from './rcon'
import { getUserById } from './users'

export type TerminalAccessContext = {
  userId: string
  serverId: string
}

export async function requireTerminalAccess(req: NextRequest): Promise<
  | { ok: true; context: TerminalAccessContext }
  | { ok: false; response: Response }
> {
  const userId = await getSessionUserId(req)
  if (!userId) {
    return { ok: false, response: Response.json({ ok: false, error: 'Unauthorized' }, { status: 401 }) }
  }

  const serverId = await getSessionActiveServerId(req)
  if (!serverId) {
    return { ok: false, response: Response.json({ ok: false, error: 'No active server selected' }, { status: 400 }) }
  }

  const features = await getUserFeatureFlags(req)
  if (!checkFeatureAccess(features, 'enable_rcon')) {
    return { ok: false, response: Response.json({ ok: false, error: 'Feature disabled by admin' }, { status: 403 }) }
  }

  const user = getUserById(userId)
  if (!user || user.role !== 'admin') {
    return { ok: false, response: Response.json({ ok: false, error: 'Admin access required' }, { status: 403 }) }
  }

  return {
    ok: true,
    context: { userId, serverId },
  }
}
