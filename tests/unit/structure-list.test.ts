import test from 'node:test'
import assert from 'node:assert/strict'
import { buildStructureArtUrl, inferStructure3DAvailability } from '../../lib/catalog-art/structure-list'

test('buildStructureArtUrl uses the active Minecraft version for structure art requests', () => {
  const url = buildStructureArtUrl({
    placementKind: 'native-template',
    resourceKey: 'village/plains/houses/plains_small_house_1',
    relativePath: null,
    format: 'native',
    iconId: null,
    bridgeRef: 'village/plains/houses/plains_small_house_1',
    id: 'native-template:village/plains/houses/plains_small_house_1',
    label: 'Plains House 1',
  }, '1.21.4')

  const parsed = new URL(url, 'http://localhost')
  assert.equal(parsed.searchParams.get('version'), '1.21.4')
  assert.equal(parsed.searchParams.get('placementKind'), 'native-template')
  assert.equal(parsed.searchParams.get('resourceKey'), 'village/plains/houses/plains_small_house_1')
})

test('buildStructureArtUrl falls back to the default Minecraft version when none is resolved', () => {
  const url = buildStructureArtUrl({
    placementKind: 'schematic',
    resourceKey: null,
    relativePath: 'uploads/castle.schem',
    format: 'schem',
    iconId: null,
    bridgeRef: 'uploads/castle.schem',
    id: 'schematic:uploads/castle.schem',
    label: 'Castle',
  }, null)

  const parsed = new URL(url, 'http://localhost')
  assert.equal(parsed.searchParams.get('version'), '1.21.11')
  assert.equal(parsed.searchParams.get('relativePath'), 'uploads/castle.schem')
  assert.equal(parsed.searchParams.get('format'), 'schem')
})

test('inferStructure3DAvailability keeps ancient city native templates 3d-ready', () => {
  assert.equal(inferStructure3DAvailability({
    placementKind: 'native-template',
    resourceKey: 'ancient_city/city_center/walls/bottom_left_corner',
    relativePath: null,
    format: 'native',
    iconId: null,
    bridgeRef: 'ancient_city/city_center/walls/bottom_left_corner',
    id: 'native-template:ancient_city/city_center/walls/bottom_left_corner',
    label: 'Bottom Left Corner',
    category: 'Ancient City',
  }), true)
})

test('inferStructure3DAvailability excludes shipwreck templates from the 3d hint', () => {
  assert.equal(inferStructure3DAvailability({
    placementKind: 'native-template',
    resourceKey: 'shipwreck/rightsideup_full',
    relativePath: null,
    format: 'native',
    iconId: null,
    bridgeRef: 'shipwreck/rightsideup_full',
    id: 'native-template:shipwreck/rightsideup_full',
    label: 'Rightsideup Full',
    category: 'Shipwreck',
  }), false)
})