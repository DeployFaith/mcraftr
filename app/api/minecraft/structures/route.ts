import { NextRequest } from 'next/server'
import { checkFeatureAccess, getSessionUserId, getUserFeatureFlags } from '@/lib/rcon'
import { buildStructureArtUrl, inferStructure3DAvailability } from '@/lib/catalog-art/structure-list'
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

  return Response.json({
    ok: true,
    structures: (sidecar.data.structures ?? []).map(structure => {
      const resolvedArtUrl = buildStructureArtUrl(structure, minecraftVersion)
      return {
        ...structure,
        has3d: inferStructure3DAvailability(structure),
        iconId: structure.iconId || structure.resourceKey || structure.bridgeRef || structure.id || structure.label,
        artUrl: resolvedArtUrl,
        imageUrl: resolvedArtUrl,
        art: null,
      }
    }),
    scan: sidecar.data.scan ?? null,
    sidecar: { ok: true, capabilities: sidecar.data.capabilities ?? [] },
  })
}
