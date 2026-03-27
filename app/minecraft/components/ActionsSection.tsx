'use client'
import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import {
  Hammer, Shield, Map as MapIcon,
  Wind, Heart, Eye, Zap, EyeOff, ArrowUp, Swords, Pickaxe, Sparkles,
  Plus, Save, Trash2, Upload, RefreshCcw,
  type LucideProps,
} from 'lucide-react'
import { KITS } from '@/lib/kits'
import { CATALOG, hydrateCatalogWithArt, type CatalogItem } from '../items'
import type { InvItem } from '../../api/minecraft/inventory/route'
import { useToast } from './useToast'
import Toasts from './Toasts'
import InvSlot, { buildInventoryLayout } from './InvSlot'
import ConfirmModal from './ConfirmModal'
import type { ConfirmModalProps } from './ConfirmModal'
import type { FeatureKey } from '@/lib/features'
import PlayerPicker from './PlayerPicker'
import CollapsibleCard, { setCollapsibleGroupState } from './CollapsibleCard'
import CapabilityLockCard from './CapabilityLockCard'
import KitIcon from './KitIcon'
import CatalogArtwork from './CatalogArtwork'
import {
  CUSTOM_KIT_CUSTOM_ICON_MAX_BYTES,
  CUSTOM_KIT_ICON_IDS,
  CUSTOM_KIT_ITEM_MAX,
  estimateDataUrlBytes,
  normalizeCustomKitLabel,
  type CustomKitIconType,
  type CustomKitItem,
  type CustomKitRecord,
} from '@/lib/custom-kits'

type LucideIcon = React.ComponentType<LucideProps>

type Props = {
  players: string[]
  selectedPlayer?: string
  onSelectedPlayerChange?: (player: string) => void
  minecraftVersion?: string | null
  relayEnabled?: boolean
}

type FeatureFlags = Record<FeatureKey, boolean>

type LiveEntity = {
  uuid: string
  id: string
  label: string
  world: string
  customName?: string | null
  location?: { x: number; y: number; z: number } | null
}

type PlayerLocationResponse = {
  ok: boolean
  world?: string | null
}

// ── Constants ─────────────────────────────────────────────────────────────────

const GAMEMODE_CMDS: { id: string; Icon: LucideIcon; label: string }[] = [
  { id: 'creative',  Icon: Hammer, label: 'Creative'  },
  { id: 'survival',  Icon: Shield, label: 'Survival'  },
  { id: 'adventure', Icon: MapIcon,    label: 'Adventure' },
]

const ABILITY_CMDS: { id: string; Icon: LucideIcon; label: string; oneShot?: boolean }[] = [
  { id: 'fly',          Icon: Wind,     label: 'Fly'          },
  { id: 'heal',         Icon: Heart,    label: 'Heal',         oneShot: true },
  { id: 'night_vision', Icon: Eye,      label: 'Night Vision' },
  { id: 'speed',        Icon: Zap,      label: 'Speed'        },
  { id: 'invisibility', Icon: EyeOff,   label: 'Invisible'    },
  { id: 'jump',         Icon: ArrowUp,  label: 'Super Jump'   },
  { id: 'strength',     Icon: Swords,   label: 'Strength'     },
  { id: 'haste',        Icon: Pickaxe,  label: 'Haste'        },
  { id: 'clear_fx',     Icon: Sparkles, label: 'Clear FX',    oneShot: true },
]

const CAT_PAGE_SIZE = 24
const MAX_STACK_BATCHES = 36
const ACTIONS_COLLAPSIBLE_GROUP = 'actions-tab'

function totalGiveQty(item: CatalogItem, qty: number) {
  return Math.max(1, Math.min(getItemMaxQty(item), Math.floor(qty) || 1))
}

function quickGiveOptions(item: CatalogItem) {
  const maxQty = getItemMaxQty(item)
  const options = item.maxStack > 1
    ? [1, 8, 16, 32, item.maxStack, item.maxStack * 2]
    : [1, 2, 4, 8, 16]
  return Array.from(new Set(options)).filter(value => value <= maxQty)
}

function splitGiveQty(item: CatalogItem, qty: number) {
  const total = totalGiveQty(item, qty)
  const perStack = Math.max(1, item.maxStack)
  if (perStack === 1) {
    return { stacks: 0, singles: total }
  }
  return {
    stacks: Math.floor(total / perStack),
    singles: total % perStack,
  }
}

function formatQuickGiveLabel(item: CatalogItem, qty: number) {
  const total = totalGiveQty(item, qty)
  const { stacks, singles } = splitGiveQty(item, total)
  if (item.maxStack <= 1) return `${total} item${total === 1 ? '' : 's'}`
  if (stacks > 0 && singles > 0) return `${stacks} stack${stacks === 1 ? '' : 's'} + ${singles}`
  if (stacks > 0) return `${stacks} stack${stacks === 1 ? '' : 's'}`
  return `${singles} single${singles === 1 ? '' : 's'}`
}

function itemBatchSummary(item: CatalogItem, qty: number) {
  const total = totalGiveQty(item, qty)
  if (item.maxStack <= 1) {
    return `${total} item${total === 1 ? '' : 's'}`
  }
  const { stacks, singles } = splitGiveQty(item, total)
  if (stacks > 0 && singles > 0) return `${stacks} stack${stacks === 1 ? '' : 's'} + ${singles}`
  if (stacks > 0) return `${stacks} stack${stacks === 1 ? '' : 's'}`
  return `${singles} single${singles === 1 ? '' : 's'}`
}

function formatEntityOption(entity: LiveEntity) {
  const coords = entity.location ? `${Math.round(entity.location.x)}, ${Math.round(entity.location.y)}, ${Math.round(entity.location.z)}` : 'unknown location'
  return entity.customName?.trim()
    ? `${entity.customName} · ${entity.label} · ${entity.world} · ${coords}`
    : `${entity.label} · ${entity.world} · ${coords}`
}

function itemLabelForId(itemId: string, allItems: CatalogItem[]) {
  return allItems.find(item => item.id === itemId)?.label ?? itemId
}

function clampKitQty(itemId: string, qty: number, allItems: CatalogItem[]) {
  const item = allItems.find(entry => entry.id === itemId)
  const maxStack = Math.max(1, item?.maxStack ?? 64)
  const maxQty = maxStack === 1 ? MAX_STACK_BATCHES : MAX_STACK_BATCHES * maxStack
  return Math.max(1, Math.min(maxQty, Math.floor(qty) || 1))
}

function getItemMaxQty(item: CatalogItem) {
  return item.maxStack === 1 ? MAX_STACK_BATCHES : MAX_STACK_BATCHES * Math.max(1, item.maxStack)
}

// ── Sub-components ────────────────────────────────────────────────────────────

function PlayerChip({ name, selected, variant = 'default', bothSelected = false, onClick }: {
  name: string; selected: boolean; variant?: 'default' | 'from' | 'to'; bothSelected?: boolean; onClick: () => void
}) {
  const base = 'tap-target px-3 py-2 rounded-lg text-[13px] font-mono border transition-all cursor-pointer select-none'
  if (variant === 'from') {
    if (!selected)
      return <button onClick={onClick} className={`${base} border-[var(--border)] text-[var(--text-dim)] hover:border-[var(--accent-mid)] hover:text-[var(--text)]`}>{name}</button>
    // selected alone: outline only, no fill
    // selected + bothSelected: same outline, pulse with offset (tp-source handles bg override)
    return <button onClick={onClick} className={`${base} border-[var(--accent)] text-[var(--accent)] ${bothSelected ? 'tp-source' : ''}`}>{name}</button>
  }
  if (variant === 'to') {
    if (!selected)
      return <button onClick={onClick} className={`${base} border-[var(--border)] text-[var(--text-dim)] hover:border-[var(--accent-mid)]`}>{name}</button>
    // selected: outline + fill + pulse (always, once "to" is chosen)
    return <button onClick={onClick} className={`${base} border-[var(--accent)] bg-[var(--accent-dim)] text-[var(--accent)] tp-target`}>{name}</button>
  }
  return (
    <button onClick={onClick} className={`${base} ${selected ? 'border-[var(--accent)] bg-[var(--accent-dim)] text-[var(--accent)]' : 'border-[var(--border)] text-[var(--text-dim)] hover:border-[var(--accent-mid)]'}`}>
      {name}
    </button>
  )
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-[13px] font-mono text-[var(--text-dim)] tracking-widest pb-1 border-b border-[var(--border)] mb-2">
      {children}
    </div>
  )
}

function itemCardPalette(item: CatalogItem, categoryLabel: string) {
  void item
  void categoryLabel
  return {
    frame: 'var(--accent-mid)',
    frameSoft: 'color-mix(in srgb, var(--accent) 12%, transparent)',
    frameGlow: 'color-mix(in srgb, var(--accent) 18%, transparent)',
    badge: 'color-mix(in srgb, var(--accent) 16%, transparent)',
    badgeText: 'var(--accent)',
  }
}

// ── Main component ─────────────────────────────────────────────────────────────

export default function ActionsSection({ players, selectedPlayer: selectedPlayerProp, onSelectedPlayerChange, minecraftVersion, relayEnabled = true }: Props) {
  const { toasts, addToast } = useToast()
  const hydratedCatalog = useMemo(() => hydrateCatalogWithArt(minecraftVersion, CATALOG), [minecraftVersion])
  const [features, setFeatures] = useState<FeatureFlags | null>(null)

  useEffect(() => {
    fetch('/api/account/preferences')
      .then(r => r.json())
      .then(d => { if (d.ok && d.features) setFeatures(d.features as FeatureFlags) })
      .catch(() => {})
  }, [])

  const [busyCmd,   setBusyCmd]   = useState<string | null>(null)
  const [internalSelectedPlayer, setInternalSelectedPlayer] = useState('')
  const selectedPlayer = selectedPlayerProp ?? internalSelectedPlayer

  // ── Effects state ─────────────────────────────────────────────────────────────

  const [activeEffects, setActiveEffects] = useState<Record<string, Set<string>>>({})
  const effectsTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const fetchEffects = useCallback(async (player: string) => {
    if (!player) return
    try {
      const r = await fetch(`/api/minecraft/effects?player=${encodeURIComponent(player)}`)
      const d = await r.json()
      if (d.ok && Array.isArray(d.active)) {
        setActiveEffects(prev => ({ ...prev, [player]: new Set(d.active as string[]) }))
      }
    } catch {}
  }, [])

  useEffect(() => {
    if (!selectedPlayer) return
    fetchEffects(selectedPlayer)
    const interval = setInterval(() => fetchEffects(selectedPlayer), 8000)
    return () => clearInterval(interval)
  }, [selectedPlayer, fetchEffects])

  useEffect(() => {
    return () => { if (effectsTimerRef.current) clearTimeout(effectsTimerRef.current) }
  }, [])

  const isActive = (effectId: string) => selectedPlayer ? (activeEffects[selectedPlayer]?.has(effectId) ?? false) : false

  const handleSelectedPlayerChange = (next: string) => {
    if (onSelectedPlayerChange) onSelectedPlayerChange(next)
    else setInternalSelectedPlayer(next)
    setTpTo('')
    if (next) {
      if (effectsTimerRef.current) clearTimeout(effectsTimerRef.current)
      effectsTimerRef.current = setTimeout(() => fetchEffects(next), 300)
    }
  }

  // ── Commands ──────────────────────────────────────────────────────────────────

  const issueCmd = async (id: string, player?: string) => {
    const key = id + (player ?? '')
    setBusyCmd(key)
    try {
      const r = await fetch('/api/minecraft/cmd', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command: id, player }),
      })
      const d = await r.json()
      if (d.ok) {
        const variant = d.activated === false ? 'deactivated' : 'ok'
        addToast(variant, d.message || 'Done')
        if (player) fetchEffects(player)
      } else {
        addToast('error', d.error || 'Command failed')
      }
    } catch (e) {
      addToast('error', e instanceof Error ? e.message : 'Network error')
    } finally {
      setBusyCmd(null)
    }
  }

  const cmdBtn = (id: string, Icon: LucideIcon, label: string, player?: string) => {
    const key  = id + (player ?? '')
    const busy = busyCmd === key
    return (
      <button key={id} onClick={() => issueCmd(id, player)} disabled={busy || !!busyCmd}
        className="tap-target flex flex-col items-center justify-center gap-1 px-2 py-3 rounded-lg border transition-all disabled:opacity-40 disabled:cursor-not-allowed hover:border-[var(--accent-mid)] border-[var(--border)] text-[var(--text-dim)]">
        <span className="flex items-center justify-center h-5">
          {busy ? <span className="text-[15px] font-mono">…</span> : <Icon size={16} color="var(--text-dim)" strokeWidth={1.5} />}
        </span>
        <span className="text-[13px] font-mono tracking-wide">{label}</span>
      </button>
    )
  }

  // ── Teleport ──────────────────────────────────────────────────────────────────

  const [tpTo,        setTpTo]        = useState('')
  const [tping,       setTping]       = useState(false)
  const [tpX, setTpX] = useState('')
  const [tpY, setTpY] = useState('')
  const [tpZ, setTpZ] = useState('')
  const [tpLocing,    setTpLocing]    = useState(false)
  const [liveEntities, setLiveEntities] = useState<LiveEntity[]>([])
  const [liveEntitiesLoading, setLiveEntitiesLoading] = useState(false)
  const [liveEntitiesWarning, setLiveEntitiesWarning] = useState<string | null>(null)
  const [liveEntityWorld, setLiveEntityWorld] = useState<string | null>(null)
  const [entitySearch, setEntitySearch] = useState('')
  const [entityToPlayerId, setEntityToPlayerId] = useState('')
  const [playerToEntityId, setPlayerToEntityId] = useState('')
  const [entityCoordId, setEntityCoordId] = useState('')
  const [entityTpX, setEntityTpX] = useState('')
  const [entityTpY, setEntityTpY] = useState('')
  const [entityTpZ, setEntityTpZ] = useState('')
  const [actorTping, setActorTping] = useState(false)

  const filteredEntities = useMemo(() => {
    const query = entitySearch.trim().toLowerCase()
    if (!query) return liveEntities.slice(0, 50)
    return liveEntities.filter(entity => {
      const haystack = `${entity.label} ${entity.id} ${entity.customName ?? ''} ${entity.world}`.toLowerCase()
      return haystack.includes(query)
    }).slice(0, 50)
  }, [entitySearch, liveEntities])

  const teleport = async () => {
    const from = selectedPlayer.trim()
    if (!from || !tpTo) return
    setTping(true)
    try {
      const r = await fetch('/api/minecraft/tp', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ from, to: tpTo }),
      })
      const d = await r.json()
      addToast(d.ok ? 'ok' : 'error', d.ok ? d.message : (d.error || 'Teleport failed'))
      if (d.ok) { setTpTo('') }
    } catch (e) {
      addToast('error', e instanceof Error ? e.message : 'Network error')
    } finally { setTping(false) }
  }

  const teleportToCoords = async () => {
    if (!selectedPlayer || !tpX || !tpY || !tpZ) return
    setTpLocing(true)
    try {
      const r = await fetch('/api/minecraft/tploc', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ player: selectedPlayer, x: Number(tpX), y: Number(tpY), z: Number(tpZ) }),
      })
      const d = await r.json()
      addToast(d.ok ? 'ok' : 'error', d.ok ? d.message : (d.error || 'Teleport failed'))
      if (d.ok) { setTpX(''); setTpY(''); setTpZ('') }
    } catch (e) {
      addToast('error', e instanceof Error ? e.message : 'Network error')
    } finally { setTpLocing(false) }
  }

  const loadLiveEntities = useCallback(async () => {
    if (!relayEnabled) {
      setLiveEntities([])
      setLiveEntitiesLoading(false)
      setLiveEntitiesWarning(null)
      setLiveEntityWorld(null)
      return
    }
    if (!selectedPlayer) {
      setLiveEntities([])
      setLiveEntitiesLoading(false)
      setLiveEntitiesWarning('Choose an active player to load live entities from that player\'s current world.')
      setLiveEntityWorld(null)
      return
    }
    setLiveEntitiesLoading(true)
    try {
      const locationResponse = await fetch(`/api/minecraft/player-location?player=${encodeURIComponent(selectedPlayer)}`, { cache: 'no-store' })
      const locationPayload = await locationResponse.json() as PlayerLocationResponse
      const world = typeof locationPayload.world === 'string' && locationPayload.world.trim()
        ? locationPayload.world.trim()
        : null

      if (!locationPayload.ok || !world) {
        setLiveEntities([])
        setLiveEntityWorld(null)
        setLiveEntitiesWarning('Live entity targeting needs the selected player\'s current world, but Relay could not resolve it right now.')
        return
      }

      const response = await fetch(`/api/minecraft/entities/live?world=${encodeURIComponent(world)}`)
      const payload = await response.json()
      if (payload.ok) {
        setLiveEntities(Array.isArray(payload.entities) ? payload.entities as LiveEntity[] : [])
        setLiveEntityWorld(world)
        setLiveEntitiesWarning(typeof payload.warning === 'string' ? payload.warning : null)
        if (payload.warning) addToast('error', payload.warning)
      } else {
        setLiveEntitiesWarning(null)
        setLiveEntityWorld(world)
        addToast('error', payload.error || 'Failed to load live entities')
      }
    } catch (error) {
      setLiveEntitiesWarning(null)
      setLiveEntityWorld(null)
      addToast('error', error instanceof Error ? error.message : 'Failed to load live entities')
    } finally {
      setLiveEntitiesLoading(false)
    }
  }, [addToast, relayEnabled, selectedPlayer])

  const teleportActor = async (payload: Record<string, unknown>, reset?: () => void) => {
    setActorTping(true)
    try {
      const response = await fetch('/api/minecraft/teleport', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const body = await response.json()
      addToast(body.ok ? 'ok' : 'error', body.ok ? body.message : (body.error || 'Teleport failed'))
      if (body.ok) reset?.()
    } catch (error) {
      addToast('error', error instanceof Error ? error.message : 'Teleport failed')
    } finally {
      setActorTping(false)
    }
  }

  // ── Kits ──────────────────────────────────────────────────────────────────────

  const [selectedKit, setSelectedKit] = useState('')
  const [assigning,   setAssigning]   = useState(false)
  const [customKits, setCustomKits] = useState<CustomKitRecord[]>([])
  const [customKitsLoading, setCustomKitsLoading] = useState(false)
  const [kitsBusy, setKitsBusy] = useState(false)
  const [builderLabel, setBuilderLabel] = useState('')
  const [builderIconType, setBuilderIconType] = useState<CustomKitIconType>('preset')
  const [builderIconValue, setBuilderIconValue] = useState<string>(CUSTOM_KIT_ICON_IDS[0])
  const [builderItems, setBuilderItems] = useState<CustomKitItem[]>([])
  const [builderEditingId, setBuilderEditingId] = useState('')
  const [builderSavedPicker, setBuilderSavedPicker] = useState('')
  const [builderCatCatId, setBuilderCatCatId] = useState(CATALOG[0].id)
  const [builderPage, setBuilderPage] = useState(0)
  const [builderSearch, setBuilderSearch] = useState('')
  const [builderSelectedItem, setBuilderSelectedItem] = useState<CatalogItem | null>(null)
  const [builderQty, setBuilderQty] = useState(1)
  const [builderIconUploading, setBuilderIconUploading] = useState(false)
  const kitsFeatureEnabled = features ? features.enable_kits : true
  const customKitsFeatureEnabled = features ? features.enable_custom_kits : true

  const allItems = useMemo(() => hydratedCatalog.flatMap(c => c.items), [hydratedCatalog])
  const builtinKitMap = useMemo(() => new Map(KITS.map(kit => [kit.id, kit])), [])
  const customKitMap = useMemo(() => new Map(customKits.map(kit => [kit.id, kit])), [customKits])
  const selectedBuiltinKit = selectedKit ? builtinKitMap.get(selectedKit) ?? null : null
  const selectedCustomKit = !selectedBuiltinKit && selectedKit ? customKitMap.get(selectedKit) ?? null : null
  const activeBuilderCat = hydratedCatalog.find(c => c.id === builderCatCatId) ?? hydratedCatalog[0]
  const builderFilteredItems = builderSearch.trim()
    ? allItems.filter(i => i.label.toLowerCase().includes(builderSearch.toLowerCase()) || i.id.toLowerCase().includes(builderSearch.toLowerCase()))
    : activeBuilderCat.items
  const builderTotalPages = Math.max(1, Math.ceil(builderFilteredItems.length / CAT_PAGE_SIZE))
  const builderPageItems = builderFilteredItems.slice(builderPage * CAT_PAGE_SIZE, (builderPage + 1) * CAT_PAGE_SIZE)

  const loadCustomKits = useCallback(async () => {
    setCustomKitsLoading(true)
    try {
      const r = await fetch('/api/minecraft/custom-kits')
      const d = await r.json()
      if (d.ok) {
        setCustomKits(Array.isArray(d.kits) ? d.kits as CustomKitRecord[] : [])
      } else {
        addToast('error', d.error || 'Failed to load saved kits')
      }
    } catch (e) {
      addToast('error', e instanceof Error ? e.message : 'Failed to load saved kits')
    } finally {
      setCustomKitsLoading(false)
    }
  }, [addToast])

  useEffect(() => {
    if (kitsFeatureEnabled && customKitsFeatureEnabled) {
      loadCustomKits()
    } else {
      setCustomKits([])
    }
  }, [kitsFeatureEnabled, customKitsFeatureEnabled, loadCustomKits])

  useEffect(() => {
    if (builderPage >= builderTotalPages) setBuilderPage(Math.max(0, builderTotalPages - 1))
  }, [builderPage, builderTotalPages])

  const resetKitBuilder = useCallback(() => {
    setBuilderEditingId('')
    setBuilderSavedPicker('')
    setBuilderLabel('')
    setBuilderIconType('preset')
    setBuilderIconValue(CUSTOM_KIT_ICON_IDS[0])
    setBuilderItems([])
    setBuilderCatCatId(CATALOG[0].id)
    setBuilderSearch('')
    setBuilderPage(0)
    setBuilderSelectedItem(null)
    setBuilderQty(1)
  }, [])

  const loadBuilderFromKit = useCallback((kit: CustomKitRecord) => {
    setBuilderEditingId(kit.id)
    setBuilderSavedPicker(kit.id)
    setBuilderLabel(kit.label)
    setBuilderIconType(kit.iconType)
    setBuilderIconValue(kit.iconValue)
    setBuilderItems(kit.items)
    setBuilderSelectedItem(null)
    setBuilderQty(1)
  }, [])

  const updateBuilderItemQty = (itemId: string, qty: number) => {
    setBuilderItems(prev => prev.map(item => item.itemId === itemId
      ? { ...item, qty: clampKitQty(itemId, qty, allItems) }
      : item))
  }

  const removeBuilderItem = (itemId: string) => {
    setBuilderItems(prev => prev.filter(item => item.itemId !== itemId))
  }

  const addBuilderItem = () => {
    if (!builderSelectedItem) return
    const qty = clampKitQty(builderSelectedItem.id, builderQty, allItems)
    setBuilderItems(prev => {
      const existing = prev.find(item => item.itemId === builderSelectedItem.id)
      if (existing) {
        return prev.map(item => item.itemId === builderSelectedItem.id
          ? { ...item, qty: clampKitQty(item.itemId, item.qty + qty, allItems) }
          : item)
      }
      if (prev.length >= CUSTOM_KIT_ITEM_MAX) return prev
      return [...prev, { itemId: builderSelectedItem.id, qty }]
    })
    setBuilderQty(1)
  }

  const processCustomIcon = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      addToast('error', 'Upload an image file')
      return
    }
    setBuilderIconUploading(true)
    const objectUrl = URL.createObjectURL(file)
    try {
      const image = await new Promise<HTMLImageElement>((resolve, reject) => {
        const nextImage = new Image()
        nextImage.onload = () => resolve(nextImage)
        nextImage.onerror = () => reject(new Error('Could not read image'))
        nextImage.src = objectUrl
      })
      const size = 96
      const padding = 10
      const scale = Math.min((size - padding * 2) / image.width, (size - padding * 2) / image.height)
      const drawWidth = Math.max(1, Math.round(image.width * scale))
      const drawHeight = Math.max(1, Math.round(image.height * scale))
      const canvas = document.createElement('canvas')
      canvas.width = size
      canvas.height = size
      const ctx = canvas.getContext('2d')
      if (!ctx) throw new Error('Canvas is unavailable')
      ctx.clearRect(0, 0, size, size)
      ctx.drawImage(image, (size - drawWidth) / 2, (size - drawHeight) / 2, drawWidth, drawHeight)
      const imageData = ctx.getImageData(0, 0, size, size)
      for (let i = 0; i < imageData.data.length; i += 4) {
        const alpha = imageData.data[i + 3]
        if (alpha < 24) {
          imageData.data[i + 3] = 0
          continue
        }
        imageData.data[i] = 0
        imageData.data[i + 1] = 0
        imageData.data[i + 2] = 0
        imageData.data[i + 3] = 255
      }
      ctx.putImageData(imageData, 0, 0)
      const dataUrl = canvas.toDataURL('image/png')
      if (estimateDataUrlBytes(dataUrl) > CUSTOM_KIT_CUSTOM_ICON_MAX_BYTES) {
        throw new Error('Icon is too detailed. Use a simpler image.')
      }
      setBuilderIconType('custom')
      setBuilderIconValue(dataUrl)
      addToast('ok', 'Custom icon flattened to match the Mcraftr style')
    } catch (e) {
      addToast('error', e instanceof Error ? e.message : 'Failed to process icon')
    } finally {
      URL.revokeObjectURL(objectUrl)
      setBuilderIconUploading(false)
    }
  }

  const saveBuilderKit = async () => {
    const label = normalizeCustomKitLabel(builderLabel)
    if (!label) {
      addToast('error', 'Kit name is required')
      return
    }
    if (builderItems.length === 0) {
      addToast('error', 'Add at least one item to the kit')
      return
    }
    setKitsBusy(true)
    try {
      const r = await fetch(builderEditingId ? `/api/minecraft/custom-kits/${builderEditingId}` : '/api/minecraft/custom-kits', {
        method: builderEditingId ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          label,
          iconType: builderIconType,
          iconValue: builderIconValue,
          items: builderItems,
        }),
      })
      const d = await r.json()
      if (d.ok) {
        await loadCustomKits()
        const savedId = builderEditingId || d.kit?.id
        if (savedId) {
          setSelectedKit(savedId)
          setBuilderEditingId(savedId)
          setBuilderSavedPicker(savedId)
        }
        addToast('ok', builderEditingId ? 'Saved custom kit changes' : 'Saved new custom kit')
      } else {
        addToast('error', d.error || 'Could not save kit')
      }
    } catch (e) {
      addToast('error', e instanceof Error ? e.message : 'Could not save kit')
    } finally {
      setKitsBusy(false)
    }
  }

  const deleteBuilderKit = async () => {
    if (!builderEditingId) return
    setKitsBusy(true)
    try {
      const r = await fetch(`/api/minecraft/custom-kits/${builderEditingId}`, { method: 'DELETE' })
      const d = await r.json()
      if (d.ok) {
        if (selectedKit === builderEditingId) setSelectedKit('')
        addToast('ok', 'Deleted custom kit')
        resetKitBuilder()
        await loadCustomKits()
      } else {
        addToast('error', d.error || 'Could not delete kit')
      }
    } catch (e) {
      addToast('error', e instanceof Error ? e.message : 'Could not delete kit')
    } finally {
      setKitsBusy(false)
    }
  }

  const assignKit = async () => {
    const player = selectedPlayer.trim()
    if (!player || !selectedKit) return
    setAssigning(true)
    try {
      const r = await fetch('/api/minecraft/kit', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ player, kit: selectedKit }),
      })
      const d = await r.json()
      addToast(d.ok ? 'ok' : 'error', d.ok ? d.message : (d.error || 'Kit assignment failed'))
    } catch (e) {
      addToast('error', e instanceof Error ? e.message : 'Network error')
    } finally { setAssigning(false) }
  }

  // ── Catalog ───────────────────────────────────────────────────────────────────

  const [catCatId,    setCatCatId]    = useState(CATALOG[0].id)
  const [catPage,     setCatPage]     = useState(0)
  const [catSearch,   setCatSearch]   = useState('')
  const [catSelected, setCatSelected] = useState<CatalogItem | null>(null)
  const [catQty,      setCatQty]      = useState(1)
  const [catBatchSelection, setCatBatchSelection] = useState<Record<string, number>>({})
  const [catGiving,   setCatGiving]   = useState(false)
  const catalogHoldTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const catalogLongPressItemRef = useRef<string | null>(null)

  const activeCat  = hydratedCatalog.find(c => c.id === catCatId) ?? hydratedCatalog[0]
  const filtered   = catSearch.trim()
    ? allItems.filter(i => i.label.toLowerCase().includes(catSearch.toLowerCase()) || i.id.toLowerCase().includes(catSearch.toLowerCase()))
    : activeCat.items
  const totalPages = Math.ceil(filtered.length / CAT_PAGE_SIZE)
  const pageItems  = filtered.slice(catPage * CAT_PAGE_SIZE, (catPage + 1) * CAT_PAGE_SIZE)
  const selectedCategoryLabel = catSearch.trim() ? 'Search Results' : activeCat.label
  const catBatchEntries = useMemo(() => Object.entries(catBatchSelection)
    .map(([itemId, qty]) => {
      const item = allItems.find(entry => entry.id === itemId)
      return item ? { item, qty: totalGiveQty(item, qty) } : null
    })
    .filter((entry): entry is { item: CatalogItem; qty: number } => Boolean(entry)), [allItems, catBatchSelection])
  const currentCatalogQty = catSelected ? totalGiveQty(catSelected, catBatchSelection[catSelected.id] ?? catQty) : catQty

  const clearCatalogHold = () => {
    if (catalogHoldTimerRef.current) {
      clearTimeout(catalogHoldTimerRef.current)
      catalogHoldTimerRef.current = null
    }
  }

  const toggleBatchItem = (item: CatalogItem) => {
    setCatSelected(item)
    setCatBatchSelection(current => {
      if (current[item.id] != null) {
        const next = { ...current }
        delete next[item.id]
        return next
      }
      return { ...current, [item.id]: 1 }
    })
  }

  const updateCatalogQty = (item: CatalogItem, nextQty: number) => {
    const normalized = totalGiveQty(item, nextQty)
    if (catBatchSelection[item.id] != null) {
      setCatBatchSelection(current => ({ ...current, [item.id]: normalized }))
      return
    }
    setCatQty(normalized)
  }

  const giveBatchItems = async () => {
    const player = selectedPlayer.trim()
    if (!player || catBatchEntries.length === 0) return
    setCatGiving(true)
    let successCount = 0
    const failures: string[] = []
    try {
      for (const entry of catBatchEntries) {
        const response = await fetch('/api/minecraft/give', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ player, item: entry.item.id, qty: entry.qty }),
        })
        const body = await response.json()
        if (body.ok) {
          successCount += 1
        } else {
          failures.push(`${entry.item.label}: ${body.error || 'Give failed'}`)
        }
      }
      if (successCount > 0) {
        addToast('ok', `Gave ${successCount} selected item ${successCount === 1 ? 'type' : 'types'} to ${player}`)
      }
      if (failures.length > 0) {
        addToast('error', failures[0])
      }
      if (successCount > 0 && invPlayer === player) {
        void loadInventory()
      }
    } catch (e) {
      addToast('error', e instanceof Error ? e.message : 'Network error')
    } finally {
      setCatGiving(false)
    }
  }

  const giveItem = async () => {
    const player = selectedPlayer.trim()
    if (!player || !catSelected) return
    const totalQty = currentCatalogQty
    if (totalQty < 1) return
    setCatGiving(true)
    try {
      const r = await fetch('/api/minecraft/give', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ player, item: catSelected.id, qty: totalQty }),
      })
      const d = await r.json()
      addToast(d.ok ? 'ok' : 'error', d.ok ? d.message : (d.error || 'Give failed'))
      if (d.ok && invPlayer === player) {
        void loadInventory()
      }
    } catch (e) {
      addToast('error', e instanceof Error ? e.message : 'Network error')
    } finally { setCatGiving(false) }
  }

  // ── Inventory ─────────────────────────────────────────────────────────────────

  const [invItems,       setInvItems]       = useState<InvItem[]>([])
  const [invLoading,     setInvLoading]     = useState(false)
  const [invDeleting,    setInvDeleting]    = useState<string | null>(null)
  const [selectedInvSlot, setSelectedInvSlot] = useState<InvItem | null>(null)
  const [confirmModal,   setConfirmModal]   = useState<Omit<ConfirmModalProps, 'onCancel'> | null>(null)

  const invPlayer = selectedPlayer.trim()

  const loadInventory = async () => {
    if (!invPlayer) return
    setInvLoading(true); setInvItems([]); setSelectedInvSlot(null)
    try {
      const r = await fetch(`/api/minecraft/inventory?player=${encodeURIComponent(invPlayer)}`)
      const d = await r.json()
      if (d.ok) setInvItems(d.items ?? [])
      else addToast('error', d.error || 'Failed to load inventory')
    } catch (e) {
      addToast('error', e instanceof Error ? e.message : 'Network error')
    } finally { setInvLoading(false) }
  }

  const deleteItem = async (player: string, item: InvItem) => {
    const key = `${item.slot}`
    setInvDeleting(key)
    try {
      const r = await fetch('/api/minecraft/inventory', {
        method: 'DELETE', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ player, item: item.id, count: item.count, slot: item.slot }),
      })
      const d = await r.json()
      if (d.ok) {
        addToast('ok', `Cleared ${item.label}`)
        void loadInventory()
      }
      else addToast('error', d.error || 'Failed to clear item')
    } catch (e) {
      addToast('error', e instanceof Error ? e.message : 'Network error')
    } finally { setInvDeleting(null) }
  }

  const doClearAll = async (player: string) => {
    setConfirmModal(null)
    setInvDeleting('all')
    try {
      const r = await fetch('/api/minecraft/inventory', {
        method: 'DELETE', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ player }),
      })
      const d = await r.json()
      if (d.ok) {
        setInvItems([])
        setSelectedInvSlot(null)
        addToast('ok', d.message || `Cleared inventory for ${player}`)
        void loadInventory()
      } else {
        addToast('error', d.error || 'Failed to clear inventory')
      }
    } catch (e) {
      addToast('error', e instanceof Error ? e.message : 'Failed to clear inventory')
    } finally {
      setInvDeleting(null)
    }
  }

  const moveInvItem = async (player: string, fromSlot: number, toSlot: number) => {
    setSelectedInvSlot(null)
    try {
      const r = await fetch('/api/minecraft/inventory', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ player, fromSlot, toSlot }),
      })
      const d = await r.json()
      if (d.ok) {
        const ri = await fetch(`/api/minecraft/inventory?player=${encodeURIComponent(player)}`)
        const di = await ri.json()
        if (di.ok) setInvItems(di.items ?? [])
      } else {
        addToast('error', d.error || 'Failed to move item')
      }
    } catch {
      addToast('error', 'Failed to move item')
    }
  }

  const handleInvSlotClick = (player: string, clickedItem: InvItem | undefined, clickedSlot: number, currentSelected: InvItem | null) => {
    if (currentSelected) {
      if (clickedItem && clickedItem.slot === currentSelected.slot) {
        setSelectedInvSlot(null)
      } else if (clickedItem && clickedItem.id === currentSelected.id) {
        moveInvItem(player, currentSelected.slot, clickedSlot)
      } else if (!clickedItem) {
        moveInvItem(player, currentSelected.slot, clickedSlot)
      } else if (clickedItem) {
        setSelectedInvSlot(clickedItem)
      }
    } else if (clickedItem) {
      setSelectedInvSlot(clickedItem)
    }
  }

  const handleInvSlotHoldToMove = (player: string, targetSlot: number | undefined, currentSelected: InvItem | null) => {
    if (!currentSelected || targetSlot === undefined) return
    moveInvItem(player, currentSelected.slot, targetSlot)
  }

  const canPlayerCmd = features ? features.enable_player_commands : true
  const canTeleport = features ? features.enable_teleport : true
  const canKits = features ? features.enable_kits : true
  const canCustomKits = features ? features.enable_custom_kits : true
  const canCatalog = features ? features.enable_item_catalog : true
  const canInventory = features ? features.enable_inventory : true
  const allSectionsDisabled = !canPlayerCmd && !canTeleport && !canKits && !canCatalog && !canInventory
  useEffect(() => {
    if (canTeleport && relayEnabled) {
      void loadLiveEntities()
    } else if (!relayEnabled) {
      setLiveEntities([])
      setLiveEntitiesLoading(false)
    }
  }, [canTeleport, loadLiveEntities, relayEnabled])
  const [collapseAllActive, setCollapseAllActive] = useState(false)
  const toggleCollapseAll = () => {
    const nextOpen = collapseAllActive
    setCollapsibleGroupState(ACTIONS_COLLAPSIBLE_GROUP, nextOpen)
    setCollapseAllActive(!collapseAllActive)
  }
  const collapseAllLabel = collapseAllActive ? 'Expand All' : 'Collapse All'

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-4 pb-6">
      <h2 className="font-mono text-base tracking-widest text-[var(--accent)]">ACTIONS</h2>

      {!allSectionsDisabled && (
        <div className="flex justify-end">
          <button
            type="button"
            onClick={toggleCollapseAll}
            className="rounded-lg border border-[var(--border)] px-3 py-2 text-[12px] font-mono tracking-widest text-[var(--text-dim)] transition-colors hover:border-[var(--accent-mid)] hover:text-[var(--accent)]"
          >
            {collapseAllLabel}
          </button>
        </div>
      )}

      {allSectionsDisabled && (
        <div className="glass-card p-4 text-[13px] font-mono text-[var(--text-dim)]">
          All Actions features are disabled for this account.
        </div>
      )}

      {!allSectionsDisabled && (
        <CollapsibleCard title="ACTIVE PLAYER" storageKey="actions:active-player" groupKey={ACTIONS_COLLAPSIBLE_GROUP} bodyClassName="p-4 space-y-3">
          <PlayerPicker
            online={players}
            selected={selectedPlayer}
            onSelect={handleSelectedPlayerChange}
            placeholder="Select or type player name…"
          />
          <div className="text-[13px] font-mono text-[var(--text-dim)]">
            {selectedPlayer
              ? <>Using <span className="text-[var(--accent)]">{selectedPlayer}</span> across player actions, messages, kits, catalog, inventory, and coordinate teleports.</>
              : 'No player selected. World actions still work; player-specific actions stay disabled until you choose someone here.'}
          </div>
        </CollapsibleCard>
      )}

      {/* ── PLAYER COMMANDS ── */}
      {canPlayerCmd && (
      <CollapsibleCard title="PLAYER COMMANDS" storageKey="actions:player-commands" groupKey={ACTIONS_COLLAPSIBLE_GROUP} bodyClassName="p-4 space-y-4">

        <div>
          <SectionLabel>GAMEMODE {selectedPlayer && <span className="text-[var(--accent)] normal-case">— {selectedPlayer}</span>}</SectionLabel>
          {selectedPlayer ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {GAMEMODE_CMDS.map(c => cmdBtn(c.id, c.Icon, c.label, selectedPlayer))}
            </div>
          ) : <div className="text-[13px] font-mono text-[var(--text-dim)] opacity-60">Choose an active player above</div>}
        </div>

        <div>
          <SectionLabel>ABILITIES {selectedPlayer && <span className="text-[var(--accent)] normal-case">— {selectedPlayer}</span>}</SectionLabel>
          {selectedPlayer ? (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {ABILITY_CMDS.map(c => {
                const key    = c.id + selectedPlayer
                const busy   = busyCmd === key
                const active = !c.oneShot && isActive(c.id)
                const iconColor = active ? 'var(--bg)' : 'var(--text-dim)'
                return (
                  <button key={c.id} onClick={() => issueCmd(c.id, selectedPlayer)} disabled={busy || !!busyCmd}
                    className="flex min-h-[3.35rem] flex-col items-center justify-center gap-1 rounded-lg border px-1.5 py-2.5 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                    style={active
                      ? { borderColor: 'var(--accent)', background: 'var(--accent)', color: 'var(--bg)', boxShadow: '0 0 10px var(--accent-mid)' }
                      : { borderColor: 'var(--border)', color: 'var(--text-dim)' }}>
                    <span className="flex items-center justify-center h-5">
                      {busy
                        ? <span className="text-[15px] font-mono" style={{ color: iconColor }}>…</span>
                        : <c.Icon size={16} color={iconColor} strokeWidth={1.5} />}
                    </span>
                    <span className="text-[12px] font-mono tracking-wide" style={{ color: iconColor }}>{c.label}</span>
                  </button>
                )
              })}
            </div>
          ) : <div className="text-[13px] font-mono text-[var(--text-dim)] opacity-60">Choose an active player above</div>}
        </div>
      </CollapsibleCard>
      )}

      {/* ── TELEPORT ── */}
      {canTeleport && (
      <CollapsibleCard title="TELEPORT" storageKey="actions:teleport" groupKey={ACTIONS_COLLAPSIBLE_GROUP} bodyClassName="p-4 space-y-4">
        <div className="rounded-lg border border-[var(--border)] bg-[var(--panel)] px-3 py-3 text-[12px] font-mono text-[var(--text-dim)]">
          {relayEnabled
            ? (liveEntitiesLoading
                ? 'Loading live entities…'
                : liveEntityWorld
                    ? `${liveEntities.length} live entit${liveEntities.length === 1 ? 'y' : 'ies'} available in ${liveEntityWorld} for actor-based teleport controls.`
                    : `${liveEntities.length} live entit${liveEntities.length === 1 ? 'y' : 'ies'} available for actor-based teleport controls.`)
            : 'Player teleport stays available with raw RCON. Relay unlocks live entity targeting and actor-based teleport controls.'}
        </div>
        {relayEnabled && liveEntitiesWarning && (
          <div className="rounded-lg border border-[var(--border)] bg-[var(--panel)] px-3 py-3 text-[12px] font-mono text-[var(--text-dim)]">
            {liveEntitiesWarning}
          </div>
        )}

        {relayEnabled ? (
          <div className="space-y-2 rounded-lg border border-[var(--border)] bg-[var(--panel)] p-3">
            <div className="text-[11px] font-mono tracking-widest text-[var(--text-dim)]">LIVE ENTITY PICKER</div>
            <input
              type="text"
              value={entitySearch}
              onChange={event => setEntitySearch(event.target.value)}
              placeholder="Search entity label, custom name, or world"
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-[13px] font-mono text-[var(--text)]"
            />
            <div className="max-h-48 overflow-y-auto rounded-lg border border-[var(--border)] bg-[var(--bg)] p-2">
              {filteredEntities.length === 0 ? (
                <div className="px-2 py-2 text-[12px] font-mono text-[var(--text-dim)]">No matching live entities.</div>
              ) : (
                <div className="space-y-1">
                  {filteredEntities.map(entity => {
                    const selected = entity.uuid === entityToPlayerId || entity.uuid === playerToEntityId || entity.uuid === entityCoordId
                    return (
                      <button
                        key={entity.uuid}
                        type="button"
                        onClick={() => {
                          setEntityToPlayerId(entity.uuid)
                          setPlayerToEntityId(entity.uuid)
                          setEntityCoordId(entity.uuid)
                        }}
                        className="w-full rounded-lg border px-3 py-2 text-left font-mono text-[12px] transition-all"
                        style={selected
                          ? { borderColor: 'var(--accent-mid)', background: 'var(--accent-dim)', color: 'var(--accent)' }
                          : { borderColor: 'var(--border)', background: 'var(--panel)', color: 'var(--text-dim)' }}
                      >
                        {formatEntityOption(entity)}
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        ) : (
          <CapabilityLockCard requirement="relay" feature="Live entity targeting and actor teleports" compact />
        )}

        <div>
          <SectionLabel>PLAYER → PLAYER</SectionLabel>
          {!selectedPlayer ? (
            <div className="text-[13px] font-mono text-[var(--text-dim)]">Choose an active player above</div>
          ) : players.length < 2 ? (
            <div className="text-[13px] font-mono text-[var(--text-dim)]">Need at least 2 players online</div>
          ) : (
            <div className="space-y-3">
              <div className="text-[13px] font-mono text-[var(--text-dim)]">Source player: <span className="text-[var(--accent)]">{selectedPlayer}</span></div>
              <div className="flex flex-wrap gap-2">
                {players.map(p => {
                  if (p === selectedPlayer) return null
                  return <PlayerChip key={p} name={p} selected={tpTo === p} onClick={() => setTpTo(s => s === p ? '' : p)} />
                })}
              </div>
              <div className="flex items-center gap-3 py-2 px-3 rounded-lg bg-[var(--panel)] border border-[var(--border)] font-mono text-[13px] min-h-[38px]">
                <span className="text-[var(--text)]">{selectedPlayer}</span>
                <span className="text-[var(--text-dim)]">→</span>
                {tpTo   ? <span className="text-[var(--accent)]">{tpTo}</span>   : <span className="text-[var(--text-dim)] opacity-60">to</span>}
              </div>
              <button onClick={teleport} disabled={tping || !selectedPlayer || !tpTo}
                className="w-full py-2.5 rounded-lg font-mono text-[13px] tracking-widest transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                style={{ background: 'var(--accent-dim)', border: '1px solid var(--accent-mid)', color: 'var(--accent)' }}>
                {tping ? 'Teleporting...' : 'Teleport'}
              </button>
            </div>
          )}
        </div>

        <div>
          <SectionLabel>PLAYER → COORDINATES</SectionLabel>
          <div className="space-y-3">
            {selectedPlayer ? (
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[var(--panel)] border border-[var(--border)]">
                <span className="text-[13px] font-mono text-[var(--text-dim)]">Player:</span>
                <span className="text-[13px] font-mono text-[var(--accent)]">{selectedPlayer}</span>
              </div>
            ) : (
              <div className="text-[13px] font-mono text-[var(--text-dim)] opacity-60">Choose an active player above</div>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {(['X', 'Y', 'Z'] as const).map((axis, i) => (
                <div key={axis}>
                  <div className="text-[13px] font-mono text-[var(--text-dim)] mb-1">{axis}</div>
                  <input type="number" placeholder="0"
                    value={[tpX, tpY, tpZ][i]} onChange={e => [setTpX, setTpY, setTpZ][i](e.target.value)}
                    className="w-full bg-[var(--panel)] border border-[var(--border)] rounded-lg px-2 py-2 text-[15px] font-mono text-[var(--text)] placeholder:text-[var(--text-dim)] focus:outline-none focus:border-[var(--accent-mid)]"
                    style={{ fontSize: '16px' }} />
                </div>
              ))}
            </div>
            <button onClick={teleportToCoords} disabled={tpLocing || !selectedPlayer || !tpX || !tpY || !tpZ}
              className="w-full py-2.5 rounded-lg font-mono text-[13px] tracking-widest transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              style={{ background: 'var(--accent-dim)', border: '1px solid var(--accent-mid)', color: 'var(--accent)' }}>
              {tpLocing ? 'Teleporting...' : 'Teleport to Coordinates'}
            </button>
          </div>
        </div>

        {relayEnabled && <div>
          <SectionLabel>ENTITY → PLAYER</SectionLabel>
          {!selectedPlayer ? (
            <div className="text-[13px] font-mono text-[var(--text-dim)]">Choose an active player above</div>
          ) : (
            <div className="space-y-3">
              <select
                value={entityToPlayerId}
                onChange={event => setEntityToPlayerId(event.target.value)}
                className="w-full rounded-lg border border-[var(--border)] bg-[var(--panel)] px-3 py-2 text-[13px] font-mono text-[var(--text)]"
              >
                <option value="">Select live entity</option>
                {filteredEntities.map(entity => <option key={entity.uuid} value={entity.uuid}>{formatEntityOption(entity)}</option>)}
              </select>
              <button
                onClick={() => void teleportActor({
                  mode: 'actor-to-actor',
                  from: { type: 'entity', value: entityToPlayerId, label: liveEntities.find(entity => entity.uuid === entityToPlayerId)?.label ?? null },
                  to: { type: 'player', value: selectedPlayer },
                }, () => setEntityToPlayerId(''))}
                disabled={actorTping || !selectedPlayer || !entityToPlayerId}
                className="w-full py-2.5 rounded-lg font-mono text-[13px] tracking-widest transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                style={{ background: 'var(--accent-dim)', border: '1px solid var(--accent-mid)', color: 'var(--accent)' }}
              >
                {actorTping ? 'Teleporting...' : 'Teleport Entity to Player'}
              </button>
            </div>
          )}
        </div>}

        {relayEnabled && <div>
          <SectionLabel>PLAYER → ENTITY</SectionLabel>
          {!selectedPlayer ? (
            <div className="text-[13px] font-mono text-[var(--text-dim)]">Choose an active player above</div>
          ) : (
            <div className="space-y-3">
              <select
                value={playerToEntityId}
                onChange={event => setPlayerToEntityId(event.target.value)}
                className="w-full rounded-lg border border-[var(--border)] bg-[var(--panel)] px-3 py-2 text-[13px] font-mono text-[var(--text)]"
              >
                <option value="">Select live entity</option>
                {filteredEntities.map(entity => <option key={entity.uuid} value={entity.uuid}>{formatEntityOption(entity)}</option>)}
              </select>
              <button
                onClick={() => void teleportActor({
                  mode: 'actor-to-actor',
                  from: { type: 'player', value: selectedPlayer },
                  to: { type: 'entity', value: playerToEntityId, label: liveEntities.find(entity => entity.uuid === playerToEntityId)?.label ?? null },
                }, () => setPlayerToEntityId(''))}
                disabled={actorTping || !selectedPlayer || !playerToEntityId}
                className="w-full py-2.5 rounded-lg font-mono text-[13px] tracking-widest transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                style={{ background: 'var(--accent-dim)', border: '1px solid var(--accent-mid)', color: 'var(--accent)' }}
              >
                {actorTping ? 'Teleporting...' : 'Teleport Player to Entity'}
              </button>
            </div>
          )}
        </div>}

        {relayEnabled && <div>
          <SectionLabel>ENTITY → COORDINATES</SectionLabel>
          <div className="space-y-3">
            <select
              value={entityCoordId}
              onChange={event => setEntityCoordId(event.target.value)}
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--panel)] px-3 py-2 text-[13px] font-mono text-[var(--text)]"
            >
              <option value="">Select live entity</option>
              {filteredEntities.map(entity => <option key={entity.uuid} value={entity.uuid}>{formatEntityOption(entity)}</option>)}
            </select>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {(['X', 'Y', 'Z'] as const).map((axis, index) => (
                <div key={axis}>
                  <div className="text-[13px] font-mono text-[var(--text-dim)] mb-1">{axis}</div>
                  <input
                    type="number"
                    placeholder="0"
                    value={[entityTpX, entityTpY, entityTpZ][index]}
                    onChange={event => [setEntityTpX, setEntityTpY, setEntityTpZ][index](event.target.value)}
                    className="w-full rounded-lg border border-[var(--border)] bg-[var(--panel)] px-2 py-2 text-[15px] font-mono text-[var(--text)]"
                    style={{ fontSize: '16px' }}
                  />
                </div>
              ))}
            </div>
            <button
              onClick={() => void teleportActor({
                mode: 'actor-to-coords',
                actor: { type: 'entity', value: entityCoordId, label: liveEntities.find(entity => entity.uuid === entityCoordId)?.label ?? null },
                x: Number(entityTpX), y: Number(entityTpY), z: Number(entityTpZ),
              }, () => { setEntityCoordId(''); setEntityTpX(''); setEntityTpY(''); setEntityTpZ('') })}
              disabled={actorTping || !entityCoordId || !entityTpX || !entityTpY || !entityTpZ}
              className="w-full py-2.5 rounded-lg font-mono text-[13px] tracking-widest transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              style={{ background: 'var(--accent-dim)', border: '1px solid var(--accent-mid)', color: 'var(--accent)' }}
            >
              {actorTping ? 'Teleporting...' : 'Teleport Entity to Coordinates'}
            </button>
          </div>
        </div>}
      </CollapsibleCard>
      )}

      {/* ── KIT ASSIGNMENT ── */}
      {canKits && (
      <CollapsibleCard title="KIT ASSIGNMENT" storageKey="actions:kits" groupKey={ACTIONS_COLLAPSIBLE_GROUP} bodyClassName="p-4 space-y-4">

        <div>
          <SectionLabel>1 · SELECT PLAYER</SectionLabel>
          {selectedPlayer ? (
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[var(--panel)] border border-[var(--border)]">
              <span className="text-[13px] font-mono text-[var(--accent)]">{selectedPlayer}</span>
              <span className="text-[13px] font-mono text-[var(--text-dim)] opacity-60 ml-auto">from Active Player</span>
            </div>
          ) : (
            <div className="text-[13px] font-mono text-[var(--text-dim)] opacity-60">Choose an active player above</div>
          )}
        </div>

        {selectedPlayer && (
          <>
            <div>
              <SectionLabel>2 · KIT LIBRARY</SectionLabel>
              <div className="space-y-3">
                <div>
                  <div className="text-[11px] font-mono tracking-widest text-[var(--text-dim)] mb-2">BUILT-IN</div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
                    {KITS.map(k => {
                      const active = selectedKit === k.id
                      const iconColor = active ? 'var(--bg)' : 'var(--text-dim)'
                      return (
                        <button key={k.id} onClick={() => setSelectedKit(s => s === k.id ? '' : k.id)}
                          className="flex flex-col items-center gap-1 px-2 py-3 rounded-xl border transition-all"
                          style={active
                            ? { borderColor: 'var(--accent)', background: 'var(--accent)', color: 'var(--bg)' }
                            : { borderColor: 'var(--border)', color: 'var(--text-dim)' }}>
                          <k.Icon size={18} color={iconColor} strokeWidth={1.5} />
                          <span className="text-[13px] font-mono tracking-wide" style={{ color: iconColor }}>{k.label}</span>
                        </button>
                      )
                    })}
                  </div>
                </div>

                {canCustomKits && (
                  <div>
                    <div className="flex items-center justify-between gap-3 mb-2">
                      <div className="text-[11px] font-mono tracking-widest text-[var(--text-dim)]">SAVED CUSTOM</div>
                      {customKitsLoading && <div className="text-[11px] font-mono text-[var(--text-dim)] opacity-60">Loading…</div>}
                    </div>
                    {customKits.length > 0 ? (
                      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
                        {customKits.map(kit => {
                          const active = selectedKit === kit.id
                          return (
                            <button
                              key={kit.id}
                              onClick={() => setSelectedKit(s => s === kit.id ? '' : kit.id)}
                              className="flex flex-col items-center gap-1 px-2 py-3 rounded-xl border transition-all"
                              style={active
                                ? { borderColor: 'var(--accent)', background: 'var(--accent)', color: 'var(--bg)' }
                                : { borderColor: 'var(--border)', color: 'var(--text-dim)' }}
                            >
                              <KitIcon iconType={kit.iconType} iconValue={kit.iconValue} size={18} color={active ? 'var(--bg)' : 'var(--text-dim)'} />
                              <span className="text-[13px] font-mono tracking-wide text-center leading-tight">{kit.label}</span>
                              <span className="text-[11px] font-mono opacity-60">{kit.items.length} items</span>
                            </button>
                          )
                        })}
                      </div>
                    ) : (
                      <div className="rounded-lg border border-[var(--border)] bg-[var(--panel)] px-3 py-3 text-[13px] font-mono text-[var(--text-dim)]">
                        No saved custom kits yet. Build one below and it will show up here.
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {(selectedBuiltinKit || (canCustomKits && selectedCustomKit)) && (() => {
              const previewTitle = selectedBuiltinKit?.label ?? selectedCustomKit?.label ?? 'Kit'
              const previewItems = selectedBuiltinKit
                ? selectedBuiltinKit.items.map(item => ({
                    key: `${selectedBuiltinKit.id}:${item.name}`,
                    qty: item.qty,
                    label: item.name,
                    meta: item.enchants ?? '',
                  }))
                : (selectedCustomKit?.items ?? []).map(item => ({
                    key: `${selectedCustomKit?.id}:${item.itemId}`,
                    qty: item.qty,
                    label: itemLabelForId(item.itemId, allItems),
                    meta: `minecraft:${item.itemId}`,
                  }))
              return (
                <div>
                  <SectionLabel>3 · PREVIEW — {previewTitle.toUpperCase()}</SectionLabel>
                  <div className="space-y-1 mb-3 max-h-48 overflow-y-auto">
                    {previewItems.map(item => (
                      <div key={item.key} className="flex items-baseline gap-2 px-2 py-1 rounded bg-[var(--panel)] text-[13px] font-mono">
                        <span className="text-[var(--accent)] shrink-0">×{item.qty}</span>
                        <span className="text-[var(--text)]">{item.label}</span>
                        {item.meta && <span className="text-[var(--text-dim)] text-[12px] opacity-80">{item.meta}</span>}
                      </div>
                    ))}
                  </div>
                  <button onClick={assignKit} disabled={assigning}
                    className="w-full py-2.5 rounded-lg font-mono text-[13px] tracking-widest transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                    style={{ background: 'var(--accent-dim)', border: '1px solid var(--accent-mid)', color: 'var(--accent)' }}>
                    {assigning ? 'Assigning...' : `Give ${previewTitle} Kit → ${selectedPlayer}`}
                  </button>
                </div>
              )
            })()}

            {canCustomKits && (
            <div className="border-t border-[var(--border)] pt-4">
              <CollapsibleCard title="4 · KIT BUILDER" storageKey="actions:kits:builder" groupKey={ACTIONS_COLLAPSIBLE_GROUP} bodyClassName="p-0 pt-4 space-y-4" className="border border-[var(--border)] bg-transparent">
                <div className="flex items-center justify-between gap-3 px-4">
                  <div className="text-[12px] font-mono text-[var(--text-dim)]">Build reusable custom kits without leaving the assignment flow.</div>
                  <button
                    onClick={resetKitBuilder}
                    disabled={kitsBusy}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-[var(--border)] text-[13px] font-mono text-[var(--text-dim)] hover:border-[var(--accent-mid)] transition-all disabled:opacity-40"
                  >
                    <RefreshCcw size={14} />
                    New
                  </button>
                </div>

              <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)] gap-4 px-4 pb-4">
                <div className="space-y-4">
                  <div className="rounded-xl border border-[var(--border)] bg-[var(--panel)] p-3 space-y-3">
                    <div className="grid grid-cols-1 sm:grid-cols-[minmax(0,1fr)_12rem] gap-3">
                      <label className="space-y-1">
                        <div className="text-[11px] font-mono tracking-widest text-[var(--text-dim)]">KIT NAME</div>
                        <input
                          type="text"
                          value={builderLabel}
                          onChange={e => setBuilderLabel(e.target.value)}
                          maxLength={32}
                          placeholder="Builder Cache"
                          className="w-full bg-[var(--bg)] border border-[var(--border)] rounded-lg px-3 py-2 text-[15px] font-mono text-[var(--text)] placeholder:text-[var(--text-dim)] focus:outline-none focus:border-[var(--accent-mid)]"
                          style={{ fontSize: '16px' }}
                        />
                      </label>
                      <label className="space-y-1">
                        <div className="text-[11px] font-mono tracking-widest text-[var(--text-dim)]">EDIT SAVED KIT</div>
                        <select
                          value={builderSavedPicker}
                          onChange={e => {
                            const nextId = e.target.value
                            setBuilderSavedPicker(nextId)
                            if (!nextId) {
                              resetKitBuilder()
                              return
                            }
                            const kit = customKitMap.get(nextId)
                            if (kit) loadBuilderFromKit(kit)
                          }}
                          className="w-full bg-[var(--bg)] border border-[var(--border)] rounded-lg px-3 py-2 text-[15px] font-mono text-[var(--text)] focus:outline-none focus:border-[var(--accent-mid)]"
                          style={{ fontSize: '16px' }}
                        >
                          <option value="">Create new custom kit</option>
                          {customKits.map(kit => (
                            <option key={kit.id} value={kit.id}>{kit.label}</option>
                          ))}
                        </select>
                      </label>
                    </div>

                    <div className="rounded-lg border border-[var(--border)] bg-[var(--bg)] p-3 flex items-center gap-3">
                      <div className="w-12 h-12 rounded-xl border border-[var(--accent-mid)] bg-[var(--accent-dim)] flex items-center justify-center text-[var(--accent)]">
                        <KitIcon iconType={builderIconType} iconValue={builderIconValue} size={24} color="var(--accent)" />
                      </div>
                      <div className="min-w-0">
                        <div className="text-[13px] font-mono text-[var(--text)] truncate">
                          {normalizeCustomKitLabel(builderLabel) || 'Untitled Kit'}
                        </div>
                        <div className="text-[12px] font-mono text-[var(--text-dim)]">
                          {builderItems.length} / {CUSTOM_KIT_ITEM_MAX} items · {builderIconType === 'preset' ? 'Preset icon' : 'Custom flattened icon'}
                        </div>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <div className="text-[11px] font-mono tracking-widest text-[var(--text-dim)]">ICON STYLE</div>
                      <div className="flex gap-2">
                        {(['preset', 'custom'] as const).map(mode => (
                          <button
                            key={mode}
                            onClick={() => {
                              setBuilderIconType(mode)
                              if (mode === 'preset' && !CUSTOM_KIT_ICON_IDS.includes(builderIconValue as typeof CUSTOM_KIT_ICON_IDS[number])) {
                                setBuilderIconValue(CUSTOM_KIT_ICON_IDS[0])
                              }
                            }}
                            className="px-3 py-2 rounded-lg border font-mono text-[13px] tracking-widest transition-all"
                            style={builderIconType === mode
                              ? { borderColor: 'var(--accent)', background: 'var(--accent-dim)', color: 'var(--accent)' }
                              : { borderColor: 'var(--border)', color: 'var(--text-dim)' }}
                          >
                            {mode === 'preset' ? 'Preset Icons' : 'Custom Upload'}
                          </button>
                        ))}
                      </div>
                    </div>

                    {builderIconType === 'preset' ? (
                      <div className="grid grid-cols-4 sm:grid-cols-8 gap-2">
                        {CUSTOM_KIT_ICON_IDS.map(iconId => (
                          <button
                            key={iconId}
                            onClick={() => {
                              setBuilderIconType('preset')
                              setBuilderIconValue(iconId)
                            }}
                            className="aspect-square rounded-xl border flex items-center justify-center transition-all"
                            style={builderIconValue === iconId && builderIconType === 'preset'
                              ? { borderColor: 'var(--accent)', background: 'var(--accent-dim)', color: 'var(--accent)' }
                              : { borderColor: 'var(--border)', color: 'var(--text-dim)' }}
                            title={iconId}
                          >
                            <KitIcon iconType="preset" iconValue={iconId} size={20} color={builderIconValue === iconId && builderIconType === 'preset' ? 'var(--accent)' : 'var(--text-dim)'} />
                          </button>
                        ))}
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <label className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-[var(--border)] text-[13px] font-mono text-[var(--text-dim)] hover:border-[var(--accent-mid)] cursor-pointer transition-all">
                          <Upload size={14} />
                          {builderIconUploading ? 'Processing…' : 'Upload custom icon'}
                          <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            disabled={builderIconUploading}
                            onChange={async e => {
                              const file = e.target.files?.[0]
                              if (file) await processCustomIcon(file)
                              e.currentTarget.value = ''
                            }}
                          />
                        </label>
                        <div className="text-[12px] font-mono text-[var(--text-dim)]">
                          Custom uploads are flattened to a single-color mask automatically so they match the rest of Mcrafter.
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="rounded-xl border border-[var(--border)] bg-[var(--panel)] p-3 space-y-3">
                    <div className="text-[11px] font-mono tracking-widest text-[var(--text-dim)]">ADD ITEMS</div>
                    <div className="flex gap-1.5 flex-wrap">
                      {hydratedCatalog.map(cat => (
                        <button
                          key={cat.id}
                          onClick={() => {
                            setBuilderCatCatId(cat.id)
                            setBuilderSearch('')
                            setBuilderPage(0)
                            setBuilderSelectedItem(null)
                          }}
                          className={`px-2 py-1 rounded text-[13px] font-mono transition-all border ${
                            builderCatCatId === cat.id
                              ? 'border-[var(--accent)] bg-[var(--accent-dim)] text-[var(--accent)]'
                              : 'border-[var(--border)] text-[var(--text-dim)] hover:border-[var(--accent-mid)]'
                          }`}
                        >
                          {cat.label}
                        </button>
                      ))}
                    </div>

                    <input
                      type="text"
                      placeholder="Search"
                      value={builderSearch}
                      onChange={e => {
                        setBuilderSearch(e.target.value)
                        setBuilderPage(0)
                        setBuilderSelectedItem(null)
                      }}
                      className="w-full bg-[var(--bg)] border border-[var(--border)] rounded-lg px-3 py-2 text-[15px] font-mono text-[var(--text)] placeholder:text-[var(--text-dim)] focus:outline-none focus:border-[var(--accent-mid)]"
                      style={{ fontSize: '16px' }}
                    />

                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                      {builderPageItems.map(item => (
                        <button
                          key={item.id}
                          onClick={() => {
                            setBuilderSelectedItem(s => s?.id === item.id ? null : item)
                            setBuilderQty(1)
                          }}
                          className={`flex flex-col items-center gap-1 px-2 py-2.5 rounded-lg border transition-all ${
                            builderSelectedItem?.id === item.id
                              ? 'border-[var(--accent)] bg-[var(--accent-dim)] text-[var(--accent)]'
                              : 'border-[var(--border)] text-[var(--text-dim)] hover:border-[var(--accent-mid)]'
                          }`}
                        >
                          <span className="text-[13px] font-mono leading-tight text-center line-clamp-2">{item.label}</span>
                        </button>
                      ))}
                    </div>

                    {builderTotalPages > 1 && (
                      <div className="flex items-center justify-between">
                        <button
                          onClick={() => setBuilderPage(p => Math.max(0, p - 1))}
                          disabled={builderPage === 0}
                          className="text-[13px] font-mono text-[var(--accent)] disabled:opacity-30"
                        >
                          ← Prev
                        </button>
                        <span className="text-[13px] font-mono text-[var(--text-dim)]">{builderPage + 1} / {builderTotalPages}</span>
                        <button
                          onClick={() => setBuilderPage(p => Math.min(builderTotalPages - 1, p + 1))}
                          disabled={builderPage === builderTotalPages - 1}
                          className="text-[13px] font-mono text-[var(--accent)] disabled:opacity-30"
                        >
                          Next →
                        </button>
                      </div>
                    )}

                    {builderSelectedItem && (
                      <div className="rounded-lg border border-[var(--accent-mid)] bg-[var(--bg)] p-3 space-y-3">
                        <div>
                          <div className="text-[13px] font-mono text-[var(--text)]">{builderSelectedItem.label}</div>
                          <div className="text-[12px] font-mono text-[var(--text-dim)]">minecraft:{builderSelectedItem.id}</div>
                        </div>
                        <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2 items-end">
                          <label className="space-y-1">
                            <div className="text-[11px] font-mono tracking-widest text-[var(--text-dim)]">QUANTITY</div>
                            <input
                              type="number"
                              min={1}
                              max={builderSelectedItem.maxStack === 1 ? MAX_STACK_BATCHES : MAX_STACK_BATCHES * builderSelectedItem.maxStack}
                              value={builderQty}
                              onChange={e => setBuilderQty(clampKitQty(builderSelectedItem.id, Number(e.target.value), allItems))}
                              className="w-full bg-[var(--panel)] border border-[var(--border)] rounded-lg px-3 py-2 text-[15px] font-mono text-[var(--text)] focus:outline-none focus:border-[var(--accent-mid)]"
                              style={{ fontSize: '16px' }}
                            />
                          </label>
                          <button
                            onClick={addBuilderItem}
                            disabled={builderItems.length >= CUSTOM_KIT_ITEM_MAX && !builderItems.some(item => item.itemId === builderSelectedItem.id)}
                            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-[var(--accent-mid)] bg-[var(--accent-dim)] text-[var(--accent)] font-mono text-[13px] tracking-widest transition-all disabled:opacity-40"
                          >
                            <Plus size={14} />
                            Add
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="rounded-xl border border-[var(--border)] bg-[var(--panel)] p-3 space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <div className="text-[11px] font-mono tracking-widest text-[var(--text-dim)]">KIT CONTENTS</div>
                      <div className="text-[11px] font-mono text-[var(--text-dim)]">{builderItems.length} / {CUSTOM_KIT_ITEM_MAX}</div>
                    </div>

                    {builderItems.length > 0 ? (
                      <div className="space-y-2 max-h-[28rem] overflow-y-auto pr-1">
                        {builderItems.map(item => (
                          <div key={item.itemId} className="rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-2 space-y-2">
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <div className="text-[13px] font-mono text-[var(--text)] truncate">{itemLabelForId(item.itemId, allItems)}</div>
                                <div className="text-[12px] font-mono text-[var(--text-dim)]">minecraft:{item.itemId}</div>
                              </div>
                              <button
                                onClick={() => removeBuilderItem(item.itemId)}
                                className="inline-flex items-center justify-center w-8 h-8 rounded-lg border border-[var(--border)] text-[var(--text-dim)] hover:border-red-500/60 hover:text-red-400 transition-all"
                                title="Remove item"
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                            <label className="block">
                              <div className="text-[11px] font-mono tracking-widest text-[var(--text-dim)] mb-1">QTY</div>
                              <input
                                type="number"
                                min={1}
                                max={allItems.find(entry => entry.id === item.itemId)?.maxStack === 1 ? MAX_STACK_BATCHES : MAX_STACK_BATCHES * Math.max(1, allItems.find(entry => entry.id === item.itemId)?.maxStack ?? 64)}
                                value={item.qty}
                                onChange={e => updateBuilderItemQty(item.itemId, Number(e.target.value))}
                                className="w-full bg-[var(--panel)] border border-[var(--border)] rounded-lg px-3 py-2 text-[15px] font-mono text-[var(--text)] focus:outline-none focus:border-[var(--accent-mid)]"
                                style={{ fontSize: '16px' }}
                              />
                            </label>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="rounded-lg border border-dashed border-[var(--border)] px-3 py-8 text-center text-[13px] font-mono text-[var(--text-dim)]">
                        Add items from the catalog to build a reusable kit.
                      </div>
                    )}
                  </div>

                  <div className="rounded-xl border border-[var(--border)] bg-[var(--panel)] p-3 space-y-3">
                    <div className="text-[11px] font-mono tracking-widest text-[var(--text-dim)]">SAVE</div>
                    <button
                      onClick={saveBuilderKit}
                      disabled={kitsBusy}
                      className="w-full inline-flex items-center justify-center gap-2 py-2.5 rounded-lg border border-[var(--accent-mid)] bg-[var(--accent-dim)] text-[var(--accent)] font-mono text-[13px] tracking-widest transition-all disabled:opacity-40"
                    >
                      <Save size={14} />
                      {kitsBusy ? 'Saving...' : builderEditingId ? 'Update Custom Kit' : 'Save New Custom Kit'}
                    </button>
                    {builderEditingId && (
                      <button
                        onClick={deleteBuilderKit}
                        disabled={kitsBusy}
                        className="w-full inline-flex items-center justify-center gap-2 py-2.5 rounded-lg border border-red-900/50 text-red-400 font-mono text-[13px] tracking-widest transition-all hover:border-red-700 disabled:opacity-40"
                      >
                        <Trash2 size={14} />
                        Delete This Custom Kit
                      </button>
                    )}
                    <div className="text-[12px] font-mono text-[var(--text-dim)]">
                      Saved custom kits stay tied to your Mcrafter account. Uploaded icons are restyled automatically into flat monochrome masks.
                    </div>
                  </div>
                </div>
              </div>
              </CollapsibleCard>
            </div>
            )}
          </>
        )}
      </CollapsibleCard>
      )}

      {/* ── ITEM CATALOG ── */}
      {canCatalog && (
      <CollapsibleCard title="ITEM CATALOG" storageKey="actions:item-catalog" defaultOpen={false} groupKey={ACTIONS_COLLAPSIBLE_GROUP} bodyClassName="p-4 space-y-4">

        <div>
          <SectionLabel>ACTIVE PLAYER</SectionLabel>
          <PlayerPicker
            online={players}
            selected={selectedPlayer}
            onSelect={handleSelectedPlayerChange}
            placeholder="Select or type player name…"
          />
        </div>

        {selectedPlayer && (
          <>
            <div className="flex gap-1.5 flex-wrap">
              {hydratedCatalog.map(cat => (
                <button key={cat.id} onClick={() => { setCatCatId(cat.id); setCatPage(0); setCatSearch(''); setCatSelected(null); setCatBatchSelection({}) }}
                  className={`px-2 py-1 rounded text-[13px] font-mono transition-all border ${
                    catCatId === cat.id
                      ? 'border-[var(--accent)] bg-[var(--accent-dim)] text-[var(--accent)]'
                      : 'border-[var(--border)] text-[var(--text-dim)] hover:border-[var(--accent-mid)]'
                  }`}>
                  {cat.label}
                </button>
              ))}
            </div>

            <input type="text" placeholder="Search"
              value={catSearch} onChange={e => { setCatSearch(e.target.value); setCatPage(0); setCatSelected(null); setCatBatchSelection({}) }}
              className="w-full bg-[var(--panel)] border border-[var(--border)] rounded-lg px-3 py-2 text-[15px] font-mono text-[var(--text)] placeholder:text-[var(--text-dim)] focus:outline-none focus:border-[var(--accent-mid)]"
              style={{ fontSize: '16px' }} />

            <div className="text-[11px] font-mono text-[var(--text-dim)]">
              Click once to preview. Double-click on desktop or press and hold on mobile to add items to a multi-give batch.
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-1.5">
              {pageItems.map(item => (
                <button key={item.id}
                  onClick={() => {
                    if (catalogLongPressItemRef.current === item.id) {
                      catalogLongPressItemRef.current = null
                      return
                    }
                    setCatSelected(current => current?.id === item.id ? null : item)
                    setCatQty(1)
                  }}
                  onDoubleClick={() => toggleBatchItem(item)}
                  onPointerDown={event => {
                    if (event.pointerType === 'mouse') return
                    clearCatalogHold()
                    catalogHoldTimerRef.current = setTimeout(() => {
                      catalogLongPressItemRef.current = item.id
                      toggleBatchItem(item)
                    }, 450)
                  }}
                  onPointerUp={clearCatalogHold}
                  onPointerLeave={clearCatalogHold}
                  onPointerCancel={clearCatalogHold}
                  className={`flex flex-col gap-2 rounded-[22px] border p-2.5 text-left transition-all ${
                    catSelected?.id === item.id || catBatchSelection[item.id] != null
                      ? 'text-[var(--accent)]'
                      : 'text-[var(--text-dim)] hover:border-[var(--accent-mid)]'
                  }`}
                  style={catSelected?.id === item.id || catBatchSelection[item.id] != null
                    ? {
                        borderColor: 'var(--accent)',
                        background: 'linear-gradient(180deg, color-mix(in srgb, var(--accent) 18%, transparent), color-mix(in srgb, var(--panel) 92%, transparent))',
                      }
                    : {
                        borderColor: 'var(--border)',
                        background: 'color-mix(in srgb, var(--panel) 84%, transparent)',
                      }}>
                  <div className="rounded-[18px] border p-2" style={{ borderColor: 'rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.04)' }}>
                    <CatalogArtwork
                      kind="item"
                      label={item.label}
                      category={selectedCategoryLabel}
                      imageUrl={item.imageUrl}
                      art={item.art}
                      className="h-24 w-full rounded-[14px] object-contain"
                    />
                  </div>
                  <div>
                    <div className="text-[12px] font-mono leading-tight line-clamp-2">{item.label}</div>
                    <div className="mt-1 text-[10px] font-mono tracking-[0.18em] opacity-70">{item.maxStack === 1 ? 'UNSTACKABLE' : `STACK ${item.maxStack}`}</div>
                    {catBatchSelection[item.id] != null && (
                      <div className="mt-1 text-[10px] font-mono tracking-[0.18em] text-[var(--accent)]">BATCHED</div>
                    )}
                  </div>
                </button>
              ))}
            </div>

            {totalPages > 1 && (
              <div className="flex items-center justify-between">
                <button onClick={() => setCatPage(p => Math.max(0, p - 1))} disabled={catPage === 0}
                  className="text-[13px] font-mono text-[var(--accent)] disabled:opacity-30">← Prev</button>
                <span className="text-[13px] font-mono text-[var(--text-dim)]">{catPage + 1} / {totalPages}</span>
                <button onClick={() => setCatPage(p => Math.min(totalPages - 1, p + 1))} disabled={catPage === totalPages - 1}
                  className="text-[13px] font-mono text-[var(--accent)] disabled:opacity-30">Next →</button>
              </div>
            )}

            {catBatchEntries.length > 0 && (
              <div className="space-y-3 rounded-[24px] border border-[var(--border)] bg-[var(--panel)] p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-[13px] font-mono text-[var(--text)]">MULTI-GIVE QUEUE</div>
                    <div className="text-[11px] font-mono text-[var(--text-dim)]">{catBatchEntries.length} selected item {catBatchEntries.length === 1 ? 'type' : 'types'}</div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setCatBatchSelection({})}
                    className="rounded-lg border border-[var(--border)] px-3 py-2 text-[11px] font-mono text-[var(--text-dim)] transition-all hover:border-[var(--accent-mid)]"
                  >
                    Clear Queue
                  </button>
                </div>
                <div className="space-y-2">
                  {catBatchEntries.map(({ item, qty }) => (
                    <div key={item.id} className="grid gap-2 rounded-2xl border border-[var(--border)] bg-[var(--bg)] px-3 py-3 sm:grid-cols-[minmax(0,1fr)_8rem_auto] sm:items-center">
                      <div className="min-w-0">
                        <div className="truncate text-[12px] font-mono text-[var(--text)]">{item.label}</div>
                        <div className="text-[10px] font-mono tracking-[0.16em] text-[var(--text-dim)]">{itemBatchSummary(item, qty)}</div>
                      </div>
                      <input
                        type="number"
                        min={1}
                        max={getItemMaxQty(item)}
                        value={qty}
                        onChange={event => updateCatalogQty(item, Number(event.target.value) || 1)}
                        className="w-full rounded-lg border border-[var(--border)] bg-[var(--panel)] px-3 py-2 text-[13px] font-mono text-[var(--text)] focus:outline-none focus:border-[var(--accent-mid)]"
                        style={{ fontSize: '16px' }}
                      />
                      <button
                        type="button"
                        onClick={() => toggleBatchItem(item)}
                        className="rounded-lg border border-[var(--border)] px-3 py-2 text-[11px] font-mono text-[var(--text-dim)] transition-all hover:border-red-700 hover:text-red-300"
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
                <button
                  onClick={giveBatchItems}
                  disabled={catGiving}
                  className="w-full rounded-lg py-2.5 font-mono text-[13px] tracking-widest transition-all disabled:cursor-not-allowed disabled:opacity-40"
                  style={{ background: 'var(--accent-dim)', border: '1px solid var(--accent-mid)', color: 'var(--accent)' }}
                >
                  {catGiving ? 'Giving...' : `Give ${catBatchEntries.length} Selected Item ${catBatchEntries.length === 1 ? 'Type' : 'Types'} → ${selectedPlayer}`}
                </button>
              </div>
            )}

            {catSelected && (
              <div className="space-y-3 pt-1">
                {(() => {
                  const totalQty = currentCatalogQty
                  const qtyBreakdown = splitGiveQty(catSelected, currentCatalogQty)
                  return (
                    <>
                      <div
                        className="space-y-3 rounded-[28px] border p-4"
                        style={{
                          borderColor: itemCardPalette(catSelected, selectedCategoryLabel).frame,
                          background: `linear-gradient(180deg, ${itemCardPalette(catSelected, selectedCategoryLabel).frameSoft}, rgba(8,11,16,0.94))`,
                          boxShadow: `0 18px 42px ${itemCardPalette(catSelected, selectedCategoryLabel).frameGlow}`,
                        }}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="text-[10px] font-mono tracking-[0.35em]" style={{ color: itemCardPalette(catSelected, selectedCategoryLabel).badgeText }}>ITEM CARD</div>
                            <div className="mt-1 text-[18px] font-mono text-[var(--text)]">{catSelected.label}</div>
                          </div>
                          <div className="flex flex-wrap justify-end gap-2 text-[10px] font-mono tracking-widest">
                            <span className="rounded-full border px-2 py-1" style={{ borderColor: itemCardPalette(catSelected, selectedCategoryLabel).frame, background: itemCardPalette(catSelected, selectedCategoryLabel).badge, color: itemCardPalette(catSelected, selectedCategoryLabel).badgeText }}>{selectedCategoryLabel}</span>
                            <span className="rounded-full border border-[var(--border)] px-2 py-1 text-[var(--text-dim)]">{minecraftVersion || 'fallback version'}</span>
                          </div>
                        </div>
                        <div className="rounded-[24px] border p-2" style={{ borderColor: itemCardPalette(catSelected, selectedCategoryLabel).frame, background: 'rgba(0,0,0,0.18)' }}>
                          <CatalogArtwork
                            kind="item"
                            label={catSelected.label}
                            category={selectedCategoryLabel}
                            imageUrl={catSelected.imageUrl}
                            art={catSelected.art}
                            className="h-52 w-full rounded-[18px] border border-white/10 object-contain"
                          />
                          <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
                            {[
                              ['Id', `minecraft:${catSelected.id}`],
                              ['Category', selectedCategoryLabel],
                              ['Per Stack', String(catSelected.maxStack)],
                              ['Max Batch', String(catSelected.maxStack > 1 ? MAX_STACK_BATCHES * catSelected.maxStack : MAX_STACK_BATCHES)],
                            ].map(([label, value]) => (
                              <div key={label} className="rounded-2xl border px-3 py-2" style={{ borderColor: 'rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.04)' }}>
                                <div className="text-[9px] font-mono tracking-[0.28em] text-[var(--text-dim)]">{label}</div>
                                <div className="mt-1 text-[12px] font-mono text-[var(--text)] break-all">{value}</div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                      <div className="space-y-2">
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-[13px] font-mono text-[var(--text-dim)]">Quantity</div>
                    <div className="text-[12px] font-mono text-[var(--text-dim)]">
                      {catSelected.maxStack > 1
                        ? `${qtyBreakdown.stacks} stack${qtyBreakdown.stacks === 1 ? '' : 's'} · ${qtyBreakdown.singles} single${qtyBreakdown.singles === 1 ? '' : 's'}`
                        : `${totalQty} item${totalQty === 1 ? '' : 's'}`}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {quickGiveOptions(catSelected).map(option => (
                      <button
                        key={option}
                        type="button"
                        onClick={() => setCatQty(option)}
                        className="rounded-lg border px-3 py-2 text-[12px] font-mono transition-all"
                        style={catQty === option
                          ? { borderColor: 'var(--accent-mid)', background: 'var(--accent-dim)', color: 'var(--accent)' }
                          : { borderColor: 'var(--border)', background: 'var(--panel)', color: 'var(--text-dim)' }}
                      >
                        {formatQuickGiveLabel(catSelected, option)}
                      </button>
                    ))}
                  </div>
                  <div className={`grid gap-2 ${catSelected.maxStack > 1 ? 'sm:grid-cols-3' : 'sm:grid-cols-[minmax(0,1fr)_8rem]'}`}>
                    {catSelected.maxStack > 1 && (
                      <>
                        <label className="space-y-1 block">
                          <div className="text-[13px] font-mono text-[var(--text-dim)]">Stacks</div>
                          <input
                            type="number"
                            min={0}
                            max={MAX_STACK_BATCHES}
                            value={qtyBreakdown.stacks}
                            onChange={e => {
                              const stacks = Math.max(0, Math.min(MAX_STACK_BATCHES, Number(e.target.value) || 0))
                              updateCatalogQty(catSelected, (stacks * catSelected.maxStack) + qtyBreakdown.singles)
                            }}
                            className="w-full bg-[var(--panel)] border border-[var(--border)] rounded-lg px-3 py-2 text-[15px] font-mono text-[var(--text)] focus:outline-none focus:border-[var(--accent-mid)]"
                            style={{ fontSize: '16px' }}
                          />
                        </label>
                        <label className="space-y-1 block">
                          <div className="text-[13px] font-mono text-[var(--text-dim)]">Singles</div>
                          <input
                            type="number"
                            min={0}
                            max={catSelected.maxStack - 1}
                            value={qtyBreakdown.singles}
                            onChange={e => {
                              const singles = Math.max(0, Math.min(catSelected.maxStack - 1, Number(e.target.value) || 0))
                              updateCatalogQty(catSelected, (qtyBreakdown.stacks * catSelected.maxStack) + singles)
                            }}
                            className="w-full bg-[var(--panel)] border border-[var(--border)] rounded-lg px-3 py-2 text-[15px] font-mono text-[var(--text)] focus:outline-none focus:border-[var(--accent-mid)]"
                            style={{ fontSize: '16px' }}
                          />
                        </label>
                      </>
                    )}
                    {catSelected.maxStack <= 1 && (
                      <label className="space-y-1 block">
                        <div className="text-[13px] font-mono text-[var(--text-dim)]">Item Count</div>
                        <input
                          type="number"
                          min={1}
                          max={getItemMaxQty(catSelected)}
                          value={currentCatalogQty}
                          onChange={e => updateCatalogQty(catSelected, Number(e.target.value) || 1)}
                          className="w-full bg-[var(--panel)] border border-[var(--border)] rounded-lg px-3 py-2 text-[15px] font-mono text-[var(--text)] focus:outline-none focus:border-[var(--accent-mid)]"
                          style={{ fontSize: '16px' }}
                        />
                      </label>
                    )}
                    <div className="rounded-lg border border-[var(--border)] bg-[var(--panel)] px-3 py-2">
                      <div className="text-[13px] font-mono text-[var(--text-dim)]">Total</div>
                      <div className="text-[15px] font-mono text-[var(--text)]">{totalQty}</div>
                    </div>
                  </div>
                      </div>
                      <div className="text-[13px] font-mono text-[var(--text-dim)]">
                        Per stack: {catSelected.maxStack} · Max batch: {catSelected.maxStack > 1 ? MAX_STACK_BATCHES * catSelected.maxStack : MAX_STACK_BATCHES}
                      </div>
                      <button onClick={catBatchEntries.length > 0 ? giveBatchItems : giveItem} disabled={catGiving}
                        className="w-full py-2.5 rounded-lg font-mono text-[13px] tracking-widest transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                        style={{ background: 'var(--accent-dim)', border: '1px solid var(--accent-mid)', color: 'var(--accent)' }}>
                        {catGiving ? 'Giving...' : catBatchEntries.length > 0 ? `Give Queue → ${selectedPlayer}` : `Give ×${totalQty} ${catSelected.label} → ${selectedPlayer}`}
                      </button>
                    </>
                  )
                })()}
              </div>
            )}
          </>
        )}
      </CollapsibleCard>
      )}

      {/* ── INVENTORY VIEWER ── */}
      {canInventory && (
      <CollapsibleCard title="INVENTORY VIEWER" storageKey="actions:inventory" groupKey={ACTIONS_COLLAPSIBLE_GROUP} bodyClassName="p-4 space-y-4">

        <div>
          <SectionLabel>SELECT PLAYER</SectionLabel>
          {selectedPlayer ? (
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[var(--panel)] border border-[var(--border)]">
              <span className="text-[13px] font-mono text-[var(--accent)]">{selectedPlayer}</span>
              <span className="text-[13px] font-mono text-[var(--text-dim)] opacity-60 ml-auto">from Active Player</span>
            </div>
          ) : (
            <div className="text-[13px] font-mono text-[var(--text-dim)] opacity-60">Choose an active player above</div>
          )}
        </div>

        <button onClick={loadInventory} disabled={invLoading || !invPlayer}
          className="w-full py-2.5 rounded-lg font-mono text-[13px] tracking-widest transition-all disabled:opacity-40 disabled:cursor-not-allowed border border-[var(--border)] text-[var(--text-dim)] hover:border-[var(--accent-mid)]">
          {invLoading ? 'Loading…' : 'Load Inventory'}
        </button>

        {invItems.length > 0 && (() => {
          const { hotbar, main, armor, offhand } = buildInventoryLayout(invItems)
          return (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="text-[13px] font-mono text-[var(--text-dim)]">{invItems.length} item{invItems.length !== 1 ? 's' : ''}</div>
                <button
                  onClick={() => setConfirmModal({ title: 'Clear all items?', body: `This will remove all ${invItems.length} items from ${invPlayer}'s inventory.`, confirmLabel: 'Clear All', destructive: true, onConfirm: () => doClearAll(invPlayer) })}
                  disabled={!!invDeleting}
                  className="text-[13px] font-mono px-2 py-1 rounded border border-red-900/50 text-red-400 hover:border-red-700 transition-all disabled:opacity-30">
                  Clear All
                </button>
              </div>
              {selectedInvSlot && (
                <div className="text-[11px] font-mono text-[var(--text-dim)] px-2 py-1 rounded border border-[var(--accent-mid)] bg-[var(--accent-dim)]">
                  <span className="text-[var(--accent)]">{selectedInvSlot.label}</span> selected — click an empty slot or matching stack to move, or click the selected item to deselect
                </div>
              )}
              <div>
                <div className="text-[11px] font-mono text-[var(--text-dim)] mb-1.5 tracking-widest">HOTBAR</div>
                <div className="flex flex-wrap gap-1">
                  {hotbar.map((item, i) => (
                    <InvSlot key={i} item={item} slotIndex={i}
                      selected={!!item && selectedInvSlot?.slot === item.slot}
                      moveTarget={!!selectedInvSlot && ((!item) || (item.id === selectedInvSlot.id && item.slot !== selectedInvSlot.slot))}
                      onMoveTargetHold={() => handleInvSlotHoldToMove(invPlayer, item?.slot ?? i, selectedInvSlot)}
                      onDelete={item ? (it) => setConfirmModal({ title: 'Clear item?', body: it.label, confirmLabel: 'Clear', destructive: true, onConfirm: () => { setConfirmModal(null); deleteItem(invPlayer, it) } }) : undefined}
                      onSlotClick={() => handleInvSlotClick(invPlayer, item, item?.slot ?? i, selectedInvSlot)}
                      deleting={item ? invDeleting === `${item.slot}` : false}
                    />
                  ))}
                </div>
              </div>
              <div>
                <div className="text-[11px] font-mono text-[var(--text-dim)] mb-1.5 tracking-widest">ARMOR / OFFHAND</div>
                <div className="flex gap-1 flex-wrap items-center">
                  {armor.map((item, i) => {
                    const armorSlots = [103, 102, 101, 100]
                    const s = armorSlots[i]
                    return (
                      <InvSlot key={i} item={item} slotIndex={s}
                        selected={!!item && selectedInvSlot?.slot === item.slot}
                        moveTarget={!!selectedInvSlot && ((!item) || (item.id === selectedInvSlot.id && item.slot !== selectedInvSlot.slot))}
                        onMoveTargetHold={() => handleInvSlotHoldToMove(invPlayer, item?.slot ?? s, selectedInvSlot)}
                        onDelete={item ? (it) => setConfirmModal({ title: 'Clear item?', body: it.label, confirmLabel: 'Clear', destructive: true, onConfirm: () => { setConfirmModal(null); deleteItem(invPlayer, it) } }) : undefined}
                        onSlotClick={() => handleInvSlotClick(invPlayer, item, item?.slot ?? s, selectedInvSlot)}
                        deleting={item ? invDeleting === `${item.slot}` : false}
                      />
                    )
                  })}
                  <div className="w-px h-8 bg-[var(--border)] mx-1.5" />
                  <InvSlot item={offhand} slotIndex={150}
                    selected={!!offhand && selectedInvSlot?.slot === 150}
                    moveTarget={!!selectedInvSlot && ((!offhand) || (offhand.id === selectedInvSlot.id && offhand.slot !== selectedInvSlot.slot))}
                    onMoveTargetHold={() => handleInvSlotHoldToMove(invPlayer, offhand?.slot ?? 150, selectedInvSlot)}
                    onDelete={offhand ? (it) => setConfirmModal({ title: 'Clear item?', body: it.label, confirmLabel: 'Clear', destructive: true, onConfirm: () => { setConfirmModal(null); deleteItem(invPlayer, it) } }) : undefined}
                    onSlotClick={() => handleInvSlotClick(invPlayer, offhand, offhand?.slot ?? 150, selectedInvSlot)}
                    deleting={offhand ? invDeleting === `${offhand.slot}` : false}
                  />
                </div>
              </div>
              <div>
                <div className="text-[11px] font-mono text-[var(--text-dim)] mb-1.5 tracking-widest">MAIN</div>
                <div className="grid gap-1" style={{ gridTemplateColumns: 'repeat(9, 2.5rem)' }}>
                  {main.map((item, i) => (
                    <InvSlot key={i} item={item} slotIndex={i + 9}
                      selected={!!item && selectedInvSlot?.slot === item.slot}
                      moveTarget={!!selectedInvSlot && ((!item) || (item.id === selectedInvSlot.id && item.slot !== selectedInvSlot.slot))}
                      onMoveTargetHold={() => handleInvSlotHoldToMove(invPlayer, item?.slot ?? (i + 9), selectedInvSlot)}
                      onDelete={item ? (it) => setConfirmModal({ title: 'Clear item?', body: it.label, confirmLabel: 'Clear', destructive: true, onConfirm: () => { setConfirmModal(null); deleteItem(invPlayer, it) } }) : undefined}
                      onSlotClick={() => handleInvSlotClick(invPlayer, item, item?.slot ?? (i + 9), selectedInvSlot)}
                      deleting={item ? invDeleting === `${item.slot}` : false}
                    />
                  ))}
                </div>
              </div>
            </div>
          )
        })()}

        {!invLoading && invPlayer && invItems.length === 0 && (
          <div className="text-[13px] font-mono text-[var(--text-dim)] text-center py-4">
            Pockets empty — player may be offline or carrying nothing
          </div>
        )}
      </CollapsibleCard>
      )}

      <Toasts toasts={toasts} />
      {confirmModal && (
        <ConfirmModal
          {...confirmModal}
          onCancel={() => { setConfirmModal(null); setSelectedInvSlot(null) }}
        />
      )}
      {!allSectionsDisabled && (
        <div className="flex justify-end">
          <button
            type="button"
            onClick={toggleCollapseAll}
            className="rounded-lg border border-[var(--border)] px-3 py-2 text-[12px] font-mono tracking-widest text-[var(--text-dim)] transition-colors hover:border-[var(--accent-mid)] hover:text-[var(--accent)]"
          >
            {collapseAllLabel}
          </button>
        </div>
      )}
    </div>
  )
}
