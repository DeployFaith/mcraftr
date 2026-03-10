import { NextRequest } from 'next/server'
import { checkFeatureAccess, getSessionActiveServerId, getSessionUserId, getUserFeatureFlags } from '@/lib/rcon'
import { logAudit } from '@/lib/audit'
import { runBridgeJson } from '@/lib/server-bridge'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type WorldEditRunResponse = {
  ok: boolean
  action?: string
  player?: string
  error?: string
}

export async function POST(req: NextRequest) {
  const features = await getUserFeatureFlags(req)
  if (!checkFeatureAccess(features, 'enable_world_build_tools')) {
    return Response.json({ ok: false, error: 'Feature disabled by admin' }, { status: 403 })
  }

  const { player, action, source, target, amount, schematic } = await req.json()
  if (!player || typeof player !== 'string') {
    return Response.json({ ok: false, error: 'Player is required' }, { status: 400 })
  }
  if (!action || typeof action !== 'string') {
    return Response.json({ ok: false, error: 'Action is required' }, { status: 400 })
  }

  const parts = ['worldedit', 'run', player.trim(), action.trim()]
  if (typeof source === 'string' && source.trim()) parts.push(source.trim())
  if (typeof target === 'string' && target.trim()) parts.push(target.trim())
  if (typeof amount === 'number' && Number.isFinite(amount)) parts.push(String(Math.max(1, Math.min(amount, 64))))
  if (typeof schematic === 'string' && schematic.trim()) parts.push(schematic.trim())

  const bridge = await runBridgeJson<WorldEditRunResponse>(req, parts.join(' '))
  if (!bridge.ok || bridge.data.ok === false) {
    return Response.json({ ok: false, error: bridge.ok ? bridge.data.error || 'WorldEdit action failed' : bridge.error }, { status: 502 })
  }

  const userId = await getSessionUserId(req)
  const serverId = await getSessionActiveServerId(req)
  if (userId) {
    const detail = [source, target, amount, schematic].filter(Boolean).join(' ')
    logAudit(userId, 'worldedit', player.trim(), `${action.trim()}${detail ? ` ${detail}` : ''}`, serverId)
  }

  return Response.json({ ok: true, result: bridge.data })
}
