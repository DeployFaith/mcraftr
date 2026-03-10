import { NextRequest } from 'next/server'
import { checkFeatureAccess, getUserFeatureFlags } from '@/lib/rcon'
import { callSidecarForRequest } from '@/lib/server-bridge'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type SchematicsResponse = {
  ok: boolean
  capabilities?: string[]
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

  const sidecar = await callSidecarForRequest<SchematicsResponse>(req, '/schematics')
  if (!sidecar.ok) {
    return Response.json({ ok: false, error: sidecar.error }, { status: sidecar.status ?? 502 })
  }

  return Response.json({
    ok: true,
    capabilities: sidecar.data.capabilities ?? [],
    schematics: sidecar.data.schematics ?? [],
  })
}
