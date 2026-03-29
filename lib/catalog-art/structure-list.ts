import { DEFAULT_MINECRAFT_VERSION } from '@/lib/minecraft-version'

export type StructureArtView = 'preview' | 'materials'

export type StructureListEntry = {
  placementKind: string
  resourceKey?: string | null
  relativePath?: string | null
  format?: string | null
  iconId?: string | null
  bridgeRef: string
  id: string
  label: string
  category?: string | null
  dimensions?: {
    width: number | null
    height: number | null
    length: number | null
  } | null
  has3d?: boolean
}

const STRUCTURE_PART_SEGMENTS = new Set([
  'wall',
  'walls',
  'corner',
  'corners',
  'segment',
  'segments',
  'cap',
  'caps',
  'room',
  'rooms',
  'debris',
  'decor',
  'street',
  'streets',
  'road',
  'roads',
  'path',
  'paths',
  'hallway',
  'hallways',
  'corridor',
  'corridors',
])

const STRUCTURE_PART_TOKENS = new Set([
  'wall',
  'corner',
  'segment',
  'cap',
  'room',
  'debris',
  'decor',
  'stairs',
  'stair',
  'ramp',
  'entry',
  'entrance',
  'edge',
  'slice',
  'support',
  'junction',
  'intersection',
])

function structureResourceSegments(structure: StructureListEntry) {
  return (structure.resourceKey ?? structure.relativePath ?? '')
    .trim()
    .toLowerCase()
    .split('/')
    .filter(Boolean)
}

export function isStructureCatalogPart(structure: StructureListEntry) {
  if (structure.placementKind !== 'native-template') return false
  const segments = structureResourceSegments(structure)
  if (segments.length === 0) return false
  const leaf = segments.at(-1) ?? ''
  const leafTokens = leaf.split(/[_-]+/).filter(Boolean)
  if (segments.slice(0, -1).some(segment => STRUCTURE_PART_SEGMENTS.has(segment))) return true
  return leafTokens.some(token => STRUCTURE_PART_TOKENS.has(token))
}

export function shouldIncludeStructureInDefaultCatalog(structure: StructureListEntry) {
  return !isStructureCatalogPart(structure)
}

function isShipwreckStructure(structure: StructureListEntry) {
  const resourceKey = structure.resourceKey?.trim().toLowerCase() ?? ''
  const category = structure.category?.trim().toLowerCase() ?? ''
  return resourceKey.startsWith('shipwreck/') || category === 'shipwreck'
}

export function inferStructurePreviewAvailability(structure: StructureListEntry) {
  if (isShipwreckStructure(structure)) return false
  if (structure.placementKind === 'schematic' || structure.placementKind === 'native-template' || structure.placementKind === 'native-worldgen') return true
  const width = structure.dimensions?.width ?? null
  const height = structure.dimensions?.height ?? null
  const length = structure.dimensions?.length ?? null
  return Boolean(width && height && length)
}

export function inferStructure3DAvailability(structure: StructureListEntry) {
  if (structure.has3d === true) return true
  if (!inferStructurePreviewAvailability(structure)) return false
  return true
}

export function buildStructureArtUrl(structure: StructureListEntry, minecraftVersion?: string | null, artView?: StructureArtView | null) {
  const iconId = structure.iconId || structure.resourceKey || structure.bridgeRef || structure.id || structure.label
  return `/api/minecraft/art/structure?${new URLSearchParams({
    version: minecraftVersion || DEFAULT_MINECRAFT_VERSION,
    placementKind: structure.placementKind,
    ...(structure.resourceKey ? { resourceKey: structure.resourceKey } : {}),
    ...(structure.relativePath ? { relativePath: structure.relativePath } : {}),
    ...(structure.format ? { format: structure.format } : {}),
    ...(artView ? { artView } : {}),
    ...(iconId ? { iconId } : {}),
    label: structure.label,
  }).toString()}`
}

export function withStructureArtView(url: string, artView: StructureArtView) {
  const parsed = new URL(url, 'http://localhost')
  parsed.searchParams.set('artView', artView)
  const next = `${parsed.pathname}?${parsed.searchParams.toString()}`
  return url.startsWith('http://') || url.startsWith('https://') ? parsed.toString() : next
}
