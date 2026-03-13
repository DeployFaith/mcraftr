import { promises as fs } from 'node:fs'
import path from 'node:path'
import AdmZip from 'adm-zip'
import { ensureDir, getMinecraftJarPath, writeFileAtomic } from './cache'
import { getClientJarDownload } from './version'

const archiveCache = new Map<string, AdmZip>()

export async function ensureClientJar(version: string) {
  const jarPath = getMinecraftJarPath(version)
  try {
    const stat = await fs.stat(jarPath)
    if (stat.size > 0) return jarPath
  } catch {
    // fall through and download
  }

  await ensureDir(path.dirname(jarPath))
  const url = await getClientJarDownload(version)
  const response = await fetch(url, { cache: 'no-store' })
  if (!response.ok) {
    throw new Error(`Failed to download Minecraft client jar (${response.status})`)
  }
  const bytes = Buffer.from(await response.arrayBuffer())
  await writeFileAtomic(jarPath, bytes)
  archiveCache.delete(version)
  return jarPath
}

async function getArchive(version: string) {
  const cached = archiveCache.get(version)
  if (cached) return cached
  const jarPath = await ensureClientJar(version)
  const archive = new AdmZip(jarPath)
  archiveCache.set(version, archive)
  return archive
}

export async function readClientJarEntry(version: string, entryPath: string) {
  const archive = await getArchive(version)
  const entry = archive.getEntry(entryPath)
  if (!entry) return null
  return entry.getData()
}

export async function readClientJarJson<T>(version: string, entryPath: string): Promise<T | null> {
  const data = await readClientJarEntry(version, entryPath)
  if (!data) return null
  return JSON.parse(data.toString('utf8')) as T
}

export async function listClientJarEntries(version: string, prefix = '') {
  const archive = await getArchive(version)
  const entries = archive.getEntries().map(entry => entry.entryName)
  return prefix ? entries.filter(entry => entry.startsWith(prefix)) : entries
}
