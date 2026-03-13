import { promises as fs } from 'node:fs'
import { getItemArtCachePath, writeFileAtomic } from './cache'
import { readClientJarEntry, readClientJarJson } from './client-jar'

type ItemDefinitionNode = Record<string, unknown>
type ModelJson = {
  parent?: string
  textures?: Record<string, string>
}

export type ItemArtData = {
  modelRef: string | null
  textures: string[]
}

function escapeXml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;')
}

function splitAssetRef(ref: string, namespaceHint = 'minecraft') {
  const [namespace, assetPath] = ref.includes(':') ? ref.split(':', 2) : [namespaceHint, ref]
  return {
    namespace,
    assetPath: assetPath.replace(/^\/+/, ''),
  }
}

function modelEntryPath(ref: string, namespaceHint = 'minecraft') {
  const { namespace, assetPath } = splitAssetRef(ref, namespaceHint)
  return `assets/${namespace}/models/${assetPath}.json`
}

function itemDefinitionPath(itemId: string) {
  return `assets/minecraft/items/${itemId}.json`
}

function textureEntryPath(ref: string, namespaceHint = 'minecraft') {
  const { namespace, assetPath } = splitAssetRef(ref, namespaceHint)
  return `assets/${namespace}/textures/${assetPath}.png`
}

function normalizeTextureRef(ref: string, namespaceHint = 'minecraft') {
  if (ref.startsWith('#')) return ref
  const { namespace, assetPath } = splitAssetRef(ref, namespaceHint)
  return `${namespace}:${assetPath}`
}

function findModelReference(node: unknown): string | null {
  if (!node) return null
  if (typeof node === 'string') return node.includes('/') ? node : null
  if (Array.isArray(node)) {
    for (const entry of node) {
      const found = findModelReference(entry)
      if (found) return found
    }
    return null
  }
  if (typeof node !== 'object') return null

  const record = node as Record<string, unknown>
  if (record.type === 'minecraft:model' && typeof record.model === 'string') {
    return record.model
  }
  if (record.type === 'minecraft:special' && typeof record.base === 'string') {
    return record.base
  }

  const candidates: unknown[] = []
  if (record.model) candidates.push(record.model)
  if (record.base) candidates.push(record.base)
  if (record.on_false) candidates.push(record.on_false)
  if (record.on_true) candidates.push(record.on_true)
  if (record.fallback) candidates.push(record.fallback)
  if (Array.isArray(record.cases)) {
    for (const entry of record.cases) {
      if (entry && typeof entry === 'object' && 'model' in entry) {
        candidates.push((entry as Record<string, unknown>).model)
      }
    }
  }
  if (Array.isArray(record.entries)) {
    for (const entry of record.entries) {
      if (entry && typeof entry === 'object' && 'model' in entry) {
        candidates.push((entry as Record<string, unknown>).model)
      }
    }
  }
  if (Array.isArray(record.models)) {
    candidates.push(...record.models)
  }

  for (const candidate of candidates) {
    const found = findModelReference(candidate)
    if (found) return found
  }

  return null
}

async function resolveItemModelRef(version: string, itemId: string) {
  const definition = await readClientJarJson<ItemDefinitionNode>(version, itemDefinitionPath(itemId))
  const fromDefinition = findModelReference(definition)
  if (fromDefinition) return fromDefinition

  const fallbackItemModel = await readClientJarJson<ModelJson>(version, modelEntryPath(`item/${itemId}`))
  if (fallbackItemModel) return `minecraft:item/${itemId}`

  const fallbackBlockModel = await readClientJarJson<ModelJson>(version, modelEntryPath(`block/${itemId}`))
  if (fallbackBlockModel) return `minecraft:block/${itemId}`

  return null
}

async function resolveModelTextures(version: string, modelRef: string, seen = new Set<string>()): Promise<Record<string, string>> {
  if (seen.has(modelRef)) return {}
  seen.add(modelRef)

  const { namespace } = splitAssetRef(modelRef)
  const json = await readClientJarJson<ModelJson>(version, modelEntryPath(modelRef))
  if (!json) return {}

  const parentTextures = json.parent ? await resolveModelTextures(version, normalizeTextureRef(json.parent, namespace), seen) : {}
  const ownTextures = Object.fromEntries(
    Object.entries(json.textures ?? {}).map(([key, value]) => [key, normalizeTextureRef(value, namespace)]),
  )
  return {
    ...parentTextures,
    ...ownTextures,
  }
}

function resolveTextureValue(textures: Record<string, string>, key: string, depth = 0): string | null {
  if (depth > 8) return null
  const value = textures[key]
  if (!value) return null
  if (!value.startsWith('#')) return value
  return resolveTextureValue(textures, value.slice(1), depth + 1)
}

function pickTextureRefs(modelRef: string, textures: Record<string, string>) {
  const layerKeys = Object.keys(textures)
    .filter(key => /^layer\d+$/.test(key))
    .sort((left, right) => Number(left.slice(5)) - Number(right.slice(5)))

  const layered = layerKeys
    .map(key => resolveTextureValue(textures, key))
    .filter((entry): entry is string => !!entry)

  if (layered.length > 0) return Array.from(new Set(layered))

  const preferredKeys = ['all', 'top', 'side', 'end', 'front', 'particle', 'texture', 'up', 'north', 'south', 'east', 'west', 'bottom', 'down']
  for (const key of preferredKeys) {
    const resolved = resolveTextureValue(textures, key)
    if (resolved) return [resolved]
  }

  const { assetPath } = splitAssetRef(modelRef)
  return [`minecraft:${assetPath}`]
}

export function renderItemArtSvg(itemId: string, label: string, textures: string[]) {
  const encodedLabel = escapeXml(label)
  const encodedId = escapeXml(`minecraft:${itemId}`)
  const layers = textures
    .map((texture, index) => `
      <image
        href="${texture}"
        x="18"
        y="18"
        width="92"
        height="92"
        preserveAspectRatio="xMidYMid meet"
        style="image-rendering: pixelated;"
        opacity="${index === textures.length - 1 ? '1' : '0.98'}"
      />`
    )
    .join('')

  return `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128">
      <defs>
        <radialGradient id="glow" cx="50%" cy="44%" r="65%">
          <stop offset="0%" stop-color="rgba(255,255,255,0.18)" />
          <stop offset="100%" stop-color="rgba(255,255,255,0)" />
        </radialGradient>
        <filter id="shadow" x="-20%" y="-20%" width="140%" height="160%">
          <feDropShadow dx="0" dy="7" stdDeviation="5" flood-color="rgba(0,0,0,0.35)" />
        </filter>
      </defs>
      <rect width="128" height="128" rx="30" fill="rgba(8,12,18,0.02)" />
      <ellipse cx="64" cy="97" rx="28" ry="11" fill="rgba(0,0,0,0.18)" />
      <rect x="10" y="10" width="108" height="108" rx="24" fill="url(#glow)" />
      <g filter="url(#shadow)">
        ${layers}
      </g>
      <title>${encodedLabel}</title>
      <desc>${encodedId}</desc>
    </svg>
  `.trim()
}

export async function getItemTextureLayers(version: string, itemId: string) {
  const artData = await getItemArtData(version, itemId)
  return artData.textures
}

export async function getItemArtData(version: string, itemId: string): Promise<ItemArtData> {
  const modelRef = await resolveItemModelRef(version, itemId)
  if (!modelRef) {
    return {
      modelRef: null,
      textures: [],
    }
  }

  const textures = await resolveModelTextures(version, modelRef)
  const refs = pickTextureRefs(modelRef, textures)
  const layers: string[] = []

  for (const ref of refs) {
    const entry = await readClientJarEntry(version, textureEntryPath(ref))
    if (entry) {
      layers.push(`data:image/png;base64,${entry.toString('base64')}`)
    }
  }

  return {
    modelRef,
    textures: Array.from(new Set(layers)),
  }
}

export async function getItemArtSvg(version: string, itemId: string, label: string) {
  const cachePath = getItemArtCachePath(version, itemId)
  try {
    return await fs.readFile(cachePath, 'utf8')
  } catch {
    const artData = await getItemArtData(version, itemId)
    if (artData.textures.length === 0) {
      throw new Error(`No official texture layers found for ${itemId} (${version})`)
    }
    const svg = renderItemArtSvg(itemId, label, artData.textures)
    await writeFileAtomic(cachePath, svg)
    return svg
  }
}
