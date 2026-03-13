import path from 'node:path'
import { promises as fs } from 'node:fs'
import { getCatalogArtRoot, getCatalogArtReviewRoot } from '@/lib/catalog-art/cache'
import { loadCatalogArtOverrides } from '@/lib/catalog-art/review'
import type { CatalogArtArtifact, CatalogArtOverride } from '@/lib/catalog-art/types'
import { FALLBACK_ENTITY_CATALOG } from '@/lib/entity-catalog'

export type CatalogArtAuditEntry = CatalogArtArtifact & {
  subject: string
  strategy: string
  version: string
  subjectId: string
  reviewState: string
  fallbackReason: string | null
}

async function walkJsonFiles(root: string): Promise<string[]> {
  try {
    const entries = await fs.readdir(root, { withFileTypes: true })
    const nested = await Promise.all(entries.map(async entry => {
      const fullPath = path.join(root, entry.name)
      if (entry.isDirectory()) return walkJsonFiles(fullPath)
      if (entry.isFile() && entry.name.endsWith('.json')) return [fullPath]
      return []
    }))
    return nested.flat()
  } catch {
    return []
  }
}

function relativeSegments(filePath: string, root: string) {
  const rel = path.relative(root, filePath)
  return rel.split(path.sep)
}

export async function getCatalogArtAuditEntries() {
  const root = getCatalogArtRoot()
  const reviewRoot = getCatalogArtReviewRoot()
  const files = (await walkJsonFiles(root)).filter(filePath => !filePath.startsWith(reviewRoot))
  const entries: CatalogArtAuditEntry[] = []

  for (const filePath of files) {
    try {
      const raw = await fs.readFile(filePath, 'utf8')
      const parsed = JSON.parse(raw) as CatalogArtArtifact & { reviewState?: string; fallbackReason?: string | null }
      if (!parsed.path || !parsed.mimeType) continue
      const [subject = 'unknown', strategy = 'unknown', version = 'unknown', filename = 'unknown'] = relativeSegments(filePath, root)
      entries.push({
        ...parsed,
        subject,
        strategy,
        version,
        subjectId: filename.replace(/-[0-9a-f]{12}\.json$/i, '').replace(/\.json$/i, ''),
        reviewState: parsed.reviewState ?? 'auto',
        fallbackReason: parsed.fallbackReason ?? null,
      })
    } catch {
      // ignore unreadable manifests during audit scan
    }
  }

  return entries.sort((left, right) => right.generatedAt - left.generatedAt)
}

export async function getCatalogArtAuditSummary() {
  const entries = await getCatalogArtAuditEntries()
  const overrides = await loadCatalogArtOverrides()
  const entityCoverage = await getEntityReviewCoverage()
  return {
    totalArtifacts: entries.length,
    placeholderCount: entries.filter(entry => entry.placeholder).length,
    warnedCount: entries.filter(entry => entry.reviewState === 'warned').length,
    rejectedCount: entries.filter(entry => entry.reviewState === 'rejected').length,
    fallbackCount: entries.filter(entry => !!entry.fallbackReason).length,
    overridesCount: overrides.length,
    entityReviewCoveredCount: entityCoverage.covered.length,
    entityReviewUncoveredCount: entityCoverage.uncovered.length,
  }
}

export async function getCatalogArtOverrides() {
  return loadCatalogArtOverrides()
}

export async function getEntityReviewCoverage() {
  const overrides = await loadCatalogArtOverrides()
  const coveredIds = new Set(
    overrides
      .filter(override => override.subject === 'entity' && typeof override.subjectId === 'string' && override.subjectId.trim().length > 0)
      .map(override => override.subjectId!.trim()),
  )

  const all = FALLBACK_ENTITY_CATALOG.map(entry => ({
    id: entry.id,
    category: entry.category,
    dangerous: entry.dangerous,
  }))

  const covered = all.filter(entry => coveredIds.has(entry.id))
  const uncovered = all.filter(entry => !coveredIds.has(entry.id))

  const byCategory = uncovered.reduce<Record<string, string[]>>((acc, entry) => {
    if (!acc[entry.category]) acc[entry.category] = []
    acc[entry.category].push(entry.id)
    return acc
  }, {})

  return {
    covered,
    uncovered,
    byCategory,
  }
}

export type CatalogArtAuditSummary = Awaited<ReturnType<typeof getCatalogArtAuditSummary>>
export type CatalogArtOverrides = CatalogArtOverride[]
export type CatalogArtEntityCoverage = Awaited<ReturnType<typeof getEntityReviewCoverage>>
