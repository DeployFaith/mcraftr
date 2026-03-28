import type { CatalogArtArtifact, CatalogArtDescriptor } from '@/lib/catalog-art/types'
import { getStructureMaterialsBoardSvg, type StructurePreviewDescriptor } from '@/lib/minecraft-assets/structure-art'

export async function renderStructureMaterialBoard(descriptor: CatalogArtDescriptor): Promise<Omit<CatalogArtArtifact, 'path' | 'generatedAt'> & { content: string }> {
  const label = typeof descriptor.meta?.label === 'string' ? descriptor.meta.label : descriptor.subjectId
  const preview = descriptor.meta?.preview as StructurePreviewDescriptor | undefined
  if (!preview) {
    throw new Error(`Missing structure preview data for ${descriptor.subjectId}`)
  }

  return {
    format: 'svg',
    mimeType: 'image/svg+xml; charset=utf-8',
    width: 320,
    height: 220,
    placeholder: false,
    content: await getStructureMaterialsBoardSvg(descriptor.version || 'unknown', label, preview),
  }
}
