import { NextRequest } from 'next/server'
import { checkFeatureAccess, getUserFeatureFlags } from '@/lib/rcon'
import { callSidecarForRequest } from '@/lib/world-stack'
import { normalizeEntityPresetInput } from '@/lib/entity-presets'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type SaveResponse = {
  ok: boolean
  path?: string
  relativePath?: string
}

type DeleteResponse = {
  ok: boolean
  path?: string
}

export async function POST(req: NextRequest) {
  const features = await getUserFeatureFlags(req)
  if (!checkFeatureAccess(features, 'enable_entity_catalog')) {
    return Response.json({ ok: false, error: 'Feature disabled by admin' }, { status: 403 })
  }

  const body = await req.json()
  const preset = normalizeEntityPresetInput(body.preset ?? {})
  const sidecar = await callSidecarForRequest<SaveResponse>(req, '/entities/upload', {
    method: 'POST',
    body: JSON.stringify({
      name: body.name ?? preset.id,
      preset,
    }),
  })
  if (!sidecar.ok) {
    return Response.json({ ok: false, error: sidecar.error }, { status: sidecar.status ?? 502 })
  }

  return Response.json({
    ok: true,
    path: sidecar.data.path ?? null,
    relativePath: sidecar.data.relativePath ?? null,
    preset,
  })
}

export async function DELETE(req: NextRequest) {
  const features = await getUserFeatureFlags(req)
  if (!checkFeatureAccess(features, 'enable_entity_catalog')) {
    return Response.json({ ok: false, error: 'Feature disabled by admin' }, { status: 403 })
  }

  const relativePath = req.nextUrl.searchParams.get('relativePath')?.trim()
  if (!relativePath) {
    return Response.json({ ok: false, error: 'relativePath is required' }, { status: 400 })
  }

  const sidecar = await callSidecarForRequest<DeleteResponse>(req, '/entities/delete', {
    method: 'POST',
    body: JSON.stringify({ relativePath }),
  })
  if (!sidecar.ok) {
    return Response.json({ ok: false, error: sidecar.error }, { status: sidecar.status ?? 502 })
  }

  return Response.json({ ok: true, path: sidecar.data.path ?? null })
}
