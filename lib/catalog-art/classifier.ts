import type { CatalogArtClass, CatalogArtDescriptor, CatalogRenderStrategy } from './types'

export type ItemArtClassificationInput = {
  itemId: string
  modelRef: string | null
  textureLayerCount: number
}

export type EntityArtClassificationInput = {
  entityId: string
}

export type StructureArtClassificationInput = {
  hasCells: boolean
  placementKind?: string | null
}

export type ItemArtClassification = {
  assetClass: CatalogArtClass
  strategy: CatalogRenderStrategy
  confidence: number
  fallbackReason: string | null
}

export type EntityArtClassification = ItemArtClassification
export type StructureArtClassification = ItemArtClassification

export function classifyItemArt(input: ItemArtClassificationInput): ItemArtClassification {
  if (input.textureLayerCount >= 2) {
    return {
      assetClass: 'layered-icon',
      strategy: 'item-layer-stack',
      confidence: 0.96,
      fallbackReason: null,
    }
  }

  if (input.textureLayerCount === 1 && input.modelRef?.includes('block/')) {
    return {
      assetClass: 'block-face',
      strategy: 'item-layer-stack',
      confidence: 0.92,
      fallbackReason: null,
    }
  }

  if (input.textureLayerCount === 1) {
    return {
      assetClass: 'flat-icon',
      strategy: 'item-layer-stack',
      confidence: 0.94,
      fallbackReason: null,
    }
  }

  return {
    assetClass: 'special-item',
    strategy: 'fallback-card',
    confidence: 0.25,
    fallbackReason: `No texture layers resolved for ${input.itemId}`,
  }
}

export function classifyEntityArt(input: EntityArtClassificationInput): EntityArtClassification {
  if (input.entityId.includes('display') || input.entityId === 'interaction') {
    return {
      assetClass: 'display-tech',
      strategy: 'entity-item-derived',
      confidence: 0.88,
      fallbackReason: null,
    }
  }

  if (input.entityId.includes('boat') || input.entityId.includes('raft') || input.entityId.includes('minecart')) {
    return {
      assetClass: 'vehicle-icon',
      strategy: 'entity-item-derived',
      confidence: 0.9,
      fallbackReason: null,
    }
  }

  if (input.entityId.includes('arrow') || input.entityId.includes('trident') || input.entityId.includes('bobber') || input.entityId.includes('hook')) {
    return {
      assetClass: 'projectile-icon',
      strategy: 'entity-item-derived',
      confidence: 0.9,
      fallbackReason: null,
    }
  }

  return {
    assetClass: 'living-portrait',
    strategy: 'entity-sheet-crop',
    confidence: 0.86,
    fallbackReason: null,
  }
}

export function classifyStructureArt(input: StructureArtClassificationInput): StructureArtClassification {
  if (input.hasCells) {
    return {
      assetClass: 'structure-topdown',
      strategy: 'structure-grid',
      confidence: 0.9,
      fallbackReason: null,
    }
  }

  if (input.placementKind === 'native-worldgen') {
    return {
      assetClass: 'structure-materials',
      strategy: 'structure-material-board',
      confidence: 0.76,
      fallbackReason: null,
    }
  }

  return {
    assetClass: 'structure-materials',
    strategy: 'structure-material-board',
    confidence: 0.7,
    fallbackReason: null,
  }
}

export function isRenderableDescriptor(descriptor: CatalogArtDescriptor) {
  return descriptor.strategy !== 'fallback-card'
}
