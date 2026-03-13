import type { CatalogArtClass, CatalogArtPayload, CatalogRenderStrategy } from './types'

export function buildCatalogArtPayload(input: {
  url: string | null
  artClass: CatalogArtClass
  strategy: CatalogRenderStrategy
  placeholder?: boolean
  reviewState?: CatalogArtPayload['reviewState']
  fallbackReason?: string | null
}): CatalogArtPayload {
  return {
    url: input.url,
    class: input.artClass,
    strategy: input.strategy,
    placeholder: input.placeholder === true,
    reviewState: input.reviewState ?? 'auto',
    fallbackReason: input.fallbackReason ?? null,
  }
}
