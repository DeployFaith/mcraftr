import { createHash } from 'node:crypto'
import { classifyStructureArt } from '@/lib/catalog-art/classifier'
import type { CatalogArtDescriptor } from '@/lib/catalog-art/types'
import type { StructurePreviewDescriptor } from '@/lib/minecraft-assets/structure-art'

function hashPreview(preview: StructurePreviewDescriptor) {
  return createHash('sha1').update(JSON.stringify(preview)).digest('hex')
}

export async function resolveStructureArtDescriptor(input: {
  version: string
  label: string
  placementKind: string
  resourceKey?: string | null
  relativePath?: string | null
  format?: string | null
  preview?: StructurePreviewDescriptor | null
}): Promise<CatalogArtDescriptor> {
  const classification = classifyStructureArt({
    hasCells: Array.isArray(input.preview?.cells) && input.preview.cells.length > 0,
    placementKind: input.placementKind,
  })
  const sourceId = input.resourceKey || input.relativePath || input.label

  return {
    key: `structure:${input.version}:${input.placementKind}:${sourceId}:${classification.strategy}`,
    subject: 'structure',
    subjectId: `${input.placementKind}:${sourceId}`,
    version: input.version,
    source: 'beacon',
    assetClass: classification.assetClass,
    strategy: classification.strategy,
    confidence: classification.confidence,
    fallbackReason: classification.fallbackReason,
    reviewState: 'auto',
    dependencies: [
      { kind: 'preview', id: sourceId, hash: input.preview ? hashPreview(input.preview) : null },
      { kind: 'renderer', id: classification.strategy, hash: 'v1' },
    ],
    meta: {
      label: input.label,
      preview: input.preview ?? null,
      placementKind: input.placementKind,
      resourceKey: input.resourceKey ?? null,
      relativePath: input.relativePath ?? null,
      format: input.format ?? null,
    },
  }
}
