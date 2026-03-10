import { NextRequest } from 'next/server'
import { checkFeatureAccess, getUserFeatureFlags } from '@/lib/rcon'
import { callSidecarForRequest } from '@/lib/server-bridge'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type UploadResponse = {
  ok: boolean
  path?: string
}

export async function POST(req: NextRequest) {
  const features = await getUserFeatureFlags(req)
  if (!checkFeatureAccess(features, 'enable_structure_catalog')) {
    return Response.json({ ok: false, error: 'Feature disabled by admin' }, { status: 403 })
  }

  const body = await req.json()
  const sidecar = await callSidecarForRequest<UploadResponse>(req, '/structures/upload', {
    method: 'POST',
    body: JSON.stringify(body),
  })
  if (!sidecar.ok) {
    return Response.json({ ok: false, error: sidecar.error }, { status: sidecar.status ?? 502 })
  }

  return Response.json({ ok: true, path: sidecar.data.path ?? null })
}
