import { promises as fs } from 'node:fs'
import { createHash } from 'node:crypto'
import { PNG } from 'pngjs'
import { listClientJarEntries, readClientJarEntry } from './client-jar'
import { getItemTextureLayers } from './item-art'
import { writeFileAtomic, ensureDir, getMinecraftAssetsRoot } from './cache'

const ENTITY_ART_RENDERER_VERSION = 'v3'

const ENTITY_TEXTURE_OVERRIDES: Record<string, string> = {
  horse: 'assets/minecraft/textures/entity/horse/horse_brown.png',
  donkey: 'assets/minecraft/textures/entity/horse/donkey.png',
  mule: 'assets/minecraft/textures/entity/horse/mule.png',
  llama: 'assets/minecraft/textures/entity/llama/llama_creamy.png',
  trader_llama: 'assets/minecraft/textures/entity/llama/trader_llama_creamy.png',
  wolf: 'assets/minecraft/textures/entity/wolf/wolf.png',
  cat: 'assets/minecraft/textures/entity/cat/tabby.png',
  fox: 'assets/minecraft/textures/entity/fox/fox.png',
  frog: 'assets/minecraft/textures/entity/frog/temperate_frog.png',
  parrot: 'assets/minecraft/textures/entity/parrot/parrot_red_blue.png',
  camel: 'assets/minecraft/textures/entity/camel/camel.png',
  panda: 'assets/minecraft/textures/entity/panda/panda.png',
  tropical_fish: 'assets/minecraft/textures/entity/fish/tropical_a_pattern_1.png',
  salmon: 'assets/minecraft/textures/entity/fish/salmon.png',
  cod: 'assets/minecraft/textures/entity/fish/cod.png',
  pufferfish: 'assets/minecraft/textures/entity/fish/pufferfish.png',
  mushroom_cow: 'assets/minecraft/textures/entity/cow/red_mooshroom.png',
  mooshroom: 'assets/minecraft/textures/entity/cow/red_mooshroom.png',
  fishing_bobber: 'assets/minecraft/textures/entity/fishing_hook.png',
}

const ENTITY_ITEM_TEXTURE_OVERRIDES: Record<string, string> = {
  arrow: 'arrow',
  spectral_arrow: 'spectral_arrow',
  trident: 'trident',
  experience_orb: 'experience_bottle',
  firework_rocket: 'firework_rocket',
  minecart: 'minecart',
  chest_minecart: 'chest_minecart',
  command_block_minecart: 'command_block_minecart',
  furnace_minecart: 'furnace_minecart',
  hopper_minecart: 'hopper_minecart',
  spawner_minecart: 'spawner',
  tnt_minecart: 'tnt_minecart',
  oak_boat: 'oak_boat',
  spruce_boat: 'spruce_boat',
  birch_boat: 'birch_boat',
  jungle_boat: 'jungle_boat',
  acacia_boat: 'acacia_boat',
  dark_oak_boat: 'dark_oak_boat',
  mangrove_boat: 'mangrove_boat',
  cherry_boat: 'cherry_boat',
  pale_oak_boat: 'pale_oak_boat',
  bamboo_raft: 'bamboo_raft',
  oak_chest_boat: 'oak_chest_boat',
  spruce_chest_boat: 'spruce_chest_boat',
  birch_chest_boat: 'birch_chest_boat',
  jungle_chest_boat: 'jungle_chest_boat',
  acacia_chest_boat: 'acacia_chest_boat',
  dark_oak_chest_boat: 'dark_oak_chest_boat',
  mangrove_chest_boat: 'mangrove_chest_boat',
  cherry_chest_boat: 'cherry_chest_boat',
  pale_oak_chest_boat: 'pale_oak_chest_boat',
  bamboo_chest_raft: 'bamboo_chest_raft',
  item_display: 'item_frame',
  text_display: 'name_tag',
  block_display: 'grass_block',
  interaction: 'tripwire_hook',
  item_frame: 'item_frame',
  glow_item_frame: 'glow_item_frame',
  painting: 'painting',
  armor_stand: 'armor_stand',
  leash_knot: 'lead',
  eye_of_ender: 'ender_eye',
  end_crystal: 'end_crystal',
  area_effect_cloud: 'lingering_potion',
  shulker_bullet: 'shulker_shell',
}

const ENTITY_UNDESIRABLE_MARKERS = ['/armor', '_armor', '_eyes', '_overlay', '_glow', '_shooting', '_exploding', '_powered', '_cold', '_warm', '_baby']

function safeSegment(value: string) {
  return value.replace(/[^a-zA-Z0-9._-]+/g, '_') || 'default'
}

function cacheRevision(sourceAsset?: string | null, cropOverride?: unknown) {
  const hash = createHash('sha1')
  hash.update(JSON.stringify({ sourceAsset: sourceAsset ?? null, cropOverride: cropOverride ?? null }))
  return hash.digest('hex').slice(0, 10)
}

function cachePath(version: string, entityId: string, sourceAsset?: string | null, cropOverride?: unknown) {
  return `${getMinecraftAssetsRoot()}/art/entities/${ENTITY_ART_RENDERER_VERSION}/${safeSegment(version)}/${safeSegment(entityId)}-${cacheRevision(sourceAsset, cropOverride)}.svg`
}

function escapeXml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;')
}

type CropBox = {
  x: number
  y: number
  width: number
  height: number
}

function normalizeCropBox(value: unknown, width: number, height: number): CropBox | null {
  if (!value || typeof value !== 'object') return null
  const row = value as Record<string, unknown>
  const x = Number(row.x)
  const y = Number(row.y)
  const boxWidth = Number(row.width)
  const boxHeight = Number(row.height)
  if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(boxWidth) || !Number.isFinite(boxHeight)) return null
  return clampBox({ x, y, width: boxWidth, height: boxHeight }, width, height)
}

function defaultSheetCrop(textureWidth: number, textureHeight: number): CropBox {
  const width = Math.max(8, Math.round(textureWidth * 0.4))
  const height = Math.max(8, Math.round(textureHeight * 0.42))
  return clampBox({
    x: Math.round(textureWidth * 0.04),
    y: Math.round(textureHeight * 0.04),
    width,
    height,
  }, textureWidth, textureHeight)
}

function buildIntegralMask(png: PNG) {
  const { width, height, data } = png
  const integral = new Uint32Array((width + 1) * (height + 1))
  for (let y = 0; y < height; y += 1) {
    let row = 0
    for (let x = 0; x < width; x += 1) {
      const alpha = data[(y * width + x) * 4 + 3]
      const opaque = alpha > 12 ? 1 : 0
      row += opaque
      integral[(y + 1) * (width + 1) + (x + 1)] = integral[y * (width + 1) + (x + 1)] + row
    }
  }
  return integral
}

function windowSum(integral: Uint32Array, width: number, x: number, y: number, w: number, h: number) {
  const stride = width + 1
  const x2 = x + w
  const y2 = y + h
  return integral[y2 * stride + x2] - integral[y * stride + x2] - integral[y2 * stride + x] + integral[y * stride + x]
}

function clampBox(box: CropBox, width: number, height: number): CropBox {
  const x = Math.max(0, Math.min(width - 1, box.x))
  const y = Math.max(0, Math.min(height - 1, box.y))
  const w = Math.max(1, Math.min(width - x, box.width))
  const h = Math.max(1, Math.min(height - y, box.height))
  return { x, y, width: w, height: h }
}

function detectPortraitCrop(pngBuffer: Buffer): CropBox | null {
  const png = PNG.sync.read(pngBuffer)
  const { width, height } = png
  if (!width || !height) return null

  const integral = buildIntegralMask(png)
  const totalOpaque = windowSum(integral, width, 0, 0, width, height)
  if (totalOpaque === 0) return null

  const candidateSizes: Array<[number, number]> = [
    [0.22, 0.24],
    [0.28, 0.28],
    [0.34, 0.32],
    [0.42, 0.36],
  ]

  const maxY = Math.max(0, Math.floor(height * 0.7))
  const stepX = Math.max(1, Math.floor(width / 28))
  const stepY = Math.max(1, Math.floor(height / 28))
  let best: { box: CropBox; score: number } | null = null

  for (const [wRatio, hRatio] of candidateSizes) {
    const candidateWidth = Math.max(4, Math.round(width * wRatio))
    const candidateHeight = Math.max(4, Math.round(height * hRatio))
    const yLimit = Math.max(0, Math.min(height - candidateHeight, maxY))
    for (let y = 0; y <= yLimit; y += stepY) {
      for (let x = 0; x <= width - candidateWidth; x += stepX) {
        const opaque = windowSum(integral, width, x, y, candidateWidth, candidateHeight)
        if (opaque === 0) continue
        const density = opaque / (candidateWidth * candidateHeight)
        const coverage = opaque / totalOpaque
        const centerX = x + (candidateWidth / 2)
        const centerY = y + (candidateHeight / 2)
        const centerPenalty = Math.abs(centerX - width * 0.28) / width + Math.abs(centerY - height * 0.24) / height
        const score = (density * 0.62) + (coverage * 0.42) - (centerPenalty * 0.12)
        if (!best || score > best.score) {
          best = {
            box: { x, y, width: candidateWidth, height: candidateHeight },
            score,
          }
        }
      }
    }
  }

  if (!best) return defaultSheetCrop(width, height)

  const paddingX = Math.max(2, Math.round(best.box.width * 0.22))
  const paddingY = Math.max(2, Math.round(best.box.height * 0.24))
  return clampBox({
    x: best.box.x - paddingX,
    y: best.box.y - paddingY,
    width: best.box.width + (paddingX * 2),
    height: best.box.height + (paddingY * 2),
  }, width, height)
}

function buildTechnicalEntitySvg(label: string, entityId: string, symbol: string) {
  const encodedLabel = escapeXml(label)
  const encodedId = escapeXml(entityId)
  return `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128">
      <defs>
        <linearGradient id="tech" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0%" stop-color="#182033" />
          <stop offset="100%" stop-color="#334667" />
        </linearGradient>
      </defs>
      <rect width="128" height="128" rx="30" fill="url(#tech)" />
      <rect x="12" y="12" width="104" height="104" rx="24" fill="rgba(255,255,255,0.04)" stroke="rgba(255,255,255,0.12)" />
      <rect x="26" y="26" width="76" height="76" rx="20" fill="rgba(0,0,0,0.18)" />
      <text x="64" y="72" text-anchor="middle" font-size="32" fill="#f4f7ff" font-family="monospace">${escapeXml(symbol)}</text>
      <title>${encodedLabel}</title>
      <desc>${encodedId}</desc>
    </svg>
  `.trim()
}

function technicalEntitySymbol(entityId: string) {
  if (entityId.includes('display')) return '[]'
  if (entityId.includes('boat') || entityId.includes('raft')) return '~'
  if (entityId.includes('minecart')) return '::'
  if (entityId.includes('arrow') || entityId.includes('trident')) return '->'
  if (entityId.includes('bobber') || entityId.includes('hook')) return 'o-'
  return '::'
}

function rankTextureCandidate(candidate: string) {
  let score = candidate.length
  for (const marker of ENTITY_UNDESIRABLE_MARKERS) {
    if (candidate.includes(marker)) score += 100
  }
  if (candidate.endsWith('/default.png')) score += 20
  return score
}

async function resolveEntityTexturePath(version: string, entityId: string) {
  const overridden = ENTITY_TEXTURE_OVERRIDES[entityId]
  if (overridden) return overridden

  const all = await listClientJarEntries(version, 'assets/minecraft/textures/entity/')
  const basename = `${entityId}.png`
  const exact = all.filter(entry => entry.endsWith(`/${basename}`))
  if (exact.length > 0) {
    return exact.sort((left, right) => rankTextureCandidate(left) - rankTextureCandidate(right))[0]
  }

  const fuzzy = all.filter(entry => entry.includes(`/${entityId}`) || entry.includes(`_${entityId}`))
  if (fuzzy.length > 0) {
    return fuzzy.sort((left, right) => rankTextureCandidate(left) - rankTextureCandidate(right))[0]
  }

  const spawnEggPath = `assets/minecraft/textures/item/${entityId}_spawn_egg.png`
  const spawnEgg = await readClientJarEntry(version, spawnEggPath)
  if (spawnEgg) return spawnEggPath

  return null
}

async function resolveEntityTextureData(version: string, entityId: string, sourceAsset?: string | null) {
  if (sourceAsset?.startsWith('icon:')) {
    const raw = await readClientJarEntry(version, sourceAsset.replace(/^icon:/, ''))
    if (raw) {
      return {
        mode: 'icon',
        raw,
      } as const
    }
  }

  if (sourceAsset?.startsWith('item:')) {
    const layers = await getItemTextureLayers(version, sourceAsset.replace(/^item:/, ''))
    if (layers.length > 0) {
      return {
        mode: 'icon',
        dataUri: layers[0],
      } as const
    }
  }

  if (sourceAsset?.startsWith('assets/')) {
    const raw = await readClientJarEntry(version, sourceAsset)
    if (raw) {
      return {
        mode: sourceAsset.includes('/textures/item/') ? 'icon' : 'sheet',
        raw,
      } as const
    }
  }

  const directPath = await resolveEntityTexturePath(version, entityId)
  if (directPath) {
    const raw = await readClientJarEntry(version, directPath)
    if (raw) {
      return {
        mode: directPath.includes('/textures/item/') ? 'icon' : 'sheet',
        raw,
      } as const
    }
  }

  const itemId = ENTITY_ITEM_TEXTURE_OVERRIDES[entityId]
  if (itemId) {
    const layers = await getItemTextureLayers(version, itemId)
    if (layers.length > 0) {
      return {
        mode: 'icon',
        dataUri: layers[0],
      } as const
    }
  }

  return null
}

function buildEntitySvg(label: string, entityId: string, textureDataUri: string, mode: 'sheet' | 'icon', crop: CropBox | null, textureWidth: number, textureHeight: number) {
  const encodedLabel = escapeXml(label)
  const encodedId = escapeXml(entityId)
  if (mode === 'icon') {
    return `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128">
        <defs>
          <radialGradient id="bg" cx="50%" cy="42%" r="70%">
            <stop offset="0%" stop-color="rgba(255,255,255,0.18)"/>
            <stop offset="100%" stop-color="rgba(255,255,255,0)"/>
          </radialGradient>
        </defs>
        <rect width="128" height="128" rx="30" fill="rgba(8,12,18,0.02)" />
        <ellipse cx="64" cy="98" rx="24" ry="10" fill="rgba(0,0,0,0.18)" />
        <rect x="18" y="14" width="92" height="100" rx="26" fill="url(#bg)" />
        <image href="${textureDataUri}" x="24" y="16" width="80" height="96" preserveAspectRatio="xMidYMid meet" style="image-rendering: pixelated;" />
        <title>${encodedLabel}</title>
        <desc>${encodedId}</desc>
      </svg>
    `.trim()
  }

  const viewportX = 18
  const viewportY = 16
  const viewportWidth = 92
  const viewportHeight = 88
  const safeCrop = crop ?? { x: 0, y: 0, width: textureWidth, height: textureHeight }
  const scale = Math.max(viewportWidth / safeCrop.width, viewportHeight / safeCrop.height)
  const imageX = viewportX - (safeCrop.x * scale)
  const imageY = viewportY - (safeCrop.y * scale)
  const imageWidth = textureWidth * scale
  const imageHeight = textureHeight * scale

  return `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128">
      <defs>
        <linearGradient id="panel" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0%" stop-color="rgba(255,255,255,0.16)" />
          <stop offset="100%" stop-color="rgba(255,255,255,0.04)" />
        </linearGradient>
        <radialGradient id="shine" cx="50%" cy="18%" r="70%">
          <stop offset="0%" stop-color="rgba(255,255,255,0.18)" />
          <stop offset="100%" stop-color="rgba(255,255,255,0)" />
        </radialGradient>
      </defs>
      <rect width="128" height="128" rx="30" fill="rgba(8,12,18,0.02)" />
      <rect x="12" y="12" width="104" height="104" rx="24" fill="url(#panel)" />
      <ellipse cx="64" cy="101" rx="30" ry="10" fill="rgba(0,0,0,0.18)" />
      <clipPath id="card-window">
        <rect x="18" y="16" width="92" height="88" rx="20" />
      </clipPath>
      <g clip-path="url(#card-window)">
        <rect x="18" y="16" width="92" height="88" fill="url(#shine)" />
        <image href="${textureDataUri}" x="${imageX}" y="${imageY}" width="${imageWidth}" height="${imageHeight}" preserveAspectRatio="none" style="image-rendering: pixelated;" />
      </g>
      <title>${encodedLabel}</title>
      <desc>${encodedId}</desc>
    </svg>
  `.trim()
}

export async function getEntityArtSvg(version: string, entityId: string, label: string, sourceAsset?: string | null, cropOverride?: unknown) {
  const filePath = cachePath(version, entityId, sourceAsset, cropOverride)
  try {
    return await fs.readFile(filePath, 'utf8')
  } catch {
    if (sourceAsset?.startsWith('symbol:')) {
      const svg = buildTechnicalEntitySvg(label, entityId, sourceAsset.replace(/^symbol:/, '') || technicalEntitySymbol(entityId))
      await ensureDir(filePath.substring(0, filePath.lastIndexOf('/')))
      await writeFileAtomic(filePath, svg)
      return svg
    }
    const resolved = await resolveEntityTextureData(version, entityId, sourceAsset)
    const svg = (() => {
      if (!resolved) {
        return buildTechnicalEntitySvg(label, entityId, technicalEntitySymbol(entityId))
      }
      if (resolved.mode === 'icon') {
        if ('raw' in resolved && resolved.raw) {
          const png = PNG.sync.read(resolved.raw)
          return buildEntitySvg(label, entityId, `data:image/png;base64,${resolved.raw.toString('base64')}`, 'icon', null, png.width, png.height)
        }
        return buildEntitySvg(label, entityId, resolved.dataUri, 'icon', null, 16, 16)
      }
      const png = PNG.sync.read(resolved.raw)
      const crop = normalizeCropBox(cropOverride, png.width, png.height)
        ?? detectPortraitCrop(resolved.raw)
        ?? defaultSheetCrop(png.width, png.height)
      return buildEntitySvg(label, entityId, `data:image/png;base64,${resolved.raw.toString('base64')}`, 'sheet', crop, png.width, png.height)
    })()
    await ensureDir(filePath.substring(0, filePath.lastIndexOf('/')))
    await writeFileAtomic(filePath, svg)
    return svg
  }
}
