import test from 'node:test'
import assert from 'node:assert/strict'
import { buildStructureArtUrl, withStructureArtView } from '../../lib/catalog-art/structure-list'
import { resolveStructureArtDescriptor } from '../../lib/catalog-art/resolvers/structure'

test('buildStructureArtUrl can request the materials view for structure art', () => {
  const url = buildStructureArtUrl({
    placementKind: 'native-template',
    resourceKey: 'village/plains/houses/plains_small_house_1',
    relativePath: null,
    format: 'native',
    iconId: null,
    bridgeRef: 'village/plains/houses/plains_small_house_1',
    id: 'native-template:village/plains/houses/plains_small_house_1',
    label: 'Plains House 1',
  }, '1.21.4', 'materials')

  const parsed = new URL(url, 'http://localhost')
  assert.equal(parsed.searchParams.get('artView'), 'materials')
})

test('withStructureArtView rewrites an existing structure art url to a different view', () => {
  const next = withStructureArtView('/api/minecraft/art/structure?version=1.21.4&placementKind=native-template&label=Plains+House', 'materials')
  const parsed = new URL(next, 'http://localhost')
  assert.equal(parsed.searchParams.get('artView'), 'materials')
  assert.equal(parsed.searchParams.get('placementKind'), 'native-template')
})

test('resolveStructureArtDescriptor honors an explicit materials view override', async () => {
  const descriptor = await resolveStructureArtDescriptor({
    version: '1.21.4',
    label: 'Plains House',
    placementKind: 'native-template',
    resourceKey: 'village/plains/houses/plains_small_house_1',
    artView: 'materials',
    preview: {
      blocks: ['minecraft:oak_planks'],
      cells: [['minecraft:oak_planks']],
      dimensions: { width: 1, height: 1, length: 1 },
    },
  })

  assert.equal(descriptor.strategy, 'structure-material-board')
  assert.equal(descriptor.assetClass, 'structure-materials')
  assert.equal(descriptor.meta?.artView, 'materials')
})