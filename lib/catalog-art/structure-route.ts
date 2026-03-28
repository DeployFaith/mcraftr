import type { CatalogArtArtifact, CatalogArtDescriptor } from './types'
import type { StructurePreviewDescriptor } from '../minecraft-assets/structure-art'

export type StructureArtInput = {
  version: string
  placementKind: string
  resourceKey: string
  relativePath: string
  format: string
  label: string
  iconId: string
}

export type StructureArtResult =
  | { kind: 'artifact'; artifact: CatalogArtArtifact & { content: Buffer } }
  | { kind: 'fallback'; mimeType: 'image/png'; content: Buffer }
  | { kind: 'missing' }

export async function resolveStructureArtContent(
  input: StructureArtInput,
  deps: {
    getPreview: (input: StructureArtInput) => Promise<StructurePreviewDescriptor | null>
    getFallbackIcon: (values: string[]) => Promise<Buffer | null>
    resolveDescriptor: (input: StructureArtInput & { preview: StructurePreviewDescriptor }) => Promise<CatalogArtDescriptor>
    getArtifact: (descriptor: CatalogArtDescriptor) => Promise<CatalogArtArtifact & { content: Buffer }>
  },
): Promise<StructureArtResult> {
  const preview = await deps.getPreview(input)
  if (preview) {
    try {
      const descriptor = await deps.resolveDescriptor({ ...input, preview })
      const artifact = await deps.getArtifact(descriptor)
      return { kind: 'artifact', artifact }
    } catch {
      // Fall through to the static icon path so structure artwork remains resilient.
    }
  }

  const fallback = await deps.getFallbackIcon([
    input.iconId,
    input.resourceKey,
    input.relativePath,
    input.label,
  ])
  if (fallback) {
    return { kind: 'fallback', mimeType: 'image/png', content: fallback }
  }

  return { kind: 'missing' }
}
