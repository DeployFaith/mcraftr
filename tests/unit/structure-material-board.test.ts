import test from 'node:test'
import assert from 'node:assert/strict'
import { renderStructureMaterialsSvg } from '../../lib/minecraft-assets/structure-art'

test('renderStructureMaterialsSvg renders a dedicated materials board instead of the top-down preview', async () => {
  const svg = await renderStructureMaterialsSvg('Plains House', {
    blocks: [
      'minecraft:oak_planks',
      'minecraft:cobblestone',
      'minecraft:oak_planks',
      'minecraft:glass_pane',
      'minecraft:oak_planks',
    ],
    cells: [
      ['minecraft:oak_planks', 'minecraft:cobblestone'],
      ['minecraft:oak_planks', 'minecraft:glass_pane'],
    ],
    dimensions: { width: 2, height: 2, length: 2 },
  }, {
    'minecraft:oak_planks': 'data:image/png;base64,oak',
    'minecraft:cobblestone': 'data:image/png;base64,cobble',
    'minecraft:glass_pane': 'data:image/png;base64,glass',
  })

  assert.match(svg, /BUILD MATERIALS/)
  assert.doesNotMatch(svg, /TOP-DOWN PREVIEW/)
  assert.match(svg, /oak_planks/i)
  assert.match(svg, /cobblestone/i)
  assert.match(svg, /glass_pane/i)
  assert.match(svg, /3 blocks/i)
})
