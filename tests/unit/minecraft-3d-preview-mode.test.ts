import test from 'node:test'
import assert from 'node:assert/strict'
import { shouldUseStructureVoxelPreview } from '../../lib/minecraft-preview-mode'

test('shouldUseStructureVoxelPreview enables voxel 3d for structures with voxel data', () => {
  assert.equal(shouldUseStructureVoxelPreview('structure', {
    voxels: [{ x: 0, y: 0, z: 0, blockId: 'minecraft:stone' }],
  }), true)
})

test('shouldUseStructureVoxelPreview stays false for structures without voxel data', () => {
  assert.equal(shouldUseStructureVoxelPreview('structure', { voxels: [] }), false)
})

test('shouldUseStructureVoxelPreview stays false for non-structure previews', () => {
  assert.equal(shouldUseStructureVoxelPreview('item', {
    voxels: [{ x: 0, y: 0, z: 0, blockId: 'minecraft:stone' }],
  }), false)
})
