'use client'
import { useState, useEffect, useCallback, useMemo } from 'react'
import InvSlot, { slotLabel, buildInventoryLayout } from './InvSlot'
import CatalogArtwork from './CatalogArtwork'
import Toasts from './Toasts'
import { useToast } from './useToast'
import type { InvItem } from '../../api/minecraft/inventory/route'
import ConfirmModal from './ConfirmModal'
import type { ConfirmModalProps } from './ConfirmModal'
import type { FeatureKey } from '@/lib/features'
import { CATALOG, hydrateCatalogWithArt } from '@/app/minecraft/items'
import CollapsibleCard, { setCollapsibleGroupState } from './CollapsibleCard'

// ── Utility Components ─────────────────────────────────────────────────────

function EmptyState({ icon, message, action }: { icon: React.ReactNode; message: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center py-8 text-center">
      <div className="mb-3 text-[var(--text-dim)] opacity-60">{icon}</div>
      <p className="text-[13px] font-mono text-[var(--text-dim)]">{message}</p>
      {action && <div className="mt-3">{action}</div>}
    </div>
  )
}

const EmptyInventoryIcon = () => (
  <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
    <rect x="2" y="3" width="20" height="14" rx="2" ry="2"/>
    <line x1="8" y1="21" x2="16" y2="21"/>
    <line x1="12" y1="17" x2="12" y2="21"/>
  </svg>
)

const SkeletonIcon = () => (
  <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
    <circle cx="12" cy="8" r="4"/>
    <path d="M12 12v8"/>
    <path d="M9 20l6-2"/>
    <path d="M15 20l-6-2"/>
    <path d="M8 16h8"/>
  </svg>
)

// ── Types ─────────────────────────────────────────────────────────────────────

type PlayerListData = {
  count: number
  players: string
  ts?: number
  sessionStarts?: Record<string, number>
  error?: string
}

type PlayerStats = {
  player: string
  uuid: string | null
  ping: number | null
  dimension: string | null
  health: number | null
  food: number | null
  xpLevel: number | null
  xpP: number | null
  gamemode: string | null
  pos: { x: number; y: number; z: number } | null
  spawnPos: { x: number; y: number; z: number } | null
}

type PlayerXpBooster = {
  id: string
  label: string
  durationHours: number
  bonusPoints: number
  intervalSeconds: number
  endsAt: number
  lastRunAt: number | null
}

type WorldDirectoryData = {
  ok: boolean
  defaultWorld: string | null
  worlds: Array<{
    name: string
    environment: string
    spawn: { x: number; y: number; z: number; yaw: number; pitch: number } | null
  }>
}

type Props = {
  onPlayersChange?: (players: string[]) => void
  minecraftVersion?: string | null
}

// ── Constants ─────────────────────────────────────────────────────────────────

const EFFECT_LABELS: Record<string, string> = {
  night_vision: 'Night Vision',
  speed:        'Speed',
  invisibility: 'Invisibility',
  jump:         'Jump Boost',
  strength:     'Strength',
  haste:        'Haste',
  fly:          'Fly',
}

const GAMEMODE_COLORS: Record<string, string> = {
  survival:  '#4ade80',
  creative:  '#60a5fa',
  adventure: '#f59e0b',
  spectator: '#a78bfa',
}

const DIMENSION_COLORS: Record<string, string> = {
  'Overworld': '#4ade80',
  'Nether':    '#f97316',
  'The End':   '#a78bfa',
}

const GAMEMODE_OPTIONS = ['survival', 'creative', 'adventure', 'spectator'] as const
const DIMENSION_OPTIONS = ['Overworld', 'Nether', 'The End'] as const
const HUNGER_OPTIONS = [
  { id: 'full', label: 'Full Belly', value: 20, note: 'Instant refill and clears hunger drain' },
  { id: 'trail', label: 'Trail Rations', value: 14, note: 'Keeps them fed but not topped off' },
  { id: 'low', label: 'Running Low', value: 8, note: 'Puts pressure on sprinting and regen' },
  { id: 'starve', label: 'Near Starving', value: 2, note: 'Sharp survival pressure profile' },
] as const
const XP_BOOST_ACTIONS = [
  { id: 'points-50', label: '+50 pts', mode: 'points', amount: 50, tone: '#4ade80' },
  { id: 'points-200', label: '+200 pts', mode: 'points', amount: 200, tone: '#f59e0b' },
  { id: 'levels-5', label: '+5 lv', mode: 'levels', amount: 5, tone: '#60a5fa' },
] as const
const XP_BOOSTER_PRESETS = [
  { id: '1h', label: 'Spark Hour', copy: '1 hour of +40 xp points every 5 minutes', tone: '#4ade80' },
  { id: '3h', label: 'Momentum Run', copy: '3 hours of +75 xp points every 5 minutes', tone: '#60a5fa' },
  { id: '5h', label: 'Overdrive Shift', copy: '5 hours of +110 xp points every 5 minutes', tone: '#f472b6' },
] as const
const EFFECT_LOADOUTS = [
  { id: 'traversal', label: 'Traversal Boost', note: 'Speed and jump boost for quick repositioning', tone: '#38bdf8' },
  { id: 'builder', label: 'Builder Focus', note: 'Night vision and haste for long build sessions', tone: '#a78bfa' },
  { id: 'rescue', label: 'Rescue Bubble', note: 'Regeneration, resistance, and safety effects', tone: '#fb7185' },
  { id: 'clear', label: 'Clear Effects', note: 'Strip the current potion stack instantly', tone: '#94a3b8' },
] as const
const AXIS_NUDGE_ROWS = [
  { axis: 'x', label: 'X Drift', actions: [{ label: '-1', delta: -1 }, { label: '+1', delta: 1 }, { label: '-8', delta: -8 }, { label: '+8', delta: 8 }], tone: '#60a5fa' },
  { axis: 'y', label: 'Y Lift', actions: [{ label: '-1', delta: -1 }, { label: '+1', delta: 1 }, { label: '-8', delta: -8 }, { label: '+8', delta: 8 }], tone: '#4ade80' },
  { axis: 'z', label: 'Z Slide', actions: [{ label: '-1', delta: -1 }, { label: '+1', delta: 1 }, { label: '-8', delta: -8 }, { label: '+8', delta: 8 }], tone: '#f59e0b' },
] as const
const INVENTORY_UTILITY_ACTIONS = [
  { id: 'clear_hotbar', label: 'Clear Hotbar', detail: 'Wipes only the 9 quick-access slots.', tone: '#fb7185' },
  { id: 'clear_main_inventory', label: 'Clear Main', detail: 'Clears storage slots only, leaving hotbar untouched.', tone: '#f97316' },
  { id: 'clear_armor', label: 'Clear Armor', detail: 'Removes helmet, chestplate, leggings, and boots.', tone: '#ef4444' },
  { id: 'clear_offhand', label: 'Clear Offhand', detail: 'Clears shields, totems, and other offhand gear.', tone: '#f43f5e' },
] as const

const PLAYERS_COLLAPSIBLE_GROUP = 'players-tab'
function buildInventoryItemLookup(minecraftVersion: string | null | undefined) {
  return new Map<string, {
    categoryLabel: string
    maxStack: number
    imageUrl: string | null
    art: NonNullable<(typeof CATALOG)[number]['items'][number]['art']> | null
  }>(
    hydrateCatalogWithArt(minecraftVersion, CATALOG).flatMap(category =>
      category.items.map(item => [
        `minecraft:${item.id}`,
        {
          categoryLabel: category.label,
          maxStack: item.maxStack,
          imageUrl: item.imageUrl ?? null,
          art: item.art ?? null,
        },
      ] as const)
    )
  )
}

// ── Utilities ─────────────────────────────────────────────────────────────────

function formatOnlineTime(joinedAtMs: number): string {
  const elapsed = Math.floor((Date.now() - joinedAtMs) / 1000)
  if (elapsed < 60)   return `${elapsed}s`
  if (elapsed < 3600) return `${Math.floor(elapsed / 60)}m ${elapsed % 60}s`
  const h = Math.floor(elapsed / 3600)
  const m = Math.floor((elapsed % 3600) / 60)
  return `${h}h ${m}m`
}

function formatRemainingTime(endsAtSec: number): string {
  const remaining = Math.max(0, endsAtSec * 1000 - Date.now())
  const totalMinutes = Math.floor(remaining / 60_000)
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  if (hours > 0) return `${hours}h ${minutes}m left`
  return `${minutes}m left`
}

function pingColor(ms: number): string {
  if (ms < 80)  return '#4ade80'
  if (ms < 150) return '#f59e0b'
  return '#f87171'
}

// ── Sub-components ────────────────────────────────────────────────────────────

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between py-1.5 border-b border-[var(--border)] last:border-0">
      <span className="text-[13px] font-mono tracking-widest text-[var(--text-dim)] shrink-0 w-28">{label}</span>
      <span className="text-[13px] font-mono text-[var(--text)] text-right">{children}</span>
    </div>
  )
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-[13px] font-mono tracking-widest text-[var(--text-dim)] pt-1">{children}</div>
  )
}

function HeartBar({ value, max = 20 }: { value: number | null; max?: number }) {
  if (value === null) return <span className="text-[var(--text-dim)]">—</span>
  const filled = Math.round(value / 2)
  const total  = max / 2
  return (
    <div className="flex flex-wrap gap-0.5 items-center justify-end">
      {Array.from({ length: total }).map((_, i) => (
        <span key={i} className="text-[13px] leading-none" style={{ color: i < filled ? '#ff4466' : 'var(--border)' }}>♥</span>
      ))}
      <span className="text-[13px] font-mono text-[var(--text-dim)] ml-1">{value.toFixed(1)}/{max}</span>
    </div>
  )
}

function HungerBar({ value, max = 20 }: { value: number | null; max?: number }) {
  if (value === null) return <span className="text-[var(--text-dim)]">—</span>
  return (
    <div className="flex flex-wrap gap-0.5 items-center justify-end">
      {Array.from({ length: max / 2 }).map((_, i) => (
        <span key={i} className="inline-block w-2 h-2 rounded-sm" style={{ background: i < value / 2 ? '#f59e0b' : 'var(--border)' }} />
      ))}
      <span className="text-[13px] font-mono text-[var(--text-dim)] ml-1">{value}/{max}</span>
    </div>
  )
}

function XpRow({ level, progress }: { level: number | null; progress: number | null }) {
  if (level === null) return <span className="text-[var(--text-dim)]">—</span>
  const pct = progress !== null ? Math.round(progress * 100) : 0
  return (
    <div className="flex items-center gap-2 justify-end">
      <span className="text-[13px] font-mono text-[var(--accent)]">Lv.{level}</span>
      <div className="w-20 h-1.5 rounded-full bg-[var(--border)] overflow-hidden">
        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: 'var(--accent)' }} />
      </div>
      <span className="text-[13px] font-mono text-[var(--text-dim)] w-7 text-right">{pct}%</span>
    </div>
  )
}

function Badge({ color, children }: { color: string; children: React.ReactNode }) {
  return (
    <span
      className="text-[13px] font-mono tracking-widest px-2 py-0.5 rounded border"
      style={{ color, borderColor: color + '44', background: color + '11' }}
    >
      {children}
    </span>
  )
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <button
      onClick={() => navigator.clipboard.writeText(text).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500) })}
      className="text-[13px] font-mono px-1.5 py-0.5 rounded border border-[var(--border)] text-[var(--text-dim)] hover:border-[var(--accent-mid)] transition-colors"
    >
      {copied ? '✓' : 'copy'}
    </button>
  )
}

function CoordBlock({ label, pos }: { label: string; pos: { x: number; y: number; z: number } | null }) {
  if (!pos) return null
  const str = `${Math.round(pos.x)}, ${Math.round(pos.y)}, ${Math.round(pos.z)}`
  return (
    <div className="bg-[var(--panel)] rounded-lg p-3 border border-[var(--border)] space-y-1">
      <div className="flex items-center justify-between">
        <span className="text-[13px] font-mono tracking-widest text-[var(--text-dim)]">{label}</span>
        <CopyButton text={str} />
      </div>
      <div className="grid grid-cols-3 gap-2 pt-1">
        {(['x', 'y', 'z'] as const).map(axis => (
          <div key={axis} className="text-center">
            <div className="text-[13px] font-mono text-[var(--accent)] opacity-60">{axis.toUpperCase()}</div>
            <div className="text-[13px] font-mono text-[var(--text)]">{Math.round(pos[axis])}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

function ActionChip({
  icon,
  label,
  hint,
  onClick,
  disabled = false,
  tone = 'var(--accent)',
  active = false,
  lockedReason,
  ctaLabel,
  onCta,
}: {
  icon: string
  label: string
  hint: string
  onClick: () => void
  disabled?: boolean
  tone?: string
  active?: boolean
  lockedReason?: string
  ctaLabel?: string
  onCta?: () => void
}) {
  const locked = !!lockedReason
  return (
    <div className="group relative inline-flex">
      <button
        type="button"
        onClick={locked || disabled ? undefined : onClick}
        disabled={disabled}
        aria-disabled={locked || disabled}
        className="inline-flex items-center gap-2 rounded-full border px-3 py-2 text-[11px] font-mono shadow-[0_10px_24px_rgba(0,0,0,0.12)] transition-all duration-150 disabled:cursor-not-allowed disabled:opacity-40 hover:-translate-y-0.5 hover:shadow-[0_14px_28px_rgba(0,0,0,0.18)]"
        style={locked
          ? { borderColor: 'rgba(148,163,184,0.18)', background: 'linear-gradient(180deg, rgba(148,163,184,0.10), rgba(148,163,184,0.04))', color: 'rgba(148,163,184,0.88)' }
          : active
            ? { borderColor: tone, background: `linear-gradient(180deg, ${tone}24, ${tone}14)`, color: tone, boxShadow: `0 0 0 1px ${tone}22 inset` }
            : { borderColor: 'var(--border)', background: 'linear-gradient(180deg, rgba(255,255,255,0.06), rgba(255,255,255,0.03))', color: 'var(--text)' }}
      >
        <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full border border-current/15 bg-black/10 px-1 text-[10px] leading-none">{locked ? 'L' : icon}</span>
        <span className="tracking-[0.12em]">{label}</span>
      </button>
      <div className="pointer-events-none absolute left-1/2 top-full z-10 mt-2 w-48 -translate-x-1/2 rounded-2xl border border-white/10 bg-[#0b1018]/95 px-3 py-2 text-left text-[10px] leading-relaxed text-[var(--text-dim)] opacity-0 shadow-[0_20px_40px_rgba(0,0,0,0.35)] backdrop-blur-sm transition-all duration-150 group-hover:pointer-events-auto group-hover:translate-y-0.5 group-hover:opacity-100 group-focus-within:pointer-events-auto group-focus-within:opacity-100">
        <div>{lockedReason ?? hint}</div>
        {locked && onCta && ctaLabel && (
          <button
            type="button"
            onClick={onCta}
            className="mt-2 rounded-full border border-[var(--accent-mid)] bg-[var(--accent-dim)] px-2.5 py-1 text-[10px] font-mono tracking-[0.14em] text-[var(--accent)]"
          >
            {ctaLabel}
          </button>
        )}
      </div>
    </div>
  )
}

function InlineMenu({
  label,
  value,
  color,
  open,
  onToggle,
  children,
}: {
  label: string
  value: string
  color: string
  open: boolean
  onToggle: () => void
  children: React.ReactNode
}) {
  return (
    <div className="relative inline-flex flex-col items-end gap-2">
      <button
        type="button"
        onClick={onToggle}
        className="inline-flex items-center gap-2 rounded-full border px-2.5 py-1.5 text-[12px] font-mono shadow-[0_10px_24px_rgba(0,0,0,0.12)] transition-all duration-150 hover:-translate-y-0.5"
        style={{ borderColor: `${color}44`, background: `linear-gradient(180deg, ${color}18, ${color}10)`, color }}
      >
        <span className="tracking-[0.14em]">{value}</span>
        <span className="text-[10px] opacity-70">{open ? '▲' : '▼'}</span>
      </button>
      {open && (
        <div className="absolute right-0 top-full z-20 mt-1 min-w-44 rounded-2xl border border-white/10 bg-[#0c1118]/98 p-2 shadow-[0_20px_40px_rgba(0,0,0,0.35)] backdrop-blur-sm">
          <div className="px-2 pb-2 text-[10px] font-mono tracking-[0.18em] text-[var(--text-dim)]">{label}</div>
          <div className="space-y-1">{children}</div>
        </div>
      )}
    </div>
  )
}

// ── Online time ticker ────────────────────────────────────────────────────────

function OnlineTimer({ joinedAtMs }: { joinedAtMs: number | null }) {
  const [display, setDisplay] = useState(joinedAtMs ? formatOnlineTime(joinedAtMs) : '—')
  useEffect(() => {
    if (!joinedAtMs) { setDisplay('—'); return }
    setDisplay(formatOnlineTime(joinedAtMs))
    const t = setInterval(() => setDisplay(formatOnlineTime(joinedAtMs)), 1000)
    return () => clearInterval(t)
  }, [joinedAtMs])
  return <>{display}</>
}

// ── Player detail panel ───────────────────────────────────────────────────────

function PlayerPanel({
  player,
  joinedAtMs,
  onClose,
  collapseAllActive,
  minecraftVersion,
}: {
  player: string
  joinedAtMs: number | null
  onClose: () => void
  collapseAllActive: boolean
  minecraftVersion?: string | null
}) {
  type FeatureFlags = Record<FeatureKey, boolean>
  const [stats, setStats]         = useState<PlayerStats | null>(null)
  const [effects, setEffects]     = useState<string[]>([])
  const [inventory, setInventory] = useState<InvItem[]>([])
  const [statsLoading, setStatsLoading] = useState(true)
  const [invLoading, setInvLoading]     = useState(true)
  const [statsError, setStatsError]     = useState<string | null>(null)
  const [deletingSlot, setDeletingSlot] = useState<number | null>(null)
  const [inventoryActionBusy, setInventoryActionBusy] = useState<string | null>(null)
  const [deleteError, setDeleteError]   = useState<string | null>(null)
  const [refreshing, setRefreshing]     = useState(false)
  const [invOpen, setInvOpen]           = useState(true)
  const [selectedSlot, setSelectedSlot] = useState<InvItem | null>(null)
  const [confirmModal, setConfirmModal] = useState<Omit<ConfirmModalProps, 'onCancel'> | null>(null)
  const [sectionsOpen, setSectionsOpen] = useState({
    session: true,
    vitals: false,
    effects: false,
    location: false,
  })
  const [features, setFeatures]         = useState<FeatureFlags | null>(null)
  const [featuresLoaded, setFeaturesLoaded] = useState(false)
  const { toasts, addToast } = useToast()
  const [boosters, setBoosters] = useState<PlayerXpBooster[]>([])
  const [controlBusy, setControlBusy] = useState<string | null>(null)
  const [selectedHungerProfile, setSelectedHungerProfile] = useState<(typeof HUNGER_OPTIONS)[number]['id']>('full')
  const [teleportXDraft, setTeleportXDraft] = useState('0')
  const [teleportYDraft, setTeleportYDraft] = useState('0')
  const [teleportZDraft, setTeleportZDraft] = useState('0')
  const [worldDirectory, setWorldDirectory] = useState<WorldDirectoryData | null>(null)
  const [openQuickMenu, setOpenQuickMenu] = useState<'gamemode' | 'dimension' | null>(null)
  const [showMoreActions, setShowMoreActions] = useState(false)

  const canSession = features ? features.enable_player_session : true
  const canVitals = features ? features.enable_player_vitals : true
  const canLocation = features ? features.enable_player_location : true
  const canEffects = features ? features.enable_player_effects : true
  const canInventory = features ? features.enable_inventory : true
  const canPlayerCommands = features ? features.enable_player_commands : true
  const canControlDeck = canPlayerCommands || canVitals || canLocation || canEffects
  const openIntegrations = useCallback(() => {
    window.location.assign('/minecraft?tab=settings')
  }, [])
  const healthLockedReason = 'Exact health control needs a supported player-control integration.'
  const hungerLockedReason = 'Exact hunger control is unavailable on vanilla. Install the supported integration to unlock it.'
  const restoreLockedReason = 'This recovery action depends on a supported player-control integration.'
  const extinguishLockedReason = 'This action is locked until a supported player-control integration is installed.'
  const inventoryUnavailableReason = 'This inventory utility is temporarily unavailable while command compatibility is being validated.'

  const loadFeatures = useCallback(async () => {
    try {
      const r = await fetch('/api/account/preferences')
      const d = await r.json()
      if (d.ok && d.features) setFeatures(d.features as FeatureFlags)
    } catch {
      setFeatures(null)
    } finally {
      setFeaturesLoaded(true)
    }
  }, [])

  const refreshBoosters = useCallback(async () => {
    if (!canVitals) {
      setBoosters([])
      return
    }

    try {
      const response = await fetch(`/api/minecraft/player-control?player=${encodeURIComponent(player)}`)
      const payload = await response.json()
      if (payload.ok) {
        setBoosters(payload.boosters ?? [])
      }
    } catch {
      setBoosters([])
    }
  }, [canVitals, player])

  const refreshWorldDirectory = useCallback(async () => {
    if (!canLocation) {
      setWorldDirectory(null)
      return
    }

    try {
      const response = await fetch('/api/minecraft/worlds', { cache: 'no-store' })
      const payload = await response.json()
      if (payload.ok) {
        setWorldDirectory(payload)
      } else {
        setWorldDirectory(null)
      }
    } catch {
      setWorldDirectory(null)
    }
  }, [canLocation])

  useEffect(() => {
    loadFeatures()
    const onFeatures = () => { void loadFeatures() }
    window.addEventListener('mcraftr:features-updated', onFeatures)
    return () => window.removeEventListener('mcraftr:features-updated', onFeatures)
  }, [loadFeatures])

  const refresh = useCallback(() => {
    setStats(null); setEffects([]); setInventory([])
    setStatsLoading(true); setInvLoading(true); setStatsError(null)
    setRefreshing(true)
    void refreshBoosters()
    void refreshWorldDirectory()

    const needsStats = canSession || canVitals || canLocation
    const needsEffects = canEffects

    const statsReq = needsStats
      ? fetch(`/api/minecraft/player?player=${encodeURIComponent(player)}`).then(r => r.json())
      : Promise.resolve({ ok: true })
    const effectsReq = needsEffects
      ? fetch(`/api/minecraft/effects?player=${encodeURIComponent(player)}`).then(r => r.json())
      : Promise.resolve({ ok: true, active: [] as string[] })

    Promise.all([statsReq, effectsReq]).then(([statsData, effectsData]) => {
      if (needsStats) {
        if (statsData.ok) setStats(statsData)
        else setStatsError(statsData.error ?? 'Failed to load player data')
      }
      if (needsEffects && effectsData.ok) setEffects(effectsData.active ?? [])
    }).catch(() => setStatsError('Could not reach server'))
      .finally(() => { setStatsLoading(false); setRefreshing(false) })

    if (!canInventory) {
      setInventory([])
      setInvLoading(false)
      return
    }

    fetch(`/api/minecraft/inventory?player=${encodeURIComponent(player)}`)
      .then(r => r.json())
      .then(d => { if (d.ok) setInventory(d.items ?? []) })
      .catch(() => {})
      .finally(() => setInvLoading(false))
  }, [player, canInventory, canEffects, canLocation, canSession, canVitals, refreshBoosters, refreshWorldDirectory])

  const refreshInventory = useCallback(async () => {
    const response = await fetch(`/api/minecraft/inventory?player=${encodeURIComponent(player)}`)
    const payload = await response.json()
    if (payload.ok) setInventory(payload.items ?? [])
  }, [player])

  useEffect(() => {
    if (!featuresLoaded) return
    refresh()
  }, [refresh, featuresLoaded])

  useEffect(() => {
    setSectionsOpen({
      session: !collapseAllActive,
      vitals: !collapseAllActive,
      effects: !collapseAllActive,
      location: !collapseAllActive,
    })
    setInvOpen(!collapseAllActive)
  }, [collapseAllActive])

  useEffect(() => {
    if (!selectedSlot) return
    const refreshedSelection = inventory.find(item => item.slot === selectedSlot.slot)
    if (!refreshedSelection) {
      setSelectedSlot(null)
      return
    }
    if (
      refreshedSelection.id !== selectedSlot.id ||
      refreshedSelection.count !== selectedSlot.count ||
      refreshedSelection.enchants !== selectedSlot.enchants ||
      refreshedSelection.label !== selectedSlot.label
    ) {
      setSelectedSlot(refreshedSelection)
    }
  }, [inventory, selectedSlot])

  useEffect(() => {
    if (!stats) return
    if (stats.pos) {
      setTeleportXDraft(String(Math.round(stats.pos.x * 100) / 100))
      setTeleportYDraft(String(Math.round(stats.pos.y * 100) / 100))
      setTeleportZDraft(String(Math.round(stats.pos.z * 100) / 100))
    }

    if (stats.food !== null) {
      const nextProfile = stats.food >= 18 ? 'full' : stats.food >= 12 ? 'trail' : stats.food >= 6 ? 'low' : 'starve'
      setSelectedHungerProfile(nextProfile)
    }
  }, [stats])

  const resolvedWorldSpawn = useMemo(() => {
    if (!worldDirectory?.ok || worldDirectory.worlds.length === 0) return null
    const dimensionEnvironment = stats?.dimension === 'Nether'
      ? 'NETHER'
      : stats?.dimension === 'The End'
        ? 'THE_END'
        : stats?.dimension === 'Overworld'
          ? 'NORMAL'
          : null

    const directMatch = dimensionEnvironment
      ? worldDirectory.worlds.find(world => world.environment === dimensionEnvironment && world.spawn)
      : null
    if (directMatch?.spawn) return directMatch.spawn

    const defaultWorldMatch = worldDirectory.defaultWorld
      ? worldDirectory.worlds.find(world => world.name === worldDirectory.defaultWorld && world.spawn)
      : null
    return defaultWorldMatch?.spawn ?? worldDirectory.worlds.find(world => world.spawn)?.spawn ?? null
  }, [stats?.dimension, worldDirectory])

  const deleteItem = async (item: InvItem) => {
    setDeletingSlot(item.slot)
    try {
      const r = await fetch('/api/minecraft/inventory', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ player, item: item.id, count: item.count, slot: item.slot }),
      })
      const d = await r.json()
      if (d.ok) {
        await refreshInventory()
      } else {
        setDeleteError(d.error || 'Failed to clear item')
        setTimeout(() => setDeleteError(null), 4000)
      }
    } catch (e) {
      setDeleteError(e instanceof Error ? e.message : 'Failed to clear item')
      setTimeout(() => setDeleteError(null), 4000)
    } finally { setDeletingSlot(null) }
  }

  const moveItem = async (fromSlot: number, toSlot: number) => {
    setSelectedSlot(null)
    try {
      const r = await fetch('/api/minecraft/inventory', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ player, fromSlot, toSlot }),
      })
      const d = await r.json()
      if (d.ok) {
        await refreshInventory()
      } else {
        setDeleteError(d.error || 'Failed to move item')
        setTimeout(() => setDeleteError(null), 4000)
      }
    } catch {
      setDeleteError('Failed to move item')
      setTimeout(() => setDeleteError(null), 4000)
    }
  }

  const adjustSelectedItem = async (mode: 'increment' | 'fill' | 'duplicate', amount = 1) => {
    if (!selectedSlot) return
    setInventoryActionBusy(mode)
    try {
      const response = await fetch('/api/minecraft/inventory', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ player, slot: selectedSlot.slot, mode, amount }),
      })
      const payload = await response.json()
      if (payload.ok) {
        await refreshInventory()
      } else {
        setDeleteError(payload.error || 'Failed to update item stack')
        setTimeout(() => setDeleteError(null), 4000)
      }
    } catch (error) {
      setDeleteError(error instanceof Error ? error.message : 'Failed to update item stack')
      setTimeout(() => setDeleteError(null), 4000)
    } finally {
      setInventoryActionBusy(null)
    }
  }

  // Slot click handler — click selects/deselects; clicking an empty slot moves there.
  const handleSlotClick = (clickedItem: InvItem | undefined, clickedSlotIndex: number | undefined, currentSelected: InvItem | null) => {
    if (clickedSlotIndex === undefined) return
    if (currentSelected) {
      if (clickedItem && clickedItem.slot === currentSelected.slot) {
        setSelectedSlot(null)
      } else if (clickedItem && clickedItem.id === currentSelected.id) {
        moveItem(currentSelected.slot, clickedSlotIndex)
      } else if (!clickedItem) {
        moveItem(currentSelected.slot, clickedSlotIndex)
      } else if (clickedItem) {
        // Switch selected source item
        setSelectedSlot(clickedItem)
      }
    } else if (clickedItem) {
      setSelectedSlot(clickedItem)
    }
  }

  const handleSlotHoldToMove = (targetSlot: number | undefined, currentSelected: InvItem | null) => {
    if (!currentSelected || targetSlot === undefined) return
    moveItem(currentSelected.slot, targetSlot)
  }

  const runPlayerControl = useCallback(async (action: string, payload: Record<string, unknown>) => {
    setControlBusy(action)
    setOpenQuickMenu(null)
    try {
      const response = await fetch('/api/minecraft/player-control', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, player, ...payload }),
      })
      const body = await response.json()
      if (!body.ok) {
        addToast('error', body.error || 'Action failed')
        return false
      }
      addToast('ok', body.message || 'Updated player state')
      refresh()
      return true
    } catch (error) {
      addToast('error', error instanceof Error ? error.message : 'Network error')
      return false
    } finally {
      setControlBusy(null)
    }
  }, [addToast, player, refresh])

  const seedTeleportDraftsFromCurrent = useCallback(() => {
    if (!stats?.pos) {
      addToast('error', 'Current position is unavailable')
      return
    }
    setTeleportXDraft(String(Math.round(stats.pos.x * 100) / 100))
    setTeleportYDraft(String(Math.round(stats.pos.y * 100) / 100))
    setTeleportZDraft(String(Math.round(stats.pos.z * 100) / 100))
    addToast('ok', 'Loaded current coordinates into the composer')
  }, [addToast, stats?.pos])

  const applyCoordinateTeleport = useCallback(() => {
    const x = Number(teleportXDraft)
    const y = Number(teleportYDraft)
    const z = Number(teleportZDraft)
    if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) {
      addToast('error', 'Use valid X, Y, and Z coordinates')
      return
    }
    void runPlayerControl('teleport_to_coords', { x, y, z })
  }, [addToast, runPlayerControl, teleportXDraft, teleportYDraft, teleportZDraft])

  const confirmInventoryUtility = useCallback((action: (typeof INVENTORY_UTILITY_ACTIONS)[number]) => {
    setConfirmModal({
      title: `${action.label}?`,
      body: `${action.detail} This only affects ${player}.`,
      confirmLabel: action.label,
      destructive: true,
      onConfirm: () => {
        setConfirmModal(null)
        void runPlayerControl(action.id, {})
      },
    })
  }, [player, runPlayerControl])

  const { hotbar, main, armor, offhand } = buildInventoryLayout(inventory)
  const inventoryItemLookup = useMemo(() => buildInventoryItemLookup(minecraftVersion), [minecraftVersion])
  const selectedInventoryItemMeta = selectedSlot ? inventoryItemLookup.get(selectedSlot.id) ?? null : null

  const uuid = stats?.uuid ?? null
  // Bedrock players (Geyser) have offline UUIDs that don't resolve on Craftatar.
  // Detect them by the leading dot on the player name and fall back to the Steve UUID.
  const STEVE_UUID = '8667ba71-b85a-4004-af54-457a9734eed7'
  const isBedrock = player.startsWith('.')
  const avatarUuid = isBedrock ? STEVE_UUID : uuid
  // Craftatar avatar URL — requires CSP img-src to allow https://craftatar.com
  const avatarUrl = avatarUuid ? `https://craftatar.com/avatars/${avatarUuid}?size=32&overlay` : null

  return (
    <div className="glass-card overflow-hidden" style={{ borderColor: 'var(--accent-mid)' }}>
      {/* Header */}
      <div
        className="flex items-center justify-between px-5 py-3 border-b border-[var(--border)]"
        style={{ background: 'var(--accent-dim)' }}
      >
        <div className="flex items-center gap-3">
          {/* Player head avatar */}
          {avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={avatarUrl}
              alt={player}
              width={32}
              height={32}
              className="rounded shrink-0 pixelated"
              style={{ imageRendering: 'pixelated' }}
              onError={e => { (e.target as HTMLImageElement).style.display = 'none' }}
            />
          ) : (
            <div className="w-8 h-8 rounded bg-[var(--panel)] border border-[var(--border)] shrink-0" />
          )}
          <div>
            <div className="font-mono text-[15px] tracking-widest text-[var(--accent)]">
              {player}
            </div>
            {uuid && (
              <div className="text-[13px] font-mono text-[var(--text-dim)] mt-0.5 leading-none">
                {uuid}
              </div>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={refresh}
            disabled={statsLoading || refreshing}
            className="text-[13px] font-mono text-[var(--text-dim)] hover:text-[var(--text)] border border-[var(--border)] px-2 py-0.5 rounded transition-colors disabled:opacity-40"
          >
            {refreshing ? '…' : 'Refresh'}
          </button>
          <button
            onClick={onClose}
            className="text-[13px] font-mono text-[var(--text-dim)] hover:text-[var(--text)] border border-[var(--border)] px-2 py-0.5 rounded transition-colors"
          >
            x close
          </button>
        </div>
      </div>

      <div className="p-5 space-y-5">
        {statsLoading ? (
          <div className="text-[13px] font-mono text-[var(--text-dim)] animate-pulse py-6 text-center">
            Loading player data…
          </div>
        ) : statsError ? (
          <div className="text-[13px] font-mono text-red-400 py-6 text-center">{statsError}</div>
        ) : (
          <>
            {/* SESSION */}
            {canSession && (
            <div className="space-y-1.5">
              <button onClick={() => setSectionsOpen(s => ({ ...s, session: !s.session }))} className="w-full text-left flex items-center gap-2">
                <SectionTitle>SESSION</SectionTitle>
                <span className="text-[13px] font-mono text-[var(--text-dim)] opacity-60">{sectionsOpen.session ? '▲' : '▼'}</span>
              </button>
              {sectionsOpen.session && (
              <div className="bg-[var(--panel)] rounded-lg border border-[var(--border)] px-3 divide-y divide-[var(--border)]">
                <Row label="ONLINE FOR">
                  <OnlineTimer joinedAtMs={joinedAtMs} />
                </Row>
                <Row label="PING">
                  {stats?.ping != null
                    ? <span style={{ color: pingColor(stats.ping) }}>{stats.ping} ms</span>
                    : <span className="text-[var(--text-dim)]">—</span>
                  }
                </Row>
                <Row label="DIMENSION">
                  {stats?.dimension ? (
                    canPlayerCommands ? (
                      <InlineMenu
                        label="DIMENSION"
                        value={stats.dimension}
                        color={DIMENSION_COLORS[stats.dimension] ?? 'var(--accent)'}
                        open={openQuickMenu === 'dimension'}
                        onToggle={() => setOpenQuickMenu(current => current === 'dimension' ? null : 'dimension')}
                      >
                        {DIMENSION_OPTIONS.map(dimension => (
                          <button
                            key={dimension}
                            type="button"
                            onClick={() => void runPlayerControl('set_dimension', { dimension, pos: stats?.pos })}
                            disabled={controlBusy !== null || !stats?.pos}
                            className="flex w-full items-center justify-between rounded-xl px-2 py-2 text-left text-[11px] font-mono text-[var(--text)] transition-colors hover:bg-white/5 disabled:opacity-40"
                          >
                            <span>{dimension}</span>
                            {stats.dimension === dimension && <span style={{ color: DIMENSION_COLORS[dimension] ?? 'var(--accent)' }}>✓</span>}
                          </button>
                        ))}
                      </InlineMenu>
                    ) : <Badge color={DIMENSION_COLORS[stats.dimension] ?? 'var(--accent)'}>{stats.dimension}</Badge>
                  ) : <span className="text-[var(--text-dim)]">—</span>}
                </Row>
                <Row label="GAMEMODE">
                  {stats?.gamemode ? (
                    canPlayerCommands ? (
                      <InlineMenu
                        label="GAMEMODE"
                        value={stats.gamemode.toUpperCase()}
                        color={GAMEMODE_COLORS[stats.gamemode] ?? 'var(--accent)'}
                        open={openQuickMenu === 'gamemode'}
                        onToggle={() => setOpenQuickMenu(current => current === 'gamemode' ? null : 'gamemode')}
                      >
                        {GAMEMODE_OPTIONS.map(mode => (
                          <button
                            key={mode}
                            type="button"
                            onClick={() => void runPlayerControl('set_gamemode', { gamemode: mode })}
                            disabled={controlBusy !== null}
                            className="flex w-full items-center justify-between rounded-xl px-2 py-2 text-left text-[11px] font-mono text-[var(--text)] transition-colors hover:bg-white/5 disabled:opacity-40"
                          >
                            <span>{mode.toUpperCase()}</span>
                            {stats.gamemode === mode && <span style={{ color: GAMEMODE_COLORS[mode] ?? 'var(--accent)' }}>✓</span>}
                          </button>
                        ))}
                      </InlineMenu>
                    ) : <Badge color={GAMEMODE_COLORS[stats.gamemode] ?? 'var(--accent)'}>{stats.gamemode.toUpperCase()}</Badge>
                  ) : <span className="text-[var(--text-dim)]">—</span>}
                </Row>
              </div>
              )}
            </div>
            )}

            {/* VITALS */}
            {canVitals && (
            <div className="space-y-1.5">
              <button onClick={() => setSectionsOpen(s => ({ ...s, vitals: !s.vitals }))} className="w-full text-left flex items-center gap-2">
                <SectionTitle>VITALS</SectionTitle>
                <span className="text-[13px] font-mono text-[var(--text-dim)] opacity-60">{sectionsOpen.vitals ? '▲' : '▼'}</span>
              </button>
              {sectionsOpen.vitals && (
              <div className="bg-[var(--panel)] rounded-lg border border-[var(--border)] px-3 divide-y divide-[var(--border)]">
                <Row label="HEALTH"><HeartBar value={stats?.health ?? null} /></Row>
                <Row label="HUNGER"><HungerBar value={stats?.food ?? null} /></Row>
                <Row label="EXPERIENCE"><XpRow level={stats?.xpLevel ?? null} progress={stats?.xpP ?? null} /></Row>
              </div>
              )}
            </div>
            )}

            {canControlDeck && (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <SectionTitle>QUICK EDIT</SectionTitle>
                  <span className="rounded-full border border-[var(--accent-mid)] bg-[var(--accent-dim)] px-2 py-0.5 text-[10px] font-mono tracking-[0.2em] text-[var(--accent)]">
                    CLICK TO APPLY
                  </span>
                </div>

                <div className="grid gap-3 xl:grid-cols-2">
                  {canVitals && (
                    <div className="rounded-[26px] border border-[var(--border)] bg-[linear-gradient(180deg,rgba(255,255,255,0.05),rgba(255,255,255,0.015))] p-4 shadow-[0_22px_38px_rgba(0,0,0,0.14)] space-y-4">
                      <div>
                        <div className="text-[10px] font-mono tracking-[0.24em] text-[var(--text-dim)]">HEALTH</div>
                        <div className="mt-2 flex flex-wrap gap-2">
                          <ActionChip icon="++" label="Full" hint="Set health to full hearts instantly." onClick={() => void runPlayerControl('set_health', { health: 20 })} tone="#4ade80" />
                          <ActionChip icon="+-" label="Half" hint="Set health to a mid-fight 10.0/20 state." onClick={() => void runPlayerControl('set_health', { health: 10 })} tone="#fb7185" />
                          <ActionChip icon="!!" label="Critical" hint="Drop health to a dangerous 4.0/20 state." onClick={() => void runPlayerControl('set_health', { health: 4 })} tone="#f97316" />
                          <ActionChip icon="OK" label="Restore" hint="Heal, feed, and stabilize the player immediately." onClick={() => void runPlayerControl('restore_vitals', {})} tone="#38bdf8" />
                        </div>
                      </div>

                      <div>
                        <div className="text-[10px] font-mono tracking-[0.24em] text-[var(--text-dim)]">HUNGER</div>
                        <div className="mt-2 flex flex-wrap gap-2">
                          {HUNGER_OPTIONS.map(option => (
                            <ActionChip
                              key={option.id}
                              icon={option.id === 'full' ? '[]' : option.id === 'trail' ? '/=' : option.id === 'low' ? '/-' : '!!'}
                              label={option.label}
                              hint={option.note}
                              onClick={() => {
                                setSelectedHungerProfile(option.id)
                                void runPlayerControl('set_hunger_profile', { profile: option.id })
                              }}
                              tone="#f59e0b"
                              active={selectedHungerProfile === option.id}
                            />
                          ))}
                        </div>
                      </div>

                      <div>
                        <div className="text-[10px] font-mono tracking-[0.24em] text-[var(--text-dim)]">EXPERIENCE</div>
                        <div className="mt-2 flex flex-wrap gap-2">
                          {XP_BOOST_ACTIONS.map(boost => (
                            <ActionChip
                              key={boost.id}
                              icon={boost.mode === 'levels' ? 'Lv' : 'XP'}
                              label={boost.label}
                              hint={`Instantly boost ${player} by ${boost.amount} ${boost.mode}.`}
                              onClick={() => void runPlayerControl('boost_xp', { mode: boost.mode, amount: boost.amount })}
                              tone={boost.tone}
                            />
                          ))}
                        </div>
                        <div className="mt-3 flex flex-wrap gap-2">
                          {XP_BOOSTER_PRESETS.map(preset => (
                            <ActionChip
                              key={preset.id}
                              icon="++"
                              label={preset.label}
                              hint={preset.copy}
                              onClick={() => void runPlayerControl('start_xp_booster', { tier: preset.id })}
                              tone={preset.tone}
                            />
                          ))}
                        </div>
                        <div className="mt-3 flex flex-wrap gap-2">
                          {boosters.length === 0 ? (
                            <span className="text-[11px] font-mono text-[var(--text-dim)]">No timed boosters active.</span>
                          ) : boosters.map(booster => (
                            <button
                              key={booster.id}
                              type="button"
                              onClick={() => void runPlayerControl('cancel_xp_booster', { boosterId: booster.id })}
                              disabled={controlBusy !== null}
                              className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-[10px] font-mono text-[var(--text)] transition-all hover:border-[#f87171] hover:text-[#fca5a5] disabled:opacity-40"
                            >
                              <span>++</span>
                              <span>{booster.label}</span>
                              <span className="text-[var(--text-dim)]">{formatRemainingTime(booster.endsAt)}</span>
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

                  {(canLocation || canEffects || canInventory) && (
                    <div className="rounded-[26px] border border-[var(--border)] bg-[linear-gradient(180deg,rgba(255,255,255,0.05),rgba(255,255,255,0.015))] p-4 shadow-[0_22px_38px_rgba(0,0,0,0.14)] space-y-4">
                      {canLocation && (
                        <div>
                          <div className="text-[10px] font-mono tracking-[0.24em] text-[var(--text-dim)]">LOCATION ACTIONS</div>
                          <div className="mt-2 flex flex-wrap gap-2">
                            <ActionChip icon="W" label="World Spawn" hint="Return the player to the current world's spawn." onClick={() => void runPlayerControl('teleport_to_world_spawn', { spawn: resolvedWorldSpawn })} tone="#38bdf8" disabled={!resolvedWorldSpawn} />
                            <ActionChip icon="B" label="Bed / Anchor" hint="Return the player to their saved respawn point." onClick={() => void runPlayerControl('teleport_to_spawn', { spawn: stats?.spawnPos })} tone="#f59e0b" disabled={!stats?.spawnPos} />
                            <ActionChip icon="S" label="Set Spawn" hint="Make the current player position their new spawnpoint." onClick={() => void runPlayerControl('set_spawn_to_current', { pos: stats?.pos })} tone="#4ade80" disabled={!stats?.pos} />
                          </div>
                        </div>
                      )}

                      {canEffects && (
                        <div>
                          <div className="text-[10px] font-mono tracking-[0.24em] text-[var(--text-dim)]">EFFECTS</div>
                          <div className="mt-2 flex flex-wrap gap-2">
                            {EFFECT_LOADOUTS.map(loadout => (
                              <ActionChip key={loadout.id} icon={loadout.id === 'clear' ? 'X' : 'FX'} label={loadout.label} hint={loadout.note} onClick={() => void runPlayerControl(loadout.id === 'clear' ? 'clear_effects' : 'apply_effect_loadout', loadout.id === 'clear' ? {} : { loadout: loadout.id })} tone={loadout.tone} />
                            ))}
                          </div>
                        </div>
                      )}

                      <div>
                        <button
                          type="button"
                          onClick={() => setShowMoreActions(open => !open)}
                          className="inline-flex items-center gap-2 rounded-full border border-[var(--border)] px-3 py-1.5 text-[11px] font-mono text-[var(--text-dim)] transition-colors hover:border-[var(--accent-mid)] hover:text-[var(--text)]"
                        >
                          <span>{showMoreActions ? '▲' : '▼'}</span>
                          <span>More Actions</span>
                        </button>

                        {showMoreActions && (
                          <div className="mt-3 space-y-3 rounded-2xl border border-[var(--border)] bg-black/10 p-3">
                            {canLocation && (
                              <>
                                <div className="grid gap-2 sm:grid-cols-3">
                                  <input type="number" value={teleportXDraft} onChange={event => setTeleportXDraft(event.target.value)} placeholder="X" className="rounded-xl border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-[12px] font-mono text-[var(--text)]" />
                                  <input type="number" value={teleportYDraft} onChange={event => setTeleportYDraft(event.target.value)} placeholder="Y" className="rounded-xl border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-[12px] font-mono text-[var(--text)]" />
                                  <input type="number" value={teleportZDraft} onChange={event => setTeleportZDraft(event.target.value)} placeholder="Z" className="rounded-xl border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-[12px] font-mono text-[var(--text)]" />
                                </div>
                                <div className="flex flex-wrap gap-2">
                                  <ActionChip icon="@" label="Use Current" hint="Seed the coordinate editor with the player's live position." onClick={seedTeleportDraftsFromCurrent} disabled={!stats?.pos} tone="#94a3b8" />
                                  <ActionChip icon="TP" label="Teleport" hint="Move the player to the typed coordinates." onClick={applyCoordinateTeleport} tone="#38bdf8" />
                                </div>
                                <div className="space-y-2 pt-1">
                                  {AXIS_NUDGE_ROWS.map(row => (
                                    <div key={row.axis} className="grid gap-2 sm:grid-cols-[80px,1fr] sm:items-center">
                                      <div className="text-[11px] font-mono text-[var(--text-dim)]">{row.label}</div>
                                      <div className="flex flex-wrap gap-2">
                                        {row.actions.map(action => (
                                          <ActionChip key={`${row.axis}-${action.label}`} icon={row.axis.toUpperCase()} label={action.label} hint={`Move ${action.label} on ${row.axis.toUpperCase()}.`} onClick={() => void runPlayerControl('nudge_axis', { pos: stats?.pos, axis: row.axis, delta: action.delta })} disabled={!stats?.pos} tone={row.tone} />
                                        ))}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </>
                            )}

                            {canInventory && (
                              <div className="flex flex-wrap gap-2 pt-1">
                                {INVENTORY_UTILITY_ACTIONS.map(action => (
                                  <ActionChip key={action.id} icon="!!" label={action.label} hint={action.detail} onClick={() => confirmInventoryUtility(action)} tone={action.tone} />
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ACTIVE EFFECTS — only shown if any */}
            {canEffects && effects.length > 0 && (
              <div className="space-y-1.5">
                <button onClick={() => setSectionsOpen(s => ({ ...s, effects: !s.effects }))} className="w-full text-left flex items-center gap-2">
                  <SectionTitle>ACTIVE EFFECTS</SectionTitle>
                  <span className="text-[13px] font-mono text-[var(--text-dim)] opacity-60">{sectionsOpen.effects ? '▲' : '▼'}</span>
                </button>
                {sectionsOpen.effects && (
                  <div className="flex flex-wrap gap-1.5">
                    {effects.map(e => (
                      <Badge key={e} color="var(--accent)">{EFFECT_LABELS[e] ?? e}</Badge>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* LOCATION */}
            {canLocation && (
            <div className="space-y-1.5">
              <button onClick={() => setSectionsOpen(s => ({ ...s, location: !s.location }))} className="w-full text-left flex items-center gap-2">
                <SectionTitle>LOCATION</SectionTitle>
                <span className="text-[13px] font-mono text-[var(--text-dim)] opacity-60">{sectionsOpen.location ? '▲' : '▼'}</span>
              </button>
              {sectionsOpen.location && (
                <div className="space-y-2">
                  <CoordBlock label="CURRENT POSITION" pos={stats?.pos ?? null} />
                  {stats?.spawnPos && (
                    <CoordBlock label="BED / ANCHOR SPAWN" pos={stats.spawnPos} />
                  )}
                </div>
              )}
            </div>
            )}

            {!canSession && !canVitals && !canEffects && !canLocation && !canInventory && (
              <div className="text-[13px] font-mono text-[var(--text-dim)]">All player detail features are disabled for this account.</div>
            )}
          </>
        )}

        {/* INVENTORY — loads independently, collapsible */}
        {canInventory && (
        <div className="space-y-1.5">
          <button
            onClick={() => setInvOpen(o => !o)}
            className="flex items-center gap-2 w-full text-left group"
          >
            <SectionTitle>INVENTORY</SectionTitle>
            <span className="text-[13px] font-mono text-[var(--text-dim)] opacity-60 group-hover:opacity-70 transition-opacity ml-1">
              {invOpen ? '▲' : '▼'}
            </span>
            {!invLoading && inventory.length > 0 && (
              <span className="text-[13px] font-mono text-[var(--text-dim)] opacity-60 ml-auto">{inventory.length} items</span>
            )}
          </button>
          {invOpen && (invLoading ? (
            <div className="text-[13px] font-mono text-[var(--text-dim)] animate-pulse">Loading inventory…</div>
          ) : (
            <div className="space-y-3">
                {selectedSlot && (
                  <div className="space-y-2 rounded border border-[var(--accent-mid)] bg-[var(--accent-dim)] px-2 py-2 text-[11px] font-mono text-[var(--text-dim)]">
                    <div>
                      <span className="text-[var(--accent)]">{selectedSlot.label}</span> selected — click an empty slot or matching stack to move, or click the selected item to deselect
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => void adjustSelectedItem('increment', 1)}
                        disabled={inventoryActionBusy !== null}
                        className="rounded border border-[var(--border)] px-2 py-1 text-[11px] text-[var(--text)] disabled:opacity-40"
                      >
                        {inventoryActionBusy === 'increment' ? '…' : '+1'}
                      </button>
                      <button
                        type="button"
                        onClick={() => void adjustSelectedItem('increment', 8)}
                        disabled={inventoryActionBusy !== null}
                        className="rounded border border-[var(--border)] px-2 py-1 text-[11px] text-[var(--text)] disabled:opacity-40"
                      >
                        +8
                      </button>
                      <button
                        type="button"
                        onClick={() => void adjustSelectedItem('fill')}
                        disabled={inventoryActionBusy !== null}
                        className="rounded border border-[var(--border)] px-2 py-1 text-[11px] text-[var(--text)] disabled:opacity-40"
                      >
                        Fill Stack
                      </button>
                      <button
                        type="button"
                        onClick={() => void adjustSelectedItem('duplicate')}
                        disabled={inventoryActionBusy !== null}
                        className="rounded border border-[var(--border)] px-2 py-1 text-[11px] text-[var(--text)] disabled:opacity-40"
                      >
                        Duplicate Stack
                      </button>
                    </div>
                  </div>
                )}

                {selectedSlot && (
                  <div className="rounded-[24px] border border-[var(--accent-mid)] bg-[linear-gradient(180deg,rgba(82,190,255,0.14),rgba(8,11,16,0.94))] p-3 shadow-[0_18px_42px_rgba(0,0,0,0.28)] lg:max-w-[30rem]">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-[10px] font-mono tracking-[0.35em] text-[var(--accent)]">ITEM CARD</div>
                        <div className="mt-1 text-[16px] font-mono text-[var(--text)]">{selectedSlot.label}</div>
                      </div>
                      <span className="rounded-full border border-[var(--accent-mid)] bg-[var(--accent-dim)] px-2 py-1 text-[10px] font-mono tracking-widest text-[var(--accent)]">
                        {selectedInventoryItemMeta?.categoryLabel ?? 'Inventory'}
                      </span>
                    </div>

                    <div className="mt-3 rounded-[20px] border border-white/10 bg-black/15 p-2">
                      <CatalogArtwork
                        kind="item"
                        label={selectedSlot.label}
                        category={selectedInventoryItemMeta?.categoryLabel ?? 'Inventory'}
                        imageUrl={selectedInventoryItemMeta?.imageUrl}
                        art={selectedInventoryItemMeta?.art}
                        className="h-40 w-full rounded-[16px] border border-white/10 object-contain"
                      />
                      <div className="mt-3 grid gap-2 sm:grid-cols-2">
                        {[
                          ['Id', selectedSlot.id],
                          ['Slot', slotLabel(selectedSlot.slot)],
                          ['Count', String(selectedSlot.count)],
                          ['Per Stack', String(selectedInventoryItemMeta?.maxStack ?? 64)],
                        ].map(([label, value]) => (
                          <div key={label} className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2">
                            <div className="text-[9px] font-mono tracking-[0.28em] text-[var(--text-dim)]">{label}</div>
                            <div className="mt-1 break-all text-[12px] font-mono text-[var(--text)]">{value}</div>
                          </div>
                        ))}
                      </div>
                      {selectedSlot.enchants && (
                        <div className="mt-2 rounded-2xl border border-white/10 bg-white/5 px-3 py-2">
                          <div className="text-[9px] font-mono tracking-[0.28em] text-[var(--text-dim)]">Enchants</div>
                          <div className="mt-1 text-[12px] font-mono text-[var(--accent)]">{selectedSlot.enchants}</div>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {deleteError && (
                  <div className="text-[13px] font-mono text-red-400 px-2 py-1 rounded border border-red-900/50 bg-red-950/30">
                    ✗ {deleteError}
                  </div>
                )}
                <div>
                  <div className="text-[13px] font-mono text-[var(--text-dim)] mb-1.5 tracking-widest">HOTBAR</div>
                  <div className="flex flex-wrap gap-1">
                    {hotbar.map((item, i) => (
                      <InvSlot key={i} item={item} slotIndex={i}
                        selected={!!item && selectedSlot?.slot === item.slot}
                        moveTarget={!!selectedSlot && ((!item) || (item.id === selectedSlot.id && item.slot !== selectedSlot.slot))}
                        onMoveTargetHold={() => handleSlotHoldToMove(item?.slot ?? i, selectedSlot)}
                        onDelete={item ? (it) => setConfirmModal({ title: 'Clear item?', body: it.label, confirmLabel: 'Clear', destructive: true, onConfirm: () => { setConfirmModal(null); deleteItem(it) } }) : undefined}
                        onSlotClick={() => handleSlotClick(item, item?.slot ?? i, selectedSlot)}
                        deleting={item ? deletingSlot === item.slot : false}
                       />
                    ))}
                  </div>
                </div>
                <div>
                  <div className="text-[13px] font-mono text-[var(--text-dim)] mb-1.5 tracking-widest">ARMOR / OFFHAND</div>
                  <div className="flex gap-1 flex-wrap items-center">
                    {armor.map((item, i) => {
                      const armorSlots = [103, 102, 101, 100]
                      const s = armorSlots[i]
                      return (
                        <InvSlot key={i} item={item} slotIndex={s}
                          selected={!!item && selectedSlot?.slot === item.slot}
                          moveTarget={!!selectedSlot && ((!item) || (item.id === selectedSlot.id && item.slot !== selectedSlot.slot))}
                          onMoveTargetHold={() => handleSlotHoldToMove(item?.slot ?? s, selectedSlot)}
                          onDelete={item ? (it) => setConfirmModal({ title: 'Clear item?', body: it.label, confirmLabel: 'Clear', destructive: true, onConfirm: () => { setConfirmModal(null); deleteItem(it) } }) : undefined}
                          onSlotClick={() => handleSlotClick(item, item?.slot ?? s, selectedSlot)}
                          deleting={item ? deletingSlot === item.slot : false}
                        />
                      )
                    })}
                    <div className="w-px h-8 bg-[var(--border)] mx-1.5" />
                    <InvSlot item={offhand} slotIndex={150}
                      selected={!!offhand && selectedSlot?.slot === 150}
                      moveTarget={!!selectedSlot && ((!offhand) || (offhand.id === selectedSlot.id && offhand.slot !== selectedSlot.slot))}
                      onMoveTargetHold={() => handleSlotHoldToMove(offhand?.slot ?? 150, selectedSlot)}
                      onDelete={offhand ? (it) => setConfirmModal({ title: 'Clear item?', body: it.label, confirmLabel: 'Clear', destructive: true, onConfirm: () => { setConfirmModal(null); deleteItem(it) } }) : undefined}
                      onSlotClick={() => handleSlotClick(offhand, offhand?.slot ?? 150, selectedSlot)}
                      deleting={offhand ? deletingSlot === 150 : false}
                    />
                  </div>
                </div>
                <div>
                  <div className="text-[13px] font-mono text-[var(--text-dim)] mb-1.5 tracking-widest">MAIN</div>
                  <div className="grid gap-1" style={{ gridTemplateColumns: 'repeat(9, 2.5rem)' }}>
                    {main.map((item, i) => (
                      <InvSlot key={i} item={item} slotIndex={i + 9}
                        selected={!!item && selectedSlot?.slot === item.slot}
                        moveTarget={!!selectedSlot && ((!item) || (item.id === selectedSlot.id && item.slot !== selectedSlot.slot))}
                        onMoveTargetHold={() => handleSlotHoldToMove(item?.slot ?? (i + 9), selectedSlot)}
                        onDelete={item ? (it) => setConfirmModal({ title: 'Clear item?', body: it.label, confirmLabel: 'Clear', destructive: true, onConfirm: () => { setConfirmModal(null); deleteItem(it) } }) : undefined}
                        onSlotClick={() => handleSlotClick(item, item?.slot ?? (i + 9), selectedSlot)}
                        deleting={item ? deletingSlot === item.slot : false}
                      />
                    ))}
                  </div>
                </div>
                {inventory.length === 0 && (
                  <EmptyState 
                    icon={<EmptyInventoryIcon />} 
                    message="Pockets empty — nothing to see here"
                  />
                )}
            </div>
          ))}
        </div>
        )}
      </div>
      {confirmModal && (
        <ConfirmModal
          {...confirmModal}
          onCancel={() => { setConfirmModal(null); setSelectedSlot(null) }}
        />
      )}
      <Toasts toasts={toasts} />
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export default function PlayersSection({ onPlayersChange, minecraftVersion }: Props) {
  const [data, setData]               = useState<PlayerListData>({ count: 0, players: '' })
  const [loading, setLoading]         = useState(true)
  const [selectedPlayer, setSelected] = useState<string | null>(null)
  const [playerSearch, setPlayerSearch] = useState('')
  const [collapseAllActive, setCollapseAllActive] = useState(false)

  const fetchPlayers = useCallback(async () => {
    try {
      const r = await fetch('/api/players')
      const d = await r.json() as PlayerListData
      setData(d)
      const list = d.players ? d.players.split(',').map(p => p.trim()).filter(Boolean) : []
      onPlayersChange?.(list)
      setSelected(prev => prev && list.includes(prev) ? prev : null)
    } catch {
      setData(prev => ({ ...prev, error: 'Could not reach server' }))
      onPlayersChange?.([])
    } finally {
      setLoading(false)
    }
  }, [onPlayersChange])

  useEffect(() => {
    fetchPlayers()
    const t = setInterval(fetchPlayers, 10_000)
    return () => clearInterval(t)
  }, [fetchPlayers])

  const playerList = data.players
    ? data.players.split(',').map(p => p.trim()).filter(Boolean)
    : []
  const toggleCollapseAll = () => {
    const nextOpen = collapseAllActive
    setCollapsibleGroupState(PLAYERS_COLLAPSIBLE_GROUP, nextOpen)
    setCollapseAllActive(!collapseAllActive)
  }
  const collapseAllLabel = collapseAllActive ? 'Expand All' : 'Collapse All'

  return (
    <div className="space-y-4">
      <h2 className="font-mono text-base tracking-widest text-[var(--accent)]">PLAYERS</h2>

      <div className="flex justify-end">
        <button
          type="button"
          onClick={toggleCollapseAll}
          className="rounded-lg border border-[var(--border)] px-3 py-2 text-[12px] font-mono tracking-widest text-[var(--text-dim)] transition-colors hover:border-[var(--accent-mid)] hover:text-[var(--accent)]"
        >
          {collapseAllLabel}
        </button>
      </div>

      <CollapsibleCard title="ONLINE NOW" storageKey="players:online" groupKey={PLAYERS_COLLAPSIBLE_GROUP} bodyClassName="p-5">
        <div className="flex items-center justify-between mb-4">
          <button
            onClick={fetchPlayers}
            className="text-[13px] font-mono text-[var(--accent)] hover:opacity-70 border border-[var(--border)] px-2 py-1 rounded transition-opacity"
          >
            Refresh
          </button>
        </div>

        <div className="flex items-end gap-3 mb-4">
          <span className="text-5xl font-mono font-bold text-[var(--accent)] leading-none">
            {loading ? '—' : data.error ? '?' : data.count}
          </span>
          <span className="text-[var(--text-dim)] text-[15px] mb-1">
            {data.count === 1 ? 'player online' : 'players online'}
          </span>
        </div>

        {data.error ? (
          <div className="flex items-center gap-2 text-[13px] font-mono text-red-400">
            <span>!</span><span>{data.error}</span>
          </div>
        ) : playerList.length > 0 ? (
          <div className="space-y-3">
            {playerList.length > 5 && (
              <input
                type="text"
                placeholder="Filter players…"
                value={playerSearch}
                onChange={e => setPlayerSearch(e.target.value)}
                className="w-full px-3 py-2 rounded-lg font-mono text-[13px] bg-[var(--panel)] border border-[var(--border)] text-[var(--text)] placeholder:text-[var(--text-dim)] focus:outline-none focus:border-[var(--accent-mid)] transition-colors"
              />
            )}
          <div className="flex flex-wrap gap-2">
            {playerList.filter(p => p.toLowerCase().includes(playerSearch.toLowerCase())).map(p => {
              const selected  = selectedPlayer === p
              const joinedAt  = data.sessionStarts?.[p] ?? null
              return (
                <button
                  key={p}
                  onClick={() => setSelected(prev => prev === p ? null : p)}
                  className="tap-target flex items-center gap-1.5 px-3 py-2 rounded-lg border transition-all"
                  style={selected ? {
                    borderColor: 'var(--accent)',
                    background: 'var(--accent-dim)',
                    color: 'var(--accent)',
                  } : {
                    borderColor: 'var(--border)',
                    background: 'var(--panel)',
                    color: 'var(--text)',
                  }}
                >
                  <span className="relative flex w-2 h-2 shrink-0">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-30" style={{ background: 'var(--accent)' }} />
                    <span className="relative inline-flex rounded-full w-2 h-2" style={{ background: 'var(--accent)' }} />
                  </span>
                  <span className="text-[13px] font-mono">{p}</span>
                  {joinedAt && (
                    <span className="text-[13px] font-mono opacity-60 ml-0.5">
                      <OnlineTimer joinedAtMs={joinedAt} />
                    </span>
                  )}
                  <span className="text-[13px] font-mono ml-0.5 opacity-60">
                    {selected ? 'v' : '>'}
                  </span>
                </button>
              )
            })}
          </div>
          {playerSearch && playerList.filter(p => p.toLowerCase().includes(playerSearch.toLowerCase())).length === 0 && (
            <div className="text-[13px] font-mono text-[var(--text-dim)]">No players match &quot;{playerSearch}&quot;</div>
          )}
          </div>
        ) : (
          !loading && (
            <EmptyState 
              icon={<SkeletonIcon />} 
              message="The server is empty — not even a skeleton"
            />
          )
        )}
      </CollapsibleCard>

      {selectedPlayer && (
                <PlayerPanel
                  player={selectedPlayer}
                  joinedAtMs={data.sessionStarts?.[selectedPlayer] ?? null}
                  onClose={() => setSelected(null)}
                  collapseAllActive={collapseAllActive}
                  minecraftVersion={minecraftVersion}
                />
      )}

      {data.ts && !data.error && (
        <div className="text-[13px] font-mono text-[var(--text-dim)] opacity-60 text-right">
          Updated {new Date(data.ts).toLocaleTimeString()}
        </div>
      )}

      <div className="flex justify-end">
        <button
          type="button"
          onClick={toggleCollapseAll}
          className="rounded-lg border border-[var(--border)] px-3 py-2 text-[12px] font-mono tracking-widest text-[var(--text-dim)] transition-colors hover:border-[var(--accent-mid)] hover:text-[var(--accent)]"
        >
          {collapseAllLabel}
        </button>
      </div>
    </div>
  )
}
