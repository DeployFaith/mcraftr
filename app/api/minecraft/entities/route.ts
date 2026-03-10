import { NextRequest } from 'next/server'
import { checkFeatureAccess, getUserFeatureFlags } from '@/lib/rcon'
import { callSidecarForRequest, runBridgeJson } from '@/lib/server-bridge'
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

type BridgeResponse = {
  ok: boolean
  entities?: Array<{
    id: string
    label: string
    category: string
    dangerous: boolean
    summary?: string | null
    imageUrl?: string | null
  }>
  error?: string
}

type NativeEntityEntry = {
  id: string
  entityId: string
  label: string
  category: string
  dangerous: boolean
  summary: string | null
  imageUrl: string | null
  sourceKind: string
  editable: boolean
  defaultCount: number
  relativePath: null
}

function nativeFallbackEntities(): NativeEntityEntry[] {
  return FALLBACK_ENTITY_CATALOG.map(entry => ({
    ...entry,
    summary: entry.summary ?? null,
    imageUrl: entry.imageUrl ?? null,
    entityId: entry.id,
    sourceKind: 'native',
    editable: false,
    defaultCount: 1,
    relativePath: null,
  }))
}

export async function GET(req: NextRequest) {
  const features = await getUserFeatureFlags(req)
  if (!checkFeatureAccess(features, 'enable_entity_catalog')) {
    return Response.json({ ok: false, error: 'Feature disabled by admin' }, { status: 403 })
  }

  const warnings: string[] = []
  const bridge = await runBridgeJson<BridgeResponse>(req, 'entities list')
  const sidecar = await callSidecarForRequest<SidecarResponse>(req, '/entities')

  let nativeEntities: NativeEntityEntry[] = nativeFallbackEntities()
  let nativeSource: 'bridge' | 'fallback' = 'fallback'

  if (!bridge.ok) {
    warnings.push(`Native entity catalog fallback in use: ${bridge.error}`)
  } else if (bridge.data.ok === false) {
    warnings.push(`Native entity catalog fallback in use: ${bridge.data.error || 'Bridge integration returned an error'}`)
  } else {
    const bridgeEntities = (bridge.data.entities ?? []).filter(entry => typeof entry.id === 'string' && entry.id.trim())
    if (bridgeEntities.length === 0) {
      warnings.push('Native entity catalog fallback in use: Bridge integration returned no entities.')
    } else {
      nativeEntities = bridgeEntities.map(entry => ({
        id: entry.id,
        entityId: entry.id,
        label: entry.label,
        category: entry.category,
        dangerous: entry.dangerous,
        summary: entry.summary ?? null,
        imageUrl: entry.imageUrl ?? null,
        sourceKind: 'native',
        editable: false,
        defaultCount: 1,
        relativePath: null,
      }))
      nativeSource = 'bridge'
    }
  }

  const customEntities = sidecar.ok && sidecar.data.ok !== false
    ? (sidecar.data.entities ?? []).filter(entry => typeof entry.id === 'string')
    : []

  if (!sidecar.ok) {
    warnings.push(`Custom entity presets unavailable: ${sidecar.error}`)
  } else if (sidecar.data.ok === false) {
    warnings.push(`Custom entity presets unavailable: ${sidecar.data.error || 'Sidecar returned an error'}`)
  } else if (Array.isArray(sidecar.data.scan?.warnings) && sidecar.data.scan.warnings.length > 0) {
    warnings.push(sidecar.data.scan.warnings[0])
  }

  return Response.json({
    ok: true,
    entities: [...nativeEntities, ...customEntities],
    fallback: nativeSource !== 'bridge',
    scan: sidecar.ok && sidecar.data.ok !== false ? sidecar.data.scan ?? null : null,
    warning: warnings.length > 0 ? warnings.join(' ') : null,
  })
}
