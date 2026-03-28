import test from 'node:test'
import assert from 'node:assert/strict'
import { computeStructureCameraDistance, computeStructureCameraTarget, getStructure3DPreview, groupVoxelsByBlockId, summarizeStructure3DMeta } from '../../lib/catalog-art/structure-3d'
import type { StructurePreviewDescriptor } from '../../lib/minecraft-assets/structure-art'

const preview: StructurePreviewDescriptor = {
  blocks: ['minecraft:stone_bricks'],
  preview3d: {
    voxels: [
      { x: 0, y: 0, z: 0, blockId: 'minecraft:stone_bricks' },
      { x: 1, y: 0, z: 0, blockId: 'minecraft:stone_bricks' },
      { x: 1, y: 1, z: 1, blockId: 'minecraft:glass' },
    ],
    bounds: { width: 2, height: 2, length: 2 },
    truncated: false,
    sampled: false,
    voxelCount: 3,
  },
}

test('getStructure3DPreview returns the 3d payload when present', () => {
  assert.deepEqual(getStructure3DPreview(preview)?.bounds, { width: 2, height: 2, length: 2 })
})

test('groupVoxelsByBlockId groups voxel positions by block id', () => {
  const grouped = groupVoxelsByBlockId(preview.preview3d!)
  assert.equal(grouped.length, 2)
  assert.equal(grouped[0].blockId, 'minecraft:glass')
  assert.equal(grouped[1].positions.length, 2)
})

test('3d preview helpers compute camera target, distance, and meta summary', () => {
  const preview3d = preview.preview3d!
  assert.deepEqual(computeStructureCameraTarget(preview3d), [1, 1, 1])
  assert.equal(computeStructureCameraDistance(preview3d), 8)
  assert.deepEqual(summarizeStructure3DMeta(preview3d), {
    voxelCount: 3,
    truncated: false,
    sampled: false,
    boundsLabel: '2 × 2 × 2',
  })
})
