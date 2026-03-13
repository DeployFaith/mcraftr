import { createHash } from 'node:crypto'
import path from 'node:path'
import { promises as fs } from 'node:fs'
import { ensureDir, getMinecraftAssetsRoot, writeFileAtomic } from '@/lib/minecraft-assets/cache'
import type { CatalogArtArtifact, CatalogArtDescriptor } from './types'

const CATALOG_ART_ROOT = path.join(getMinecraftAssetsRoot(), 'catalog-art')
const CATALOG_ART_REVIEW_ROOT = path.join(CATALOG_ART_ROOT, 'review')

function safeSegment(value: string) {
  return value.replace(/[^a-zA-Z0-9._-]+/g, '_') || 'default'
}

function versionSegment(version: string | null) {
  return safeSegment(version ?? 'agnostic')
}

export function getCatalogArtRoot() {
  return CATALOG_ART_ROOT
}

export function getCatalogArtReviewRoot() {
  return CATALOG_ART_REVIEW_ROOT
}

export function getCatalogArtDescriptorRevision(descriptor: CatalogArtDescriptor) {
  return createHash('sha1').update(JSON.stringify(descriptor)).digest('hex').slice(0, 12)
}

export function getCatalogArtArtifactPath(descriptor: CatalogArtDescriptor, format: CatalogArtArtifact['format']) {
  const revision = getCatalogArtDescriptorRevision(descriptor)
  return path.join(
    CATALOG_ART_ROOT,
    descriptor.subject,
    safeSegment(descriptor.strategy),
    versionSegment(descriptor.version),
    `${safeSegment(descriptor.subjectId)}-${revision}.${format}`,
  )
}

export function getCatalogArtManifestPath(descriptor: CatalogArtDescriptor) {
  const revision = getCatalogArtDescriptorRevision(descriptor)
  return path.join(
    CATALOG_ART_ROOT,
    descriptor.subject,
    safeSegment(descriptor.strategy),
    versionSegment(descriptor.version),
    `${safeSegment(descriptor.subjectId)}-${revision}.json`,
  )
}

export async function readCatalogArtArtifact(descriptor: CatalogArtDescriptor) {
  const manifestPath = getCatalogArtManifestPath(descriptor)
  const raw = await fs.readFile(manifestPath, 'utf8')
  return JSON.parse(raw) as CatalogArtArtifact
}

export async function readCatalogArtArtifactContent(artifact: CatalogArtArtifact) {
  return fs.readFile(artifact.path)
}

export async function writeCatalogArtArtifact(
  descriptor: CatalogArtDescriptor,
  artifact: Omit<CatalogArtArtifact, 'path' | 'generatedAt'> & { content: string | Buffer },
) {
  const pathToArtifact = getCatalogArtArtifactPath(descriptor, artifact.format)
  const manifestPath = getCatalogArtManifestPath(descriptor)
  const stored: CatalogArtArtifact = {
    format: artifact.format,
    mimeType: artifact.mimeType,
    path: pathToArtifact,
    width: artifact.width,
    height: artifact.height,
    placeholder: artifact.placeholder,
    generatedAt: Date.now(),
  }

  await ensureDir(path.dirname(pathToArtifact))
  await writeFileAtomic(pathToArtifact, artifact.content)
  await writeFileAtomic(manifestPath, JSON.stringify(stored, null, 2))
  return stored
}
