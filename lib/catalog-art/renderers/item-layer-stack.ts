import type { CatalogArtArtifact, CatalogArtDescriptor } from '@/lib/catalog-art/types'
import { getItemArtData, renderItemArtSvg } from '@/lib/minecraft-assets/item-art'

export async function renderItemLayerStack(descriptor: CatalogArtDescriptor): Promise<Omit<CatalogArtArtifact, 'path' | 'generatedAt'> & { content: string }> {
  const label = typeof descriptor.meta?.label === 'string' ? descriptor.meta.label : descriptor.subjectId
  const sourceItemId = typeof descriptor.meta?.sourceAsset === 'string' && descriptor.meta.sourceAsset.trim()
    ? descriptor.meta.sourceAsset.trim().replace(/^item:/, '')
    : descriptor.subjectId
  const artData = await getItemArtData(descriptor.version || 'unknown', sourceItemId)
  if (artData.textures.length === 0) {
    throw new Error(`No official item textures resolved for ${sourceItemId}`)
  }

  return {
    format: 'svg',
    mimeType: 'image/svg+xml; charset=utf-8',
    width: 128,
    height: 128,
    placeholder: false,
    content: renderItemArtSvg(descriptor.subjectId, label, artData.textures),
  }
}
