import path from 'node:path'
import { promises as fs } from 'node:fs'

const DATA_DIR = process.env.DATA_DIR || '/app/data'
const ROOT_DIR = path.join(DATA_DIR, 'minecraft-assets')

export const ITEM_ART_RENDERER_VERSION = 'v1'

function safeSegment(value: string) {
  return value.replace(/[^a-zA-Z0-9._-]+/g, '_') || 'default'
}

export function getMinecraftAssetsRoot() {
  return ROOT_DIR
}

export function getMinecraftVersionCacheDir(version: string) {
  return path.join(ROOT_DIR, 'versions', safeSegment(version))
}

export function getMinecraftJarPath(version: string) {
  return path.join(getMinecraftVersionCacheDir(version), 'client.jar')
}

export function getMinecraftVersionMetaPath(version: string) {
  return path.join(getMinecraftVersionCacheDir(version), 'version.json')
}

export function getItemArtCachePath(version: string, itemId: string) {
  return path.join(ROOT_DIR, 'art', 'items', ITEM_ART_RENDERER_VERSION, safeSegment(version), `${safeSegment(itemId)}.svg`)
}

export async function ensureDir(dirPath: string) {
  await fs.mkdir(dirPath, { recursive: true })
}

export async function writeFileAtomic(filePath: string, content: Buffer | string) {
  await ensureDir(path.dirname(filePath))
  const tempPath = `${filePath}.${process.pid}.${Date.now()}.tmp`
  await fs.writeFile(tempPath, content)
  await fs.rename(tempPath, filePath)
}
