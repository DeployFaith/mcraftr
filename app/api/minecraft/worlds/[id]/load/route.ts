import { NextRequest } from 'next/server'
import { checkFeatureAccess, getSessionActiveServerId, getSessionUserId, getUserFeatureFlags } from '@/lib/rcon'
import { logAudit } from '@/lib/audit'
import { requireServerCapability } from '@/lib/server-capability'
import { runBridgeJson } from '@/lib/server-bridge'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type BridgeMutationResponse = { ok: boolean; world?: string; error?: string }

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const features = await getUserFeatureFlags(req)
  if (!checkFeatureAccess(features, 'enable_world_build_tools')) {
    return Response.json({ ok: false, error: 'Feature disabled by admin' }, { status: 403 })
  }

  const capability = await requireServerCapability(req, 'full')
  if (!capability.ok) return capability.response

  const { id } = await params
  const bridge = await runBridgeJson<BridgeMutationResponse>(req, `worlds load ${id}`)
  if (!bridge.ok || bridge.data.ok === false) {
    return Response.json({ ok: false, error: bridge.ok ? bridge.data.error || 'Failed to load world' : bridge.error }, { status: 502 })
  }
  const userId = await getSessionUserId(req)
  const serverId = await getSessionActiveServerId(req)
  if (userId) logAudit(userId, 'world_load', id, undefined, serverId)
  return Response.json({ ok: true, world: bridge.data.world ?? id })
}
