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