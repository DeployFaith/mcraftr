import test from 'node:test'
import assert from 'node:assert/strict'
import { resolveItemCatalogArtEntry } from '../../lib/catalog-art/item-catalog'
import type { CatalogArtDescriptor } from '../../lib/catalog-art/types'

function makeDescriptor(overrides: Partial<CatalogArtDescriptor> = {}): CatalogArtDescriptor {
  return {
    key: 'item:1.21.4:diamond_sword:item-layer-stack',
    subject: 'item',
    subjectId: 'diamond_sword',
    version: '1.21.4',
    source: 'vanilla-jar',
    assetClass: 'flat-icon',
    strategy: 'item-layer-stack',
    confidence: 0.9,
    fallbackReason: null,
    reviewState: 'auto',
    dependencies: [],
    meta: { label: 'Diamond Sword' },
    ...overrides,
  }
}

test('resolveItemCatalogArtEntry returns authoritative reviewed payload for renderable item art', async () => {
  const entry = await resolveItemCatalogArtEntry({
    version: '1.21.4',
    itemId: 'diamond_sword',
    label: 'Diamond Sword',
  }, {
    resolveDescriptor: async () => makeDescriptor(),
    reviewDescriptor: async descriptor => descriptor,
  })

  assert.equal(entry.itemId, 'diamond_sword')
  assert.equal(entry.imageUrl, '/api/minecraft/art/item/1.21.4/diamond_sword')
  assert.equal(entry.art?.url, '/api/minecraft/art/item/1.21.4/diamond_sword')
  assert.equal(entry.art?.strategy, 'item-layer-stack')
  assert.equal(entry.art?.placeholder, false)
  assert.equal(entry.art?.reviewState, 'auto')
})

test('resolveItemCatalogArtEntry reports fallback-card metadata when reviewed descriptor is not renderable', async () => {
  const entry = await resolveItemCatalogArtEntry({
    version: '1.21.4',
    itemId: 'missing_test_item',
    label: 'Missing Test Item',
  }, {
    resolveDescriptor: async () => makeDescriptor({
      key: 'item:1.21.4:missing_test_item:fallback-card',
      subjectId: 'missing_test_item',
      strategy: 'fallback-card',
      assetClass: 'special-item',
      confidence: 0.25,
      fallbackReason: 'No texture layers resolved for missing_test_item',
      meta: { label: 'Missing Test Item' },
    }),
    reviewDescriptor: async descriptor => descriptor,
  })

  assert.equal(entry.itemId, 'missing_test_item')
  assert.equal(entry.imageUrl, null)
  assert.equal(entry.art?.url, null)
  assert.equal(entry.art?.strategy, 'fallback-card')
  assert.match(entry.art?.fallbackReason ?? '', /No texture layers resolved/i)
})
