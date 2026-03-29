import test from 'node:test'
import assert from 'node:assert/strict'
import { resolveStructureBlockColor } from '../../lib/catalog-art/structure-block-color'

test('resolveStructureBlockColor keeps related wood variants in recognizable families', () => {
  assert.equal(resolveStructureBlockColor('minecraft:oak_stairs'), '#b88752')
  assert.equal(resolveStructureBlockColor('minecraft:dark_oak_log'), '#6b4c33')
  assert.equal(resolveStructureBlockColor('minecraft:spruce_fence'), '#8e6a45')
})

test('resolveStructureBlockColor recognizes major stone and deep block families', () => {
  assert.equal(resolveStructureBlockColor('minecraft:stone_brick_stairs'), '#8c9097')
  assert.equal(resolveStructureBlockColor('minecraft:deepslate_tile_slab'), '#555661')
  assert.equal(resolveStructureBlockColor('minecraft:polished_blackstone_brick_wall'), '#4a434a')
})

test('resolveStructureBlockColor covers special structure palette blocks', () => {
  assert.equal(resolveStructureBlockColor('minecraft:sea_lantern'), '#bff7ea')
  assert.equal(resolveStructureBlockColor('minecraft:sculk'), '#16333f')
  assert.equal(resolveStructureBlockColor('minecraft:copper_bulb'), '#b66a3f')
})

test('resolveStructureBlockColor returns stable hashed colors for unknown blocks', () => {
  const color = resolveStructureBlockColor('minecraft:custom_block_example')
  assert.match(color, /^hsl\(/)
  assert.equal(color, resolveStructureBlockColor('minecraft:custom_block_example'))
})
