import { NextRequest } from 'next/server'
import { checkFeatureAccess, getUserFeatureFlags } from '@/lib/rcon'
import { requireServerCapability } from '@/lib/server-capability'
import { callSidecarForRequest, runBridgeJson } from '@/lib/server-bridge'
import { FALLBACK_ENTITY_CATALOG } from '@/lib/entity-catalog'
import { getSessionUserId } from '@/lib/rcon'
import { getActiveServer } from '@/lib/users'
import { resolveEntityArtDescriptor } from '@/lib/catalog-art/resolvers/entity'
import { buildCatalogArtPayload, getReviewedCatalogArtDescriptor } from '@/lib/catalog-art/service'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type SidecarResponse = {
  ok: boolean
  entities?: unknown[]
  presets?: unknown[]
  catalog?: unknown[]
  entries?: unknown[]
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
  entities?: unknown[]
  catalog?: unknown[]
  entries?: unknown[]
  error?: string
}

type NativeEntityEntry = {
  id: string
  entityId: string
  iconId?: string | null
  label: string
  category: string
  dangerous: boolean
  summary: string | null
  imageUrl: string | null
  artUrl?: string | null
  sourceKind: string
  editable: boolean
  defaultCount: number
  relativePath: string | null
}

type CatalogEntityEntry = NativeEntityEntry & {
  presetId?: string
  customName?: string | null
  health?: number | null
  persistenceRequired?: boolean
  noAi?: boolean
  silent?: boolean
  glowing?: boolean
  invulnerable?: boolean
  noGravity?: boolean
  advancedNbt?: string | null
}

function titleCase(value: string) {
  return value
    .split(/[_\-/\s]+/)
    .filter(Boolean)
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

function pickEntityArray(payload: {
  entities?: unknown[]
  presets?: unknown[]
  catalog?: unknown[]
  entries?: unknown[]
} | null | undefined): unknown[] {
  if (!payload) return []
  if (Array.isArray(payload.entities)) return payload.entities
  if (Array.isArray(payload.catalog)) return payload.catalog
  if (Array.isArray(payload.entries)) return payload.entries
  if (Array.isArray(payload.presets)) return payload.presets
  return []
}

function normalizeEntityEntry(raw: unknown, fallbackSourceKind: string): CatalogEntityEntry | null {
  if (!raw || typeof raw !== 'object') return null
  const row = raw as Record<string, unknown>
  const rawId = typeof row.id === 'string' && row.id.trim() ? row.id.trim() : ''
  const entityId = typeof row.entityId === 'string' && row.entityId.trim()
    ? row.entityId.trim()
    : rawId.startsWith('preset:')
      ? ''
      : rawId

  if (!rawId && !entityId) return null

  const effectiveEntityId = entityId || rawId
  const label = typeof row.label === 'string' && row.label.trim() ? row.label.trim() : titleCase(effectiveEntityId || rawId)
  const category = typeof row.category === 'string' && row.category.trim() ? row.category.trim().toLowerCase() : 'misc'
  const sourceKind = typeof row.sourceKind === 'string' && row.sourceKind.trim() ? row.sourceKind.trim() : fallbackSourceKind
  const defaultCount = Number.isFinite(Number(row.defaultCount)) ? Math.max(1, Math.min(64, Math.floor(Number(row.defaultCount)))) : 1
  const normalizedId = rawId || (row.presetId ? `preset:${String(row.presetId).trim()}` : effectiveEntityId)

  return {
    id: normalizedId,
    presetId: typeof row.presetId === 'string' && row.presetId.trim() ? row.presetId.trim() : undefined,
    entityId: effectiveEntityId,
    label,
    category,
    dangerous: row.dangerous === true,
    summary: typeof row.summary === 'string' && row.summary.trim() ? row.summary.trim() : null,
    imageUrl: typeof row.imageUrl === 'string' && row.imageUrl.trim() ? row.imageUrl.trim() : null,
    artUrl: typeof row.artUrl === 'string' && row.artUrl.trim() ? row.artUrl.trim() : null,
    iconId: typeof row.iconId === 'string' && row.iconId.trim() ? row.iconId.trim() : null,
    sourceKind,
    editable: row.editable === true,
    defaultCount,
    relativePath: typeof row.relativePath === 'string' && row.relativePath.trim() ? row.relativePath.trim() : null,
    customName: typeof row.customName === 'string' ? row.customName.trim() || null : null,
    health: Number.isFinite(Number(row.health)) ? Number(row.health) : null,
    persistenceRequired: row.persistenceRequired === true,
    noAi: row.noAi === true,
    silent: row.silent === true,
    glowing: row.glowing === true,
    invulnerable: row.invulnerable === true,
    noGravity: row.noGravity === true,
    advancedNbt: typeof row.advancedNbt === 'string' && row.advancedNbt.trim() ? row.advancedNbt.trim() : null,
  }
}

function mergeNativeEntities(base: CatalogEntityEntry[], incoming: CatalogEntityEntry[]): CatalogEntityEntry[] {
  const merged = new Map(base.map(entry => [entry.entityId.toLowerCase(), entry]))
  for (const entry of incoming) {
    const key = entry.entityId.toLowerCase()
    const existing = merged.get(key)
    merged.set(
      key,
      existing
        ? {
            ...existing,
            ...entry,
            entityId: existing.entityId || entry.entityId,
            sourceKind: 'native',
            editable: false,
            relativePath: null,
          }
        : {
            ...entry,
            sourceKind: 'native',
            editable: false,
            relativePath: null,
          },
    )
  }
  return Array.from(merged.values())
}

function dedupeCustomEntities(entries: CatalogEntityEntry[]): CatalogEntityEntry[] {
  const merged = new Map<string, CatalogEntityEntry>()
  for (const entry of entries) {
    const presetKey = entry.presetId?.toLowerCase()
    const key = presetKey ? `${entry.sourceKind}:${presetKey}` : `${entry.sourceKind}:${entry.id.toLowerCase()}`
    merged.set(key, entry)
  }
  return Array.from(merged.values())
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

  const capability = await requireServerCapability(req, 'full')
  if (!capability.ok) return capability.response

  const userId = await getSessionUserId(req)
  const activeServer = userId ? getActiveServer(userId) : null
  const minecraftVersion = activeServer?.minecraftVersion.resolved ?? null

  const warnings: string[] = []
  const bridge = await runBridgeJson<BridgeResponse>(req, 'entities list')
  const sidecar = await callSidecarForRequest<SidecarResponse>(req, '/entities')

  let nativeEntities: CatalogEntityEntry[] = nativeFallbackEntities()
  let nativeSource: 'bridge' | 'fallback' = 'fallback'

  if (!bridge.ok) {
    const message = bridge.code === 'bridge_json_parse_failed'
      ? 'Native entity catalog fallback in use: Relay catalog response was truncated, so Mcraftr is using the built-in entity catalog.'
      : `Native entity catalog fallback in use: ${bridge.error}`
    warnings.push(message)
  } else if (bridge.data.ok === false) {
    warnings.push(`Native entity catalog fallback in use: ${bridge.data.error || 'Relay integration returned an error'}`)
  } else {
    const bridgeEntities = pickEntityArray(bridge.data)
      .map(entry => normalizeEntityEntry(entry, 'native'))
      .filter((entry): entry is CatalogEntityEntry => !!entry)
    if (bridgeEntities.length === 0) {
      warnings.push('Native entity catalog fallback in use: Relay integration returned no entities.')
    } else {
      nativeEntities = mergeNativeEntities(nativeEntities, bridgeEntities)
      nativeSource = 'bridge'
    }
  }

  const customEntities = sidecar.ok && sidecar.data.ok !== false
    ? dedupeCustomEntities(
        pickEntityArray(sidecar.data)
          .map(entry => normalizeEntityEntry(entry, 'custom'))
          .filter((entry): entry is CatalogEntityEntry => !!entry),
      )
    : []

  if (!sidecar.ok) {
    warnings.push(`Custom entity presets unavailable: ${sidecar.error}`)
  } else if (sidecar.data.ok === false) {
      warnings.push(`Custom entity presets unavailable: ${sidecar.data.error || 'Beacon returned an error'}`)
  } else if (Array.isArray(sidecar.data.scan?.warnings) && sidecar.data.scan.warnings.length > 0) {
    warnings.push(sidecar.data.scan.warnings[0])
  }

  const dedupedWarnings = Array.from(new Set(warnings.filter(Boolean)))

  return Response.json({
    ok: true,
    entities: (await Promise.all([...nativeEntities, ...customEntities]
      .map(async entry => {
        const candidateUrl = entry.artUrl ?? entry.imageUrl ?? (minecraftVersion && entry.entityId
          ? `/api/minecraft/art/entity/${encodeURIComponent(minecraftVersion)}/${encodeURIComponent(entry.entityId)}`
          : null)
        const descriptor = minecraftVersion && entry.entityId
          ? await getReviewedCatalogArtDescriptor(await resolveEntityArtDescriptor({
              version: minecraftVersion,
              entityId: entry.entityId,
              label: entry.label,
            }))
          : null
        const art = descriptor ? buildCatalogArtPayload(descriptor, candidateUrl) : null
        return {
          ...entry,
          artUrl: art?.url ?? candidateUrl,
          imageUrl: art?.url ?? candidateUrl,
          art,
        }
      })))
      .sort((a, b) => a.label.localeCompare(b.label)),
    fallback: nativeSource !== 'bridge',
    scan: sidecar.ok && sidecar.data.ok !== false ? sidecar.data.scan ?? null : null,
    warning: dedupedWarnings.length > 0 ? dedupedWarnings.join(' ') : null,
  })
}
