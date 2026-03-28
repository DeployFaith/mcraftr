import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { gunzipSync } from 'node:zlib'
import { URL } from 'node:url'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const nbt = require('prismarine-nbt')

const PORT = parseInt(process.env.MCRAFTR_BEACON_PORT || process.env.MCRAFTR_SIDECAR_PORT || '9419', 10)
const HOST = process.env.MCRAFTR_BEACON_HOST || process.env.MCRAFTR_SIDECAR_HOST || '0.0.0.0'
const AUTH_TOKEN = process.env.MCRAFTR_BEACON_TOKEN || process.env.MCRAFTR_SIDECAR_TOKEN || ''
const PLUGINS_DIR = process.env.MCRAFTR_PLUGINS_DIR || '/data/plugins'
const WORLDS_DIR = process.env.MCRAFTR_WORLDS_DIR || '/data'
const SCHEMATICS_DIRS = resolveSchematicDirs(process.env.MCRAFTR_SCHEMATICS_DIR)
const ENTITY_PRESET_DIRS = resolveEntityPresetDirs(process.env.MCRAFTR_ENTITY_PRESET_DIR)
const BLUEMAP_BASE_URL = (process.env.MCRAFTR_BLUEMAP_URL || '').trim().replace(/\/+$/, '')
const DYNMAP_BASE_URL = (process.env.MCRAFTR_DYNMAP_URL || '').trim().replace(/\/+$/, '')
const APP_BASE_URL = (process.env.MCRAFTR_APP_BASE_URL || '').trim().replace(/\/+$/, '')
const ART_VERSION = (process.env.MCRAFTR_ART_VERSION || process.env.MCRAFTR_MINECRAFT_VERSION || '').trim()
const CACHE_DIR = '/tmp/mcraftr-beacon'
const MANAGED_INTEGRATIONS_FILE = '.mcraftr-managed.json'
const MANAGED_BACKUPS_DIR = '.mcraftr-backups'

const BUILTIN_CAPABILITIES = [
  'health',
  'plugin-stack',
  'worlds',
  'maps',
  'schematics',
  'structures',
  'structure-upload',
  'entities',
  'entity-art',
  'entity-upload',
  'entity-delete',
  'structure-art',
  'clone-world',
  'integrations',
  'integration-install',
  'integration-remove',
  'integration-repair',
]

const CURATED_PLUGIN_INTEGRATIONS = {
  luckperms: {
    id: 'luckperms',
    label: 'LuckPerms',
    pinnedVersion: '5.5.17',
    filename: 'LuckPerms-Bukkit-5.5.17.jar',
    downloadUrl: 'https://cdn.modrinth.com/data/Vebnzrzj/versions/OrIs0S6b/LuckPerms-Bukkit-5.5.17.jar',
    checksum: { algorithm: 'sha512', value: '773895644260b338818bfeff0c78f8d4f590f56b0f711c378a4eec91be6e8b37354099b5db1ea5b2dce4c02486213297a6da09675c9bf6f014f9a400b5772cf3' },
    detectNames: ['luckperms'],
    restartRequired: true,
  },
  worldedit: {
    id: 'worldedit',
    label: 'WorldEdit',
    pinnedVersion: '7.4.1',
    filename: 'worldedit-bukkit-7.4.1.jar',
    downloadUrl: 'https://cdn.modrinth.com/data/1u6JkXh5/versions/JUWRHdru/worldedit-bukkit-7.4.1.jar',
    checksum: { algorithm: 'sha512', value: '93407bede53159c7eb556547a448c42ed0bd2ab4564b1a4662839c76c359e13f284f6883756785c0a22df1cec526ef837d189a8af9204d2e99db75dc62b3a333' },
    detectNames: ['worldedit'],
    restartRequired: true,
  },
  fawe: {
    id: 'fawe',
    label: 'FAWE',
    pinnedVersion: '2.15.0',
    filename: 'FastAsyncWorldEdit-Bukkit-2.15.0.jar',
    downloadUrl: 'https://cdn.modrinth.com/data/z4HZZnLr/versions/MOe9fY3h/FastAsyncWorldEdit-Bukkit-2.15.0.jar',
    checksum: { algorithm: 'sha512', value: '862177cc1acbae3cb094af3416ac378a547318a47e1751b197e126465977e3177949b3eefd3fd5f3a54740f4d09248e4ae2a7f7d31c688d0eccf5455bca1c88a' },
    detectNames: ['fastasyncworldedit', 'fawe'],
    restartRequired: true,
  },
}

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

function sendRedirect(res, status, location) {
  res.writeHead(status, { Location: location })
  res.end()
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

function resolveConfiguredDirs(raw, fallback) {
  const values = (raw || '')
    .split(/[,:]/)
    .map(value => value.trim())
    .filter(Boolean)
  return Array.from(new Set((values.length > 0 ? values : fallback).map(value => (
    path.isAbsolute(value) ? path.resolve(value) : safeJoin(WORLDS_DIR, value)
  ))))
}

function resolveSchematicDirs(raw) {
  return resolveConfiguredDirs(raw, [
    '/data/plugins/FastAsyncWorldEdit/schematics',
    '/data/plugins/WorldEdit/schematics',
  ])
}

function resolveEntityPresetDirs(raw) {
  return resolveConfiguredDirs(raw, ['/data/mcraftr/entity-presets'])
}

function displayPath(value) {
  const absolute = path.resolve(value)
  const root = path.resolve(WORLDS_DIR)
  if (absolute === root) return '.'
  if (absolute.startsWith(root + path.sep)) return absolute.slice(root.length + 1)
  return absolute
}

function getEntityArtUrl(entityId) {
  if (!ART_VERSION || !entityId) return null
  return `/art/entity/${encodeURIComponent(ART_VERSION)}/${encodeURIComponent(entityId)}`
}

function getStructureArtUrl(entry) {
  const rawId = entry?.iconId || entry?.resourceKey || entry?.bridgeRef || entry?.id || entry?.label
  if (!rawId) return null
  return `/art/structures/${encodeURIComponent(rawId)}.png`
}

function normalizeStructureArtId(raw) {
  const value = decodeURIComponent(String(raw || '').trim().toLowerCase())
  return value.includes(':') ? value : `minecraft:${value}`
}

function resolveStructureArtFile(structureId) {
  const id = normalizeStructureArtId(structureId)
  const alias = id.replace(/^minecraft:/, '')
  const realDir = path.join(process.cwd(), 'beacon/catalog-art/structures/real')
  if (
    id === 'minecraft:woodland_mansion' ||
    id === 'minecraft:mansion' ||
    alias === 'woodland_mansion' ||
    alias === 'mansion' ||
    alias.includes('/mansion')
  ) {
    return path.join(realDir, 'woodland_mansion.png')
  }
  if (
    id === 'minecraft:ocean_monument' ||
    id === 'minecraft:monument' ||
    alias === 'ocean_monument' ||
    alias === 'monument' ||
    alias.includes('/monument')
  ) {
    return path.join(realDir, 'ocean_monument.png')
  }
  return path.join(realDir, 'generic_structure.png')
}

function buildAppArtUrl(relativePath) {
  if (!APP_BASE_URL) return null
  return `${APP_BASE_URL}${relativePath.startsWith('/') ? relativePath : `/${relativePath}`}`
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

function getPluginRoot() {
  const root = path.resolve(PLUGINS_DIR)
  if (!isDirectory(root)) {
    throw new Error(`Plugins directory is unavailable: ${root}`)
  }
  return root
}

function managedManifestPath() {
  return safeJoin(getPluginRoot(), MANAGED_INTEGRATIONS_FILE)
}

function managedBackupRoot() {
  return safeJoin(getPluginRoot(), MANAGED_BACKUPS_DIR)
}

function ensureManagedBackupRoot() {
  const root = managedBackupRoot()
  fs.mkdirSync(root, { recursive: true })
  return root
}

function emptyManagedManifest() {
  return {
    version: 1,
    updatedAt: Math.floor(Date.now() / 1000),
    integrations: {},
  }
}

function readManagedManifest() {
  const file = managedManifestPath()
  if (!fs.existsSync(file)) return emptyManagedManifest()
  try {
    const parsed = JSON.parse(fs.readFileSync(file, 'utf8'))
    if (!parsed || typeof parsed !== 'object' || typeof parsed.integrations !== 'object' || parsed.integrations === null) {
      return emptyManagedManifest()
    }
    return {
      version: typeof parsed.version === 'number' ? parsed.version : 1,
      updatedAt: typeof parsed.updatedAt === 'number' ? parsed.updatedAt : Math.floor(Date.now() / 1000),
      integrations: parsed.integrations,
    }
  } catch {
    return emptyManagedManifest()
  }
}

function writeManagedManifest(manifest) {
  const file = managedManifestPath()
  const payload = {
    version: 1,
    updatedAt: Math.floor(Date.now() / 1000),
    integrations: manifest.integrations || {},
  }
  const tempFile = `${file}.${process.pid}.tmp`
  fs.writeFileSync(tempFile, JSON.stringify(payload, null, 2))
  fs.renameSync(tempFile, file)
  return payload
}

function getManagedIntegrationEntry(manifest, integrationId) {
  const entry = manifest.integrations?.[integrationId]
  return entry && typeof entry === 'object' ? entry : null
}

function setManagedIntegrationEntry(manifest, integrationId, entry) {
  manifest.integrations[integrationId] = entry
  return writeManagedManifest(manifest)
}

function removeManagedIntegrationEntry(manifest, integrationId) {
  delete manifest.integrations[integrationId]
  return writeManagedManifest(manifest)
}

function curatedIntegrationById(integrationId) {
  const integration = CURATED_PLUGIN_INTEGRATIONS[integrationId]
  if (!integration) throw new Error(`Unsupported curated integration: ${integrationId}`)
  return integration
}

function displayPluginPath(value) {
  const absolute = path.resolve(value)
  const root = getPluginRoot()
  if (absolute === root) return 'plugins'
  if (absolute.startsWith(root + path.sep)) return path.posix.join('plugins', absolute.slice(root.length + 1).split(path.sep).join('/'))
  return absolute
}

function resolvePluginJarPath(filename) {
  return safeJoin(getPluginRoot(), filename)
}

function resolveBackupJarPath(filename, timestamp) {
  const ext = path.extname(filename) || '.jar'
  const base = path.basename(filename, ext)
  return safeJoin(ensureManagedBackupRoot(), `${base}-${timestamp}${ext}`)
}

function fileExists(entryPath) {
  try {
    return fs.statSync(entryPath).isFile()
  } catch {
    return false
  }
}

function readFileHash(entryPath, algorithm) {
  const hash = crypto.createHash(algorithm)
  hash.update(fs.readFileSync(entryPath))
  return hash.digest('hex')
}

function copyFileToBackup(sourcePath, backupPath) {
  ensureManagedBackupRoot()
  fs.copyFileSync(sourcePath, backupPath)
}

function removeFile(entryPath) {
  if (fileExists(entryPath)) fs.rmSync(entryPath)
}

function normalizeName(value) {
  return value.trim().toLowerCase()
}

function detectCuratedPlugin(integration) {
  const jarPath = resolvePluginJarPath(integration.filename)
  const plugins = listPlugins()
  const byFilename = plugins.find(plugin => normalizeName(plugin.filename) === normalizeName(integration.filename))
  const byName = plugins.find(plugin => integration.detectNames.some(name => normalizeName(name) === normalizeName(plugin.name)))
  const matched = byFilename || byName || null
  return {
    installed: fileExists(jarPath) || !!matched,
    pluginPath: fileExists(jarPath) ? jarPath : (matched ? safeJoin(getPluginRoot(), matched.filename) : null),
    detectedVersion: matched?.version || null,
  }
}

function evaluateCuratedIntegration(integrationId) {
  const integration = curatedIntegrationById(integrationId)
  const manifest = readManagedManifest()
  const managedEntry = getManagedIntegrationEntry(manifest, integrationId)
  const detected = detectCuratedPlugin(integration)
  const warnings = []
  let state = 'missing'
  let managed = !!managedEntry?.managed

  if (!detected.installed && !managedEntry) {
    state = 'missing'
  } else if (detected.installed && !managedEntry) {
    state = 'user-managed'
    warnings.push('Plugin detected on disk but not managed by Mcraftr.')
  } else if (!detected.installed && managedEntry) {
    state = 'drifted'
    warnings.push('Managed metadata exists, but the plugin jar is missing from the plugins directory.')
  } else if (detected.pluginPath && managedEntry) {
    const checksumMatches = integration.checksum
      ? readFileHash(detected.pluginPath, integration.checksum.algorithm) === integration.checksum.value
      : true
    if (!checksumMatches) {
      state = 'drifted'
      warnings.push('Managed jar checksum no longer matches the curated pinned artifact.')
    } else if (managedEntry.pinnedVersion !== integration.pinnedVersion || (managedEntry.installedVersion && managedEntry.installedVersion !== integration.pinnedVersion)) {
      state = 'outdated'
      warnings.push('Managed integration does not match the currently curated pinned version.')
    } else {
      state = 'ready'
    }
  } else {
    state = 'unknown'
    warnings.push('Mcraftr could not determine the integration state safely.')
  }

  return {
    integrationId,
    installed: detected.installed,
    detectedVersion: detected.detectedVersion,
    pinnedVersion: integration.pinnedVersion,
    pluginPath: detected.pluginPath ? displayPluginPath(detected.pluginPath) : null,
    managed,
    backupPath: managedEntry?.backupPath || null,
    restartRequired: integration.restartRequired,
    state,
    warnings,
  }
}

async function downloadCuratedArtifact(integration) {
  const response = await fetch(integration.downloadUrl, { redirect: 'follow' })
  if (!response.ok) throw new Error(`Download failed (${response.status})`)
  const arrayBuffer = await response.arrayBuffer()
  const buffer = Buffer.from(arrayBuffer)
  if (integration.checksum) {
    const actual = crypto.createHash(integration.checksum.algorithm).update(buffer).digest('hex')
    if (actual !== integration.checksum.value) {
      throw new Error('Checksum verification failed for curated artifact.')
    }
  }
  return buffer
}

function integrationConflictWarnings(integrationId) {
  if (integrationId === 'worldedit' && evaluateCuratedIntegration('fawe').installed) {
    return ['FAWE is already present on this server. Mcraftr will not remove it automatically.']
  }
  if (integrationId === 'fawe' && evaluateCuratedIntegration('worldedit').installed) {
    return ['WorldEdit is already present on this server. Mcraftr will not remove it automatically.']
  }
  return []
}

async function installCuratedIntegration(integrationId) {
  const integration = curatedIntegrationById(integrationId)
  const manifest = readManagedManifest()
  const jarPath = resolvePluginJarPath(integration.filename)
  const warnings = integrationConflictWarnings(integrationId)
  let backupPath = null

  if (fileExists(jarPath)) {
    const backup = resolveBackupJarPath(integration.filename, Math.floor(Date.now() / 1000))
    copyFileToBackup(jarPath, backup)
    backupPath = displayPluginPath(backup)
    warnings.push('Existing jar was backed up before replacement.')
  }

  const artifact = await downloadCuratedArtifact(integration)
  fs.writeFileSync(jarPath, artifact)
  setManagedIntegrationEntry(manifest, integrationId, {
    managed: true,
    installedVersion: integration.pinnedVersion,
    pinnedVersion: integration.pinnedVersion,
    filename: integration.filename,
    pluginPath: displayPluginPath(jarPath),
    backupPath,
    checksum: integration.checksum,
    installedAt: Math.floor(Date.now() / 1000),
  })

  return {
    ok: true,
    integrationId,
    action: 'install',
    installedVersion: integration.pinnedVersion,
    pinnedVersion: integration.pinnedVersion,
    filename: integration.filename,
    pluginPath: displayPluginPath(jarPath),
    backupPath,
    restartRequired: integration.restartRequired,
    managed: true,
    warnings,
  }
}

async function removeCuratedIntegration(integrationId) {
  const integration = curatedIntegrationById(integrationId)
  const manifest = readManagedManifest()
  const managedEntry = getManagedIntegrationEntry(manifest, integrationId)
  if (!managedEntry?.managed) {
    return {
      ok: false,
      integrationId,
      action: 'remove',
      error: `${integration.label} is not managed by Mcraftr and will not be removed automatically.`,
      warnings: ['Manual removal is required for user-managed plugins.'],
    }
  }

  const jarPath = resolvePluginJarPath(integration.filename)
  let backupPath = null
  if (fileExists(jarPath)) {
    const backup = resolveBackupJarPath(integration.filename, Math.floor(Date.now() / 1000))
    copyFileToBackup(jarPath, backup)
    backupPath = displayPluginPath(backup)
    removeFile(jarPath)
  }

  removeManagedIntegrationEntry(manifest, integrationId)
  return {
    ok: true,
    integrationId,
    action: 'remove',
    installedVersion: null,
    pinnedVersion: integration.pinnedVersion,
    filename: integration.filename,
    pluginPath: null,
    backupPath,
    restartRequired: integration.restartRequired,
    managed: false,
    warnings: ['Managed jar removed and backed up.'],
  }
}

async function repairCuratedIntegration(integrationId) {
  const integration = curatedIntegrationById(integrationId)
  const manifest = readManagedManifest()
  const managedEntry = getManagedIntegrationEntry(manifest, integrationId)
  if (!managedEntry?.managed) {
    return {
      ok: false,
      integrationId,
      action: 'repair',
      error: `${integration.label} is present but not managed by Mcraftr.`,
      warnings: ['Repair only applies to Mcraftr-managed integrations.'],
    }
  }

  const jarPath = resolvePluginJarPath(integration.filename)
  let backupPath = null
  if (fileExists(jarPath)) {
    const backup = resolveBackupJarPath(integration.filename, Math.floor(Date.now() / 1000))
    copyFileToBackup(jarPath, backup)
    backupPath = displayPluginPath(backup)
  }

  const artifact = await downloadCuratedArtifact(integration)
  fs.writeFileSync(jarPath, artifact)
  setManagedIntegrationEntry(manifest, integrationId, {
    managed: true,
    installedVersion: integration.pinnedVersion,
    pinnedVersion: integration.pinnedVersion,
    filename: integration.filename,
    pluginPath: displayPluginPath(jarPath),
    backupPath,
    checksum: integration.checksum,
    installedAt: Math.floor(Date.now() / 1000),
  })

  return {
    ok: true,
    integrationId,
    action: 'repair',
    installedVersion: integration.pinnedVersion,
    pinnedVersion: integration.pinnedVersion,
    filename: integration.filename,
    pluginPath: displayPluginPath(jarPath),
    backupPath,
    restartRequired: integration.restartRequired,
    managed: true,
    warnings: ['Existing managed jar was replaced with the curated pinned build.'],
  }
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
      imageUrl: getStructureArtUrl({ placementKind: 'schematic', relativePath: relative, format: entry.name.toLowerCase().endsWith('.schematic') ? 'schematic' : 'schem', label: labelize(entry.name) }),
      artUrl: getStructureArtUrl({ placementKind: 'schematic', relativePath: relative, format: entry.name.toLowerCase().endsWith('.schematic') ? 'schematic' : 'schem', label: labelize(entry.name) }),
      iconId: relative,
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
  return execFileSync('unzip', ['-l', zipPath], {
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
    stdio: ['ignore', 'pipe', 'ignore'],
  })
    .split('\n')
    .map(line => line.match(/^\s*\d+\s+\S+\s+\S+\s+(.*)$/)?.[1]?.trim() ?? '')
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
      const raw = execFileSync('unzip', ['-p', latest.fullPath, nestedServerJar], { encoding: 'buffer', maxBuffer: 64 * 1024 * 1024 })
      fs.writeFileSync(jarPath, raw)
    }
  }
  return { key, jarPath }
}

function diagnoseNativeStructureCatalog() {
  const diagnostics = {
    cacheDir: path.join(WORLDS_DIR, 'cache'),
    cacheDirExists: isDirectory(path.join(WORLDS_DIR, 'cache')),
    latestJar: null,
    bundledJarPath: null,
    warnings: [],
    error: null,
  }

  try {
    const latest = findLatestMojangJar()
    if (!latest) {
      diagnostics.error = 'no_mojang_cache_jar'
      diagnostics.warnings.push('No mojang_*.jar was found under the server cache directory.')
      return diagnostics
    }
    diagnostics.latestJar = displayPath(latest.fullPath)

    const bundled = ensureBundledServerJar()
    if (!bundled) {
      diagnostics.error = 'no_bundled_server_jar'
      diagnostics.warnings.push('Beacon could not prepare a bundled server jar for native structure scanning.')
      return diagnostics
    }
    diagnostics.bundledJarPath = displayPath(bundled.jarPath)

    try {
      execFileSync('unzip', ['-l', bundled.jarPath], {
        encoding: 'utf8',
        maxBuffer: 16 * 1024 * 1024,
        stdio: ['ignore', 'pipe', 'ignore'],
      })
    } catch {
      diagnostics.error = 'unzip_unavailable_or_failed'
      diagnostics.warnings.push('Beacon could not inspect the bundled server jar with unzip.')
      return diagnostics
    }

    return diagnostics
  } catch (error) {
    diagnostics.error = 'native_structure_scan_failed'
    diagnostics.warnings.push(error instanceof Error ? error.message : 'Unknown native structure scan error')
    return diagnostics
  }
}

function buildNativeStructureCatalog() {
  try {
    const bundled = ensureBundledServerJar()
    if (!bundled) {
      return { templates: [], worldgen: [], jarPath: '', diagnostics: diagnoseNativeStructureCatalog() }
    }
    if (nativeStructureCache.key === bundled.key && nativeStructureCache.jarPath === bundled.jarPath) {
      return { ...nativeStructureCache, diagnostics: diagnoseNativeStructureCatalog() }
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
          imageUrl: getStructureArtUrl({ placementKind: 'native-worldgen', resourceKey, label: labelize(resourceKey.split('/').at(-1) || resourceKey), format: 'native' }),
          artUrl: getStructureArtUrl({ placementKind: 'native-worldgen', resourceKey, label: labelize(resourceKey.split('/').at(-1) || resourceKey), format: 'native' }),
          iconId: resourceKey,
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
          imageUrl: getStructureArtUrl({ placementKind: 'native-template', resourceKey, label: labelize(resourceKey.split('/').at(-1) || resourceKey), format: 'native' }),
          artUrl: getStructureArtUrl({ placementKind: 'native-template', resourceKey, label: labelize(resourceKey.split('/').at(-1) || resourceKey), format: 'native' }),
          iconId: resourceKey,
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
    return { ...nativeStructureCache, diagnostics: diagnoseNativeStructureCatalog() }
  } catch (error) {
    return {
      templates: [],
      worldgen: [],
      jarPath: '',
      diagnostics: {
        cacheDir: path.join(WORLDS_DIR, 'cache'),
        cacheDirExists: isDirectory(path.join(WORLDS_DIR, 'cache')),
        latestJar: null,
        bundledJarPath: null,
        warnings: [error instanceof Error ? error.message : 'Unknown native structure scan error'],
        error: 'native_structure_scan_failed',
      },
    }
  }
}

function stripBlockState(value) {
  return String(value || '').replace(/^minecraft:/, '').replace(/\[.*$/, '').trim()
}

function isPreviewableBlock(value) {
  const block = stripBlockState(value)
  return !!block && !['air', 'cave_air', 'void_air', 'structure_void', 'barrier', 'water', 'lava'].includes(block)
}

function summarizeBlocks(names) {
  const counts = new Map()
  for (const name of names) {
    const block = stripBlockState(name)
    if (!isPreviewableBlock(block)) continue
    counts.set(block, (counts.get(block) || 0) + 1)
  }
  return Array.from(counts.entries())
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
    .slice(0, 6)
    .map(([block]) => block)
}

function makePatternGrid(materials, size = 8) {
  const palette = materials.length > 0 ? materials : ['stone_bricks']
  const grid = []
  for (let z = 0; z < size; z += 1) {
    const row = []
    for (let x = 0; x < size; x += 1) {
      const border = z === 0 || x === 0 || z === size - 1 || x === size - 1
      const diagonal = x === z || x + z === size - 1
      row.push(border ? palette[0] : diagonal ? (palette[1] ?? palette[0]) : (palette[2] ?? palette[0]))
    }
    grid.push(row)
  }
  return grid
}

function buildTopDownCells(dimensions, positionedBlocks) {
  if (!dimensions?.width || !dimensions?.length || positionedBlocks.length === 0) return null
  const width = Math.max(1, Number(dimensions.width) || 1)
  const length = Math.max(1, Number(dimensions.length) || 1)
  const target = 8
  const stepX = Math.max(1, Math.ceil(width / target))
  const stepZ = Math.max(1, Math.ceil(length / target))
  const cellsWide = Math.max(1, Math.ceil(width / stepX))
  const cellsLong = Math.max(1, Math.ceil(length / stepZ))
  const grid = Array.from({ length: cellsLong }, () => Array.from({ length: cellsWide }, () => 'air'))

  for (let cellZ = 0; cellZ < cellsLong; cellZ += 1) {
    const zStart = cellZ * stepZ
    const zEnd = Math.min(length, zStart + stepZ)
    for (let cellX = 0; cellX < cellsWide; cellX += 1) {
      const xStart = cellX * stepX
      const xEnd = Math.min(width, xStart + stepX)
      let best = null
      for (const block of positionedBlocks) {
        if (!isPreviewableBlock(block.name)) continue
        if (block.x < xStart || block.x >= xEnd || block.z < zStart || block.z >= zEnd) continue
        if (!best || block.y > best.y) {
          best = block
        }
      }
      grid[cellZ][cellX] = best ? stripBlockState(best.name) : 'air'
    }
  }

  return grid
}

function readVarIntArray(buffer) {
  const values = []
  let current = 0
  let shift = 0
  for (const byte of buffer) {
    current |= (byte & 0x7f) << shift
    if ((byte & 0x80) === 0) {
      values.push(current >>> 0)
      current = 0
      shift = 0
      continue
    }
    shift += 7
  }
  if (shift !== 0) values.push(current >>> 0)
  return values
}

function worldgenPreviewBlocks(resourceKey) {
  const lower = resourceKey.toLowerCase()
  if (lower.includes('bastion')) return ['polished_blackstone_bricks', 'gilded_blackstone', 'magma_block']
  if (lower.includes('ancient_city')) return ['deepslate_tiles', 'soul_lantern', 'sculk']
  if (lower.includes('trial_chamber')) return ['copper_bulb', 'tuff_bricks', 'chiseled_tuff']
  if (lower.includes('stronghold')) return ['stone_bricks', 'mossy_stone_bricks', 'cracked_stone_bricks']
  if (lower.includes('desert_pyramid')) return ['sandstone', 'cut_sandstone', 'orange_terracotta']
  if (lower.includes('jungle_temple')) return ['cobblestone', 'mossy_cobblestone', 'stone_bricks']
  if (lower.includes('igloo')) return ['snow_block', 'spruce_planks', 'red_carpet']
  if (lower.includes('mansion')) return ['dark_oak_planks', 'cobblestone', 'white_wool']
  if (lower.includes('monument')) return ['prismarine', 'sea_lantern', 'dark_prismarine']
  if (lower.includes('ocean_ruin')) return ['stone_bricks', 'mossy_stone_bricks', 'suspicious_gravel']
  if (lower.includes('shipwreck')) return ['oak_planks', 'spruce_planks', 'oak_log']
  if (lower.includes('outpost')) return ['dark_oak_log', 'cobblestone', 'white_wool']
  if (lower.includes('trail_ruins')) return ['terracotta', 'packed_mud', 'mud_bricks']
  if (lower.includes('ruined_portal')) return ['obsidian', 'crying_obsidian', 'netherrack']
  if (lower.includes('village')) return ['oak_planks', 'cobblestone', 'hay_block']
  if (lower.includes('fortress')) return ['nether_bricks', 'soul_sand', 'lava']
  if (lower.includes('mineshaft')) return ['oak_planks', 'oak_log', 'rail']
  if (lower.includes('end_city')) return ['purpur_block', 'end_stone_bricks', 'end_rod']
  return ['stone_bricks', 'oak_planks', 'lantern']
}

function worldgenPreview(resourceKey) {
  const blocks = worldgenPreviewBlocks(resourceKey)
  return {
    blocks,
    dimensions: null,
    cells: makePatternGrid(blocks, 8),
  }
}

async function parseNbtBuffer(raw) {
  const parsed = await nbt.parse(raw)
  return nbt.simplify(parsed.parsed)
}

async function readNativeStructurePreview(resourceKey) {
  const native = buildNativeStructureCatalog()
  if (!native.jarPath) return worldgenPreview(resourceKey)
  const entryName = `data/minecraft/structure/${resourceKey}.nbt`
  const raw = execFileSync('unzip', ['-p', native.jarPath, entryName], { encoding: 'buffer', maxBuffer: 64 * 1024 * 1024 })
  const data = await parseNbtBuffer(raw)
  const palette = Array.isArray(data.palette) ? data.palette : []
  const blocks = Array.isArray(data.blocks) ? data.blocks : []
  const dimensions = Array.isArray(data.size) && data.size.length >= 3
    ? { width: data.size[0] ?? null, height: data.size[1] ?? null, length: data.size[2] ?? null }
    : null
  const names = blocks.map(block => palette[block.state]?.Name).filter(Boolean)
  const sample = summarizeBlocks(names.length > 0 ? names : palette.map(entry => entry?.Name).filter(Boolean))
  const positionedBlocks = blocks.map(block => ({
    x: Array.isArray(block.pos) ? Number(block.pos[0]) || 0 : 0,
    y: Array.isArray(block.pos) ? Number(block.pos[1]) || 0 : 0,
    z: Array.isArray(block.pos) ? Number(block.pos[2]) || 0 : 0,
    name: palette[block.state]?.Name,
  })).filter(block => block.name)
  return {
    blocks: sample.length > 0 ? sample : worldgenPreviewBlocks(resourceKey),
    dimensions,
    cells: buildTopDownCells(dimensions, positionedBlocks),
  }
}

function resolveStructureFile(req, relativePath) {
  const baseRoots = SCHEMATICS_DIRS.map(fullPath => ({ fullPath, rootKind: 'default' }))
  const linkedRoots = resolveLinkedRoots(req, 'x-mcraftr-structure-roots')
  const roots = mergeRoots(baseRoots, linkedRoots)
  for (const root of roots) {
    const candidate = safeJoin(root.fullPath, relativePath)
    if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
      return candidate
    }
  }
  return null
}

async function readFileStructurePreview(req, relativePath, formatHint) {
  const fullPath = resolveStructureFile(req, relativePath)
  if (!fullPath) {
    throw new Error('Structure file not found')
  }
  const raw = fs.readFileSync(fullPath)
  const data = await parseNbtBuffer(raw)

  const widthValue = data.Width ?? data.width ?? null
  const heightValue = data.Height ?? data.height ?? null
  const lengthValue = data.Length ?? data.length ?? null
  const width = Number(widthValue)
  const height = Number(heightValue)
  const length = Number(lengthValue)
  const safeWidth = Number.isFinite(width) && width > 0 ? width : 1
  const safeLength = Number.isFinite(length) && length > 0 ? length : 1
  const dimensions = Number.isFinite(width) && Number.isFinite(height) && Number.isFinite(length)
    ? { width, height, length }
    : (Array.isArray(data.size) && data.size.length >= 3
      ? { width: data.size[0] ?? null, height: data.size[1] ?? null, length: data.size[2] ?? null }
      : null)

  if (data.Palette && typeof data.Palette === 'object' && !Array.isArray(data.Palette)) {
    const paletteByIndex = new Map()
    for (const [name, index] of Object.entries(data.Palette)) {
      paletteByIndex.set(Number(index), name)
    }
    const blockData = data.BlockData && typeof data.BlockData === 'object' && 'length' in data.BlockData
      ? readVarIntArray(Buffer.from(data.BlockData))
      : []
    const names = blockData.map(index => paletteByIndex.get(index)).filter(Boolean)
    const positionedBlocks = blockData.map((index, linear) => ({
      x: linear % safeWidth,
      y: Math.floor(linear / (safeWidth * safeLength)),
      z: Math.floor(linear / safeWidth) % safeLength,
      name: paletteByIndex.get(index),
    })).filter(block => block.name)
    const sample = summarizeBlocks(names.length > 0 ? names : Array.from(paletteByIndex.values()))
    return {
      blocks: sample,
      dimensions,
      cells: buildTopDownCells(dimensions, positionedBlocks),
    }
  }

  if (Array.isArray(data.palette)) {
    const paletteNames = data.palette.map(entry => entry?.Name).filter(Boolean)
    const blockNames = Array.isArray(data.blocks)
      ? data.blocks.map(block => data.palette?.[block.state]?.Name).filter(Boolean)
      : []
    const positionedBlocks = Array.isArray(data.blocks)
      ? data.blocks.map(block => ({
          x: Array.isArray(block.pos) ? Number(block.pos[0]) || 0 : 0,
          y: Array.isArray(block.pos) ? Number(block.pos[1]) || 0 : 0,
          z: Array.isArray(block.pos) ? Number(block.pos[2]) || 0 : 0,
          name: data.palette?.[block.state]?.Name,
        })).filter(block => block.name)
      : []
    return {
      blocks: summarizeBlocks(blockNames.length > 0 ? blockNames : paletteNames),
      dimensions,
      cells: buildTopDownCells(dimensions, positionedBlocks),
    }
  }

  return {
    blocks: formatHint === 'schematic' ? ['stone_bricks', 'oak_planks', 'glass'] : ['cobblestone', 'oak_planks', 'lantern'],
    dimensions,
    cells: makePatternGrid(formatHint === 'schematic' ? ['stone_bricks', 'oak_planks', 'glass'] : ['cobblestone', 'oak_planks', 'lantern'], 8),
  }
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
  const raw = execFileSync('unzip', ['-p', native.jarPath, entryName], { encoding: 'buffer', maxBuffer: 64 * 1024 * 1024 })
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
    nativeScan: native.diagnostics,
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
    imageUrl: getEntityArtUrl(entityId),
    artUrl: getEntityArtUrl(entityId),
    iconId: entityId,
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

    const entityArtMatch = pathname.match(/^\/art\/entity\/([^/]+)\/([^/]+)$/)
    if (req.method === 'GET' && entityArtMatch) {
      if (!APP_BASE_URL) {
        sendJson(res, 503, { ok: false, error: 'MCRAFTR_APP_BASE_URL is not configured for art redirects' })
        return
      }
      const version = decodeURIComponent(entityArtMatch[1])
      const entityId = decodeURIComponent(entityArtMatch[2])
      const target = buildAppArtUrl(`/api/minecraft/art/entity/${encodeURIComponent(version)}/${encodeURIComponent(entityId)}`)
      if (!target) {
        sendJson(res, 503, { ok: false, error: 'Beacon could not build the entity art target URL' })
        return
      }
      sendRedirect(res, 302, target)
      return
    }

    const structureArtMatch = pathname.match(/^\/art\/structures\/(.+)\.png$/)
    if (req.method === 'GET' && structureArtMatch) {
      const filePath = resolveStructureArtFile(structureArtMatch[1])
      if (!fs.existsSync(filePath)) {
        sendJson(res, 404, { ok: false, error: 'Structure art not found' })
        return
      }
      const buffer = fs.readFileSync(filePath)
      res.writeHead(200, {
        'Content-Type': 'image/png',
        'Content-Length': buffer.length,
        'Cache-Control': 'public, max-age=604800, stale-while-revalidate=86400',
      })
      res.end(buffer)
      return
    }

    if (req.method === 'GET' && pathname === '/art/structure') {
      if (!APP_BASE_URL) {
        sendJson(res, 503, { ok: false, error: 'MCRAFTR_APP_BASE_URL is not configured for art redirects' })
        return
      }
      const target = buildAppArtUrl(`/api/minecraft/art/structure?${url.searchParams.toString()}`)
      if (!target) {
        sendJson(res, 503, { ok: false, error: 'Beacon could not build the structure art target URL' })
        return
      }
      sendRedirect(res, 302, target)
      return
    }

    if (req.method === 'GET' && pathname === '/integrations') {
      sendJson(res, 200, {
        ok: true,
        capabilities: BUILTIN_CAPABILITIES,
        pluginRoot: 'plugins',
        manifestPath: 'plugins/.mcraftr-managed.json',
        backupRoot: 'plugins/.mcraftr-backups',
        integrations: Object.keys(CURATED_PLUGIN_INTEGRATIONS).map(evaluateCuratedIntegration),
      })
      return
    }

    if (req.method === 'POST' && pathname === '/integrations/install') {
      const body = await readBody(req)
      const integrationId = String(body.integrationId || '').trim()
      if (!CURATED_PLUGIN_INTEGRATIONS[integrationId]) {
        sendJson(res, 400, { ok: false, error: 'Unsupported curated integration', capabilities: BUILTIN_CAPABILITIES })
        return
      }
      const result = await installCuratedIntegration(integrationId)
      sendJson(res, result.ok ? 200 : 400, { ...result, capabilities: BUILTIN_CAPABILITIES })
      return
    }

    if (req.method === 'POST' && pathname === '/integrations/remove') {
      const body = await readBody(req)
      const integrationId = String(body.integrationId || '').trim()
      if (!CURATED_PLUGIN_INTEGRATIONS[integrationId]) {
        sendJson(res, 400, { ok: false, error: 'Unsupported curated integration', capabilities: BUILTIN_CAPABILITIES })
        return
      }
      const result = await removeCuratedIntegration(integrationId)
      sendJson(res, result.ok ? 200 : 400, { ...result, capabilities: BUILTIN_CAPABILITIES })
      return
    }

    if (req.method === 'POST' && pathname === '/integrations/repair') {
      const body = await readBody(req)
      const integrationId = String(body.integrationId || '').trim()
      if (!CURATED_PLUGIN_INTEGRATIONS[integrationId]) {
        sendJson(res, 400, { ok: false, error: 'Unsupported curated integration', capabilities: BUILTIN_CAPABILITIES })
        return
      }
      const result = await repairCuratedIntegration(integrationId)
      sendJson(res, result.ok ? 200 : 400, { ...result, capabilities: BUILTIN_CAPABILITIES })
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
          nativeScan: scan.nativeScan,
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

    if (req.method === 'GET' && pathname === '/structures/preview') {
      const placementKind = url.searchParams.get('placementKind')?.trim() || ''
      const resourceKey = url.searchParams.get('resourceKey')?.trim() || ''
      const relativePath = url.searchParams.get('relativePath')?.trim() || ''
      const format = url.searchParams.get('format')?.trim() || ''

      let preview = null
      if (placementKind === 'native-template' && resourceKey) {
        preview = await readNativeStructurePreview(resourceKey)
      } else if (placementKind === 'native-worldgen' && resourceKey) {
        preview = {
          blocks: worldgenPreviewBlocks(resourceKey),
          dimensions: null,
        }
      } else if (relativePath) {
        preview = await readFileStructurePreview(req, relativePath, format)
      }

      if (!preview) {
        sendJson(res, 400, { ok: false, error: 'Structure preview data is unavailable for this entry' })
        return
      }

      sendJson(res, 200, { ok: true, preview })
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
  console.log(`[mcraftr-beacon] listening on http://${HOST}:${PORT}`)
})
