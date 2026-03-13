import { readCatalogArtArtifact, readCatalogArtArtifactContent, writeCatalogArtArtifact } from '@/lib/catalog-art/cache'
import { isRenderableDescriptor } from '@/lib/catalog-art/classifier'
import { buildCatalogArtPayload as buildCatalogArtPayloadShape } from '@/lib/catalog-art/payload'
import { applyCatalogArtReview } from '@/lib/catalog-art/review'
import { renderEntityItemDerived } from '@/lib/catalog-art/renderers/entity-item-derived'
import { renderEntitySheetCrop } from '@/lib/catalog-art/renderers/entity-sheet-crop'
import { renderItemLayerStack } from '@/lib/catalog-art/renderers/item-layer-stack'
import { renderStructureGrid } from '@/lib/catalog-art/renderers/structure-grid'
import { renderStructureMaterialBoard } from '@/lib/catalog-art/renderers/structure-material-board'
import type { CatalogArtArtifact, CatalogArtDescriptor, CatalogArtPayload } from '@/lib/catalog-art/types'

export async function getCatalogArtArtifact(descriptor: CatalogArtDescriptor): Promise<CatalogArtArtifact & { content: Buffer }> {
  const reviewed = await applyCatalogArtReview(descriptor)
  try {
    const cached = await readCatalogArtArtifact(reviewed)
    const content = await readCatalogArtArtifactContent(cached)
    return { ...cached, content }
  } catch {
    // cache miss; render below
  }

  if (!isRenderableDescriptor(reviewed)) {
    throw new Error(reviewed.fallbackReason || `Descriptor ${reviewed.key} is not renderable`)
  }

  const generated = await renderDescriptor(reviewed)
  const stored = await writeCatalogArtArtifact(reviewed, generated)
  return {
    ...stored,
    content: Buffer.isBuffer(generated.content) ? generated.content : Buffer.from(generated.content, 'utf8'),
  }
}

export async function getReviewedCatalogArtDescriptor(descriptor: CatalogArtDescriptor) {
  return applyCatalogArtReview(descriptor)
}

async function renderDescriptor(descriptor: CatalogArtDescriptor): Promise<Omit<CatalogArtArtifact, 'path' | 'generatedAt'> & { content: string | Buffer }> {
  switch (descriptor.strategy) {
    case 'item-layer-stack':
      return renderItemLayerStack(descriptor)
    case 'entity-sheet-crop':
      return renderEntitySheetCrop(descriptor)
    case 'entity-item-derived':
      return renderEntityItemDerived(descriptor)
    case 'structure-grid':
      return renderStructureGrid(descriptor)
    case 'structure-material-board':
      return renderStructureMaterialBoard(descriptor)
    default:
      throw new Error(`Unsupported render strategy: ${descriptor.strategy}`)
  }
}

export function buildCatalogArtPayload(descriptor: CatalogArtDescriptor, url: string | null, placeholder = false): CatalogArtPayload {
  return buildCatalogArtPayloadShape({
    url,
    artClass: descriptor.assetClass,
    strategy: descriptor.strategy,
    placeholder,
    reviewState: descriptor.reviewState,
    fallbackReason: descriptor.fallbackReason,
  })
}
