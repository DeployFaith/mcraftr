import test from 'node:test'
import assert from 'node:assert/strict'
import { getStructureArtSvg } from '../../lib/minecraft-assets/structure-art'

test('getStructureArtSvg uses the Mcraftr accent palette instead of the old hardcoded blue theme', async () => {
  const svg = await getStructureArtSvg('1.21.4', 'Plains House', {
    blocks: [],
    cells: [['minecraft:oak_planks']],
    dimensions: { width: 1, height: 1, length: 1 },
  })

  assert.match(svg, /#00ffc8/i)
  assert.doesNotMatch(svg, /#9ed8ff/i)
  assert.doesNotMatch(svg, /#365173/i)
})