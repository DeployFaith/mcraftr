export type CatalogSubject = 'item' | 'entity' | 'structure'

export type CatalogArtSource =
  | 'vanilla-jar'
  | 'bridge'
  | 'beacon'
  | 'preset-json'
  | 'upload-image'
  | 'upload-structure'
  | 'derived'
  | 'fallback'

export type CatalogArtClass =
  | 'flat-icon'
  | 'layered-icon'
  | 'block-face'
  | 'special-item'
  | 'living-portrait'
  | 'projectile-icon'
  | 'vehicle-icon'
  | 'display-tech'
  | 'spawn-egg'
  | 'structure-topdown'
  | 'structure-materials'
  | 'symbolic-fallback'

export type CatalogRenderStrategy =
  | 'item-layer-stack'
  | 'item-single-icon'
  | 'entity-sheet-crop'
  | 'entity-item-derived'
  | 'structure-grid'
  | 'structure-material-board'
  | 'fallback-card'

export type CatalogArtReviewState = 'auto' | 'approved' | 'warned' | 'rejected'

export type CatalogArtDependency = {
  kind: 'jar' | 'preview' | 'preset' | 'upload' | 'renderer'
  id: string
  hash: string | null
}

export type CatalogArtDescriptor = {
  key: string
  subject: CatalogSubject
  subjectId: string
  version: string | null
  source: CatalogArtSource
  assetClass: CatalogArtClass
  strategy: CatalogRenderStrategy
  confidence: number
  fallbackReason: string | null
  reviewState: CatalogArtReviewState
  dependencies: CatalogArtDependency[]
  meta?: Record<string, unknown>
}

export type CatalogArtOverride = {
  key?: string
  subject?: CatalogSubject
  subjectId?: string
  version?: string | '*'
  reviewState?: CatalogArtReviewState
  forceClass?: CatalogArtClass
  forceStrategy?: CatalogRenderStrategy
  fallbackReason?: string | null
  sourceAsset?: string | null
  cropBox?: {
    x: number
    y: number
    width: number
    height: number
  }
  notes?: string
}

export type CatalogArtArtifact = {
  format: 'svg' | 'png' | 'webp'
  mimeType: string
  path: string
  width: number | null
  height: number | null
  placeholder: boolean
  generatedAt: number
}

export type CatalogArtPayload = {
  url: string | null
  class: CatalogArtClass
  strategy: CatalogRenderStrategy
  placeholder: boolean
  reviewState: CatalogArtReviewState
  fallbackReason: string | null
}
