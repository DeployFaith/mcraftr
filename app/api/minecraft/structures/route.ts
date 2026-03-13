import { NextRequest } from 'next/server'
import { checkFeatureAccess, getUserFeatureFlags } from '@/lib/rcon'
import { callSidecarForRequest } from '@/lib/server-bridge'
import { getSessionUserId } from '@/lib/rcon'
import { getActiveServer } from '@/lib/users'
import { resolveStructureArtDescriptor } from '@/lib/catalog-art/resolvers/structure'
import { buildCatalogArtPayload, getReviewedCatalogArtDescriptor } from '@/lib/catalog-art/service'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type StructureResponse = {
  ok: boolean
  structures?: Array<{
    id: string
    label: string
    category: string
    sourceKind: string
    placementKind: string
    bridgeRef: string
    resourceKey?: string | null
    relativePath?: string | null
    format?: string | null
    sizeBytes?: number | null
    updatedAt?: number | null
    imageUrl?: string | null
    summary?: string | null
    dimensions?: { width: number | null; height: number | null; length: number | null } | null
    removable?: boolean
    editable?: boolean
  }>
  scan?: {
    roots?: Array<{
      path: string
      exists: boolean
      structureCount: number
      rootKind?: string
    }>
    totalStructures?: number
    uploadRoot?: string | null
    nativeCounts?: {
      templates?: number
      worldgen?: number
    }
  }
  capabilities?: string[]
}

export async function GET(req: NextRequest) {
  const features = await getUserFeatureFlags(req)
  if (!checkFeatureAccess(features, 'enable_structure_catalog')) {
    return Response.json({ ok: false, error: 'Feature disabled by admin' }, { status: 403 })
  }

  const userId = await getSessionUserId(req)
  const activeServer = userId ? getActiveServer(userId) : null
  const minecraftVersion = activeServer?.minecraftVersion.resolved ?? null

  const sidecar = await callSidecarForRequest<StructureResponse>(req, '/structures')
  if (!sidecar.ok) {
    return Response.json({ ok: false, error: sidecar.error }, { status: sidecar.status ?? 502 })
  }

  return Response.json({
    ok: true,
    structures: await Promise.all((sidecar.data.structures ?? []).map(async structure => {
      const candidateUrl = structure.imageUrl ?? (minecraftVersion
        ? `/api/minecraft/art/structure?${new URLSearchParams({
            version: minecraftVersion,
            placementKind: structure.placementKind,
            ...(structure.resourceKey ? { resourceKey: structure.resourceKey } : {}),
            ...(structure.relativePath ? { relativePath: structure.relativePath } : {}),
            ...(structure.format ? { format: structure.format } : {}),
            label: structure.label,
          }).toString()}`
        : null)
      const descriptor = minecraftVersion
        ? await getReviewedCatalogArtDescriptor(await resolveStructureArtDescriptor({
            version: minecraftVersion,
            label: structure.label,
            placementKind: structure.placementKind,
            resourceKey: structure.resourceKey ?? null,
            relativePath: structure.relativePath ?? null,
            format: structure.format ?? null,
            preview: null,
          }))
        : null
      const art = descriptor ? buildCatalogArtPayload(descriptor, candidateUrl) : null
      return {
        ...structure,
        imageUrl: art?.url ?? candidateUrl,
        art,
      }
    })),
    scan: sidecar.data.scan ?? null,
    sidecar: { ok: true, capabilities: sidecar.data.capabilities ?? [] },
  })
}
