import test from 'node:test'
import assert from 'node:assert/strict'
import { selectStructurePreviewVoxels } from '../../beacon/structure-preview.mjs'

test('selectStructurePreviewVoxels prefers exposed shell voxels over buried interior blocks', () => {
  const voxels = []
  for (let z = 0; z < 3; z += 1) {
    for (let y = 0; y < 3; y += 1) {
      for (let x = 0; x < 3; x += 1) {
        voxels.push({ x, y, z, blockId: 'minecraft:stone_bricks' })
      }
    }
  }

  const selection = selectStructurePreviewVoxels(voxels, { width: 3, height: 3, length: 3 }, 26)
  assert.equal(selection.voxels.length, 26)
  assert.equal(selection.sampled, true)
  assert.equal(selection.voxels.some(voxel => voxel.x === 1 && voxel.y === 1 && voxel.z === 1), false)
})

test('selectStructurePreviewVoxels keeps all voxels when under budget', () => {
  const voxels = [
    { x: 0, y: 0, z: 0, blockId: 'minecraft:oak_planks' },
    { x: 1, y: 0, z: 0, blockId: 'minecraft:oak_planks' },
    { x: 0, y: 1, z: 0, blockId: 'minecraft:oak_planks' },
  ]

  const selection = selectStructurePreviewVoxels(voxels, { width: 2, height: 2, length: 1 }, 10)
  assert.equal(selection.voxels.length, 3)
  assert.equal(selection.sampled, false)
})
