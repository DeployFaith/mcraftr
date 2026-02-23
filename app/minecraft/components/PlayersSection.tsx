'use client'
import { useState, useEffect, useCallback } from 'react'

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

type InvItem = {
  slot: number
  id: string
  label: string
  count: number
  enchants?: string
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

function slotLabel(slot: number): string {
  if (slot >= 0  && slot <= 8)  return `Hotbar ${slot + 1}`
  if (slot >= 9  && slot <= 35) return `Slot ${slot - 8}`
  if (slot === 100) return 'Boots'
  if (slot === 101) return 'Leggings'
  if (slot === 102) return 'Chestplate'
  if (slot === 103) return 'Helmet'
  if (slot === 150) return 'Offhand'
  return `Slot ${slot}`
}

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
      <span className="text-[9px] font-mono tracking-widest text-[var(--text-dim)] shrink-0 w-28">{label}</span>
      <span className="text-xs font-mono text-[var(--text)] text-right">{children}</span>
    </div>
  )
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-[9px] font-mono tracking-widest text-[var(--text-dim)] pt-1">{children}</div>
  )
}

function HeartBar({ value, max = 20 }: { value: number | null; max?: number }) {
  if (value === null) return <span className="text-[var(--text-dim)]">—</span>
  const filled = Math.round(value / 2)
  const total  = max / 2
  return (
    <div className="flex flex-wrap gap-0.5 items-center justify-end">
      {Array.from({ length: total }).map((_, i) => (
        <span key={i} className="text-[11px] leading-none" style={{ color: i < filled ? '#ff4466' : 'var(--border)' }}>♥</span>
      ))}
      <span className="text-[10px] font-mono text-[var(--text-dim)] ml-1">{value.toFixed(1)}/{max}</span>
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
      <span className="text-[10px] font-mono text-[var(--text-dim)] ml-1">{value}/{max}</span>
    </div>
  )
}

function XpRow({ level, progress }: { level: number | null; progress: number | null }) {
  if (level === null) return <span className="text-[var(--text-dim)]">—</span>
  const pct = progress !== null ? Math.round(progress * 100) : 0
  return (
    <div className="flex items-center gap-2 justify-end">
      <span className="text-xs font-mono text-[var(--accent)]">Lv.{level}</span>
      <div className="w-20 h-1.5 rounded-full bg-[var(--border)] overflow-hidden">
        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: 'var(--accent)' }} />
      </div>
      <span className="text-[10px] font-mono text-[var(--text-dim)] w-7 text-right">{pct}%</span>
    </div>
  )
}

function Badge({ color, children }: { color: string; children: React.ReactNode }) {
  return (
    <span
      className="text-[9px] font-mono tracking-widest px-2 py-0.5 rounded border"
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
      className="text-[9px] font-mono px-1.5 py-0.5 rounded border border-[var(--border)] text-[var(--text-dim)] hover:border-[var(--accent-mid)] transition-colors"
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
        <span className="text-[9px] font-mono tracking-widest text-[var(--text-dim)]">{label}</span>
        <CopyButton text={str} />
      </div>
      <div className="grid grid-cols-3 gap-2 pt-1">
        {(['x', 'y', 'z'] as const).map(axis => (
          <div key={axis} className="text-center">
            <div className="text-[8px] font-mono text-[var(--accent)] opacity-60">{axis.toUpperCase()}</div>
            <div className="text-xs font-mono text-[var(--text)]">{Math.round(pos[axis])}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

function InvSlot({ item, onDelete, deleting }: {
  item: InvItem | undefined
  onDelete?: (item: InvItem) => void
  deleting?: boolean
}) {
  const [hovered, setHovered] = useState(false)
  if (!item) {
    return <div className="w-10 h-10 rounded border border-[var(--border)] bg-[var(--panel)] opacity-20" />
  }
  return (
    <div className="relative group" onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}>
      <div
        className="w-10 h-10 rounded border border-[var(--border)] bg-[var(--panel)] flex flex-col items-center justify-center cursor-default hover:border-[var(--accent-mid)] transition-colors"
      >
        {deleting ? (
          <span className="text-[9px] font-mono text-[var(--text-dim)] animate-pulse">…</span>
        ) : (
          <>
            <span className="text-[8px] font-mono text-[var(--accent)] leading-tight text-center px-0.5 w-full truncate text-center">
              {item.label.slice(0, 6)}
            </span>
            {item.count > 1 && <span className="text-[7px] font-mono text-[var(--text-dim)]">x{item.count}</span>}
          </>
        )}
      </div>
      {/* Delete button — appears on hover when onDelete is provided */}
      {onDelete && !deleting && (
        <button
          onClick={e => {
            e.stopPropagation()
            if (confirm(`Clear ${item.label} from inventory? This cannot be undone.`)) {
              onDelete(item)
            }
          }}
          className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-red-900 border border-red-700 text-red-300 text-[8px] font-mono leading-none flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity z-10 hover:bg-red-700"
          title={`Clear ${item.label}`}
        >
          ✕
        </button>
      )}
      {/* Tooltip */}
      {hovered && !deleting && (
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 z-20 bg-[var(--bg)] border border-[var(--border)] rounded px-2 py-1.5 text-[9px] font-mono text-[var(--text)] whitespace-nowrap shadow-lg pointer-events-none">
          <div className="font-medium">{item.label}</div>
          {item.count > 1 && <div className="text-[var(--text-dim)]">x{item.count}</div>}
          {item.enchants && <div className="text-[var(--accent)] opacity-80 mt-0.5">{item.enchants}</div>}
          <div className="text-[var(--text-dim)] opacity-50 mt-0.5">{slotLabel(item.slot)}</div>
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
}: {
  player: string
  joinedAtMs: number | null
  onClose: () => void
}) {
  const [stats, setStats]         = useState<PlayerStats | null>(null)
  const [effects, setEffects]     = useState<string[]>([])
  const [inventory, setInventory] = useState<InvItem[]>([])
  const [statsLoading, setStatsLoading] = useState(true)
  const [invLoading, setInvLoading]     = useState(true)
  const [statsError, setStatsError]     = useState<string | null>(null)
  const [deletingSlot, setDeletingSlot] = useState<number | null>(null)
  const [deleteError, setDeleteError]   = useState<string | null>(null)
  const [refreshing, setRefreshing]     = useState(false)

  const refresh = useCallback(() => {
    setStats(null); setEffects([]); setInventory([])
    setStatsLoading(true); setInvLoading(true); setStatsError(null)
    setRefreshing(true)

    Promise.all([
      fetch(`/api/minecraft/player?player=${encodeURIComponent(player)}`).then(r => r.json()),
      fetch(`/api/minecraft/effects?player=${encodeURIComponent(player)}`).then(r => r.json()),
    ]).then(([statsData, effectsData]) => {
      if (statsData.ok) setStats(statsData)
      else setStatsError(statsData.error ?? 'Failed to load player data')
      if (effectsData.ok) setEffects(effectsData.active ?? [])
    }).catch(() => setStatsError('Could not reach server'))
      .finally(() => { setStatsLoading(false); setRefreshing(false) })

    fetch(`/api/minecraft/inventory?player=${encodeURIComponent(player)}`)
      .then(r => r.json())
      .then(d => { if (d.ok) setInventory(d.items ?? []) })
      .catch(() => {})
      .finally(() => setInvLoading(false))
  }, [player])

  useEffect(() => {
    refresh()
  }, [refresh])

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

  const bySlot  = new Map(inventory.map(i => [i.slot, i]))
  const hotbar  = Array.from({ length: 9 },  (_, i) => bySlot.get(i))
  const main    = Array.from({ length: 27 }, (_, i) => bySlot.get(i + 9))
  const armor   = [103, 102, 101, 100].map(s => bySlot.get(s))
  const offhand = bySlot.get(150)

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
            <div className="font-mono text-sm tracking-widest text-[var(--accent)]">
              {player}
            </div>
            {uuid && (
              <div className="text-[8px] font-mono text-[var(--text-dim)] opacity-50 mt-0.5 leading-none">
                {uuid}
              </div>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={refresh}
            disabled={statsLoading || refreshing}
            className="text-[10px] font-mono text-[var(--text-dim)] hover:text-[var(--text)] border border-[var(--border)] px-2 py-0.5 rounded transition-colors disabled:opacity-40"
          >
            {refreshing ? '…' : 'Refresh'}
          </button>
          <button
            onClick={onClose}
            className="text-[10px] font-mono text-[var(--text-dim)] hover:text-[var(--text)] border border-[var(--border)] px-2 py-0.5 rounded transition-colors"
          >
            x close
          </button>
        </div>
      </div>

      <div className="p-5 space-y-5">
        {statsLoading ? (
          <div className="text-xs font-mono text-[var(--text-dim)] animate-pulse py-6 text-center">
            Loading player data...
          </div>
        ) : statsError ? (
          <div className="text-xs font-mono text-red-400 py-6 text-center">{statsError}</div>
        ) : (
          <>
            {/* SESSION */}
            <div className="space-y-1.5">
              <SectionTitle>SESSION</SectionTitle>
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
            </div>

            {/* VITALS */}
            <div className="space-y-1.5">
              <SectionTitle>VITALS</SectionTitle>
              <div className="bg-[var(--panel)] rounded-lg border border-[var(--border)] px-3 divide-y divide-[var(--border)]">
                <Row label="HEALTH"><HeartBar value={stats?.health ?? null} /></Row>
                <Row label="HUNGER"><HungerBar value={stats?.food ?? null} /></Row>
                <Row label="EXPERIENCE"><XpRow level={stats?.xpLevel ?? null} progress={stats?.xpP ?? null} /></Row>
              </div>
            </div>

            {/* ACTIVE EFFECTS — only shown if any */}
            {effects.length > 0 && (
              <div className="space-y-1.5">
                <SectionTitle>ACTIVE EFFECTS</SectionTitle>
                <div className="flex flex-wrap gap-1.5">
                  {effects.map(e => (
                    <Badge key={e} color="var(--accent)">{EFFECT_LABELS[e] ?? e}</Badge>
                  ))}
                </div>
              </div>
            )}

            {/* LOCATION */}
            <div className="space-y-1.5">
              <SectionTitle>LOCATION</SectionTitle>
              <div className="space-y-2">
                <CoordBlock label="CURRENT POSITION" pos={stats?.pos ?? null} />
                {stats?.spawnPos && (
                  <CoordBlock label="BED / ANCHOR SPAWN" pos={stats.spawnPos} />
                )}
              </div>
            </div>
          </>
        )}

        {/* INVENTORY — loads independently */}
        <div className="space-y-1.5">
          <SectionTitle>INVENTORY</SectionTitle>
          {invLoading ? (
            <div className="text-xs font-mono text-[var(--text-dim)] animate-pulse">Loading inventory...</div>
          ) : (
            <div className="space-y-3">
              {deleteError && (
                <div className="text-[10px] font-mono text-red-400 px-2 py-1 rounded border border-red-900/50 bg-red-950/30">
                  ✗ {deleteError}
                </div>
              )}
              <div>
                <div className="text-[8px] font-mono text-[var(--text-dim)] mb-1.5 opacity-50 tracking-widest">HOTBAR</div>
                <div className="flex flex-wrap gap-1">
                  {hotbar.map((item, i) => (
                    <InvSlot key={i} item={item}
                      onDelete={item ? deleteItem : undefined}
                      deleting={item ? deletingSlot === item.slot : false}
                    />
                  ))}
                </div>
              </div>
              <div>
                <div className="text-[8px] font-mono text-[var(--text-dim)] mb-1.5 opacity-50 tracking-widest">ARMOR / OFFHAND</div>
                <div className="flex gap-1 flex-wrap items-center">
                  {armor.map((item, i) => (
                    <InvSlot key={i} item={item}
                      onDelete={item ? deleteItem : undefined}
                      deleting={item ? deletingSlot === item.slot : false}
                    />
                  ))}
                  <div className="w-px h-8 bg-[var(--border)] mx-1.5" />
                  <InvSlot item={offhand}
                    onDelete={offhand ? deleteItem : undefined}
                    deleting={offhand ? deletingSlot === offhand.slot : false}
                  />
                </div>
              </div>
              <div>
                <div className="text-[8px] font-mono text-[var(--text-dim)] mb-1.5 opacity-50 tracking-widest">MAIN</div>
                <div className="grid gap-1" style={{ gridTemplateColumns: 'repeat(9, 2.5rem)' }}>
                  {main.map((item, i) => (
                    <InvSlot key={i} item={item}
                      onDelete={item ? deleteItem : undefined}
                      deleting={item ? deletingSlot === item.slot : false}
                    />
                  ))}
                </div>
              </div>
              {inventory.length === 0 && (
                <div className="text-[10px] font-mono text-[var(--text-dim)] opacity-50">Inventory empty</div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export default function PlayersSection({ onPlayersChange }: Props) {
  const [data, setData]               = useState<PlayerListData>({ count: 0, players: '' })
  const [loading, setLoading]         = useState(true)
  const [selectedPlayer, setSelected] = useState<string | null>(null)

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
          <div className="text-[10px] font-mono tracking-widest text-[var(--text-dim)]">ONLINE NOW</div>
          <button
            onClick={fetchPlayers}
            className="text-[9px] font-mono text-[var(--accent)] hover:opacity-70 border border-[var(--border)] px-2 py-1 rounded transition-opacity"
          >
            Refresh
          </button>
        </div>

        <div className="flex items-end gap-3 mb-4">
          <span className="text-5xl font-mono font-bold text-[var(--accent)] leading-none">
            {loading ? '—' : data.error ? '?' : data.count}
          </span>
          <span className="text-[var(--text-dim)] text-sm mb-1">
            {data.count === 1 ? 'player online' : 'players online'}
          </span>
        </div>

        {data.error ? (
          <div className="flex items-center gap-2 text-xs font-mono text-red-400">
            <span>!</span><span>{data.error}</span>
          </div>
        ) : playerList.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {playerList.map(p => {
              const selected  = selectedPlayer === p
              const joinedAt  = data.sessionStarts?.[p] ?? null
              return (
                <button
                  key={p}
                  onClick={() => setSelected(prev => prev === p ? null : p)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border transition-all"
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
                  <span className="w-2 h-2 rounded-full shrink-0" style={{ background: 'var(--accent)' }} />
                  <span className="text-xs font-mono">{p}</span>
                  {joinedAt && (
                    <span className="text-[8px] font-mono opacity-60 ml-0.5">
                      <OnlineTimer joinedAtMs={joinedAt} />
                    </span>
                  )}
                  <span className="text-[8px] font-mono ml-0.5 opacity-60">
                    {selected ? 'v' : '>'}
                  </span>
                </button>
              )
            })}
          </div>
        ) : (
          !loading && (
            <div className="text-xs font-mono text-[var(--text-dim)] opacity-50">No players online</div>
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
        <div className="text-[10px] font-mono text-[var(--text-dim)] opacity-40 text-right">
          Updated {new Date(data.ts).toLocaleTimeString()}
        </div>
      )}
    </div>
  )
}
