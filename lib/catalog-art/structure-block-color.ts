const BLOCK_COLOR_OVERRIDES: Record<string, string> = {
  'minecraft:sea_lantern': '#bff7ea',
  'minecraft:lantern': '#f7d27d',
  'minecraft:soul_lantern': '#7ac2d9',
  'minecraft:glowstone': '#d8a85b',
  'minecraft:sculk': '#16333f',
  'minecraft:sculk_vein': '#275263',
  'minecraft:sculk_catalyst': '#30525d',
  'minecraft:sculk_shrieker': '#4b6977',
  'minecraft:copper_bulb': '#b66a3f',
  'minecraft:weathered_copper_bulb': '#4f7f72',
  'minecraft:exposed_copper_bulb': '#7f8f76',
  'minecraft:oxidized_copper_bulb': '#4e8b78',
}

const FAMILY_COLORS: Array<[RegExp, string]> = [
  [/dark_oak/i, '#6b4c33'],
  [/acacia/i, '#c27a55'],
  [/(oak|pale_oak)/i, '#b88752'],
  [/spruce/i, '#8e6a45'],
  [/birch/i, '#d9c78e'],
  [/jungle/i, '#ad7d4b'],
  [/mangrove/i, '#8f5346'],
  [/crimson/i, '#8f3d55'],
  [/warped/i, '#2f7f7d'],
  [/bamboo/i, '#c7c07a'],
  [/cherry/i, '#d18aa0'],
  [/blackstone/i, '#4a434a'],
  [/(deepslate|reinforced_deepslate)/i, '#555661'],
  [/(stone_brick|stonebrick)/i, '#8c9097'],
  [/mossy_stone/i, '#72836d'],
  [/cracked_stone/i, '#7b7f86'],
  [/cobblestone/i, '#7b7f87'],
  [/andesite/i, '#8f9499'],
  [/diorite/i, '#d8d4cf'],
  [/granite/i, '#9f7b72'],
  [/tuff/i, '#768085'],
  [/basalt/i, '#5c5b61'],
  [/prismarine/i, '#6cb4a7'],
  [/sandstone/i, '#d8c18d'],
  [/red_sandstone/i, '#b76e4d'],
  [/terracotta/i, '#b67e63'],
  [/(mud|packed_mud)/i, '#7a5d4e'],
  [/mud_brick/i, '#7d6151'],
  [/brick/i, '#9c5f4d'],
  [/nether_brick/i, '#4e3437'],
  [/quartz/i, '#ece7df'],
  [/calcite/i, '#ece7e2'],
  [/amethyst/i, '#8f72bf'],
  [/purpur/i, '#af7ebc'],
  [/end_stone/i, '#d4d2a2'],
  [/obsidian/i, '#4a3f67'],
  [/crying_obsidian/i, '#6550b3'],
  [/glass/i, '#9ddde2'],
  [/ice/i, '#86c8f8'],
  [/snow/i, '#f3f8ff'],
  [/hay/i, '#d8b548'],
  [/wool/i, '#d8d3cb'],
  [/concrete/i, '#b9b4aa'],
  [/copper/i, '#b66a3f'],
  [/oxidized/i, '#4e8b78'],
  [/exposed/i, '#7f8f76'],
  [/weathered/i, '#5f7f72'],
  [/gold/i, '#c9a245'],
  [/iron/i, '#b8bec6'],
  [/diamond/i, '#73d7d5'],
  [/emerald/i, '#42bb72'],
  [/lapis/i, '#4777be'],
  [/redstone/i, '#b44343'],
]

function normalize(blockId: string) {
  return (blockId.includes(':') ? blockId : `minecraft:${blockId}`).toLowerCase()
}

function hashedColor(blockId: string) {
  let hash = 0
  for (let index = 0; index < blockId.length; index += 1) {
    hash = ((hash << 5) - hash) + blockId.charCodeAt(index)
  }
  const hue = Math.abs(hash) % 360
  const saturation = 18 + (Math.abs(hash) % 18)
  const lightness = 46 + (Math.abs(hash >> 3) % 16)
  return `hsl(${hue} ${saturation}% ${lightness}%)`
}

export function resolveStructureBlockColor(blockId: string) {
  const normalized = normalize(blockId)
  if (BLOCK_COLOR_OVERRIDES[normalized]) return BLOCK_COLOR_OVERRIDES[normalized]
  for (const [pattern, color] of FAMILY_COLORS) {
    if (pattern.test(normalized)) return color
  }
  return hashedColor(normalized)
}
