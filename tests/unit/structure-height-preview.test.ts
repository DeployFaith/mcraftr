import test from 'node:test'
import assert from 'node:assert/strict'
import { renderStructurePreviewSvg } from '../../lib/minecraft-assets/structure-art'

test('renderStructurePreviewSvg surfaces relief metadata when height data is available', () => {
  const svg = renderStructurePreviewSvg('Tower', {
    blocks: ['minecraft:stone_bricks', 'minecraft:deepslate_tiles'],
    cells: [
      ['minecraft:stone_bricks', 'minecraft:deepslate_tiles'],
      ['minecraft:stone_bricks', 'minecraft:stone_bricks'],
    ],
    heights: [
      [1, 4],
      [2, 3],
    ],
    dimensions: { width: 2, height: 4, length: 2 },
  }, {
    'minecraft:stone_bricks': 'data:image/png;base64,stone',
    'minecraft:deepslate_tiles': 'data:image/png;base64,deep',
  })

  assert.match(svg, /RELIEF 4 LEVELS/)
  assert.match(svg, /HEIGHT 4/)
})