import test from 'node:test'
import assert from 'node:assert/strict'
import { resolveStructureBlockShape } from '../../lib/catalog-art/structure-block-shape'

test('resolveStructureBlockShape keeps full blocks cubic by default', () => {
  assert.deepEqual(resolveStructureBlockShape('minecraft:stone_bricks'), {
    scale: [1, 1, 1],
    yOffset: 0,
  })
})

test('resolveStructureBlockShape gives slab and stair families reduced height', () => {
  assert.deepEqual(resolveStructureBlockShape('minecraft:deepslate_tile_slab'), {
    scale: [1, 0.5, 1],
    yOffset: -0.25,
  })
  assert.deepEqual(resolveStructureBlockShape('minecraft:oak_stairs'), {
    scale: [1, 0.75, 1],
    yOffset: -0.125,
  })
})

test('resolveStructureBlockShape makes thin structure families less cubic', () => {
  assert.deepEqual(resolveStructureBlockShape('minecraft:cobblestone_wall'), {
    scale: [0.6, 1, 0.6],
    yOffset: 0,
  })
  assert.deepEqual(resolveStructureBlockShape('minecraft:glass_pane'), {
    scale: [0.14, 1, 0.14],
    yOffset: 0,
  })
  assert.deepEqual(resolveStructureBlockShape('minecraft:torch'), {
    scale: [0.28, 0.45, 0.28],
    yOffset: -0.275,
  })
})
