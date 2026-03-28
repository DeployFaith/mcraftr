import test from 'node:test'
import assert from 'node:assert/strict'
import { getStructure3DPreview } from '../../lib/catalog-art/structure-3d'

test('getStructure3DPreview synthesizes a usable 3d preview from cells and heights when preview3d is missing', () => {
  const preview3d = getStructure3DPreview({
    blocks: ['minecraft:stone_bricks'],
    cells: [
      ['minecraft:stone_bricks', 'air'],
      ['minecraft:glass', 'minecraft:stone_bricks'],
    ],
    heights: [
      [1, 0],
      [3, 2],
    ],
    dimensions: { width: 2, height: 3, length: 2 },
  })

  assert.ok(preview3d)
  assert.equal(preview3d?.voxels.length, 3)
  assert.equal(preview3d?.sampled, true)
  assert.deepEqual(preview3d?.bounds, { width: 2, height: 3, length: 2 })
})