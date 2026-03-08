import { NextRequest } from 'next/server'
import { checkFeatureAccess, getUserFeatureFlags } from '@/lib/rcon'
import { callSidecarForRequest } from '@/lib/world-stack'
import { FALLBACK_ENTITY_CATALOG } from '@/lib/entity-catalog'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type SidecarResponse = {
  ok: boolean
  entities?: Array<{
    id: string
    presetId?: string
    entityId?: string
    label: string
    category: string
    dangerous: boolean
    summary?: string | null
    imageUrl?: string | null
    sourceKind?: string
    editable?: boolean
    defaultCount?: number
    relativePath?: string | null
    customName?: string | null
    health?: number | null
    persistenceRequired?: boolean
    noAi?: boolean
    silent?: boolean
    glowing?: boolean
    invulnerable?: boolean
    noGravity?: boolean
    advancedNbt?: string | null
  }>
  scan?: {
    roots?: Array<{
      path: string
      exists: boolean
      presetCount: number
      rootKind?: string
    }>
    totalPresets?: number
    uploadRoot?: string | null
    warnings?: string[]
  }
  error?: string
}

export async function GET(req: NextRequest) {
  const features = await getUserFeatureFlags(req)
  if (!checkFeatureAccess(features, 'enable_entity_catalog')) {
    return Response.json({ ok: false, error: 'Feature disabled by admin' }, { status: 403 })
  }

  const sidecar = await callSidecarForRequest<SidecarResponse>(req, '/entities')
  const nativeEntities = FALLBACK_ENTITY_CATALOG.map(entry => ({
    ...entry,
    entityId: entry.id,
    sourceKind: 'native',
    editable: false,
    defaultCount: 1,
    relativePath: null,
  }))

  if (!sidecar.ok || sidecar.data.ok === false) {
    return Response.json({
      ok: true,
      entities: nativeEntities,
      fallback: true,
      warning: sidecar.ok ? sidecar.data.error || 'Failed to load custom entity presets' : sidecar.error,
      scan: null,
    })
  }

  const customEntities = (sidecar.data.entities ?? []).filter(entry => typeof entry.id === 'string')
  return Response.json({
    ok: true,
    entities: [...nativeEntities, ...customEntities],
    scan: sidecar.data.scan ?? null,
    warning: Array.isArray(sidecar.data.scan?.warnings) && sidecar.data.scan?.warnings.length > 0
      ? sidecar.data.scan.warnings[0]
      : null,
  })
}
