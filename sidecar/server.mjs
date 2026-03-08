import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { gunzipSync } from 'node:zlib'
import { URL } from 'node:url'

const PORT = parseInt(process.env.MCRAFTR_SIDECAR_PORT || '9419', 10)
const HOST = process.env.MCRAFTR_SIDECAR_HOST || '0.0.0.0'
const AUTH_TOKEN = process.env.MCRAFTR_SIDECAR_TOKEN || ''
const PLUGINS_DIR = process.env.MCRAFTR_PLUGINS_DIR || '/data/plugins'
const WORLDS_DIR = process.env.MCRAFTR_WORLDS_DIR || '/data'
const SCHEMATICS_DIRS = resolveSchematicDirs(process.env.MCRAFTR_SCHEMATICS_DIR)
const ENTITY_PRESET_DIRS = resolveEntityPresetDirs(process.env.MCRAFTR_ENTITY_PRESET_DIR)
const BLUEMAP_BASE_URL = (process.env.MCRAFTR_BLUEMAP_URL || '').trim().replace(/\/+$/, '')
const DYNMAP_BASE_URL = (process.env.MCRAFTR_DYNMAP_URL || '').trim().replace(/\/+$/, '')
const CACHE_DIR = '/tmp/mcraftr-sidecar'

const BUILTIN_CAPABILITIES = [
  'health',
  'plugin-stack',
  'worlds',
  'maps',
  'schematics',
  'structures',
  'structure-upload',
  'entities',
  'entity-upload',
  'entity-delete',
  'clone-world',
]

let nativeStructureCache = {
  key: '',
  jarPath: '',
  templates: [],
  worldgen: [],
}

function sendJson(res, status, payload) {
  const body = JSON.stringify(payload)
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
  })
  res.end(body)
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let raw = ''
    req.setEncoding('utf8')
    req.on('data', chunk => { raw += chunk })
    req.on('end', () => {
      if (!raw.trim()) {
        resolve({})
        return
      }
      try {
        resolve(JSON.parse(raw))
      } catch (error) {
        reject(error)
      }
    })
    req.on('error', reject)
  })
}

function isDirectory(entryPath) {
  try {
    return fs.statSync(entryPath).isDirectory()
  } catch {
    return false
  }
}

function safeJoin(root, name) {
  const full = path.resolve(root, name)
  if (!full.startsWith(path.resolve(root) + path.sep) && full !== path.resolve(root)) {
    throw new Error('Invalid path')
  }
  return full
}

function resolveSchematicDirs(raw) {
  const fallback = [
    '/data/plugins/FastAsyncWorldEdit/schematics',
    '/data/plugins/WorldEdit/schematics',
  ]
  const values = (raw || '')
    .split(/[,:]/)
    .map(value => value.trim())
    .filter(Boolean)
  return Array.from(new Set((values.length > 0 ? values : fallback).map(value => path.resolve(value))))
}

function resolveEntityPresetDirs(raw) {
  const fallback = ['/data/mcraftr/entity-presets']
  const values = (raw || '')
    .split(/[,:]/)
    .map(value => value.trim())
    .filter(Boolean)
  return Array.from(new Set((values.length > 0 ? values : fallback).map(value => path.resolve(value))))
}

function displayPath(value) {
  const absolute = path.resolve(value)
  const root = path.resolve(WORLDS_DIR)
  if (absolute === root) return '.'
  if (absolute.startsWith(root + path.sep)) return absolute.slice(root.length + 1)
  return absolute
}

function parseRootsHeader(req, headerName) {
  const raw = req.headers[headerName] || ''
  if (!raw || typeof raw !== 'string') return []
  try {
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return Array.from(new Set(parsed
      .filter(value => typeof value === 'string')
      .map(value => value.trim())
      .filter(Boolean)))
  } catch {
    return []
  }
}

function resolveLinkedRoots(req, headerName) {
  return parseRootsHeader(req, headerName)
    .filter(value => !path.isAbsolute(value))
    .map(value => {
      try {
        return {
          fullPath: safeJoin(WORLDS_DIR, value),
          display: value,
          rootKind: 'linked',
        }
      } catch {
        return null
      }
    })
    .filter(Boolean)
}

function mergeRoots(baseRoots, linkedRoots) {
  const merged = []
  const seen = new Set()
  for (const entry of [...baseRoots, ...linkedRoots]) {
    const key = path.resolve(entry.fullPath)
    if (seen.has(key)) continue
    seen.add(key)
    merged.push(entry)
  }
  return merged
}

function listPlugins() {
  if (!isDirectory(PLUGINS_DIR)) return []
  return fs.readdirSync(PLUGINS_DIR)
    .filter(name => name.toLowerCase().endsWith('.jar'))
    .sort((a, b) => a.localeCompare(b))
    .map(name => ({
      name: name.replace(/\.jar$/i, ''),
      version: extractVersion(name),
      filename: name,
      detectedFrom: PLUGINS_DIR,
    }))
}

function extractVersion(name) {
  const base = name.replace(/\.jar$/i, '')
  const match = base.match(/[-_](\d+(?:\.\d+)+(?:[-+][A-Za-z0-9.-]+)?)$/)
  return match ? match[1] : null
}

function directorySize(root) {
  try {
    const stat = fs.statSync(root)
    if (!stat.isDirectory()) return stat.size
    let total = 0
    for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
      const child = path.join(root, entry.name)
      total += entry.isDirectory() ? directorySize(child) : fs.statSync(child).size
    }
    return total
  } catch {
    return null
  }
}

function detectWorlds() {
  if (!isDirectory(WORLDS_DIR)) return []
  return fs.readdirSync(WORLDS_DIR, { withFileTypes: true })
    .filter(entry => entry.isDirectory())
    .map(entry => {
      const fullPath = path.join(WORLDS_DIR, entry.name)
      const hasLevelDat = fs.existsSync(path.join(fullPath, 'level.dat'))
      const hasRegion = isDirectory(path.join(fullPath, 'region'))
      if (!hasLevelDat && !hasRegion) return null
      return {
        name: entry.name,
        path: fullPath,
        sizeBytes: directorySize(fullPath),
        mapUrl: worldMapUrl(entry.name),
        hasBlueMap: !!BLUEMAP_BASE_URL,
        hasDynmap: !!DYNMAP_BASE_URL,
        source: fullPath,
      }
    })
    .filter(Boolean)
    .sort((a, b) => a.name.localeCompare(b.name))
}

function worldMapUrl(worldName) {
  if (BLUEMAP_BASE_URL) return `${BLUEMAP_BASE_URL}/#world:${encodeURIComponent(worldName)}`
  if (DYNMAP_BASE_URL) return `${DYNMAP_BASE_URL}/?worldname=${encodeURIComponent(worldName)}`
  return null
}

function listMaps() {
  const worlds = detectWorlds()
  const maps = []
  if (BLUEMAP_BASE_URL) {
    for (const world of worlds) {
      maps.push({
        type: 'bluemap',
        world: world.name,
        label: `${world.name} BlueMap`,
        url: `${BLUEMAP_BASE_URL}/#world:${encodeURIComponent(world.name)}`,
      })
    }
  }
  if (DYNMAP_BASE_URL) {
    for (const world of worlds) {
      maps.push({
        type: 'dynmap',
        world: world.name,
        label: `${world.name} Dynmap`,
        url: `${DYNMAP_BASE_URL}/?worldname=${encodeURIComponent(world.name)}`,
      })
    }
  }
  return maps
}

function slugify(value) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'catalog-entry'
}

function labelize(value) {
  return value
    .replace(/\.(schem|schematic|json)$/i, '')
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, char => char.toUpperCase())
}

function titleizePath(value) {
  return value
    .split('/')
    .filter(Boolean)
    .map(part => labelize(part))
    .join(' / ')
}

function structureCategory(relativePath, placementKind) {
  const parts = relativePath.split('/').filter(Boolean)
  if (placementKind === 'native-worldgen') return parts[0] ? labelize(parts[0]) : 'Vanilla Worldgen'
  if (placementKind === 'native-template') return parts[0] ? labelize(parts[0]) : 'Vanilla Templates'
  if (parts[0] === 'uploads') return 'Uploads'
  if (parts.length > 1) return labelize(parts[0])
  return 'Server Library'
}

function structureSourceKind(relativePath, rootKind) {
  const parts = relativePath.split('/').filter(Boolean)
  if (parts[0] === 'uploads') return 'upload'
  if (rootKind === 'linked') return 'linked'
  return 'server'
}

function listStructureFiles(root, rootKind, current = '') {
  if (!isDirectory(root)) return []
  const entries = []
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    if (entry.name.startsWith('.')) continue
    const fullPath = path.join(root, entry.name)
    const relative = current ? `${current}/${entry.name}` : entry.name
    if (entry.isDirectory()) {
      entries.push(...listStructureFiles(fullPath, rootKind, relative))
      continue
    }
    if (!/\.(schem|schematic)$/i.test(entry.name)) continue
    let stat = null
    try {
      stat = fs.statSync(fullPath)
    } catch {}
    entries.push({
      id: `schematic:${displayPath(root)}:${relative}`.toLowerCase(),
      label: labelize(entry.name),
      category: structureCategory(relative, 'schematic'),
      sourceKind: structureSourceKind(relative, rootKind),
      placementKind: 'schematic',
      bridgeRef: encodeURIComponent(relative),
      resourceKey: null,
      relativePath: relative,
      format: entry.name.toLowerCase().endsWith('.schematic') ? 'schematic' : 'schem',
      sizeBytes: stat?.size ?? null,
      updatedAt: stat ? Math.floor(stat.mtimeMs / 1000) : null,
      imageUrl: null,
      summary: `${labelize(entry.name)} ready for structure placement.`,
      dimensions: null,
      removable: true,
      editable: entry.name.startsWith('uploads/') || relative.startsWith('uploads/'),
    })
  }
  return entries
}

function scanFileStructures(req) {
  const baseRoots = SCHEMATICS_DIRS.map(fullPath => ({ fullPath, display: displayPath(fullPath), rootKind: 'default' }))
  const linkedRoots = resolveLinkedRoots(req, 'x-mcraftr-structure-roots')
  const roots = mergeRoots(baseRoots, linkedRoots)
  const structures = []
  const seen = new Set()
  const rootScan = []
  for (const root of roots) {
    const exists = isDirectory(root.fullPath)
    const entries = exists ? listStructureFiles(root.fullPath, root.rootKind) : []
    rootScan.push({
      path: root.display,
      exists,
      structureCount: entries.length,
      rootKind: root.rootKind,
    })
    for (const entry of entries) {
      const key = `${entry.sourceKind}:${entry.relativePath}`
      if (seen.has(key)) continue
      seen.add(key)
      structures.push(entry)
    }
  }
  structures.sort((a, b) => a.label.localeCompare(b.label))
  return {
    roots: rootScan,
    structures,
    totalStructures: structures.length,
    uploadRoot: displayPath(path.join(SCHEMATICS_DIRS[0] || '/data/plugins/WorldEdit/schematics', 'uploads')),
  }
}

function findLatestMojangJar() {
  const cacheDir = path.join(WORLDS_DIR, 'cache')
  if (!isDirectory(cacheDir)) return null
  const jars = fs.readdirSync(cacheDir)
    .filter(name => /^mojang_.*\.jar$/i.test(name))
    .map(name => {
      const fullPath = path.join(cacheDir, name)
      try {
        const stat = fs.statSync(fullPath)
        return { name, fullPath, mtimeMs: stat.mtimeMs }
      } catch {
        return null
      }
    })
    .filter(Boolean)
    .sort((a, b) => b.mtimeMs - a.mtimeMs)
  return jars[0] ?? null
}

function listZipEntries(zipPath) {
  return execFileSync('unzip', ['-Z1', zipPath], { encoding: 'utf8' })
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean)
}

function ensureBundledServerJar() {
  const latest = findLatestMojangJar()
  if (!latest) return null
  const key = `${latest.fullPath}:${latest.mtimeMs}`
  const outputDir = path.join(CACHE_DIR)
  if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true })
  const outerEntries = listZipEntries(latest.fullPath)
  const nestedServerJar = outerEntries.find(entry => /^META-INF\/versions\/[^/]+\/server-[^/]+\.jar$/.test(entry))
  const jarPath = nestedServerJar
    ? path.join(outputDir, `vanilla-server-${path.basename(latest.name, '.jar')}.jar`)
    : latest.fullPath
  if (nestedServerJar) {
    if (!fs.existsSync(jarPath) || fs.statSync(jarPath).size === 0) {
      const raw = execFileSync('unzip', ['-p', latest.fullPath, nestedServerJar], { encoding: 'buffer' })
      fs.writeFileSync(jarPath, raw)
    }
  }
  return { key, jarPath }
}

function buildNativeStructureCatalog() {
  const bundled = ensureBundledServerJar()
  if (!bundled) {
    return { templates: [], worldgen: [], jarPath: '' }
  }
  if (nativeStructureCache.key === bundled.key && nativeStructureCache.jarPath === bundled.jarPath) {
    return nativeStructureCache
  }
  const entries = listZipEntries(bundled.jarPath)
  const worldgen = entries
    .filter(entry => entry.startsWith('data/minecraft/worldgen/structure/') && entry.endsWith('.json'))
    .map(entry => {
      const resourceKey = entry
        .replace(/^data\/minecraft\/worldgen\/structure\//, '')
        .replace(/\.json$/i, '')
      return {
        id: `native-worldgen:${resourceKey}`,
        label: labelize(resourceKey.split('/').at(-1) || resourceKey),
        category: structureCategory(resourceKey, 'native-worldgen'),
        sourceKind: 'native',
        placementKind: 'native-worldgen',
        bridgeRef: resourceKey,
        resourceKey,
        relativePath: null,
        format: 'native',
        sizeBytes: null,
        updatedAt: null,
        imageUrl: null,
        summary: `Vanilla worldgen structure ${titleizePath(resourceKey)}.`,
        dimensions: null,
        removable: false,
        editable: false,
      }
    })
    .sort((a, b) => a.label.localeCompare(b.label))
  const templates = entries
    .filter(entry => entry.startsWith('data/minecraft/structure/') && entry.endsWith('.nbt'))
    .map(entry => {
      const resourceKey = entry
        .replace(/^data\/minecraft\/structure\//, '')
        .replace(/\.nbt$/i, '')
      return {
        id: `native-template:${resourceKey}`,
        label: labelize(resourceKey.split('/').at(-1) || resourceKey),
        category: structureCategory(resourceKey, 'native-template'),
        sourceKind: 'native',
        placementKind: 'native-template',
        bridgeRef: resourceKey,
        resourceKey,
        relativePath: null,
        format: 'native',
        sizeBytes: null,
        updatedAt: null,
        imageUrl: null,
        summary: `Vanilla template ${titleizePath(resourceKey)}.`,
        dimensions: null,
        removable: true,
        editable: false,
      }
    })
    .sort((a, b) => a.label.localeCompare(b.label))
  nativeStructureCache = {
    key: bundled.key,
    jarPath: bundled.jarPath,
    templates,
    worldgen,
  }
  return nativeStructureCache
}

function readNbtString(buffer, offset) {
  const length = buffer.readUInt16BE(offset)
  const nextOffset = offset + 2
  return [buffer.toString('utf8', nextOffset, nextOffset + length), nextOffset + length]
}

function skipNbtPayload(buffer, type, offset) {
  switch (type) {
    case 1: return offset + 1
    case 2: return offset + 2
    case 3: return offset + 4
    case 4: return offset + 8
    case 5: return offset + 4
    case 6: return offset + 8
    case 7: return offset + 4 + buffer.readInt32BE(offset)
    case 8: return offset + 2 + buffer.readUInt16BE(offset)
    case 9: {
      const childType = buffer[offset]
      const length = buffer.readInt32BE(offset + 1)
      let next = offset + 5
      for (let i = 0; i < length; i += 1) next = skipNbtPayload(buffer, childType, next)
      return next
    }
    case 10: {
      let next = offset
      while (true) {
        const childType = buffer[next]
        next += 1
        if (childType === 0) return next
        const [, afterName] = readNbtString(buffer, next)
        next = skipNbtPayload(buffer, childType, afterName)
      }
    }
    case 11: {
      const length = buffer.readInt32BE(offset)
      return offset + 4 + (length * 4)
    }
    case 12: {
      const length = buffer.readInt32BE(offset)
      return offset + 4 + (length * 8)
    }
    default:
      throw new Error(`Unsupported NBT tag ${type}`)
  }
}

function readStructureTemplateSize(resourceKey) {
  const native = buildNativeStructureCatalog()
  if (!native.jarPath) return null
  const entryName = `data/minecraft/structure/${resourceKey}.nbt`
  const raw = execFileSync('unzip', ['-p', native.jarPath, entryName], { encoding: 'buffer' })
  const data = gunzipSync(raw)
  let offset = 0
  if (data[offset] !== 10) throw new Error('Invalid NBT root')
  offset += 1
  const [, afterRootName] = readNbtString(data, offset)
  offset = afterRootName
  while (offset < data.length) {
    const type = data[offset]
    offset += 1
    if (type === 0) break
    const [name, afterName] = readNbtString(data, offset)
    offset = afterName
    if (name === 'size' && type === 9) {
      const childType = data[offset]
      const length = data.readInt32BE(offset + 1)
      if (childType !== 3 || length < 3) return null
      return {
        width: data.readInt32BE(offset + 5),
        height: data.readInt32BE(offset + 9),
        length: data.readInt32BE(offset + 13),
      }
    }
    offset = skipNbtPayload(data, type, offset)
  }
  return null
}

function scanStructures(req) {
  const native = buildNativeStructureCatalog()
  const fileScan = scanFileStructures(req)
  const structures = [
    ...native.templates,
    ...native.worldgen,
    ...fileScan.structures,
  ]
  structures.sort((a, b) => a.label.localeCompare(b.label))
  return {
    roots: fileScan.roots,
    structures,
    totalStructures: structures.length,
    uploadRoot: fileScan.uploadRoot,
    nativeCounts: {
      templates: native.templates.length,
      worldgen: native.worldgen.length,
    },
  }
}

function listSchematics(req) {
  return scanFileStructures(req).structures.map(entry => ({
    name: entry.bridgeRef,
    path: entry.relativePath,
    sizeBytes: entry.sizeBytes,
    updatedAt: entry.updatedAt,
  }))
}

function derivePresetId(relativePath, explicitId) {
  if (typeof explicitId === 'string' && explicitId.trim()) return slugify(explicitId)
  return slugify(path.basename(relativePath, path.extname(relativePath)))
}

function normalizeEntityPreset(raw, relativePath, sourceKind) {
  if (!raw || typeof raw !== 'object') return null
  const entityId = typeof raw.entityId === 'string' && raw.entityId.trim() ? raw.entityId.trim() : ''
  if (!entityId) return null
  const id = derivePresetId(relativePath, raw.id)
  const label = typeof raw.label === 'string' && raw.label.trim() ? raw.label.trim() : labelize(id)
  const category = typeof raw.category === 'string' && raw.category.trim() ? raw.category.trim().toLowerCase() : 'custom'
  const summary = typeof raw.summary === 'string' && raw.summary.trim()
    ? raw.summary.trim()
    : `${label} preset ready for spawning.`
  return {
    id: `preset:${id}`,
    presetId: id,
    entityId,
    label,
    category,
    dangerous: raw.dangerous === true,
    summary,
    imageUrl: null,
    sourceKind,
    editable: sourceKind === 'upload',
    defaultCount: Number.isFinite(Number(raw.defaultCount)) ? Math.max(1, Math.min(64, Math.floor(Number(raw.defaultCount)))) : 1,
    relativePath,
    customName: typeof raw.customName === 'string' ? raw.customName.trim() || null : null,
    health: Number.isFinite(Number(raw.health)) ? Number(raw.health) : null,
    persistenceRequired: raw.persistenceRequired === true,
    noAi: raw.noAi === true,
    silent: raw.silent === true,
    glowing: raw.glowing === true,
    invulnerable: raw.invulnerable === true,
    noGravity: raw.noGravity === true,
    advancedNbt: typeof raw.advancedNbt === 'string' && raw.advancedNbt.trim() ? raw.advancedNbt.trim() : null,
  }
}

function listJsonFiles(root, current = '') {
  if (!isDirectory(root)) return []
  const entries = []
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    if (entry.name.startsWith('.')) continue
    const fullPath = path.join(root, entry.name)
    const relative = current ? `${current}/${entry.name}` : entry.name
    if (entry.isDirectory()) {
      entries.push(...listJsonFiles(fullPath, relative))
      continue
    }
    if (!/\.json$/i.test(entry.name)) continue
    entries.push({ fullPath, relative })
  }
  return entries
}

function scanEntityPresets(req) {
  const baseRoots = ENTITY_PRESET_DIRS.map(fullPath => ({ fullPath, display: displayPath(fullPath), rootKind: 'default' }))
  const linkedRoots = resolveLinkedRoots(req, 'x-mcraftr-entity-roots')
  const roots = mergeRoots(baseRoots, linkedRoots)
  const entities = []
  const seen = new Set()
  const warnings = []
  const rootScan = []
  for (const root of roots) {
    const exists = isDirectory(root.fullPath)
    const files = exists ? listJsonFiles(root.fullPath) : []
    let presetCount = 0
    for (const file of files) {
      try {
        const raw = JSON.parse(fs.readFileSync(file.fullPath, 'utf8'))
        const sourceKind = file.relative.startsWith('uploads/') ? 'upload' : root.rootKind === 'linked' ? 'linked' : 'server'
        const preset = normalizeEntityPreset(raw, file.relative, sourceKind)
        if (!preset) {
          warnings.push(`Skipped invalid preset: ${displayPath(path.join(root.fullPath, file.relative))}`)
          continue
        }
        const key = `${preset.sourceKind}:${preset.presetId}`
        if (seen.has(key)) continue
        seen.add(key)
        entities.push(preset)
        presetCount += 1
      } catch {
        warnings.push(`Skipped unreadable preset: ${displayPath(path.join(root.fullPath, file.relative))}`)
      }
    }
    rootScan.push({
      path: root.display,
      exists,
      presetCount,
      rootKind: root.rootKind,
    })
  }
  entities.sort((a, b) => a.label.localeCompare(b.label))
  return {
    roots: rootScan,
    entities,
    totalPresets: entities.length,
    uploadRoot: displayPath(path.join(ENTITY_PRESET_DIRS[0] || '/data/mcraftr/entity-presets', 'uploads')),
    warnings,
  }
}

async function saveUploadedStructure(name, dataBase64) {
  if (!name || typeof name !== 'string') throw new Error('File name is required')
  if (!dataBase64 || typeof dataBase64 !== 'string') throw new Error('Structure data is required')
  if (!/\.(schem|schematic)$/i.test(name)) throw new Error('Only .schem or .schematic files are supported')
  const uploadRoot = SCHEMATICS_DIRS[0] || '/data/plugins/WorldEdit/schematics'
  const uploadDir = path.join(uploadRoot, 'uploads')
  await fs.promises.mkdir(uploadDir, { recursive: true })
  const safeName = `${slugify(name.replace(/\.(schem|schematic)$/i, ''))}${path.extname(name).toLowerCase()}`
  const destination = path.join(uploadDir, safeName)
  const raw = dataBase64.includes(',') ? dataBase64.slice(dataBase64.indexOf(',') + 1) : dataBase64
  await fs.promises.writeFile(destination, Buffer.from(raw, 'base64'))
  return destination
}

async function saveEntityPreset(body) {
  const rawPreset = body?.preset
  if (!rawPreset || typeof rawPreset !== 'object') throw new Error('Preset data is required')
  const uploadRoot = ENTITY_PRESET_DIRS[0] || '/data/mcraftr/entity-presets'
  const uploadDir = path.join(uploadRoot, 'uploads')
  await fs.promises.mkdir(uploadDir, { recursive: true })
  const preset = normalizeEntityPreset(rawPreset, 'uploads/preset.json', 'upload')
  if (!preset) throw new Error('Preset must include an entityId')
  const safeName = `${slugify(body?.name || preset.id)}.json`
  const relativePath = `uploads/${safeName}`
  const destination = path.join(uploadDir, safeName)
  const toWrite = {
    id: preset.presetId,
    label: preset.label,
    entityId: preset.entityId,
    category: preset.category,
    summary: preset.summary,
    dangerous: preset.dangerous,
    defaultCount: preset.defaultCount,
    customName: preset.customName,
    health: preset.health,
    persistenceRequired: preset.persistenceRequired,
    noAi: preset.noAi,
    silent: preset.silent,
    glowing: preset.glowing,
    invulnerable: preset.invulnerable,
    noGravity: preset.noGravity,
    advancedNbt: preset.advancedNbt,
  }
  await fs.promises.writeFile(destination, `${JSON.stringify(toWrite, null, 2)}\n`)
  return {
    destination,
    relativePath,
    preset: normalizeEntityPreset(toWrite, relativePath, 'upload'),
  }
}

async function deleteEntityPreset(relativePath) {
  if (!relativePath || typeof relativePath !== 'string') throw new Error('Preset path is required')
  const normalized = relativePath.trim().replace(/\\/g, '/')
  if (!normalized.startsWith('uploads/') || !normalized.endsWith('.json')) {
    throw new Error('Only uploaded presets can be deleted')
  }
  const uploadRoot = ENTITY_PRESET_DIRS[0] || '/data/mcraftr/entity-presets'
  const target = safeJoin(uploadRoot, normalized)
  await fs.promises.unlink(target)
  return target
}

async function cloneWorld(worldName, cloneName) {
  const source = safeJoin(WORLDS_DIR, worldName)
  const destination = safeJoin(WORLDS_DIR, cloneName)
  if (!isDirectory(source)) throw new Error(`World does not exist: ${worldName}`)
  if (fs.existsSync(destination)) throw new Error(`Target already exists: ${cloneName}`)
  await fs.promises.cp(source, destination, { recursive: true, errorOnExist: true })
  return destination
}

function requireAuth(req, res) {
  if (!AUTH_TOKEN) return false
  const auth = req.headers.authorization || ''
  if (auth === `Bearer ${AUTH_TOKEN}`) return false
  sendJson(res, 401, { ok: false, error: 'Unauthorized' })
  return true
}

const server = http.createServer(async (req, res) => {
  try {
    if (requireAuth(req, res)) return

    const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`)
    const pathname = url.pathname.replace(/\/+$/, '') || '/'

    if (req.method === 'GET' && pathname === '/health') {
      sendJson(res, 200, { ok: true, capabilities: BUILTIN_CAPABILITIES })
      return
    }

    if (req.method === 'GET' && pathname === '/plugin-stack') {
      sendJson(res, 200, { ok: true, capabilities: BUILTIN_CAPABILITIES, plugins: listPlugins() })
      return
    }

    if (req.method === 'GET' && pathname === '/worlds') {
      sendJson(res, 200, { ok: true, capabilities: BUILTIN_CAPABILITIES, worlds: detectWorlds() })
      return
    }

    if (req.method === 'GET' && pathname === '/maps') {
      sendJson(res, 200, { ok: true, capabilities: BUILTIN_CAPABILITIES, maps: listMaps() })
      return
    }

    if (req.method === 'GET' && pathname === '/schematics') {
      const scan = scanFileStructures(req)
      sendJson(res, 200, {
        ok: true,
        capabilities: BUILTIN_CAPABILITIES,
        schematics: listSchematics(req),
        scan: {
          roots: scan.roots,
          totalStructures: scan.totalStructures,
          uploadRoot: scan.uploadRoot,
        },
      })
      return
    }

    if (req.method === 'GET' && pathname === '/structures') {
      const scan = scanStructures(req)
      sendJson(res, 200, {
        ok: true,
        capabilities: BUILTIN_CAPABILITIES,
        structures: scan.structures,
        scan: {
          roots: scan.roots,
          totalStructures: scan.totalStructures,
          uploadRoot: scan.uploadRoot,
          nativeCounts: scan.nativeCounts,
        },
      })
      return
    }

    if (req.method === 'GET' && pathname === '/structures/metadata') {
      const resourceKey = url.searchParams.get('resourceKey')?.trim() || ''
      if (!resourceKey) {
        sendJson(res, 400, { ok: false, error: 'resourceKey is required' })
        return
      }
      const dimensions = readStructureTemplateSize(resourceKey)
      sendJson(res, 200, { ok: true, resourceKey, dimensions })
      return
    }

    if (req.method === 'POST' && pathname === '/structures/upload') {
      const body = await readBody(req)
      const destination = await saveUploadedStructure(body.name, body.dataBase64)
      sendJson(res, 200, { ok: true, path: destination, structures: scanStructures(req).structures })
      return
    }

    if (req.method === 'GET' && pathname === '/entities') {
      const scan = scanEntityPresets(req)
      sendJson(res, 200, {
        ok: true,
        capabilities: BUILTIN_CAPABILITIES,
        entities: scan.entities,
        scan: {
          roots: scan.roots,
          totalPresets: scan.totalPresets,
          uploadRoot: scan.uploadRoot,
          warnings: scan.warnings,
        },
      })
      return
    }

    if (req.method === 'POST' && pathname === '/entities/upload') {
      const body = await readBody(req)
      const result = await saveEntityPreset(body)
      sendJson(res, 200, { ok: true, path: result.destination, relativePath: result.relativePath, preset: result.preset, entities: scanEntityPresets(req).entities })
      return
    }

    if (req.method === 'POST' && pathname === '/entities/delete') {
      const body = await readBody(req)
      const deletedPath = await deleteEntityPreset(body.relativePath)
      sendJson(res, 200, { ok: true, path: deletedPath, entities: scanEntityPresets(req).entities })
      return
    }

    const cloneMatch = pathname.match(/^\/worlds\/([^/]+)\/clone$/)
    if (req.method === 'POST' && cloneMatch) {
      const sourceName = decodeURIComponent(cloneMatch[1])
      const body = await readBody(req)
      const cloneName = typeof body.name === 'string' ? body.name.trim() : ''
      if (!cloneName) {
        sendJson(res, 400, { ok: false, error: 'Clone target name is required' })
        return
      }
      const destination = await cloneWorld(sourceName, cloneName)
      sendJson(res, 200, { ok: true, world: cloneName, path: destination })
      return
    }

    sendJson(res, 404, { ok: false, error: 'Not found' })
  } catch (error) {
    sendJson(res, 500, { ok: false, error: error instanceof Error ? error.message : 'Server error' })
  }
})

server.listen(PORT, HOST, () => {
  console.log(`[mcraftr-sidecar] listening on http://${HOST}:${PORT}`)
})
