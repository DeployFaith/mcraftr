import { NextRequest } from 'next/server'
import { checkFeatureAccess, getSessionActiveServerId, getSessionUserId, getUserFeatureFlags } from '@/lib/rcon'
import { logAudit } from '@/lib/audit'
import { requireServerCapability } from '@/lib/server-capability'
import { runBridgeJson } from '@/lib/server-bridge'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type BridgeMutationResponse = {
  ok: boolean
  world?: string
  error?: string
}

function normalizeEnvironment(raw: unknown): string {
  const value = typeof raw === 'string' ? raw.trim().toLowerCase() : ''
  return value === 'nether' || value === 'the_end' || value === 'end' ? value : 'normal'
}

export async function POST(req: NextRequest) {
  const features = await getUserFeatureFlags(req)
  if (!checkFeatureAccess(features, 'enable_world_build_tools')) {
    return Response.json({ ok: false, error: 'Feature disabled by admin' }, { status: 403 })
  }
  if (!checkFeatureAccess(features, 'enable_world_management')) {
    return Response.json({ ok: false, error: 'Feature disabled by admin' }, { status: 403 })
  }

  const capability = await requireServerCapability(req, 'full')
  if (!capability.ok) return capability.response

  const { name, environment } = await req.json()
  if (!name || typeof name !== 'string') {
    return Response.json({ ok: false, error: 'World name is required' }, { status: 400 })
  }

  const bridge = await runBridgeJson<BridgeMutationResponse>(req, `worlds create ${name.trim()} ${normalizeEnvironment(environment)}`)
  if (!bridge.ok || bridge.data.ok === false) {
    return Response.json({ ok: false, error: bridge.ok ? bridge.data.error || 'Failed to create world' : bridge.error }, { status: 502 })
  }

  const userId = await getSessionUserId(req)
  const serverId = await getSessionActiveServerId(req)
  if (userId) logAudit(userId, 'world_create', name.trim(), `environment=${normalizeEnvironment(environment)}`, serverId)

  return Response.json({ ok: true, world: bridge.data.world ?? name.trim() })
}
