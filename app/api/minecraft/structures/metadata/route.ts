import { NextRequest } from 'next/server'
import { checkFeatureAccess, getUserFeatureFlags } from '@/lib/rcon'
import { callSidecarForRequest } from '@/lib/server-bridge'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type MetadataResponse = {
  ok: boolean
  resourceKey?: string
  dimensions?: { width: number | null; height: number | null; length: number | null } | null
}

export async function GET(req: NextRequest) {
  const features = await getUserFeatureFlags(req)
  if (!checkFeatureAccess(features, 'enable_structure_catalog')) {
    return Response.json({ ok: false, error: 'Feature disabled by admin' }, { status: 403 })
  }

  const resourceKey = req.nextUrl.searchParams.get('resourceKey')?.trim()
  if (!resourceKey) {
    return Response.json({ ok: false, error: 'resourceKey is required' }, { status: 400 })
  }

  const sidecar = await callSidecarForRequest<MetadataResponse>(req, `/structures/metadata?resourceKey=${encodeURIComponent(resourceKey)}`)
  if (!sidecar.ok) {
    return Response.json({ ok: false, error: sidecar.error }, { status: sidecar.status ?? 502 })
  }

  return Response.json({ ok: true, resourceKey, dimensions: sidecar.data.dimensions ?? null })
}
