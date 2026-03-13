import { classifyEntityArt } from '@/lib/catalog-art/classifier'
import type { CatalogArtDescriptor } from '@/lib/catalog-art/types'

export async function resolveEntityArtDescriptor(input: {
  version: string
  entityId: string
  label: string
}): Promise<CatalogArtDescriptor> {
  const classification = classifyEntityArt({ entityId: input.entityId })

  return {
    key: `entity:${input.version}:${input.entityId}:${classification.strategy}`,
    subject: 'entity',
    subjectId: input.entityId,
    version: input.version,
    source: 'vanilla-jar',
    assetClass: classification.assetClass,
    strategy: classification.strategy,
    confidence: classification.confidence,
    fallbackReason: classification.fallbackReason,
    reviewState: 'auto',
    dependencies: [
      { kind: 'jar', id: input.version, hash: null },
      { kind: 'renderer', id: classification.strategy, hash: 'v2' },
    ],
    meta: {
      label: input.label,
    },
  }
}
