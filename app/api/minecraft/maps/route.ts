import { NextRequest } from 'next/server'
import { checkFeatureAccess, getUserFeatureFlags } from '@/lib/rcon'
import { callSidecarForRequest } from '@/lib/server-bridge'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type MapsResponse = {
  ok: boolean
  capabilities?: string[]
  maps?: Array<{
    type: 'bluemap' | 'dynmap'
    world: string | null
    label: string
    url: string
  }>
}

export async function GET(req: NextRequest) {
  const features = await getUserFeatureFlags(req)
  if (!checkFeatureAccess(features, 'enable_world_maps')) {
    return Response.json({ ok: false, error: 'Feature disabled by admin' }, { status: 403 })
  }

  const sidecar = await callSidecarForRequest<MapsResponse>(req, '/maps')
  if (!sidecar.ok) {
    return Response.json({ ok: false, error: sidecar.error }, { status: sidecar.status ?? 502 })
  }

  return Response.json({
    ok: true,
    capabilities: sidecar.data.capabilities ?? [],
    maps: sidecar.data.maps ?? [],
  })
}
