import path from 'node:path'
import { promises as fs } from 'node:fs'
import { getCatalogArtReviewRoot } from '@/lib/catalog-art/cache'
import type { CatalogArtDescriptor, CatalogArtOverride } from '@/lib/catalog-art/types'

type OverrideManifest = {
  overrides?: CatalogArtOverride[]
}

let overrideCache: { key: string; overrides: CatalogArtOverride[] } | null = null

function bundledReviewRoot() {
  return path.join(process.cwd(), 'catalog-art', 'review-manifests')
}

function matchesOverride(descriptor: CatalogArtDescriptor, override: CatalogArtOverride) {
  if (override.key && override.key !== descriptor.key) return false
  if (override.subject && override.subject !== descriptor.subject) return false
  if (override.subjectId && override.subjectId !== descriptor.subjectId) return false
  if (override.version && override.version !== '*' && override.version !== descriptor.version) return false
  return true
}

function specificity(override: CatalogArtOverride) {
  return ['key', 'subject', 'subjectId', 'version'].reduce((score, field) => score + (field in override ? 1 : 0), 0)
}

async function readManifestFile(filePath: string) {
  const raw = await fs.readFile(filePath, 'utf8')
  const parsed = JSON.parse(raw) as CatalogArtOverride[] | OverrideManifest
  if (Array.isArray(parsed)) return parsed
  return Array.isArray(parsed.overrides) ? parsed.overrides : []
}

async function collectManifestFiles(root: string): Promise<string[]> {
  try {
    const entries = await fs.readdir(root, { withFileTypes: true })
    const files = await Promise.all(entries.map(async entry => {
      const fullPath = path.join(root, entry.name)
      if (entry.isDirectory()) return collectManifestFiles(fullPath)
      if (entry.isFile() && entry.name.endsWith('.json')) return [fullPath]
      return []
    }))
    return files.flat()
  } catch {
    return []
  }
}

async function loadOverrides() {
  const roots = [bundledReviewRoot(), getCatalogArtReviewRoot()]
  const fileGroups = await Promise.all(roots.map(collectManifestFiles))
  const files = fileGroups.flat()
  const statParts = await Promise.all(files.map(async filePath => {
    const stat = await fs.stat(filePath)
    return `${filePath}:${stat.mtimeMs}`
  }))
  const cacheKey = statParts.sort().join('|')
  if (overrideCache && overrideCache.key === cacheKey) return overrideCache.overrides

  const overrideLists = await Promise.all(files.map(async (filePath, index) => ({
    index,
    overrides: await readManifestFile(filePath),
  })))
  const overrides = overrideLists
    .flatMap(entry => entry.overrides.map(override => ({ override, index: entry.index })))
    .sort((left, right) => {
      const specificityDiff = specificity(right.override) - specificity(left.override)
      if (specificityDiff !== 0) return specificityDiff
      return right.index - left.index
    })
    .map(entry => entry.override)
  overrideCache = { key: cacheKey, overrides }
  return overrides
}

export async function loadCatalogArtOverrides() {
  return loadOverrides()
}

export async function applyCatalogArtReview(descriptor: CatalogArtDescriptor): Promise<CatalogArtDescriptor> {
  const overrides = await loadOverrides()
  const matched = overrides.find(override => matchesOverride(descriptor, override))
  if (!matched) return descriptor

  return {
    ...descriptor,
    assetClass: matched.forceClass ?? descriptor.assetClass,
    strategy: matched.forceStrategy ?? descriptor.strategy,
    reviewState: matched.reviewState ?? descriptor.reviewState,
    fallbackReason: matched.fallbackReason !== undefined ? matched.fallbackReason : descriptor.fallbackReason,
    meta: {
      ...descriptor.meta,
      ...(matched.sourceAsset ? { sourceAsset: matched.sourceAsset } : {}),
      ...(matched.cropBox ? { cropBox: matched.cropBox } : {}),
      ...(matched.notes ? { reviewNotes: matched.notes } : {}),
    },
  }
}
