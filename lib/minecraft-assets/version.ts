import path from 'node:path'
import { promises as fs } from 'node:fs'
import { ensureDir, getMinecraftVersionMetaPath } from './cache'

const VERSION_MANIFEST_URL = 'https://launchermeta.mojang.com/mc/game/version_manifest_v2.json'

type VersionManifest = {
  versions?: Array<{
    id: string
    url: string
  }>
}

type VersionMetadata = {
  downloads?: {
    client?: {
      url: string
      sha1?: string
    }
  }
}

let manifestCache: VersionManifest | null = null

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url, { cache: 'no-store' })
  if (!response.ok) {
    throw new Error(`Failed to fetch Minecraft metadata (${response.status})`)
  }
  return response.json() as Promise<T>
}

async function getVersionManifest() {
  if (manifestCache) return manifestCache
  manifestCache = await fetchJson<VersionManifest>(VERSION_MANIFEST_URL)
  return manifestCache
}

export async function getVersionMetadata(version: string): Promise<VersionMetadata> {
  const filePath = getMinecraftVersionMetaPath(version)
  try {
    const cached = await fs.readFile(filePath, 'utf8')
    return JSON.parse(cached) as VersionMetadata
  } catch {
    const manifest = await getVersionManifest()
    const entry = manifest.versions?.find(candidate => candidate.id === version)
    if (!entry?.url) {
      throw new Error(`Unknown Minecraft version: ${version}`)
    }
    const metadata = await fetchJson<VersionMetadata>(entry.url)
    await ensureDir(path.dirname(filePath))
    await fs.writeFile(filePath, JSON.stringify(metadata, null, 2))
    return metadata
  }
}

export async function getClientJarDownload(version: string) {
  const metadata = await getVersionMetadata(version)
  const url = metadata.downloads?.client?.url
  if (!url) {
    throw new Error(`Minecraft version ${version} does not expose a client jar download`)
  }
  return url
}
