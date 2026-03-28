import { getItemTextureLayers } from './item-art'
import { CATALOG_ART_THEME } from '@/lib/catalog-art/theme'

export type StructurePreviewDescriptor = {
  blocks: string[]
  cells?: string[][] | null
  heights?: number[][] | null
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

function renderHeightOverlay(height: number | null, minHeight: number, maxHeight: number, x: number, y: number, size: number) {
  if (!height || maxHeight <= 0) return ''
  const span = Math.max(1, maxHeight - minHeight)
  const normalized = (height - minHeight) / span
  const overlayOpacity = 0.08 + (normalized * 0.2)
  const badgeOpacity = 0.55 + (normalized * 0.25)
  return `
    <g transform="translate(${x} ${y})">
      <rect width="${size}" height="${size}" rx="${Math.max(3, Math.round(size * 0.18))}" fill="rgba(0,255,200,${overlayOpacity.toFixed(3)})" />
      <rect x="${Math.max(2, size - 16)}" y="2" width="14" height="10" rx="4" fill="rgba(8,12,18,${badgeOpacity.toFixed(3)})" stroke="rgba(255,255,255,0.08)" />
      <text x="${Math.max(9, size - 9)}" y="10" text-anchor="middle" font-size="6" fill="${CATALOG_ART_THEME.accentSoft}" font-family="monospace">${height}</text>
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
  const heights = Array.isArray(preview.heights) && preview.heights.length > 0 ? preview.heights : null
  const gridScene = cells
    ? (() => {
        const cropped = cropCells(cells)
        const rows = cropped.length
        const cols = Math.max(...cropped.map(row => row.length), 1)
        const tileHalfWidth = Math.max(12, Math.min(22, Math.floor(140 / Math.max(rows, cols))))
        const tileHalfHeight = Math.max(7, Math.round(tileHalfWidth * 0.55))
        const heightStep = Math.max(4, Math.round(tileHalfHeight * 0.9))
        const baseGridWidth = (cols + rows) * tileHalfWidth
        const baseGridHeight = (cols + rows) * tileHalfHeight
        const croppedHeights = heights
          ? cropped.map((row, rowIndex) => row.map((_, colIndex) => heights?.[rowIndex]?.[colIndex] ?? 0))
          : null
        const flatHeights = (croppedHeights ?? []).flat().filter(value => Number.isFinite(value) && value > 0) as number[]
        const minHeight = flatHeights.length > 0 ? Math.min(...flatHeights) : 0
        const maxHeight = flatHeights.length > 0 ? Math.max(...flatHeights) : 0
        const projectedHeight = Math.max(0, maxHeight - minHeight) * heightStep
        const originX = Math.round((320 - baseGridWidth) / 2) + (rows * tileHalfWidth)
        const originY = Math.round(58 + Math.max(0, (110 - baseGridHeight) / 2) + projectedHeight)
        const tiles = cropped.flatMap((row, rowIndex) => row.map((blockId, colIndex) => {
          if (!blockId || blockId === 'air') return ''
          const texture = textureCache.get(blockId) ?? `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(placeholderTile(blockId.replace(/^minecraft:/, ''), rowIndex + colIndex))}`
          const height = croppedHeights?.[rowIndex]?.[colIndex] ?? null
          const relativeHeight = Math.max(0, (height ?? minHeight) - minHeight)
          const centerX = originX + ((colIndex - rowIndex) * tileHalfWidth)
          const centerY = originY + ((colIndex + rowIndex) * tileHalfHeight) - (relativeHeight * heightStep)
          const left = centerX - tileHalfWidth
          const right = centerX + tileHalfWidth
          const top = centerY - tileHalfHeight
          const bottom = centerY + tileHalfHeight
          const wallBottom = bottom + Math.max(6, relativeHeight * heightStep)
          const clipId = `iso-clip-${rowIndex}-${colIndex}-${Math.max(0, relativeHeight)}`
          const topDiamond = `${centerX},${top} ${right},${centerY} ${centerX},${bottom} ${left},${centerY}`
          const leftWall = `${left},${centerY} ${centerX},${bottom} ${centerX},${wallBottom} ${left},${wallBottom - tileHalfHeight}`
          const rightWall = `${right},${centerY} ${centerX},${bottom} ${centerX},${wallBottom} ${right},${wallBottom - tileHalfHeight}`
          const badgeY = top - 6
          return `
            <g transform="translate(0 0)">
              <polygon points="${leftWall}" fill="rgba(0,0,0,0.24)" stroke="rgba(255,255,255,0.05)" />
              <polygon points="${rightWall}" fill="rgba(255,255,255,0.08)" stroke="rgba(255,255,255,0.05)" />
              <polygon points="${topDiamond}" fill="rgba(255,255,255,0.06)" stroke="rgba(255,255,255,0.12)" />
              <clipPath id="${clipId}"><polygon points="${topDiamond}" /></clipPath>
              <image href="${texture}" x="${left}" y="${top}" width="${tileHalfWidth * 2}" height="${tileHalfHeight * 2}" preserveAspectRatio="xMidYMid slice" clip-path="url(#${clipId})" style="image-rendering: pixelated;" />
              <polygon points="${topDiamond}" fill="rgba(0,255,200,${(0.05 + (relativeHeight / Math.max(1, maxHeight || 1)) * 0.14).toFixed(3)})" />
              <rect x="${centerX - 11}" y="${badgeY}" width="22" height="10" rx="5" fill="rgba(8,12,18,0.72)" stroke="rgba(255,255,255,0.08)" />
              <text x="${centerX}" y="${badgeY + 7}" text-anchor="middle" font-size="6" fill="${CATALOG_ART_THEME.accentSoft}" font-family="monospace">${height ?? 0}</text>
              <title>${escapeXml(blockId)} · height ${height ?? 0}</title>
            </g>
          `
        })).join('')
        return {
          content: tiles,
          reliefLevels: flatHeights.length > 0 ? (maxHeight - minHeight + 1) : null,
          peakHeight: maxHeight > 0 ? maxHeight : null,
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
      <text x="28" y="28" font-size="10" fill="${CATALOG_ART_THEME.accent}" font-family="monospace">${gridScene ? 'ISOMETRIC PREVIEW' : 'BUILD MATERIALS'}</text>
      <text x="292" y="28" text-anchor="end" font-size="10" fill="${CATALOG_ART_THEME.textStrong}" font-family="monospace">${escapeXml(dimsLabel)}</text>
      ${gridScene?.reliefLevels ? `<text x="28" y="42" font-size="9" fill="${CATALOG_ART_THEME.text}" font-family="monospace">RELIEF ${gridScene.reliefLevels} LEVELS · HEIGHT ${gridScene.peakHeight}</text>` : ''}
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
