import { NextRequest } from 'next/server'
import { checkFeatureAccess, getUserFeatureFlags } from '@/lib/rcon'
import { requireServerCapability } from '@/lib/server-capability'
import { callSidecarForRequest, runBridgeJson } from '@/lib/server-bridge'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type WorldEditInfoResponse = {
  ok: boolean
  mode: string
  pluginInstalled: boolean
  pluginName: string | null
  player?: string | null
  note?: string | null
}

type SchematicsResponse = {
  ok: boolean
  schematics?: Array<{
    name: string
    path: string
    sizeBytes: number | null
    updatedAt: number | null
  }>
}

export async function GET(req: NextRequest) {
  const features = await getUserFeatureFlags(req)
  if (!checkFeatureAccess(features, 'enable_world_build_tools')) {
    return Response.json({ ok: false, error: 'Feature disabled by admin' }, { status: 403 })
  }

  const capability = await requireServerCapability(req, 'relay')
  if (!capability.ok) return capability.response

  const player = req.nextUrl.searchParams.get('player')
  const bridge = await runBridgeJson<WorldEditInfoResponse>(req, player ? `worldedit info ${player}` : 'worldedit info')
  const sidecar = await callSidecarForRequest<SchematicsResponse>(req, '/schematics')

  if (!bridge.ok) {
    return Response.json({ ok: false, error: bridge.error }, { status: 502 })
  }

  return Response.json({
    ok: true,
    bridge: bridge.data,
    schematics: sidecar.ok ? sidecar.data.schematics ?? [] : [],
    sidecar: sidecar.ok ? { ok: true } : { ok: false, error: sidecar.error },
  })
}
