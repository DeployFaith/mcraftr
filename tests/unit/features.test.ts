import test from 'node:test'
import assert from 'node:assert/strict'
import { DEFAULT_FEATURES, FEATURE_CATEGORIES } from '../../lib/features'

test('experimental feature category is present', () => {
  assert.equal(FEATURE_CATEGORIES.some(category => category.id === 'experimental'), true)
})

test('experimental art features default to disabled', () => {
  assert.equal(DEFAULT_FEATURES.enable_experimental_structure_art, false)
  assert.equal(DEFAULT_FEATURES.enable_experimental_entity_art, false)
  assert.equal(DEFAULT_FEATURES.enable_experimental_item_art, false)
})
