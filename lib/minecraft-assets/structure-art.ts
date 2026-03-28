import { getItemTextureLayers } from './item-art'
import { CATALOG_ART_THEME } from '@/lib/catalog-art/theme'

export type StructurePreviewDescriptor = {
  blocks: string[]
  cells?: string[][] | null
  dimensions?: {
    width: number | null
    height: number | null
    length: number | null
  } | null
}

type StructureTextureMap = Record<string, string>

function escapeXml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;')
}

function placeholderTile(label: string, index: number) {
  const palette = CATALOG_ART_THEME.placeholderPalettes[index % CATALOG_ART_THEME.placeholderPalettes.length]
  const bg = palette.bg
  const fg = palette.fg
  return `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48">
      <rect width="48" height="48" rx="10" fill="${bg}" />
      <text x="24" y="29" text-anchor="middle" font-size="18" fill="${fg}" font-family="monospace">${escapeXml(label.slice(0, 2).toUpperCase())}</text>
    </svg>
  `.trim()
}

function renderCellTexture(texture: string, x: number, y: number, size: number, key: string) {
  return `
    <g transform="translate(${x} ${y})">
      <rect width="${size}" height="${size}" rx="${Math.max(3, Math.round(size * 0.18))}" fill="rgba(255,255,255,0.04)" stroke="rgba(255,255,255,0.06)" />
      <image href="${texture}" x="2" y="2" width="${size - 4}" height="${size - 4}" preserveAspectRatio="xMidYMid meet" style="image-rendering: pixelated;" />
      <title>${escapeXml(key)}</title>
    </g>
  `
}

function cropCells(cells: string[][]) {
  let minRow = Infinity
  let maxRow = -1
  let minCol = Infinity
  let maxCol = -1

  for (let rowIndex = 0; rowIndex < cells.length; rowIndex += 1) {
    const row = cells[rowIndex]
    for (let colIndex = 0; colIndex < row.length; colIndex += 1) {
      const blockId = row[colIndex]
      if (!blockId || blockId === 'air') continue
      minRow = Math.min(minRow, rowIndex)
      maxRow = Math.max(maxRow, rowIndex)
      minCol = Math.min(minCol, colIndex)
      maxCol = Math.max(maxCol, colIndex)
    }
  }

  if (!Number.isFinite(minRow) || maxRow < 0 || maxCol < 0) return cells
  return cells.slice(minRow, maxRow + 1).map(row => row.slice(minCol, maxCol + 1))
}

async function resolveStructureTextures(version: string, blocks: string[]): Promise<StructureTextureMap> {
  const unique = Array.from(new Set(blocks.filter(Boolean)))
  const entries = await Promise.all(unique.map(async (blockId, index) => {
    const layers = await getItemTextureLayers(version, blockId)
    return [
      blockId,
      layers[0] ?? `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(placeholderTile(blockId.replace(/^minecraft:/, ''), index))}`,
    ] as const
  }))
  return Object.fromEntries(entries)
}

function buildDimensionsLabel(dimensions: StructurePreviewDescriptor['dimensions']) {
  return dimensions
    ? `${dimensions.width ?? '?'}W × ${dimensions.length ?? '?'}L${dimensions.height ? ` × ${dimensions.height}H` : ''}`
    : 'Footprint unknown'
}

export function renderStructurePreviewSvg(label: string, preview: StructurePreviewDescriptor, textureMap: StructureTextureMap) {
  const swatches = preview.blocks.slice(0, 6).map((blockId, index) => ({
    blockId,
    texture: textureMap[blockId] ?? `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(placeholderTile(blockId.replace(/^minecraft:/, ''), index))}`,
  }))

  const dimsLabel = buildDimensionsLabel(preview.dimensions)
  const textureCache = new Map(swatches.map(swatch => [swatch.blockId, swatch.texture]))
  const cells = Array.isArray(preview.cells) && preview.cells.length > 0 ? preview.cells : null
  const gridScene = cells
    ? (() => {
        const cropped = cropCells(cells)
        const rows = cropped.length
        const cols = Math.max(...cropped.map(row => row.length), 1)
        const tileSize = Math.max(20, Math.min(36, Math.floor(176 / Math.max(rows, cols))))
        const gridWidth = cols * tileSize
        const gridHeight = rows * tileSize
        const originX = Math.round((320 - gridWidth) / 2)
        const originY = Math.round(34 + Math.max(0, (148 - gridHeight) / 2))
        const tiles = cropped.flatMap((row, rowIndex) => row.map((blockId, colIndex) => {
          if (!blockId || blockId === 'air') return ''
          const texture = textureCache.get(blockId) ?? `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(placeholderTile(blockId.replace(/^minecraft:/, ''), rowIndex + colIndex))}`
          return renderCellTexture(texture, originX + (colIndex * tileSize), originY + (rowIndex * tileSize), tileSize, blockId)
        })).join('')
        return {
          content: tiles,
        }
      })()
    : null

  const tiles = swatches.map((swatch, index) => {
    const col = index % 3
    const row = Math.floor(index / 3)
    const x = 28 + (col * 88)
    const y = 42 + (row * 88)
    return `
      <g transform="translate(${x} ${y})">
        <rect width="72" height="72" rx="18" fill="rgba(255,255,255,0.06)" stroke="rgba(255,255,255,0.08)" />
        <image href="${swatch.texture}" x="10" y="10" width="52" height="52" preserveAspectRatio="xMidYMid meet" style="image-rendering: pixelated;" />
        <text x="36" y="66" text-anchor="middle" font-size="7" fill="rgba(245,247,255,0.8)" font-family="monospace">${escapeXml(swatch.blockId.replace(/^minecraft:/, '').slice(0, 14))}</text>
      </g>
    `
  }).join('')

  return `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 220">
      <defs>
        <linearGradient id="bg" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0%" stop-color="${CATALOG_ART_THEME.panelGradientStart}" />
          <stop offset="100%" stop-color="${CATALOG_ART_THEME.panelGradientEnd}" />
        </linearGradient>
      </defs>
      <rect width="320" height="220" rx="30" fill="url(#bg)" />
      <rect x="12" y="12" width="296" height="196" rx="24" fill="${CATALOG_ART_THEME.panelInsetFill}" stroke="${CATALOG_ART_THEME.panelInsetStroke}" />
      <text x="28" y="28" font-size="10" fill="${CATALOG_ART_THEME.accent}" font-family="monospace">${gridScene ? 'TOP-DOWN PREVIEW' : 'BUILD MATERIALS'}</text>
      <text x="292" y="28" text-anchor="end" font-size="10" fill="${CATALOG_ART_THEME.textStrong}" font-family="monospace">${escapeXml(dimsLabel)}</text>
      ${gridScene ? gridScene.content : tiles}
      <text x="160" y="204" text-anchor="middle" font-size="11" fill="${CATALOG_ART_THEME.text}" font-family="monospace">${escapeXml(label)}</text>
    </svg>
  `.trim()
}

export function renderStructureMaterialsSvg(label: string, preview: StructurePreviewDescriptor, textureMap: StructureTextureMap) {
  const counts = new Map<string, number>()
  for (const blockId of preview.blocks) {
    if (!blockId || blockId === 'air') continue
    counts.set(blockId, (counts.get(blockId) ?? 0) + 1)
  }

  const ranked = Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 6)

  const cards = ranked.map(([blockId, count], index) => {
    const texture = textureMap[blockId] ?? `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(placeholderTile(blockId.replace(/^minecraft:/, ''), index))}`
    const col = index % 2
    const row = Math.floor(index / 2)
    const x = 24 + (col * 136)
    const y = 48 + (row * 48)
    return `
      <g transform="translate(${x} ${y})">
        <rect width="120" height="40" rx="14" fill="rgba(255,255,255,0.05)" stroke="rgba(255,255,255,0.08)" />
        <rect x="8" y="8" width="24" height="24" rx="8" fill="rgba(255,255,255,0.06)" stroke="rgba(255,255,255,0.08)" />
        <image href="${texture}" x="10" y="10" width="20" height="20" preserveAspectRatio="xMidYMid meet" style="image-rendering: pixelated;" />
        <text x="40" y="18" font-size="8" fill="${CATALOG_ART_THEME.textStrong}" font-family="monospace">${escapeXml(blockId.replace(/^minecraft:/, '').slice(0, 18))}</text>
        <text x="40" y="30" font-size="9" fill="${CATALOG_ART_THEME.accent}" font-family="monospace">${count} blocks</text>
      </g>
    `
  }).join('')

  const dimensions = buildDimensionsLabel(preview.dimensions)
  const total = Array.from(counts.values()).reduce((sum, count) => sum + count, 0)

  return `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 220">
      <defs>
        <linearGradient id="bg" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0%" stop-color="${CATALOG_ART_THEME.panelGradientStart}" />
          <stop offset="100%" stop-color="${CATALOG_ART_THEME.panelGradientEnd}" />
        </linearGradient>
      </defs>
      <rect width="320" height="220" rx="30" fill="url(#bg)" />
      <rect x="12" y="12" width="296" height="196" rx="24" fill="${CATALOG_ART_THEME.panelInsetFill}" stroke="${CATALOG_ART_THEME.panelInsetStroke}" />
      <text x="28" y="28" font-size="10" fill="${CATALOG_ART_THEME.accent}" font-family="monospace">BUILD MATERIALS</text>
      <text x="292" y="28" text-anchor="end" font-size="10" fill="${CATALOG_ART_THEME.textStrong}" font-family="monospace">${escapeXml(dimensions)}</text>
      <text x="28" y="42" font-size="9" fill="${CATALOG_ART_THEME.text}" font-family="monospace">${total} sampled blocks · ${ranked.length} primary materials</text>
      ${cards}
      <text x="160" y="204" text-anchor="middle" font-size="11" fill="${CATALOG_ART_THEME.text}" font-family="monospace">${escapeXml(label)}</text>
    </svg>
  `.trim()
}

export async function getStructureArtSvg(version: string, label: string, preview: StructurePreviewDescriptor) {
  const textureMap = await resolveStructureTextures(version, preview.blocks)
  return renderStructurePreviewSvg(label, preview, textureMap)
}

export async function getStructureMaterialsBoardSvg(version: string, label: string, preview: StructurePreviewDescriptor) {
  const textureMap = await resolveStructureTextures(version, preview.blocks)
  return renderStructureMaterialsSvg(label, preview, textureMap)
}
