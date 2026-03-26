import { NextRequest } from 'next/server'
import { checkFeatureAccess, getSessionActiveServerId, getSessionUserId, getUserFeatureFlags } from '@/lib/rcon'
import { logAudit } from '@/lib/audit'
import { requireServerCapability } from '@/lib/server-capability'
import { callSidecarForRequest, runBridgeJson } from '@/lib/server-bridge'

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
  if (!checkFeatureAccess(features, 'enable_world_management')) {
    return Response.json({ ok: false, error: 'Feature disabled by admin' }, { status: 403 })
  }

  const capability = await requireServerCapability(req, 'full')
  if (!capability.ok) return capability.response

  const { id } = await params
  const { name } = await req.json()
  if (!name || typeof name !== 'string') {
    return Response.json({ ok: false, error: 'Clone target name is required' }, { status: 400 })
  }

  const bridge = await runBridgeJson<BridgeMutationResponse>(req, `worlds clone ${id} ${name.trim()}`)
  const sidecar = await callSidecarForRequest<{ ok: boolean; world?: string; error?: string }>(req, `/worlds/${encodeURIComponent(id)}/clone`, {
    method: 'POST',
    body: JSON.stringify({ name: name.trim() }),
  })

  if (!bridge.ok || bridge.data.ok === false) {
    return Response.json({
      ok: false,
      error: bridge.ok ? bridge.data.error || 'Failed to clone world' : bridge.error,
      sidecar: sidecar.ok ? 'ok' : sidecar.error,
    }, { status: 502 })
  }

  const userId = await getSessionUserId(req)
  const serverId = await getSessionActiveServerId(req)
  if (userId) logAudit(userId, 'world_clone', id, `target=${name.trim()}`, serverId)

  return Response.json({
    ok: true,
    world: bridge.data.world ?? name.trim(),
    sidecar: sidecar.ok ? 'ok' : sidecar.error,
  })
}
