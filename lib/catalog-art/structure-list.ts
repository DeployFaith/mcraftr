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

function isShipwreckStructure(structure: StructureListEntry) {
  const resourceKey = structure.resourceKey?.trim().toLowerCase() ?? ''
  const category = structure.category?.trim().toLowerCase() ?? ''
  return resourceKey.startsWith('shipwreck/') || category === 'shipwreck'
}

export function inferStructurePreviewAvailability(structure: StructureListEntry) {
  if (structure.placementKind === 'native-worldgen') return false
  if (isShipwreckStructure(structure)) return false
  if (structure.placementKind === 'schematic' || structure.placementKind === 'native-template') return true
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