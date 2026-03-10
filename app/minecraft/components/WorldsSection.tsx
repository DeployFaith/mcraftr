'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import CollapsibleCard, { setCollapsibleGroupState } from './CollapsibleCard'
import PlayerPicker from './PlayerPicker'
import SpawnInspectModal, { type EntityCatalogEntry, type LocationMode, type StructureCatalogEntry } from './SpawnInspectModal'
import CatalogArtwork from './CatalogArtwork'
import EntityPresetEditorModal from './EntityPresetEditorModal'
import { playSound } from '@/app/components/soundfx'
import type { FeatureKey } from '@/lib/features'
import { FALLBACK_ENTITY_CATALOG } from '@/lib/entity-catalog'

type FeatureFlags = Record<FeatureKey, boolean>

type PluginStackData = {
  ok: boolean
  bridge: {
    ok?: boolean
    error?: string
    serverVersion?: string | null
    plugins?: Array<{ key: string; name: string; installed: boolean; enabled: boolean; version: string | null; source: string }>
  }
  sidecar: {
    ok?: boolean
    error?: string
    capabilities?: string[]
  }
}

type WorldEntry = {
  name: string
  alias: string | null
  environment: string
  loaded: boolean
  players: number
  difficulty: string | null
  pvp: boolean | null
  allowFlight: boolean | null
  allowWeather: boolean | null
  hidden: boolean | null
  autoLoad: boolean | null
  seed: number | null
  spawn: { x: number; y: number; z: number; yaw: number; pitch: number } | null
  fs: null | {
    path: string
    sizeBytes: number | null
    mapUrl: string | null
    hasBlueMap: boolean
    hasDynmap: boolean
    source: string
  }
}

type WorldsData = {
  ok: boolean
  defaultWorld: string | null
  multiverseLoaded: boolean
  worlds: WorldEntry[]
}

type StructureScanRoot = {
  path: string
  exists: boolean
  structureCount: number
  rootKind?: string
}

type StructureScanData = {
  roots: StructureScanRoot[]
  totalStructures: number
  uploadRoot: string | null
  nativeCounts?: {
    templates?: number
    worldgen?: number
  }
}

type EntityScanRoot = {
  path: string
  exists: boolean
  presetCount: number
  rootKind?: string
}

type EntityScanData = {
  roots: EntityScanRoot[]
  totalPresets: number
  uploadRoot: string | null
  warnings: string[]
}

type PlacementEntry = {
  id: string
  world: string
  structure_id: string
  structure_label: string
  source_kind: string
  origin_x: number
  origin_y: number
  origin_z: number
  rotation: number
  include_air: number
  min_x: number
  min_y: number
  min_z: number
  max_x: number
  max_y: number
  max_z: number
  created_at: number
}

type WorldSettingsEntry = WorldEntry & {
  gamerules?: Record<string, boolean | null> | null
}

type LiveEntityEntry = {
  uuid: string
  id: string
  label: string
  category: string
  dangerous: boolean
  world: string
  location?: {
    x: number
    y: number
    z: number
    yaw?: number
    pitch?: number
  } | null
  customName?: string | null
  persistent?: boolean
  glowing?: boolean
  invulnerable?: boolean
  silent?: boolean
  gravity?: boolean
  health?: number | null
}

const WORLDS_COLLAPSIBLE_GROUP = 'worlds-tab'
const WORLD_CATEGORY_PAGE_SIZE = 8
const WORLD_GAMERULE_LABELS: Record<string, string> = {
  keepInventory: 'Keep Inventory',
  mobGriefing: 'Mob Griefing',
  pvp: 'PvP',
  doDaylightCycle: 'Daylight Cycle',
  doWeatherCycle: 'Weather Cycle',
  doFireTick: 'Fire Tick',
  doMobSpawning: 'Mob Spawning',
  naturalRegeneration: 'Natural Regen',
}
const WORLD_TOGGLE_SETTINGS = [
  ['pvp', 'PvP'],
  ['flight', 'Flight'],
  ['weather', 'Weather'],
  ['hidden', 'Hidden'],
  ['autoload', 'Autoload'],
] as const
const WORLD_DIFFICULTIES = ['peaceful', 'easy', 'normal', 'hard'] as const

function titleCase(value: string): string {
  return value
    .split(/[_\-/\s]+/)
    .filter(Boolean)
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

function normalizeStructureEntries(raw: unknown): StructureCatalogEntry[] {
  if (!Array.isArray(raw)) return []
  const entries: StructureCatalogEntry[] = []
  for (const entry of raw) {
    if (!entry || typeof entry !== 'object') continue
    const row = entry as Record<string, unknown>
    const id = typeof row.id === 'string' && row.id.trim() ? row.id.trim() : null
    if (!id) continue
    const relativePath = typeof row.relativePath === 'string' && row.relativePath.trim() ? row.relativePath.trim() : null
    entries.push({
      id,
      label: typeof row.label === 'string' && row.label.trim() ? row.label.trim() : titleCase(id),
      category: typeof row.category === 'string' && row.category.trim() ? row.category.trim() : 'Uncategorized',
      sourceKind: typeof row.sourceKind === 'string' && row.sourceKind.trim() ? row.sourceKind.trim() : 'server',
      placementKind: typeof row.placementKind === 'string' && row.placementKind.trim() ? row.placementKind.trim() : 'schematic',
      bridgeRef: typeof row.bridgeRef === 'string' && row.bridgeRef.trim() ? row.bridgeRef.trim() : encodeURIComponent(relativePath ?? id),
      resourceKey: typeof row.resourceKey === 'string' && row.resourceKey.trim() ? row.resourceKey.trim() : null,
      relativePath,
      format: typeof row.format === 'string' && row.format.trim() ? row.format.trim() : null,
      sizeBytes: typeof row.sizeBytes === 'number' ? row.sizeBytes : null,
      updatedAt: typeof row.updatedAt === 'number' ? row.updatedAt : null,
      imageUrl: typeof row.imageUrl === 'string' && row.imageUrl.trim() ? row.imageUrl.trim() : null,
      summary: typeof row.summary === 'string' && row.summary.trim() ? row.summary.trim() : null,
      dimensions: row.dimensions && typeof row.dimensions === 'object'
        ? {
            width: typeof (row.dimensions as Record<string, unknown>).width === 'number' ? (row.dimensions as Record<string, number>).width : null,
            height: typeof (row.dimensions as Record<string, unknown>).height === 'number' ? (row.dimensions as Record<string, number>).height : null,
            length: typeof (row.dimensions as Record<string, unknown>).length === 'number' ? (row.dimensions as Record<string, number>).length : null,
          }
        : null,
      removable: row.removable !== false,
      editable: row.editable === true,
    })
  }
  return entries
}

function normalizeEntityEntries(raw: unknown): EntityCatalogEntry[] {
  if (!Array.isArray(raw)) return []
  const entries: EntityCatalogEntry[] = []
  for (const entry of raw) {
    if (!entry || typeof entry !== 'object') continue
    const row = entry as Record<string, unknown>
    const id = typeof row.id === 'string' && row.id.trim() ? row.id.trim() : null
    if (!id) continue
    entries.push({
      id,
      presetId: typeof row.presetId === 'string' && row.presetId.trim() ? row.presetId.trim() : undefined,
      entityId: typeof row.entityId === 'string' && row.entityId.trim() ? row.entityId.trim() : id,
      label: typeof row.label === 'string' && row.label.trim() ? row.label.trim() : titleCase(id),
      category: typeof row.category === 'string' && row.category.trim() ? row.category.trim().toLowerCase() : 'misc',
      dangerous: !!row.dangerous,
      sourceKind: typeof row.sourceKind === 'string' && row.sourceKind.trim() ? row.sourceKind.trim() : 'native',
      editable: row.editable === true,
      defaultCount: typeof row.defaultCount === 'number' ? row.defaultCount : 1,
      relativePath: typeof row.relativePath === 'string' && row.relativePath.trim() ? row.relativePath.trim() : null,
      customName: typeof row.customName === 'string' && row.customName.trim() ? row.customName.trim() : null,
      health: typeof row.health === 'number' ? row.health : null,
      persistenceRequired: row.persistenceRequired === true,
      noAi: row.noAi === true,
      silent: row.silent === true,
      glowing: row.glowing === true,
      invulnerable: row.invulnerable === true,
      noGravity: row.noGravity === true,
      advancedNbt: typeof row.advancedNbt === 'string' && row.advancedNbt.trim() ? row.advancedNbt.trim() : null,
      imageUrl: typeof row.imageUrl === 'string' && row.imageUrl.trim() ? row.imageUrl.trim() : null,
      summary: typeof row.summary === 'string' && row.summary.trim() ? row.summary.trim() : null,
    })
  }
  return entries
}

function normalizeStructureScan(raw: unknown): StructureScanData | null {
  if (!raw || typeof raw !== 'object') return null
  const row = raw as Record<string, unknown>
  const roots = Array.isArray(row.roots)
    ? row.roots
        .map(entry => {
          if (!entry || typeof entry !== 'object') return null
          const root = entry as Record<string, unknown>
          if (typeof root.path !== 'string' || !root.path.trim()) return null
          return {
            path: root.path.trim(),
            exists: !!root.exists,
            structureCount: typeof root.structureCount === 'number' ? root.structureCount : 0,
          } satisfies StructureScanRoot
        })
        .filter((entry): entry is StructureScanRoot => !!entry)
    : []
  return {
    roots,
    totalStructures: typeof row.totalStructures === 'number' ? row.totalStructures : 0,
    uploadRoot: typeof row.uploadRoot === 'string' && row.uploadRoot.trim() ? row.uploadRoot.trim() : null,
    nativeCounts: row.nativeCounts && typeof row.nativeCounts === 'object'
      ? {
          templates: typeof (row.nativeCounts as Record<string, unknown>).templates === 'number' ? (row.nativeCounts as Record<string, number>).templates : 0,
          worldgen: typeof (row.nativeCounts as Record<string, unknown>).worldgen === 'number' ? (row.nativeCounts as Record<string, number>).worldgen : 0,
        }
      : undefined,
  }
}

function normalizeEntityScan(raw: unknown): EntityScanData | null {
  if (!raw || typeof raw !== 'object') return null
  const row = raw as Record<string, unknown>
  const roots: EntityScanRoot[] = []
  if (Array.isArray(row.roots)) {
    for (const entry of row.roots) {
      if (!entry || typeof entry !== 'object') continue
      const root = entry as Record<string, unknown>
      if (typeof root.path !== 'string' || !root.path.trim()) continue
      roots.push({
        path: root.path.trim(),
        exists: !!root.exists,
        presetCount: typeof root.presetCount === 'number' ? root.presetCount : 0,
        rootKind: typeof root.rootKind === 'string' ? root.rootKind : undefined,
      })
    }
  }
  return {
    roots,
    totalPresets: typeof row.totalPresets === 'number' ? row.totalPresets : 0,
    uploadRoot: typeof row.uploadRoot === 'string' && row.uploadRoot.trim() ? row.uploadRoot.trim() : null,
    warnings: Array.isArray(row.warnings) ? row.warnings.filter((entry): entry is string => typeof entry === 'string') : [],
  }
}

function formatBytes(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '—'
  if (value < 1024) return `${value} B`
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`
  if (value < 1024 * 1024 * 1024) return `${(value / (1024 * 1024)).toFixed(1)} MB`
  return `${(value / (1024 * 1024 * 1024)).toFixed(1)} GB`
}

function inferSummary(entry: StructureCatalogEntry | EntityCatalogEntry) {
  if ('sourceKind' in entry) {
    return entry.summary || `${entry.category} structure from ${entry.sourceKind}.`
  }
  return entry.summary || `${entry.category} entity ready for spawning.`
}

function categoryPage<T>(entries: T[], page: number, pageSize: number) {
  return entries.slice(page * pageSize, page * pageSize + pageSize)
}

function clampPage(page: number, count: number) {
  return Math.max(0, Math.min(page, Math.max(0, count - 1)))
}

function pillStyle(enabled: boolean | null) {
  return enabled
    ? { borderColor: 'var(--accent-mid)', background: 'var(--accent-dim)', color: 'var(--accent)' }
    : { borderColor: 'var(--border)', background: 'var(--panel)', color: enabled === null ? 'var(--text-dim)' : 'var(--text)' }
}

export default function WorldsSection({
  players,
  selectedPlayer,
  onSelectedPlayerChange,
}: {
  players: string[]
  selectedPlayer: string
  onSelectedPlayerChange: (player: string) => void
}) {
  const [features, setFeatures] = useState<FeatureFlags | null>(null)
  const [pluginStack, setPluginStack] = useState<PluginStackData | null>(null)
  const [worldsData, setWorldsData] = useState<WorldsData | null>(null)
  const [structures, setStructures] = useState<StructureCatalogEntry[]>([])
  const [entities, setEntities] = useState<EntityCatalogEntry[]>([])
  const [placements, setPlacements] = useState<PlacementEntry[]>([])
  const [worldDetails, setWorldDetails] = useState<Record<string, WorldSettingsEntry>>({})
  const [liveEntities, setLiveEntities] = useState<LiveEntityEntry[]>([])
  const [playerWorlds, setPlayerWorlds] = useState<Record<string, string | null>>({})
  const [structureScan, setStructureScan] = useState<StructureScanData | null>(null)
  const [entityScan, setEntityScan] = useState<EntityScanData | null>(null)
  const [structureLoadError, setStructureLoadError] = useState<string | null>(null)
  const [entityLoadError, setEntityLoadError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [status, setStatus] = useState<string | null>(null)
  const [collapseAllActive, setCollapseAllActive] = useState(false)

  const [spawnWorld, setSpawnWorld] = useState('')
  const [spawnMode, setSpawnMode] = useState<LocationMode>('player')
  const [spawnX, setSpawnX] = useState('')
  const [spawnY, setSpawnY] = useState('')
  const [spawnZ, setSpawnZ] = useState('')

  const [structureSearch, setStructureSearch] = useState('')
  const [structureCategory, setStructureCategory] = useState('all')
  const [selectedStructure, setSelectedStructure] = useState<StructureCatalogEntry | null>(null)
  const [structureModalMode, setStructureModalMode] = useState<'place' | 'remove'>('place')
  const [placementToRemove, setPlacementToRemove] = useState<PlacementEntry | null>(null)
  const [structureMode, setStructureMode] = useState<LocationMode>('player')
  const [structureWorld, setStructureWorld] = useState('')
  const [structureX, setStructureX] = useState('')
  const [structureY, setStructureY] = useState('')
  const [structureZ, setStructureZ] = useState('')
  const [structureRotation, setStructureRotation] = useState('0')
  const [structureIncludeAir, setStructureIncludeAir] = useState(false)
  const [structureBusy, setStructureBusy] = useState(false)
  const [worldActionBusy, setWorldActionBusy] = useState<string | null>(null)
  const [structureCategoryPage, setStructureCategoryPage] = useState(0)

  const [entitySearch, setEntitySearch] = useState('')
  const [entityCategory, setEntityCategory] = useState('all')
  const [selectedEntity, setSelectedEntity] = useState<EntityCatalogEntry | null>(null)
  const [entityMode, setEntityMode] = useState<LocationMode>('player')
  const [entityWorld, setEntityWorld] = useState('')
  const [entityX, setEntityX] = useState('')
  const [entityY, setEntityY] = useState('')
  const [entityZ, setEntityZ] = useState('')
  const [entityCount, setEntityCount] = useState('1')
  const [entityBusy, setEntityBusy] = useState(false)
  const [presetEditorOpen, setPresetEditorOpen] = useState(false)
  const [presetEditorBusy, setPresetEditorBusy] = useState(false)
  const [editingPreset, setEditingPreset] = useState<EntityCatalogEntry | null>(null)
  const [catalogBusy, setCatalogBusy] = useState(false)
  const [entityCategoryPage, setEntityCategoryPage] = useState(0)
  const [liveEntityWorldFilter, setLiveEntityWorldFilter] = useState('')

  const [placementWorldFilter, setPlacementWorldFilter] = useState('')
  const [placementMode, setPlacementMode] = useState<LocationMode>('coords')
  const [placementX, setPlacementX] = useState('')
  const [placementY, setPlacementY] = useState('')
  const [placementZ, setPlacementZ] = useState('')
  const structureUploadRef = useRef<HTMLInputElement | null>(null)
  const entityUploadRef = useRef<HTMLInputElement | null>(null)

  const canPluginStatus = features?.enable_plugin_stack_status ?? true
  const canWorldInventory = features?.enable_world_inventory ?? true
  const canSpawnTools = features?.enable_world_spawn_tools ?? true
  const canStructureCatalog = features?.enable_structure_catalog ?? true
  const canEntityCatalog = features?.enable_entity_catalog ?? true

  const loadFeatures = useCallback(async () => {
    try {
      const res = await fetch('/api/account/preferences', { cache: 'no-store' })
      const data = await res.json()
      if (data.ok && data.features) setFeatures(data.features)
    } catch {
      setFeatures(null)
    }
  }, [])

  const loadWorldDetail = useCallback(async (worldName: string) => {
    if (!worldName) return
    try {
      const res = await fetch(`/api/minecraft/worlds/${encodeURIComponent(worldName)}`, { cache: 'no-store' })
      const data = await res.json()
      if (!data.ok || !data.world) throw new Error(data.error || 'Failed to load world settings')
      setWorldDetails(current => ({ ...current, [worldName]: data.world as WorldSettingsEntry }))
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Failed to load world settings')
    }
  }, [])

  const toggleCollapseAll = useCallback(() => {
    setCollapsibleGroupState(WORLDS_COLLAPSIBLE_GROUP, collapseAllActive)
    setCollapseAllActive(current => !current)
  }, [collapseAllActive])

  const loadData = useCallback(async (showSpinner = false) => {
    if (showSpinner) setLoading(true)
    setError(null)
    setStructureLoadError(null)
    setEntityLoadError(null)
    const nextErrors: string[] = []

    if (canPluginStatus) {
      try {
        const res = await fetch('/api/minecraft/plugin-stack', { cache: 'no-store' })
        setPluginStack(await res.json())
      } catch (nextError) {
        nextErrors.push(nextError instanceof Error ? nextError.message : 'Failed to load integration status')
      }
    }

    if (canWorldInventory || canSpawnTools) {
      try {
        const res = await fetch('/api/minecraft/worlds', { cache: 'no-store' })
        const data = await res.json()
        if (!data.ok) throw new Error(data.error || 'Failed to load worlds')
        setWorldsData(data)
      } catch (nextError) {
        nextErrors.push(nextError instanceof Error ? nextError.message : 'Failed to load worlds')
      }
    }

    if (canStructureCatalog) {
      try {
        const res = await fetch('/api/minecraft/structures', { cache: 'no-store' })
        const data = await res.json()
        if (!data.ok) {
          setStructureLoadError(data.error || 'Failed to load structure catalog')
          setStructures([])
          setStructureScan(normalizeStructureScan(data.scan))
        } else {
          setStructures(normalizeStructureEntries(data.structures))
          setStructureScan(normalizeStructureScan(data.scan))
        }
      } catch (nextError) {
        setStructureLoadError(nextError instanceof Error ? nextError.message : 'Failed to load structure catalog')
        setStructures([])
        setStructureScan(null)
      }
    }

    if (canEntityCatalog) {
      try {
        const res = await fetch('/api/minecraft/entities', { cache: 'no-store' })
        const data = await res.json()
        if (!data.ok) {
          setEntityLoadError(data.error || 'Failed to load entity catalog')
          setEntities(FALLBACK_ENTITY_CATALOG)
          setEntityScan(null)
        } else {
          const nextEntities = normalizeEntityEntries(data.entities)
          setEntities(nextEntities.length > 0 ? nextEntities : FALLBACK_ENTITY_CATALOG)
          setEntityScan(normalizeEntityScan(data.scan))
          setEntityLoadError(data.warning || (nextEntities.length === 0 ? 'Using built-in entity catalog fallback.' : null))
        }
      } catch (nextError) {
        setEntityLoadError(nextError instanceof Error ? nextError.message : 'Failed to load entity catalog')
        setEntities(FALLBACK_ENTITY_CATALOG)
        setEntityScan(null)
      }
    }

    if (canEntityCatalog) {
      try {
        const res = await fetch('/api/minecraft/entities/live', { cache: 'no-store' })
        const data = await res.json()
        setLiveEntities(data.ok ? (data.entities ?? []) : [])
      } catch {
        setLiveEntities([])
      }
    }

    if (canStructureCatalog) {
      try {
        const res = await fetch('/api/minecraft/structures/placements', { cache: 'no-store' })
        const data = await res.json()
        setPlacements(data.ok ? data.placements ?? [] : [])
      } catch {
        setPlacements([])
      }
    }

    setError(nextErrors[0] ?? null)
    setLoading(false)
  }, [canEntityCatalog, canPluginStatus, canSpawnTools, canStructureCatalog, canWorldInventory])

  useEffect(() => {
    void loadFeatures()
  }, [loadFeatures])

  useEffect(() => {
    void loadData(true)
    const id = setInterval(() => void loadData(false), 30_000)
    return () => clearInterval(id)
  }, [loadData])

  useEffect(() => {
    const firstWorld = worldsData?.worlds?.[0]?.name ?? ''
    if (!spawnWorld && firstWorld) setSpawnWorld(firstWorld)
    if (!structureWorld && firstWorld) setStructureWorld(firstWorld)
    if (!entityWorld && firstWorld) setEntityWorld(firstWorld)
    if (!placementWorldFilter && firstWorld) setPlacementWorldFilter(firstWorld)
  }, [entityWorld, placementWorldFilter, spawnWorld, structureWorld, worldsData])

  useEffect(() => {
    let cancelled = false
    if (players.length === 0) {
      setPlayerWorlds({})
      return
    }
    void Promise.all(players.map(async player => {
      try {
        const res = await fetch(`/api/minecraft/player-location?player=${encodeURIComponent(player)}`, { cache: 'no-store' })
        const data = await res.json()
        return [player, data.ok ? (typeof data.world === 'string' ? data.world : null) : null] as const
      } catch {
        return [player, null] as const
      }
    })).then(entries => {
      if (cancelled) return
      setPlayerWorlds(Object.fromEntries(entries))
    })
    return () => { cancelled = true }
  }, [players])

  const structureCategories = useMemo(
    () => ['all', ...Array.from(new Set(structures.map(entry => entry.category))).sort((a, b) => a.localeCompare(b))],
    [structures],
  )
  const entityCategories = useMemo(
    () => ['all', ...Array.from(new Set(entities.map(entry => entry.category))).sort((a, b) => a.localeCompare(b))],
    [entities],
  )

  useEffect(() => {
    if (!structureCategories.includes(structureCategory)) setStructureCategory('all')
  }, [structureCategories, structureCategory])

  useEffect(() => {
    if (!entityCategories.includes(entityCategory)) setEntityCategory('all')
  }, [entityCategories, entityCategory])

  useEffect(() => {
    setStructureCategoryPage(0)
  }, [structureCategory, structureSearch])

  useEffect(() => {
    setEntityCategoryPage(0)
  }, [entityCategory, entitySearch])

  const filteredStructures = useMemo(() => {
    const needle = structureSearch.trim().toLowerCase()
    return structures.filter(entry => {
      if (structureCategory !== 'all' && entry.category !== structureCategory) return false
      if (!needle) return true
      return entry.label.toLowerCase().includes(needle) || entry.id.toLowerCase().includes(needle)
    })
  }, [structureCategory, structureSearch, structures])

  const groupedStructures = useMemo(() => {
    const groups = new Map<string, StructureCatalogEntry[]>()
    for (const entry of filteredStructures) {
      const bucket = groups.get(entry.category)
      if (bucket) bucket.push(entry)
      else groups.set(entry.category, [entry])
    }
    return Array.from(groups.entries()).sort((a, b) => a[0].localeCompare(b[0]))
  }, [filteredStructures])

  const filteredEntities = useMemo(() => {
    const needle = entitySearch.trim().toLowerCase()
    return entities.filter(entry => {
      if (entityCategory !== 'all' && entry.category !== entityCategory) return false
      if (!needle) return true
      return entry.label.toLowerCase().includes(needle) || entry.id.toLowerCase().includes(needle)
    })
  }, [entities, entityCategory, entitySearch])

  const groupedEntities = useMemo(() => {
    const groups = new Map<string, EntityCatalogEntry[]>()
    for (const entry of filteredEntities) {
      const bucket = groups.get(entry.category)
      if (bucket) bucket.push(entry)
      else groups.set(entry.category, [entry])
    }
    return Array.from(groups.entries()).sort((a, b) => a[0].localeCompare(b[0]))
  }, [filteredEntities])

  const visiblePlacements = useMemo(() => {
    return placements.filter(entry => !placementWorldFilter || entry.world === placementWorldFilter)
  }, [placementWorldFilter, placements])

  const visibleLiveEntities = useMemo(() => {
    return liveEntities.filter(entry => !liveEntityWorldFilter || entry.world === liveEntityWorldFilter)
  }, [liveEntities, liveEntityWorldFilter])

  const structureCategoryPageCount = Math.max(1, Math.ceil(groupedStructures.length / WORLD_CATEGORY_PAGE_SIZE))
  const entityCategoryPageCount = Math.max(1, Math.ceil(groupedEntities.length / WORLD_CATEGORY_PAGE_SIZE))
  const pagedStructureGroups = categoryPage(groupedStructures, clampPage(structureCategoryPage, structureCategoryPageCount), WORLD_CATEGORY_PAGE_SIZE)
  const pagedEntityGroups = categoryPage(groupedEntities, clampPage(entityCategoryPage, entityCategoryPageCount), WORLD_CATEGORY_PAGE_SIZE)

  useEffect(() => {
    setStructureCategoryPage(current => clampPage(current, structureCategoryPageCount))
  }, [structureCategoryPageCount])

  useEffect(() => {
    setEntityCategoryPage(current => clampPage(current, entityCategoryPageCount))
  }, [entityCategoryPageCount])

  const postJson = useCallback(async (url: string, body: Record<string, unknown>) => {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    const data = await res.json()
    if (!data.ok) throw new Error(data.error || 'Action failed')
    playSound('success')
    return data
  }, [])

  const resolvePlayerTarget = useCallback(async (player: string, expectedWorld?: string) => {
    if (!player) throw new Error('Select a player first.')
    const res = await fetch(`/api/minecraft/player-location?player=${encodeURIComponent(player)}`, { cache: 'no-store' })
    const data = await res.json()
    if (!data.ok || !data.location || typeof data.world !== 'string') {
      throw new Error(data.error || 'Failed to resolve player location')
    }
    if (expectedWorld && data.world !== expectedWorld) {
      throw new Error(`${player} is in ${data.world}, not ${expectedWorld}. Choose a player in that world or use coordinates.`)
    }
    return data as { ok: true; world: string; location: { x: number; y: number; z: number } }
  }, [])

  const handleWorldSettingChange = useCallback(async (worldName: string, key: string, value: string | boolean) => {
    try {
      setWorldActionBusy(`${worldName}:${key}`)
      const res = await fetch(`/api/minecraft/worlds/${encodeURIComponent(worldName)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key, value }),
      })
      const data = await res.json()
      if (!data.ok) throw new Error(data.error || 'Failed to update world setting')
      if (data.world) {
        setWorldDetails(current => ({ ...current, [worldName]: data.world as WorldSettingsEntry }))
      }
      setStatus(`Updated ${worldName}: ${key}.`)
      await loadData(false)
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Failed to update world setting')
    } finally {
      setWorldActionBusy(null)
    }
  }, [loadData])

  const handleWorldDelete = useCallback(async (worldName: string) => {
    if (typeof window !== 'undefined' && !window.confirm(`Delete ${worldName}? This removes the world from the server.`)) {
      return
    }
    try {
      setWorldActionBusy(`${worldName}:delete`)
      const res = await fetch(`/api/minecraft/worlds/${encodeURIComponent(worldName)}`, { method: 'DELETE' })
      const data = await res.json()
      if (!data.ok) throw new Error(data.error || 'Failed to delete world')
      setStatus(`Deleted ${worldName}.`)
      await loadData(true)
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Failed to delete world')
    } finally {
      setWorldActionBusy(null)
    }
  }, [loadData])

  const handleWorldLoadToggle = useCallback(async (worldName: string, loaded: boolean) => {
    try {
      setWorldActionBusy(`${worldName}:${loaded ? 'unload' : 'load'}`)
      const endpoint = loaded ? 'unload' : 'load'
      const res = await fetch(`/api/minecraft/worlds/${encodeURIComponent(worldName)}/${endpoint}`, { method: 'POST' })
      const data = await res.json()
      if (!data.ok) throw new Error(data.error || `Failed to ${endpoint} world`)
      setStatus(`${loaded ? 'Unloaded' : 'Loaded'} ${worldName}.`)
      await loadData(true)
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Failed to update world load state')
    } finally {
      setWorldActionBusy(null)
    }
  }, [loadData])

  const handleSetSpawn = async () => {
    if (!spawnWorld) return
    try {
      const payload = spawnMode === 'player'
        ? { locationMode: 'player', player: selectedPlayer }
        : { locationMode: 'coords', x: Number(spawnX), y: Number(spawnY), z: Number(spawnZ) }
      const data = await postJson(`/api/minecraft/worlds/${encodeURIComponent(spawnWorld)}/spawn`, payload)
      setStatus(`Updated spawn for ${data.world}.`)
      await loadData(false)
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Failed to update world spawn')
    }
  }

  const handlePlaceStructure = async () => {
    if (!selectedStructure) return
    setStructureBusy(true)
    try {
      if (structureMode === 'world-player' && !structureWorld) {
        throw new Error('Select a world first.')
      }
      const playerTarget = structureMode === 'player'
        ? await resolvePlayerTarget(selectedPlayer)
        : structureMode === 'world-player'
          ? await resolvePlayerTarget(selectedPlayer, structureWorld)
          : null
      const payload = playerTarget
        ? {
            structureId: selectedStructure.id,
            structureLabel: selectedStructure.label,
            bridgeRef: selectedStructure.bridgeRef,
            sourceKind: selectedStructure.sourceKind,
            placementKind: selectedStructure.placementKind,
            locationMode: 'player',
            player: selectedPlayer,
            rotation: Number(structureRotation),
            includeAir: structureIncludeAir,
          }
        : {
            structureId: selectedStructure.id,
            structureLabel: selectedStructure.label,
            bridgeRef: selectedStructure.bridgeRef,
            sourceKind: selectedStructure.sourceKind,
            placementKind: selectedStructure.placementKind,
            locationMode: 'coords',
            world: structureWorld,
            x: Number(structureX),
            y: Number(structureY),
            z: Number(structureZ),
            rotation: Number(structureRotation),
            includeAir: structureIncludeAir,
          }
      const data = await postJson('/api/minecraft/structures/place', payload)
      setStatus(`Placed ${selectedStructure.label}${data.world ? ` in ${data.world}` : ''}.`)
      setSelectedStructure(null)
      await loadData(false)
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Failed to place structure')
    } finally {
      setStructureBusy(false)
    }
  }

  const handleRemoveStructure = async () => {
    if (!placementToRemove) return
    setStructureBusy(true)
    try {
      await postJson('/api/minecraft/structures/remove', { placementId: placementToRemove.id })
      setStatus(`Removed ${placementToRemove.structure_label}.`)
      setPlacementToRemove(null)
      setSelectedStructure(null)
      await loadData(false)
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Failed to remove structure')
    } finally {
      setStructureBusy(false)
    }
  }

  const handleFindPlacements = async () => {
    try {
      let world = placementWorldFilter
      let x = placementX
      let y = placementY
      let z = placementZ

      if (placementMode === 'player') {
        if (!selectedPlayer) {
          throw new Error('Pick a selected player first.')
        }
        const playerRes = await fetch(`/api/minecraft/player-location?player=${encodeURIComponent(selectedPlayer)}`, { cache: 'no-store' })
        const playerData = await playerRes.json()
        if (!playerData.ok || !playerData.location || !playerData.world) {
          throw new Error(playerData.error || 'Failed to resolve selected player location')
        }
        world = playerData.world
        x = String(playerData.location.x)
        y = String(playerData.location.y)
        z = String(playerData.location.z)
        setPlacementWorldFilter(world)
        setPlacementX(x)
        setPlacementY(y)
        setPlacementZ(z)
      }

      if (!world || !x || !y || !z) {
        throw new Error('Choose a player or enter a full location first.')
      }

      const query = new URLSearchParams({ world, x, y, z })
      const res = await fetch(`/api/minecraft/structures/placements?${query.toString()}`, { cache: 'no-store' })
      const data = await res.json()
      if (!data.ok) throw new Error(data.error || 'Failed to locate placements')
      setPlacements(data.placements ?? [])
      setStatus((data.placements ?? []).length > 0 ? `Found ${(data.placements ?? []).length} structure placement(s).` : 'No tracked structures found at that location.')
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Failed to find structures')
    }
  }

  const handleSpawnEntity = async () => {
    if (!selectedEntity) return
    setEntityBusy(true)
    try {
      if (entityMode === 'world-player' && !entityWorld) {
        throw new Error('Select a world first.')
      }
      const playerTarget = entityMode === 'player'
        ? await resolvePlayerTarget(selectedPlayer)
        : entityMode === 'world-player'
          ? await resolvePlayerTarget(selectedPlayer, entityWorld)
          : null
      const payload = playerTarget
        ? { ...selectedEntity, entityId: selectedEntity.entityId ?? selectedEntity.id, sourceKind: selectedEntity.sourceKind, locationMode: 'player', player: selectedPlayer, count: Number(entityCount) || 1 }
        : {
            ...selectedEntity,
            entityId: selectedEntity.entityId ?? selectedEntity.id,
            sourceKind: selectedEntity.sourceKind,
            locationMode: 'coords',
            world: entityWorld,
            x: Number(entityX),
            y: Number(entityY),
            z: Number(entityZ),
            count: Number(entityCount) || 1,
          }
      const data = await postJson('/api/minecraft/entities/spawn', payload)
      setStatus(`Spawned ${data.count} ${selectedEntity.label}${data.world ? ` in ${data.world}` : ''}.`)
      setSelectedEntity(null)
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Failed to spawn entity')
    } finally {
      setEntityBusy(false)
    }
  }

  const handleStructureUpload = async (file: File | null) => {
    if (!file) return
    try {
      setCatalogBusy(true)
      const reader = new FileReader()
      const dataBase64 = await new Promise<string>((resolve, reject) => {
        reader.onload = () => resolve(String(reader.result ?? ''))
        reader.onerror = () => reject(reader.error ?? new Error('Failed to read file'))
        reader.readAsDataURL(file)
      })
      await postJson('/api/minecraft/structures/upload', { name: file.name, dataBase64 })
      setStatus(`Uploaded ${file.name}.`)
      await loadData(false)
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Failed to upload structure')
    } finally {
      setCatalogBusy(false)
      if (structureUploadRef.current) structureUploadRef.current.value = ''
    }
  }

  const handleEntityPresetUpload = async (file: File | null) => {
    if (!file) return
    try {
      setCatalogBusy(true)
      const text = await file.text()
      const preset = JSON.parse(text)
      await postJson('/api/minecraft/entities/presets', { name: file.name.replace(/\.json$/i, ''), preset })
      setStatus(`Uploaded ${file.name}.`)
      await loadData(false)
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Failed to upload entity preset')
    } finally {
      setCatalogBusy(false)
      if (entityUploadRef.current) entityUploadRef.current.value = ''
    }
  }

  const handleSavePreset = async (payload: Record<string, unknown>) => {
    try {
      setPresetEditorBusy(true)
      await postJson('/api/minecraft/entities/presets', { name: payload.id, preset: payload })
      setStatus(`${typeof payload.label === 'string' ? payload.label : 'Entity preset'} saved.`)
      setPresetEditorOpen(false)
      setEditingPreset(null)
      await loadData(false)
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Failed to save preset')
    } finally {
      setPresetEditorBusy(false)
    }
  }

  const handleDeletePreset = async (entry: EntityCatalogEntry) => {
    if (!entry.relativePath) return
    try {
      setCatalogBusy(true)
      const res = await fetch(`/api/minecraft/entities/presets?relativePath=${encodeURIComponent(entry.relativePath)}`, { method: 'DELETE' })
      const data = await res.json()
      if (!data.ok) throw new Error(data.error || 'Failed to delete preset')
      setStatus(`Deleted ${entry.label}.`)
      await loadData(false)
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Failed to delete preset')
    } finally {
      setCatalogBusy(false)
    }
  }

  const handleOpenRemoval = (placement: PlacementEntry) => {
    setPlacementToRemove(placement)
    setStructureModalMode('remove')
    setSelectedStructure({
      id: placement.structure_id,
      label: placement.structure_label,
      category: placement.world,
      sourceKind: placement.source_kind,
      placementKind: placement.source_kind === 'native' ? 'native-template' : 'schematic',
      bridgeRef: '',
      summary: `Placed at ${placement.origin_x}, ${placement.origin_y}, ${placement.origin_z} in ${placement.world}.`,
      dimensions: {
        width: placement.max_x - placement.min_x + 1,
        height: placement.max_y - placement.min_y + 1,
        length: placement.max_z - placement.min_z + 1,
      },
    })
  }

  const currentSpawn = useMemo(() => worldsData?.worlds.find(entry => entry.name === spawnWorld)?.spawn ?? null, [spawnWorld, worldsData])
  const worldNames = useMemo(() => worldsData?.worlds.map(entry => entry.name) ?? [], [worldsData])
  const collapseAllLabel = collapseAllActive ? 'Expand All' : 'Collapse All'

  return (
    <div className="space-y-4 pb-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="font-mono text-base tracking-widest text-[var(--accent)]">WORLDS</h2>
          <div className="mt-1 text-[12px] font-mono text-[var(--text-dim)]">
            World management, structure placement, entity spawning, and build tools.
          </div>
        </div>
        <button
          onClick={() => void loadData(true)}
          className="rounded border border-[var(--border)] px-3 py-2 text-[12px] font-mono text-[var(--text-dim)] hover:border-[var(--accent-mid)]"
        >
          Refresh
        </button>
      </div>

      <div className="flex justify-end">
        <button
          type="button"
          onClick={toggleCollapseAll}
          className="rounded border border-[var(--border)] px-3 py-2 text-[12px] font-mono text-[var(--text-dim)] hover:border-[var(--accent-mid)]"
        >
          {collapseAllLabel}
        </button>
      </div>

      <CollapsibleCard title="ACTIVE PLAYER" storageKey="worlds:active-player" bodyClassName="p-4 space-y-3" groupKey={WORLDS_COLLAPSIBLE_GROUP}>
        <PlayerPicker
          online={players}
          selected={selectedPlayer}
          onSelect={onSelectedPlayerChange}
          placeholder="Select or type player name…"
        />
        <div className="text-[12px] font-mono text-[var(--text-dim)]">
          {selectedPlayer
            ? <>Using <span className="text-[var(--accent)]">{selectedPlayer}</span> for player-targeted structure, entity, and spawn actions.</>
            : 'Pick a player when you want to target their current live location.'}
        </div>
      </CollapsibleCard>

      {error && <div className="glass-card p-4 text-[13px] font-mono text-red-400">{error}</div>}
      {status && <div className="glass-card p-4 text-[13px] font-mono text-[var(--accent)]">{status}</div>}
      {loading && !worldsData && <div className="glass-card p-4 text-[13px] font-mono text-[var(--text-dim)]">Loading world and integration surface…</div>}

      {canPluginStatus && pluginStack && (
        <CollapsibleCard title="INTEGRATIONS" storageKey="worlds:plugin-stack" bodyClassName="p-5 space-y-4" groupKey={WORLDS_COLLAPSIBLE_GROUP}>
          <div className="grid gap-3 md:grid-cols-2">
            <div className="rounded-lg border border-[var(--border)] bg-[var(--panel)] p-4">
              <div className="text-[11px] font-mono tracking-widest text-[var(--text-dim)]">BRIDGE STATUS</div>
              <div className="mt-2 text-[13px] font-mono text-[var(--text)]">
                {pluginStack.bridge?.ok === false ? pluginStack.bridge.error : 'Connected'}
              </div>
              <div className="mt-1 text-[12px] font-mono text-[var(--text-dim)]">
                {pluginStack.bridge?.serverVersion ? `Paper ${pluginStack.bridge.serverVersion}` : 'Server version unavailable'}
              </div>
            </div>
            <div className="rounded-lg border border-[var(--border)] bg-[var(--panel)] p-4">
              <div className="text-[11px] font-mono tracking-widest text-[var(--text-dim)]">SIDECAR STATUS</div>
              <div className="mt-2 text-[13px] font-mono text-[var(--text)]">
                {pluginStack.sidecar?.ok === false ? pluginStack.sidecar.error : 'Connected'}
              </div>
              <div className="mt-1 text-[12px] font-mono text-[var(--text-dim)]">
                {(pluginStack.sidecar?.capabilities ?? []).length > 0 ? (pluginStack.sidecar?.capabilities ?? []).join(', ') : 'No sidecar capabilities reported'}
              </div>
            </div>
          </div>
        </CollapsibleCard>
      )}

      {canWorldInventory && worldsData && (
        <CollapsibleCard title="WORLD INVENTORY" storageKey="worlds:inventory" bodyClassName="p-5 space-y-4" groupKey={WORLDS_COLLAPSIBLE_GROUP}>
          <div className="grid gap-3">
            {worldsData.worlds.map(world => {
              const detail = { ...world, ...(worldDetails[world.name] ?? {}) } as WorldSettingsEntry
              const gamerules = worldDetails[world.name]?.gamerules ?? null
              return (
                <CollapsibleCard
                  key={world.name}
                  title={
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <div className="text-[14px] font-mono text-[var(--text)]">{detail.alias?.trim() || detail.name}</div>
                        <div className="text-[11px] font-mono text-[var(--text-dim)]">
                          {detail.name} · {detail.environment} · {detail.loaded ? 'loaded' : 'unloaded'}
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <span className="rounded border px-2 py-1 text-[10px] font-mono tracking-widest" style={pillStyle(detail.pvp)}>PVP</span>
                        <span className="rounded border px-2 py-1 text-[10px] font-mono tracking-widest" style={pillStyle(detail.allowFlight)}>FLIGHT</span>
                        <span className="rounded border px-2 py-1 text-[10px] font-mono tracking-widest" style={pillStyle(detail.allowWeather)}>WEATHER</span>
                      </div>
                    </div>
                  }
                  storageKey={`worlds:inventory:${world.name}`}
                  defaultOpen={false}
                  bodyClassName="p-4 space-y-4"
                  groupKey={WORLDS_COLLAPSIBLE_GROUP}
                  onOpenChange={(open) => {
                    if (open && !worldDetails[world.name]) void loadWorldDetail(world.name)
                  }}
                >
                  <div className="grid gap-2 text-[12px] font-mono text-[var(--text-dim)] sm:grid-cols-2 xl:grid-cols-3">
                    <div>Players: <span className="text-[var(--text)]">{detail.players}</span></div>
                    <div>Difficulty: <span className="text-[var(--text)]">{detail.difficulty ?? '—'}</span></div>
                    <div>Disk: <span className="text-[var(--text)]">{formatBytes(detail.fs?.sizeBytes)}</span></div>
                    <div>Spawn: <span className="text-[var(--text)]">{detail.spawn ? `${detail.spawn.x}, ${detail.spawn.y}, ${detail.spawn.z}` : '—'}</span></div>
                    <div>Path: <span className="text-[var(--text)]">{detail.fs?.path ?? '—'}</span></div>
                    <div>Map: <span className="text-[var(--text)]">{detail.fs?.mapUrl ? 'Available' : 'Unavailable'}</span></div>
                  </div>

                  <div className="space-y-2">
                    <div className="text-[11px] font-mono tracking-widest text-[var(--text-dim)]">WORLD FLAGS</div>
                    <div className="flex flex-wrap gap-2">
                      {WORLD_TOGGLE_SETTINGS.map(([settingKey, label]) => {
                        const currentValue = settingKey === 'pvp'
                          ? detail.pvp
                          : settingKey === 'flight'
                            ? detail.allowFlight
                            : settingKey === 'weather'
                              ? detail.allowWeather
                              : settingKey === 'hidden'
                                ? detail.hidden
                                : detail.autoLoad
                        const busy = worldActionBusy === `${world.name}:${settingKey}`
                        return (
                          <button
                            key={settingKey}
                            type="button"
                            disabled={busy || currentValue === null}
                            onClick={() => void handleWorldSettingChange(world.name, settingKey, !currentValue)}
                            className="rounded border px-3 py-2 text-[11px] font-mono tracking-widest disabled:opacity-40"
                            style={pillStyle(currentValue)}
                          >
                            {busy ? '…' : `${label} ${currentValue ? 'ON' : 'OFF'}`}
                          </button>
                        )
                      })}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="text-[11px] font-mono tracking-widest text-[var(--text-dim)]">DIFFICULTY</div>
                    <div className="grid gap-2 sm:grid-cols-4">
                      {WORLD_DIFFICULTIES.map(level => (
                        <button
                          key={level}
                          type="button"
                          disabled={worldActionBusy === `${world.name}:difficulty`}
                          onClick={() => void handleWorldSettingChange(world.name, 'difficulty', level)}
                          className="rounded border px-3 py-2 text-[11px] font-mono tracking-widest disabled:opacity-40"
                          style={detail.difficulty === level
                            ? { borderColor: 'var(--accent-mid)', background: 'var(--accent-dim)', color: 'var(--accent)' }
                            : { borderColor: 'var(--border)', background: 'var(--panel)', color: 'var(--text-dim)' }}
                        >
                          {level.toUpperCase()}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="text-[11px] font-mono tracking-widest text-[var(--text-dim)]">WORLD GAMERULES</div>
                    {gamerules ? (
                      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
                        {Object.entries(WORLD_GAMERULE_LABELS).map(([rule, label]) => {
                          const currentValue = gamerules?.[rule] ?? null
                          const busy = worldActionBusy === `${world.name}:${rule}`
                          return (
                            <button
                              key={rule}
                              type="button"
                              disabled={busy || currentValue === null}
                              onClick={() => void handleWorldSettingChange(world.name, rule, !currentValue)}
                              className="flex items-center justify-between rounded-xl border px-3 py-3 text-left font-mono text-[11px] disabled:opacity-40"
                              style={currentValue
                                ? { borderColor: 'var(--accent-mid)', background: 'var(--accent-dim)', color: 'var(--accent)' }
                                : { borderColor: 'var(--border)', background: 'var(--panel)', color: 'var(--text-dim)' }}
                            >
                              <span>{label}</span>
                              <span>{busy ? '…' : currentValue ? 'ON' : 'OFF'}</span>
                            </button>
                          )
                        })}
                      </div>
                    ) : (
                      <div className="rounded-xl border border-[var(--border)] bg-[var(--panel)] px-4 py-3 text-[11px] font-mono text-[var(--text-dim)]">
                        Load this world&apos;s detail card to edit per-world gamerules. Unloaded worlds may not expose gamerules until loaded.
                      </div>
                    )}
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={worldActionBusy === `${world.name}:${detail.loaded ? 'unload' : 'load'}`}
                      onClick={() => void handleWorldLoadToggle(world.name, detail.loaded)}
                      className="rounded border border-[var(--border)] px-3 py-2 text-[11px] font-mono text-[var(--text-dim)] disabled:opacity-40"
                    >
                      {detail.loaded ? 'Unload World' : 'Load World'}
                    </button>
                    <button
                      type="button"
                      disabled={worldActionBusy === `${world.name}:delete`}
                      onClick={() => void handleWorldDelete(world.name)}
                      className="rounded border border-red-900 px-3 py-2 text-[11px] font-mono text-red-400 disabled:opacity-40"
                    >
                      Delete World
                    </button>
                  </div>
                </CollapsibleCard>
              )
            })}
          </div>
        </CollapsibleCard>
      )}

      {canSpawnTools && worldsData && (
        <CollapsibleCard title="WORLD SPAWN" storageKey="worlds:spawn" bodyClassName="p-5 space-y-4" groupKey={WORLDS_COLLAPSIBLE_GROUP}>
          <div className="grid gap-4 lg:grid-cols-[1fr_0.95fr]">
            <div className="rounded-xl border border-[var(--border)] bg-[var(--panel)] p-4 space-y-3">
              <label className="block space-y-1">
                <div className="text-[11px] font-mono tracking-widest text-[var(--text-dim)]">WORLD</div>
                <select value={spawnWorld} onChange={event => setSpawnWorld(event.target.value)} className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg2)] px-3 py-2 text-[13px] font-mono text-[var(--text)]">
                  {worldsData.worlds.map(world => <option key={world.name} value={world.name}>{world.name}</option>)}
                </select>
              </label>
              <div className="flex gap-2">
                {(['player', 'coords'] as const).map(mode => (
                  <button
                    key={mode}
                    onClick={() => setSpawnMode(mode)}
                    className="rounded-lg border px-3 py-2 text-[12px] font-mono transition-all"
                    style={spawnMode === mode
                      ? { borderColor: 'var(--accent-mid)', background: 'var(--accent-dim)', color: 'var(--accent)' }
                      : { borderColor: 'var(--border)', color: 'var(--text-dim)' }}
                  >
                    {mode === 'player' ? 'Use Selected Player' : 'Use Coordinates'}
                  </button>
                ))}
              </div>
              {spawnMode === 'coords' && (
                <div className="grid gap-3 sm:grid-cols-3">
                  {([
                    ['x', spawnX, setSpawnX],
                    ['y', spawnY, setSpawnY],
                    ['z', spawnZ, setSpawnZ],
                  ] as const).map(([axis, value, setter]) => (
                    <label key={axis} className="block space-y-1">
                      <div className="text-[11px] font-mono tracking-widest text-[var(--text-dim)]">{axis.toUpperCase()}</div>
                      <input value={value} onChange={event => setter(event.target.value)} className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg2)] px-3 py-2 text-[13px] font-mono text-[var(--text)]" />
                    </label>
                  ))}
                </div>
              )}
              <button
                onClick={() => void handleSetSpawn()}
                disabled={!spawnWorld || (spawnMode === 'player' ? !selectedPlayer : !spawnX || !spawnY || !spawnZ)}
                className="w-full rounded-lg border border-[var(--accent-mid)] px-3 py-2 text-[12px] font-mono disabled:opacity-40"
                style={{ color: 'var(--accent)', background: 'var(--accent-dim)' }}
              >
                Set Spawn
              </button>
            </div>
            <div className="rounded-xl border border-[var(--border)] bg-[var(--panel)] p-4 space-y-3">
              <div className="text-[11px] font-mono tracking-widest text-[var(--text-dim)]">CURRENT SPAWN</div>
              <div className="text-[13px] font-mono text-[var(--text)]">
                {currentSpawn ? `${currentSpawn.x}, ${currentSpawn.y}, ${currentSpawn.z}` : 'No spawn available'}
              </div>
              <div className="text-[12px] font-mono text-[var(--text-dim)]">
                {spawnMode === 'player'
                  ? selectedPlayer
                    ? `Will use ${selectedPlayer}'s current live location.`
                    : 'Pick a selected player first.'
                  : 'Enter exact coordinates for the new world spawn.'}
              </div>
            </div>
          </div>
        </CollapsibleCard>
      )}

      {canStructureCatalog && (
        <CollapsibleCard title="STRUCTURE CATALOG" storageKey="worlds:structures" bodyClassName="p-5 space-y-4" groupKey={WORLDS_COLLAPSIBLE_GROUP}>
          <input
            ref={structureUploadRef}
            type="file"
            accept=".schem,.schematic"
            className="hidden"
            onChange={event => void handleStructureUpload(event.target.files?.[0] ?? null)}
          />
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="text-[12px] font-mono text-[var(--text-dim)]">
              {structures.length} structure entries
              {structureScan?.nativeCounts
                ? ` · ${structureScan.nativeCounts.templates ?? 0} native templates · ${structureScan.nativeCounts.worldgen ?? 0} native worldgen`
                : ''}
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={catalogBusy}
                onClick={() => structureUploadRef.current?.click()}
                className="rounded-lg border border-[var(--accent-mid)] px-3 py-2 text-[12px] font-mono text-[var(--accent)] disabled:opacity-40"
                style={{ background: 'var(--accent-dim)' }}
              >
                Upload Schematic
              </button>
            </div>
          </div>
          <div className="flex gap-1.5 flex-wrap">
            {structureCategories.map(category => (
              <button
                key={category}
                onClick={() => setStructureCategory(category)}
                className="px-2 py-1 rounded text-[13px] font-mono transition-all border"
                style={structureCategory === category
                  ? { borderColor: 'var(--accent)', background: 'var(--accent-dim)', color: 'var(--accent)' }
                  : { borderColor: 'var(--border)', color: 'var(--text-dim)' }}
              >
                {category === 'all' ? 'All' : category}
              </button>
            ))}
          </div>
          <input
            type="text"
            placeholder="Search structures"
            value={structureSearch}
            onChange={event => setStructureSearch(event.target.value)}
            className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg2)] px-3 py-2 text-[14px] font-mono text-[var(--text)]"
          />
          {structureScan && (
            <div className="rounded-2xl border border-[var(--border)] bg-[var(--panel)] px-4 py-3 text-[11px] font-mono text-[var(--text-dim)]">
              Scanned roots: {structureScan.roots.length > 0 ? structureScan.roots.map(root => `${root.path} (${root.structureCount})`).join(' · ') : 'none'}
              {structureScan.uploadRoot ? ` · upload root ${structureScan.uploadRoot}` : ''}
            </div>
          )}
          {structureLoadError && (
            <div className="rounded-2xl border border-red-900/50 bg-red-950/20 px-4 py-3 text-[11px] font-mono text-red-300">
              {structureLoadError}
            </div>
          )}
          {structureCategory === 'all' && groupedStructures.length > WORLD_CATEGORY_PAGE_SIZE && (
            <div className="flex items-center justify-between rounded-2xl border border-[var(--border)] bg-[var(--panel)] px-4 py-3 text-[11px] font-mono text-[var(--text-dim)]">
              <span>Category page {clampPage(structureCategoryPage, structureCategoryPageCount) + 1} / {structureCategoryPageCount}</span>
              <div className="flex gap-2">
                <button type="button" disabled={structureCategoryPage <= 0} onClick={() => setStructureCategoryPage(page => Math.max(0, page - 1))} className="rounded border border-[var(--border)] px-3 py-1 disabled:opacity-40">Prev</button>
                <button type="button" disabled={structureCategoryPage >= structureCategoryPageCount - 1} onClick={() => setStructureCategoryPage(page => Math.min(structureCategoryPageCount - 1, page + 1))} className="rounded border border-[var(--border)] px-3 py-1 disabled:opacity-40">Next</button>
              </div>
            </div>
          )}
          <div className="space-y-3">
            {pagedStructureGroups.map(([category, entries]) => (
              <CollapsibleCard
                key={category}
                title={`${category.toUpperCase()} (${entries.length})`}
                storageKey={`worlds:structures:category:${category}`}
                defaultOpen={structureCategory !== 'all'}
                bodyClassName="p-3 space-y-3"
                groupKey={WORLDS_COLLAPSIBLE_GROUP}
              >
                {entries.map(entry => (
                  <CollapsibleCard
                    key={entry.id}
                    title={
                      <div className="flex items-center justify-between gap-3">
                        <div className="text-[13px] font-mono text-[var(--text)]">{entry.label}</div>
                        <div className="text-[10px] font-mono tracking-widest text-[var(--text-dim)]">{entry.sourceKind} · {entry.placementKind}</div>
                      </div>
                    }
                    storageKey={`worlds:structures:item:${entry.id}`}
                    defaultOpen={false}
                    bodyClassName="p-4 space-y-3"
                    className="border border-[var(--border)] bg-[var(--panel)]"
                    groupKey={WORLDS_COLLAPSIBLE_GROUP}
                  >
                    <CatalogArtwork kind="structure" label={entry.label} category={entry.category} sourceKind={entry.sourceKind} imageUrl={entry.imageUrl} className="h-32 w-full rounded-2xl border object-cover" />
                    <div className="grid gap-2 text-[12px] font-mono text-[var(--text-dim)] sm:grid-cols-2">
                      <div>Category: <span className="text-[var(--text)]">{entry.category}</span></div>
                      <div>Format: <span className="text-[var(--text)]">{entry.format ?? entry.placementKind ?? 'native'}</span></div>
                      <div>Size: <span className="text-[var(--text)]">{formatBytes(entry.sizeBytes)}</span></div>
                      <div>Updated: <span className="text-[var(--text)]">{entry.updatedAt ? new Date(entry.updatedAt * 1000).toLocaleString() : '—'}</span></div>
                    </div>
                    {entry.summary && <div className="rounded-xl border border-[var(--border)] bg-[var(--bg2)] px-4 py-3 text-[12px] font-mono text-[var(--text-dim)]">{entry.summary}</div>}
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setStructureModalMode('place')
                          setPlacementToRemove(null)
                          setSelectedStructure({ ...entry, summary: inferSummary(entry) })
                        }}
                        className="rounded-lg border border-[var(--accent-mid)] px-3 py-2 text-[11px] font-mono text-[var(--accent)]"
                        style={{ background: 'var(--accent-dim)' }}
                      >
                        Open Placement Target
                      </button>
                    </div>
                  </CollapsibleCard>
                ))}
              </CollapsibleCard>
            ))}
          </div>
          {filteredStructures.length === 0 && (
            <div className="rounded-2xl border border-dashed border-[var(--border)] px-4 py-10 text-center text-[13px] font-mono text-[var(--text-dim)]">
              {structureLoadError
                ? structureLoadError
                : structures.length === 0
                  ? 'No structures found. Check the sidecar schematics path or upload a schematic first.'
                  : `No structures match "${structureSearch.trim()}".`}
            </div>
          )}
        </CollapsibleCard>
      )}

      {canStructureCatalog && (
        <CollapsibleCard title="PLACED STRUCTURES" storageKey="worlds:placements" bodyClassName="p-5 space-y-4" groupKey={WORLDS_COLLAPSIBLE_GROUP}>
          <div className="rounded-xl border border-[var(--border)] bg-[var(--panel)] px-4 py-3 text-[11px] font-mono text-[var(--text-dim)]">
            This section tracks structure placements Mcraftr can reliably identify. Native worldgen structure instance discovery is not yet available from the current bridge surface.
          </div>
          <div className="flex gap-2">
            {(['coords', 'player'] as const).map(mode => (
              <button
                key={mode}
                onClick={() => setPlacementMode(mode)}
                className="rounded-lg border px-3 py-2 text-[12px] font-mono transition-all"
                style={placementMode === mode
                  ? { borderColor: 'var(--accent-mid)', background: 'var(--accent-dim)', color: 'var(--accent)' }
                  : { borderColor: 'var(--border)', color: 'var(--text-dim)' }}
              >
                {mode === 'coords' ? 'Find by Coordinates' : 'Find by Selected Player'}
              </button>
            ))}
          </div>
          {placementMode === 'coords' ? (
            <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_repeat(3,8rem)_auto]">
              <select value={placementWorldFilter} onChange={event => setPlacementWorldFilter(event.target.value)} className="rounded-lg border border-[var(--border)] bg-[var(--bg2)] px-3 py-2 text-[13px] font-mono text-[var(--text)]">
                <option value="">All worlds</option>
                {(worldsData?.worlds ?? []).map(world => <option key={world.name} value={world.name}>{world.name}</option>)}
              </select>
              <input value={placementX} onChange={event => setPlacementX(event.target.value)} placeholder="x" className="rounded-lg border border-[var(--border)] bg-[var(--bg2)] px-3 py-2 text-[13px] font-mono text-[var(--text)]" />
              <input value={placementY} onChange={event => setPlacementY(event.target.value)} placeholder="y" className="rounded-lg border border-[var(--border)] bg-[var(--bg2)] px-3 py-2 text-[13px] font-mono text-[var(--text)]" />
              <input value={placementZ} onChange={event => setPlacementZ(event.target.value)} placeholder="z" className="rounded-lg border border-[var(--border)] bg-[var(--bg2)] px-3 py-2 text-[13px] font-mono text-[var(--text)]" />
              <button onClick={() => void handleFindPlacements()} disabled={!placementWorldFilter || !placementX || !placementY || !placementZ} className="rounded-lg border border-[var(--border)] px-3 py-2 text-[12px] font-mono text-[var(--text-dim)] disabled:opacity-40 hover:border-[var(--accent-mid)]">
                Find
              </button>
            </div>
          ) : (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[var(--border)] bg-[var(--panel)] px-4 py-3">
              <div className="text-[12px] font-mono text-[var(--text-dim)]">
                {selectedPlayer ? <>Use <span className="text-[var(--accent)]">{selectedPlayer}</span>'s live world and position.</> : 'Pick an active player first.'}
              </div>
              <button onClick={() => void handleFindPlacements()} disabled={!selectedPlayer} className="rounded-lg border border-[var(--border)] px-3 py-2 text-[12px] font-mono text-[var(--text-dim)] disabled:opacity-40 hover:border-[var(--accent-mid)]">
                Find At Player
              </button>
            </div>
          )}
          <div className="grid gap-3 md:grid-cols-2">
            {visiblePlacements.map(entry => (
              <button
                key={entry.id}
                onClick={() => handleOpenRemoval(entry)}
                className="rounded-2xl border border-[var(--border)] bg-[var(--panel)] p-4 text-left transition-all hover:border-[var(--accent-mid)]"
              >
                <div className="text-[13px] font-mono text-[var(--text)]">{entry.structure_label}</div>
                <div className="mt-1 text-[11px] font-mono text-[var(--text-dim)]">
                  {entry.world} · {entry.origin_x}, {entry.origin_y}, {entry.origin_z}
                </div>
              </button>
            ))}
            {visiblePlacements.length === 0 && (
              <div className="rounded-2xl border border-dashed border-[var(--border)] px-4 py-10 text-center text-[13px] font-mono text-[var(--text-dim)]">
                No tracked structure placements yet.
              </div>
            )}
          </div>
        </CollapsibleCard>
      )}

      {canEntityCatalog && (
        <CollapsibleCard title="ENTITY CATALOG" storageKey="worlds:entities" bodyClassName="p-5 space-y-4" groupKey={WORLDS_COLLAPSIBLE_GROUP}>
          <input
            ref={entityUploadRef}
            type="file"
            accept=".json"
            className="hidden"
            onChange={event => void handleEntityPresetUpload(event.target.files?.[0] ?? null)}
          />
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="text-[12px] font-mono text-[var(--text-dim)]">
              {entities.length} entity entries{entityScan ? ` · ${entityScan.totalPresets} custom presets` : ''}
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => {
                  setEditingPreset(null)
                  setPresetEditorOpen(true)
                }}
                className="rounded-lg border border-[var(--accent-mid)] px-3 py-2 text-[12px] font-mono text-[var(--accent)]"
                style={{ background: 'var(--accent-dim)' }}
              >
                New Preset
              </button>
              <button
                type="button"
                disabled={catalogBusy}
                onClick={() => entityUploadRef.current?.click()}
                className="rounded-lg border border-[var(--border)] px-3 py-2 text-[12px] font-mono text-[var(--text-dim)] disabled:opacity-40"
              >
                Upload JSON
              </button>
            </div>
          </div>
          <div className="flex gap-1.5 flex-wrap">
            {entityCategories.map(category => (
              <button
                key={category}
                onClick={() => setEntityCategory(category)}
                className="px-2 py-1 rounded text-[13px] font-mono transition-all border"
                style={entityCategory === category
                  ? { borderColor: 'var(--accent)', background: 'var(--accent-dim)', color: 'var(--accent)' }
                  : { borderColor: 'var(--border)', color: 'var(--text-dim)' }}
              >
                {category === 'all' ? 'All' : category}
              </button>
            ))}
          </div>
          <input
            type="text"
            placeholder="Search entities"
            value={entitySearch}
            onChange={event => setEntitySearch(event.target.value)}
            className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg2)] px-3 py-2 text-[14px] font-mono text-[var(--text)]"
          />
          {entityScan && (
            <div className="rounded-2xl border border-[var(--border)] bg-[var(--panel)] px-4 py-3 text-[11px] font-mono text-[var(--text-dim)]">
              Preset roots: {entityScan.roots.length > 0 ? entityScan.roots.map(root => `${root.path} (${root.presetCount})`).join(' · ') : 'none'}
              {entityScan.uploadRoot ? ` · upload root ${entityScan.uploadRoot}` : ''}
            </div>
          )}
          {entityLoadError && (
            <div className="rounded-2xl border border-[var(--border)] bg-[var(--panel)] px-4 py-3 text-[11px] font-mono text-[var(--text-dim)]">
              {entityLoadError}
            </div>
          )}
          {entityCategory === 'all' && groupedEntities.length > WORLD_CATEGORY_PAGE_SIZE && (
            <div className="flex items-center justify-between rounded-2xl border border-[var(--border)] bg-[var(--panel)] px-4 py-3 text-[11px] font-mono text-[var(--text-dim)]">
              <span>Category page {clampPage(entityCategoryPage, entityCategoryPageCount) + 1} / {entityCategoryPageCount}</span>
              <div className="flex gap-2">
                <button type="button" disabled={entityCategoryPage <= 0} onClick={() => setEntityCategoryPage(page => Math.max(0, page - 1))} className="rounded border border-[var(--border)] px-3 py-1 disabled:opacity-40">Prev</button>
                <button type="button" disabled={entityCategoryPage >= entityCategoryPageCount - 1} onClick={() => setEntityCategoryPage(page => Math.min(entityCategoryPageCount - 1, page + 1))} className="rounded border border-[var(--border)] px-3 py-1 disabled:opacity-40">Next</button>
              </div>
            </div>
          )}
          <div className="space-y-3">
            {pagedEntityGroups.map(([category, entries]) => (
              <CollapsibleCard
                key={category}
                title={`${category.toUpperCase()} (${entries.length})`}
                storageKey={`worlds:entities:category:${category}`}
                defaultOpen={entityCategory !== 'all'}
                bodyClassName="p-3 space-y-3"
                groupKey={WORLDS_COLLAPSIBLE_GROUP}
              >
                {entries.map(entry => (
                  <CollapsibleCard
                    key={entry.id}
                    title={
                      <div className="flex items-center justify-between gap-2">
                        <div className="text-[13px] font-mono text-[var(--text)]">{entry.label}</div>
                        <div className="flex items-center gap-2 text-[10px] font-mono tracking-widest text-[var(--text-dim)]">
                          <span>{entry.sourceKind ?? 'native'}</span>
                          {entry.dangerous && <span className="text-red-300">DANGER</span>}
                        </div>
                      </div>
                    }
                    storageKey={`worlds:entities:item:${entry.id}`}
                    defaultOpen={false}
                    bodyClassName="p-4 space-y-3"
                    className="border border-[var(--border)] bg-[var(--panel)]"
                    groupKey={WORLDS_COLLAPSIBLE_GROUP}
                  >
                    <CatalogArtwork kind="entity" label={entry.label} category={entry.category} imageUrl={entry.imageUrl} className="h-32 w-full rounded-2xl border object-cover" />
                    <div className="grid gap-2 text-[12px] font-mono text-[var(--text-dim)] sm:grid-cols-2">
                      <div>Category: <span className="text-[var(--text)]">{entry.category}</span></div>
                      <div>Source: <span className="text-[var(--text)]">{entry.sourceKind ?? 'native'}</span></div>
                      <div>Default Count: <span className="text-[var(--text)]">{entry.defaultCount ?? 1}</span></div>
                      <div>Entity Id: <span className="text-[var(--text)]">{entry.entityId ?? entry.id}</span></div>
                    </div>
                    {entry.summary && <div className="rounded-xl border border-[var(--border)] bg-[var(--bg2)] px-4 py-3 text-[12px] font-mono text-[var(--text-dim)]">{entry.summary}</div>}
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setEntityCount(String(entry.defaultCount ?? 1))
                          setSelectedEntity({ ...entry, summary: inferSummary(entry) })
                        }}
                        className="rounded-lg border border-[var(--accent-mid)] px-3 py-2 text-[11px] font-mono text-[var(--accent)]"
                        style={{ background: 'var(--accent-dim)' }}
                      >
                        Open Placement Target
                      </button>
                      {entry.editable && (
                        <button
                          type="button"
                          onClick={() => {
                            setEditingPreset(entry)
                            setPresetEditorOpen(true)
                          }}
                          className="rounded border border-[var(--border)] px-3 py-2 text-[11px] font-mono text-[var(--text-dim)]"
                        >
                          Edit
                        </button>
                      )}
                      {entry.editable && entry.relativePath && (
                        <button
                          type="button"
                          onClick={() => void handleDeletePreset(entry)}
                          className="rounded border border-red-900 px-3 py-2 text-[11px] font-mono text-red-400"
                        >
                          Delete
                        </button>
                      )}
                    </div>
                  </CollapsibleCard>
                ))}
              </CollapsibleCard>
            ))}
          </div>
          {filteredEntities.length === 0 && (
            <div className="rounded-2xl border border-dashed border-[var(--border)] px-4 py-10 text-center text-[13px] font-mono text-[var(--text-dim)]">
              {entityLoadError
                ? entityLoadError
                : entities.length === 0
                  ? 'No entities available for browsing right now.'
                  : `No entities match "${entitySearch.trim()}".`}
            </div>
          )}
        </CollapsibleCard>
      )}

      {canEntityCatalog && (
        <CollapsibleCard title="PLACED ENTITIES" storageKey="worlds:entities-live" bodyClassName="p-5 space-y-4" groupKey={WORLDS_COLLAPSIBLE_GROUP}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="text-[12px] font-mono text-[var(--text-dim)]">
              {liveEntities.length} live entities detected across loaded worlds
            </div>
            <select
              value={liveEntityWorldFilter}
              onChange={event => setLiveEntityWorldFilter(event.target.value)}
              className="rounded-lg border border-[var(--border)] bg-[var(--bg2)] px-3 py-2 text-[12px] font-mono text-[var(--text)]"
            >
              <option value="">All worlds</option>
              {worldNames.map(world => <option key={world} value={world}>{world}</option>)}
            </select>
          </div>
          <div className="space-y-3">
            {visibleLiveEntities.map(entry => (
              <CollapsibleCard
                key={entry.uuid}
                title={
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-[13px] font-mono text-[var(--text)]">{entry.label}</div>
                    <div className="text-[10px] font-mono tracking-widest text-[var(--text-dim)]">{entry.world}</div>
                  </div>
                }
                storageKey={`worlds:entities-live:${entry.uuid}`}
                defaultOpen={false}
                bodyClassName="p-4 space-y-3"
                className="border border-[var(--border)] bg-[var(--panel)]"
                groupKey={WORLDS_COLLAPSIBLE_GROUP}
              >
                <div className="grid gap-2 text-[12px] font-mono text-[var(--text-dim)] sm:grid-cols-2 xl:grid-cols-3">
                  <div>Type: <span className="text-[var(--text)]">{entry.id}</span></div>
                  <div>Category: <span className="text-[var(--text)]">{entry.category}</span></div>
                  <div>World: <span className="text-[var(--text)]">{entry.world}</span></div>
                  <div>Location: <span className="text-[var(--text)]">{entry.location ? `${Math.round(entry.location.x)}, ${Math.round(entry.location.y)}, ${Math.round(entry.location.z)}` : '—'}</span></div>
                  <div>Health: <span className="text-[var(--text)]">{entry.health ?? '—'}</span></div>
                  <div>Name: <span className="text-[var(--text)]">{entry.customName ?? '—'}</span></div>
                </div>
              </CollapsibleCard>
            ))}
            {visibleLiveEntities.length === 0 && (
              <div className="rounded-2xl border border-dashed border-[var(--border)] px-4 py-10 text-center text-[13px] font-mono text-[var(--text-dim)]">
                No live entities match the current world filter.
              </div>
            )}
          </div>
        </CollapsibleCard>
      )}

      <div className="flex justify-end">
        <button
          type="button"
          onClick={toggleCollapseAll}
          className="rounded border border-[var(--border)] px-3 py-2 text-[12px] font-mono text-[var(--text-dim)] hover:border-[var(--accent-mid)]"
        >
          {collapseAllLabel}
        </button>
      </div>

      {selectedStructure && structureModalMode === 'place' && (
        <SpawnInspectModal
          mode="place-structure"
          structure={selectedStructure}
          locationMode={structureMode}
          onLocationModeChange={setStructureMode}
          worlds={worldNames}
          players={players}
          playerWorlds={playerWorlds}
          selectedPlayer={selectedPlayer}
          onSelectedPlayerChange={onSelectedPlayerChange}
          world={structureWorld}
          onWorldChange={setStructureWorld}
          x={structureX}
          y={structureY}
          z={structureZ}
          onCoordChange={(axis, value) => {
            if (axis === 'x') setStructureX(value)
            if (axis === 'y') setStructureY(value)
            if (axis === 'z') setStructureZ(value)
          }}
          rotation={structureRotation}
          onRotationChange={setStructureRotation}
          includeAir={structureIncludeAir}
          onIncludeAirChange={setStructureIncludeAir}
          confirmLabel={`Place ${selectedStructure.label}`}
          busy={structureBusy}
          onCancel={() => setSelectedStructure(null)}
          onConfirm={() => void handlePlaceStructure()}
        />
      )}

      {selectedStructure && structureModalMode === 'remove' && placementToRemove && (
        <SpawnInspectModal
          mode="remove-structure"
          structure={selectedStructure}
          locationMode="coords"
          onLocationModeChange={() => {}}
          worlds={worldNames}
          players={players}
          playerWorlds={playerWorlds}
          selectedPlayer={selectedPlayer}
          onSelectedPlayerChange={onSelectedPlayerChange}
          world={placementToRemove.world}
          onWorldChange={() => {}}
          x={String(placementToRemove.origin_x)}
          y={String(placementToRemove.origin_y)}
          z={String(placementToRemove.origin_z)}
          onCoordChange={() => {}}
          confirmLabel={`Remove ${selectedStructure.label}`}
          busy={structureBusy}
          dangerLabel="This removes the tracked structure footprint from the world."
          onCancel={() => {
            setSelectedStructure(null)
            setPlacementToRemove(null)
          }}
          onConfirm={() => void handleRemoveStructure()}
        />
      )}

      {selectedEntity && (
        <SpawnInspectModal
          mode="spawn-entity"
          entity={selectedEntity}
          locationMode={entityMode}
          onLocationModeChange={setEntityMode}
          worlds={worldNames}
          players={players}
          playerWorlds={playerWorlds}
          selectedPlayer={selectedPlayer}
          onSelectedPlayerChange={onSelectedPlayerChange}
          world={entityWorld}
          onWorldChange={setEntityWorld}
          x={entityX}
          y={entityY}
          z={entityZ}
          onCoordChange={(axis, value) => {
            if (axis === 'x') setEntityX(value)
            if (axis === 'y') setEntityY(value)
            if (axis === 'z') setEntityZ(value)
          }}
          count={entityCount}
          onCountChange={setEntityCount}
          confirmLabel={`Spawn ${selectedEntity.label}`}
          dangerLabel={selectedEntity.dangerous ? 'This entity can damage terrain, players, or server stability. Confirm carefully.' : null}
          busy={entityBusy}
          onCancel={() => setSelectedEntity(null)}
          onConfirm={() => void handleSpawnEntity()}
        />
      )}

      {presetEditorOpen && (
        <EntityPresetEditorModal
          initial={editingPreset}
          busy={presetEditorBusy}
          onCancel={() => {
            if (presetEditorBusy) return
            setPresetEditorOpen(false)
            setEditingPreset(null)
          }}
          onSave={payload => void handleSavePreset(payload)}
        />
      )}
    </div>
  )
}
