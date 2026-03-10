import { NextRequest } from 'next/server'
import { checkFeatureAccess, getSessionActiveServerId, getSessionUserId, getUserFeatureFlags } from '@/lib/rcon'
import { logAudit } from '@/lib/audit'
import { runBridgeJson } from '@/lib/server-bridge'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type BridgeMutationResponse = { ok: boolean; world?: string; player?: string; error?: string }

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const features = await getUserFeatureFlags(req)
  if (!checkFeatureAccess(features, 'enable_world_build_tools')) {
    return Response.json({ ok: false, error: 'Feature disabled by admin' }, { status: 403 })
  }

  const { id } = await params
  const { player } = await req.json()
  if (!player || typeof player !== 'string') {
    return Response.json({ ok: false, error: 'Player is required' }, { status: 400 })
  }

  const bridge = await runBridgeJson<BridgeMutationResponse>(req, `worlds teleport ${player.trim()} ${id}`)
  if (!bridge.ok || bridge.data.ok === false) {
    return Response.json({ ok: false, error: bridge.ok ? bridge.data.error || 'Failed to teleport player' : bridge.error }, { status: 502 })
  }
  const userId = await getSessionUserId(req)
  const serverId = await getSessionActiveServerId(req)
  if (userId) logAudit(userId, 'world_tp', player.trim(), `world=${id}`, serverId)
  return Response.json({ ok: true, player: bridge.data.player ?? player.trim(), world: bridge.data.world ?? id })
}
