import { DEFAULT_MINECRAFT_VERSION } from '@/lib/minecraft-version'

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

export function buildStructureArtUrl(structure: StructureListEntry, minecraftVersion?: string | null) {
  const iconId = structure.iconId || structure.resourceKey || structure.bridgeRef || structure.id || structure.label
  return `/api/minecraft/art/structure?${new URLSearchParams({
    version: minecraftVersion || DEFAULT_MINECRAFT_VERSION,
    placementKind: structure.placementKind,
    ...(structure.resourceKey ? { resourceKey: structure.resourceKey } : {}),
    ...(structure.relativePath ? { relativePath: structure.relativePath } : {}),
    ...(structure.format ? { format: structure.format } : {}),
    ...(iconId ? { iconId } : {}),
    label: structure.label,
  }).toString()}`
}