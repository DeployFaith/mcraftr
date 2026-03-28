import test from 'node:test'
import assert from 'node:assert/strict'
import type { StructurePreviewDescriptor } from '../../lib/minecraft-assets/structure-art'
import { resolveStructureArtContent } from '../../lib/catalog-art/structure-route'

const preview: StructurePreviewDescriptor = {
  blocks: ['minecraft:oak_planks', 'minecraft:cobblestone'],
  cells: [['minecraft:oak_planks']],
  dimensions: { width: 1, height: 1, length: 1 },
}

test('resolveStructureArtContent prefers generated structure art when preview data is available', async () => {
  const calls: string[] = []
  const result = await resolveStructureArtContent(
    {
      version: '1.21.4',
      placementKind: 'native-template',
      resourceKey: 'village/plains/houses/plains_small_house_1',
      relativePath: '',
      format: 'native',
      label: 'Plains House',
      iconId: 'village/plains/houses/plains_small_house_1',
    },
    {
      getPreview: async () => {
        calls.push('preview')
        return preview
      },
      getFallbackIcon: async () => {
        calls.push('fallback')
        return Buffer.from('fallback')
      },
      resolveDescriptor: async (input) => {
        calls.push('descriptor')
        assert.equal(input.preview, preview)
        return {
          key: 'structure:test',
          subject: 'structure',
          subjectId: 'native-template:test',
          version: input.version,
          source: 'beacon',
          assetClass: 'structure-topdown',
          strategy: 'structure-grid',
          confidence: 1,
          fallbackReason: null,
          reviewState: 'auto',
          dependencies: [],
          meta: { label: input.label, preview: input.preview },
        }
      },
      getArtifact: async () => {
        calls.push('artifact')
        return {
          format: 'svg',
          mimeType: 'image/svg+xml; charset=utf-8',
          path: '/tmp/test.svg',
          width: 320,
          height: 220,
          placeholder: false,
          generatedAt: Date.now(),
          content: Buffer.from('<svg/>'),
        }
      },
    },
  )

  assert.equal(result.kind, 'artifact')
  assert.equal(result.artifact.mimeType, 'image/svg+xml; charset=utf-8')
  assert.deepEqual(calls, ['preview', 'descriptor', 'artifact'])
})

test('resolveStructureArtContent falls back to static icon when preview data is unavailable', async () => {
  const calls: string[] = []
  const result = await resolveStructureArtContent(
    {
      version: '1.21.4',
      placementKind: 'native-worldgen',
      resourceKey: 'village/plains',
      relativePath: '',
      format: 'native',
      label: 'Village',
      iconId: 'village/plains',
    },
    {
      getPreview: async () => {
        calls.push('preview')
        return null
      },
      getFallbackIcon: async () => {
        calls.push('fallback')
        return Buffer.from('fallback-png')
      },
      resolveDescriptor: async () => {
        calls.push('descriptor')
        throw new Error('should not be called')
      },
      getArtifact: async () => {
        calls.push('artifact')
        throw new Error('should not be called')
      },
    },
  )

  assert.equal(result.kind, 'fallback')
  assert.equal(result.mimeType, 'image/png')
  assert.equal(result.content.toString(), 'fallback-png')
  assert.deepEqual(calls, ['preview', 'fallback'])
})

test('resolveStructureArtContent uses fallback icon when generated art fails unexpectedly', async () => {
  const calls: string[] = []
  const result = await resolveStructureArtContent(
    {
      version: '1.21.4',
      placementKind: 'schematic',
      resourceKey: '',
      relativePath: 'uploads/castle.schem',
      format: 'schem',
      label: 'Castle',
      iconId: 'uploads/castle.schem',
    },
    {
      getPreview: async () => {
        calls.push('preview')
        return preview
      },
      getFallbackIcon: async () => {
        calls.push('fallback')
        return Buffer.from('fallback-after-error')
      },
      resolveDescriptor: async () => {
        calls.push('descriptor')
        throw new Error('boom')
      },
      getArtifact: async () => {
        calls.push('artifact')
        throw new Error('should not be called')
      },
    },
  )

  assert.equal(result.kind, 'fallback')
  assert.equal(result.content.toString(), 'fallback-after-error')
  assert.deepEqual(calls, ['preview', 'descriptor', 'fallback'])
})
