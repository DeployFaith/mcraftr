'use client'
import { useState, useEffect, useCallback } from 'react'
import InvSlot, { slotLabel, buildInventoryLayout } from './InvSlot'
import type { InvItem } from '../../api/minecraft/inventory/route'
import ConfirmModal from './ConfirmModal'
import type { ConfirmModalProps } from './ConfirmModal'
import type { FeatureKey } from '@/lib/features'

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

type Props = {
  onPlayersChange?: (players: string[]) => void
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

// ── Utilities ─────────────────────────────────────────────────────────────────

function formatOnlineTime(joinedAtMs: number): string {
  const elapsed = Math.floor((Date.now() - joinedAtMs) / 1000)
  if (elapsed < 60)   return `${elapsed}s`
  if (elapsed < 3600) return `${Math.floor(elapsed / 60)}m ${elapsed % 60}s`
  const h = Math.floor(elapsed / 3600)
  const m = Math.floor((elapsed % 3600) / 60)
  return `${h}h ${m}m`
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
}: {
  player: string
  joinedAtMs: number | null
  onClose: () => void
}) {
  type FeatureFlags = Record<FeatureKey, boolean>
  const [stats, setStats]         = useState<PlayerStats | null>(null)
  const [effects, setEffects]     = useState<string[]>([])
  const [inventory, setInventory] = useState<InvItem[]>([])
  const [statsLoading, setStatsLoading] = useState(true)
  const [invLoading, setInvLoading]     = useState(true)
  const [statsError, setStatsError]     = useState<string | null>(null)
  const [deletingSlot, setDeletingSlot] = useState<number | null>(null)
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

  const canSession = features ? features.enable_player_session : true
  const canVitals = features ? features.enable_player_vitals : true
  const canLocation = features ? features.enable_player_location : true
  const canEffects = features ? features.enable_player_effects : true
  const canInventory = features ? features.enable_inventory : true

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
  }, [player, canInventory, canEffects, canLocation, canSession, canVitals])

  useEffect(() => {
    if (!featuresLoaded) return
    refresh()
  }, [refresh, featuresLoaded])

  const deleteItem = async (item: InvItem) => {
    setDeletingSlot(item.slot)
    try {
      const r = await fetch('/api/minecraft/inventory', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ player, item: item.id, count: item.count }),
      })
      const d = await r.json()
      if (d.ok) {
        setInventory(prev => prev.filter(i => i.slot !== item.slot))
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
        // Refresh inventory to reflect server state
        const ri = await fetch(`/api/minecraft/inventory?player=${encodeURIComponent(player)}`)
        const di = await ri.json()
        if (di.ok) setInventory(di.items ?? [])
      } else {
        setDeleteError(d.error || 'Failed to move item')
        setTimeout(() => setDeleteError(null), 4000)
      }
    } catch {
      setDeleteError('Failed to move item')
      setTimeout(() => setDeleteError(null), 4000)
    }
  }

  // Slot click handler — click to select, click another slot to move immediately (no modal)
  const handleSlotClick = (clickedItem: InvItem | undefined, clickedSlotIndex: number | undefined, currentSelected: InvItem | null) => {
    if (clickedSlotIndex === undefined) return
    if (currentSelected) {
      if (clickedItem && clickedItem.slot === currentSelected.slot) {
        // Same slot — deselect
        setSelectedSlot(null)
      } else {
        // Different slot (empty or filled) — move immediately
        moveItem(currentSelected.slot, clickedItem?.slot ?? clickedSlotIndex)
      }
    } else if (clickedItem) {
      setSelectedSlot(clickedItem)
    }
  }

  const { hotbar, main, armor, offhand } = buildInventoryLayout(inventory)

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
                  {stats?.dimension
                    ? <Badge color={DIMENSION_COLORS[stats.dimension] ?? 'var(--accent)'}>{stats.dimension}</Badge>
                    : <span className="text-[var(--text-dim)]">—</span>
                  }
                </Row>
                <Row label="GAMEMODE">
                  {stats?.gamemode
                    ? <Badge color={GAMEMODE_COLORS[stats.gamemode] ?? 'var(--accent)'}>{stats.gamemode.toUpperCase()}</Badge>
                    : <span className="text-[var(--text-dim)]">—</span>
                  }
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
                <div className="text-[11px] font-mono text-[var(--text-dim)] px-2 py-1 rounded border border-[var(--accent-mid)] bg-[var(--accent-dim)]">
                  <span className="text-[var(--accent)]">{selectedSlot.label}</span> selected — click an empty slot to move, or click it again to deselect
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
                      moveTarget={!!selectedSlot && !item}
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
                        moveTarget={!!selectedSlot && !item}
                        onDelete={item ? (it) => setConfirmModal({ title: 'Clear item?', body: it.label, confirmLabel: 'Clear', destructive: true, onConfirm: () => { setConfirmModal(null); deleteItem(it) } }) : undefined}
                        onSlotClick={() => handleSlotClick(item, item?.slot ?? s, selectedSlot)}
                        deleting={item ? deletingSlot === item.slot : false}
                      />
                    )
                  })}
                  <div className="w-px h-8 bg-[var(--border)] mx-1.5" />
                  <InvSlot item={offhand} slotIndex={150}
                    selected={!!offhand && selectedSlot?.slot === 150}
                    moveTarget={!!selectedSlot && !offhand}
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
                      moveTarget={!!selectedSlot && !item}
                      onDelete={item ? (it) => setConfirmModal({ title: 'Clear item?', body: it.label, confirmLabel: 'Clear', destructive: true, onConfirm: () => { setConfirmModal(null); deleteItem(it) } }) : undefined}
                      onSlotClick={() => handleSlotClick(item, item?.slot ?? (i + 9), selectedSlot)}
                      deleting={item ? deletingSlot === item.slot : false}
                    />
                  ))}
                </div>
              </div>
              {inventory.length === 0 && (
                <div className="text-[13px] font-mono text-[var(--text-dim)]">Pockets empty — nothing to see here</div>
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
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export default function PlayersSection({ onPlayersChange }: Props) {
  const [data, setData]               = useState<PlayerListData>({ count: 0, players: '' })
  const [loading, setLoading]         = useState(true)
  const [selectedPlayer, setSelected] = useState<string | null>(null)
  const [playerSearch, setPlayerSearch] = useState('')

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

  return (
    <div className="space-y-4">
      <h2 className="font-mono text-base tracking-widest text-[var(--accent)]">PLAYERS</h2>

      <div className="glass-card p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="text-[13px] font-mono tracking-widest text-[var(--text-dim)]">ONLINE NOW</div>
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
            <div className="text-[13px] font-mono text-[var(--text-dim)]">The server is empty — not even a skeleton</div>
          )
        )}
      </div>

      {selectedPlayer && (
        <PlayerPanel
          player={selectedPlayer}
          joinedAtMs={data.sessionStarts?.[selectedPlayer] ?? null}
          onClose={() => setSelected(null)}
        />
      )}

      {data.ts && !data.error && (
        <div className="text-[13px] font-mono text-[var(--text-dim)] opacity-60 text-right">
          Updated {new Date(data.ts).toLocaleTimeString()}
        </div>
      )}
    </div>
  )
}
