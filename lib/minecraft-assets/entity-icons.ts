import { promises as fs } from 'node:fs'
import path from 'node:path'
import { PNG } from 'pngjs'

type SpriteCell = {
  x: number
  y: number
  size: number
}

type EntityIconsManifest = {
  entities: {
    columns: number
    rows: number
    width: number
    height: number
    [key: string]: unknown
  }
}

let manifestCache: Map<string, SpriteCell> | null = null
let sheetCache: PNG | null = null

const SHEET_PATH = path.join(process.cwd(), 'catalog-art/vendor/entity-icons/16x16_sheet.png')
const MANIFEST_PATH = path.join(process.cwd(), 'catalog-art/vendor/entity-icons/16x16_sprites.json')

function canonicalEntityId(entityId: string) {
  return entityId.includes(':') ? entityId : `minecraft:${entityId}`
}

async function loadManifestMap() {
  if (manifestCache) return manifestCache

  const parsed = JSON.parse(await fs.readFile(MANIFEST_PATH, 'utf8')) as EntityIconsManifest
  const entities = parsed.entities
  const columns = Number(entities.columns) || 13
  const width = Number(entities.width) || 208
  const cellSize = Math.floor(width / columns) || 16
  const map = new Map<string, SpriteCell>()

  for (const [key, value] of Object.entries(entities)) {
    if (!key.startsWith('row_') || !Array.isArray(value)) continue
    const rowIndex = Math.max(0, Number(key.replace('row_', '')) - 1)
    value.forEach((entry, columnIndex) => {
      if (!entry || typeof entry !== 'object') return
      const entity = typeof (entry as { entity?: unknown }).entity === 'string'
        ? canonicalEntityId((entry as { entity: string }).entity)
        : null
      if (!entity || map.has(entity)) return
      map.set(entity, {
        x: columnIndex * cellSize,
        y: rowIndex * cellSize,
        size: cellSize,
      })
    })
  }

  manifestCache = map
  return map
}

export async function hasEntityIcon(entityId: string) {
  const manifest = await loadManifestMap()
  return manifest.has(canonicalEntityId(entityId))
}

export function normalizeEntityIconId(entityId: string) {
  return canonicalEntityId(entityId)
}

async function loadSheet() {
  if (sheetCache) return sheetCache
  sheetCache = PNG.sync.read(await fs.readFile(SHEET_PATH))
  return sheetCache
}

export async function getEntityIconPng(entityId: string) {
  const manifest = await loadManifestMap()
  const cell = manifest.get(canonicalEntityId(entityId))
  if (!cell) return null

  const sheet = await loadSheet()
  const output = new PNG({ width: cell.size, height: cell.size })

  for (let y = 0; y < cell.size; y += 1) {
    for (let x = 0; x < cell.size; x += 1) {
      const sourceIndex = ((cell.y + y) * sheet.width + (cell.x + x)) * 4
      const targetIndex = (y * cell.size + x) * 4
      output.data[targetIndex] = sheet.data[sourceIndex]
      output.data[targetIndex + 1] = sheet.data[sourceIndex + 1]
      output.data[targetIndex + 2] = sheet.data[sourceIndex + 2]
      output.data[targetIndex + 3] = sheet.data[sourceIndex + 3]
    }
  }

  return PNG.sync.write(output)
}
