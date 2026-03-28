import { NextRequest } from 'next/server'
import { callSidecarForRequest } from '@/lib/server-bridge'
import type { StructurePreviewDescriptor } from '@/lib/minecraft-assets/structure-art'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type StructurePreviewResponse = {
  ok: boolean
  preview?: StructurePreviewDescriptor | null
}

export async function GET(req: NextRequest) {
  const placementKind = req.nextUrl.searchParams.get('placementKind')?.trim() || ''
  const resourceKey = req.nextUrl.searchParams.get('resourceKey')?.trim() || ''
  const relativePath = req.nextUrl.searchParams.get('relativePath')?.trim() || ''
  const format = req.nextUrl.searchParams.get('format')?.trim() || ''

  if (!placementKind || (!resourceKey && !relativePath)) {
    return Response.json({ ok: false, error: 'placementKind and resourceKey or relativePath are required' }, { status: 400 })
  }

  const endpoint = `/structures/preview?${new URLSearchParams({
    placementKind,
    ...(resourceKey ? { resourceKey } : {}),
    ...(relativePath ? { relativePath } : {}),
    ...(format ? { format } : {}),
  }).toString()}`

  const sidecar = await callSidecarForRequest<StructurePreviewResponse>(req, endpoint)
  if (!sidecar.ok) {
    return Response.json({ ok: false, error: sidecar.error }, { status: sidecar.status ?? 502 })
  }

  return Response.json({ ok: true, preview: sidecar.data.preview ?? null })
}
