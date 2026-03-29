import { NextRequest } from 'next/server'
import { checkFeatureAccess, getSessionUserId, getUserFeatureFlags } from '@/lib/rcon'
import { buildStructureArtUrl, inferStructure3DAvailability, inferStructurePreviewAvailability } from '@/lib/catalog-art/structure-list'
import { resolveStructureArtDescriptor } from '@/lib/catalog-art/resolvers/structure'
import { buildCatalogArtPayload, getReviewedCatalogArtDescriptor } from '@/lib/catalog-art/service'
import { DEFAULT_MINECRAFT_VERSION } from '@/lib/minecraft-version'
import { requireServerCapability } from '@/lib/server-capability'
import { callSidecarForRequest } from '@/lib/server-bridge'
import { getActiveServer } from '@/lib/users'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type StructureResponse = {
  ok: boolean
  structures?: StructureEntry[]
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
    nativeScan?: {
      cacheDir?: string
      cacheDirExists?: boolean
      latestJar?: string | null
      bundledJarPath?: string | null
      warnings?: string[]
      error?: string | null
    }
  }
  capabilities?: string[]
}

type StructureEntry = {
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
  artUrl?: string | null
  iconId?: string | null
  summary?: string | null
  dimensions?: { width: number | null; height: number | null; length: number | null } | null
  has3d?: boolean
  hasPreview?: boolean
  removable?: boolean
  editable?: boolean
}

export async function GET(req: NextRequest) {
  const features = await getUserFeatureFlags(req)
  if (!checkFeatureAccess(features, 'enable_structure_catalog')) {
    return Response.json({ ok: false, error: 'Feature disabled by admin' }, { status: 403 })
  }

  const capability = await requireServerCapability(req, 'full')
  if (!capability.ok) return capability.response

  const userId = await getSessionUserId(req)
  const activeServer = userId ? getActiveServer(userId) : null
  const minecraftVersion = activeServer?.minecraftVersion.resolved ?? null

  const sidecar = await callSidecarForRequest<StructureResponse>(req, '/structures')
  if (!sidecar.ok) {
    return Response.json({ ok: false, error: sidecar.error }, { status: sidecar.status ?? 502 })
  }

  const structures = await Promise.all((sidecar.data.structures ?? []).map(async structure => {
    const resolvedArtUrl = buildStructureArtUrl(structure, minecraftVersion)
    const descriptor = await resolveStructureArtDescriptor({
      version: minecraftVersion || DEFAULT_MINECRAFT_VERSION,
      label: structure.label,
      placementKind: structure.placementKind,
      resourceKey: structure.resourceKey ?? null,
      relativePath: structure.relativePath ?? null,
      format: structure.format ?? null,
      preview: null,
    })
    const reviewed = await getReviewedCatalogArtDescriptor(descriptor)
    return {
      ...structure,
      hasPreview: inferStructurePreviewAvailability(structure),
      has3d: inferStructure3DAvailability(structure),
      iconId: structure.iconId || structure.resourceKey || structure.bridgeRef || structure.id || structure.label,
      artUrl: resolvedArtUrl,
      imageUrl: resolvedArtUrl,
      art: buildCatalogArtPayload(reviewed, resolvedArtUrl),
    }
  }))

  return Response.json({
    ok: true,
    structures,
    scan: sidecar.data.scan ?? null,
    sidecar: { ok: true, capabilities: sidecar.data.capabilities ?? [] },
  })
}
