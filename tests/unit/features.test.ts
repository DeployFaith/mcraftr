import test from 'node:test'
import assert from 'node:assert/strict'
import { DEFAULT_FEATURES, FEATURE_CATEGORIES, FEATURE_DEFS, FEATURE_KEYS } from '../../lib/features'

const experimentalArtDefs = FEATURE_DEFS.filter(def => def.category === 'experimental')

test('experimental feature category is present', () => {
  assert.equal(FEATURE_CATEGORIES.some(category => category.id === 'experimental'), true)
})

test('experimental art features default to disabled', () => {
  assert.equal(DEFAULT_FEATURES.enable_experimental_structure_art, false)
  assert.equal(DEFAULT_FEATURES.enable_experimental_entity_art, false)
  assert.equal(DEFAULT_FEATURES.enable_experimental_item_art, false)
})

test('experimental feature definitions stay scoped to the three art toggles', () => {
  assert.deepEqual(
    experimentalArtDefs.map(def => def.key),
    [
      'enable_experimental_structure_art',
      'enable_experimental_entity_art',
      'enable_experimental_item_art',
    ],
  )
})

test('non-experimental features stay enabled by default', () => {
  for (const def of FEATURE_DEFS) {
    if (def.category === 'experimental') continue
    assert.equal(DEFAULT_FEATURES[def.key], true, `${def.key} should default to enabled`)
  }
})

test('feature key exports stay unique and aligned with definitions', () => {
  assert.equal(new Set(FEATURE_KEYS).size, FEATURE_KEYS.length)
  assert.deepEqual(FEATURE_KEYS, FEATURE_DEFS.map(def => def.key))
})
