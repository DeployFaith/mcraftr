import { isRenderableDescriptor } from '@/lib/catalog-art/classifier'
import { resolveItemArtDescriptor } from '@/lib/catalog-art/resolvers/item'
import { buildCatalogArtPayload, getReviewedCatalogArtDescriptor } from '@/lib/catalog-art/service'
import type { CatalogArtDescriptor, CatalogArtPayload } from '@/lib/catalog-art/types'

export type ItemCatalogArtEntry = {
  itemId: string
  imageUrl: string | null
  art: CatalogArtPayload | null
}

type ItemCatalogArtDeps = {
  resolveDescriptor: (input: { version: string; itemId: string; label: string }) => Promise<CatalogArtDescriptor>
  reviewDescriptor: (descriptor: CatalogArtDescriptor) => Promise<CatalogArtDescriptor>
}

const DEFAULT_DEPS: ItemCatalogArtDeps = {
  resolveDescriptor: resolveItemArtDescriptor,
  reviewDescriptor: getReviewedCatalogArtDescriptor,
}

export async function resolveItemCatalogArtEntry(input: {
  version: string
  itemId: string
  label: string
}, deps: ItemCatalogArtDeps = DEFAULT_DEPS): Promise<ItemCatalogArtEntry> {
  try {
    const descriptor = await deps.resolveDescriptor(input)
    const reviewed = await deps.reviewDescriptor(descriptor)
    const imageUrl = isRenderableDescriptor(reviewed)
      ? `/api/minecraft/art/item/${encodeURIComponent(input.version)}/${encodeURIComponent(input.itemId)}`
      : null

    return {
      itemId: input.itemId,
      imageUrl,
      art: buildCatalogArtPayload(reviewed, imageUrl),
    }
  } catch {
    return {
      itemId: input.itemId,
      imageUrl: null,
      art: null,
    }
  }
}
