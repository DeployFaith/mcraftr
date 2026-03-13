import type { CatalogArtArtifact, CatalogArtDescriptor } from '@/lib/catalog-art/types'
import { getEntityArtSvg } from '@/lib/minecraft-assets/entity-art'

export async function renderEntityItemDerived(descriptor: CatalogArtDescriptor): Promise<Omit<CatalogArtArtifact, 'path' | 'generatedAt'> & { content: string }> {
  const label = typeof descriptor.meta?.label === 'string' ? descriptor.meta.label : descriptor.subjectId
  const version = descriptor.version || 'unknown'
  const sourceAsset = typeof descriptor.meta?.sourceAsset === 'string' ? descriptor.meta.sourceAsset : null
  return {
    format: 'svg',
    mimeType: 'image/svg+xml; charset=utf-8',
    width: 128,
    height: 128,
    placeholder: false,
    content: await getEntityArtSvg(version, descriptor.subjectId, label, sourceAsset),
  }
}
