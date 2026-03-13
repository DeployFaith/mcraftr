import { classifyItemArt } from '@/lib/catalog-art/classifier'
import type { CatalogArtDescriptor } from '@/lib/catalog-art/types'
import { getItemArtData } from '@/lib/minecraft-assets/item-art'

export async function resolveItemArtDescriptor(input: {
  version: string
  itemId: string
  label: string
}): Promise<CatalogArtDescriptor> {
  const artData = await getItemArtData(input.version, input.itemId)
  const classification = classifyItemArt({
    itemId: input.itemId,
    modelRef: artData.modelRef,
    textureLayerCount: artData.textures.length,
  })

  return {
    key: `item:${input.version}:${input.itemId}:${classification.strategy}`,
    subject: 'item',
    subjectId: input.itemId,
    version: input.version,
    source: 'vanilla-jar',
    assetClass: classification.assetClass,
    strategy: classification.strategy,
    confidence: classification.confidence,
    fallbackReason: classification.fallbackReason,
    reviewState: 'auto',
    dependencies: [
      { kind: 'jar', id: input.version, hash: null },
      { kind: 'renderer', id: classification.strategy, hash: 'v1' },
    ],
    meta: {
      label: input.label,
      modelRef: artData.modelRef,
      textureLayerCount: artData.textures.length,
    },
  }
}
