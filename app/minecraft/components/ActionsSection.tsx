'use client'
import { useState, useEffect, useCallback, useRef, useLayoutEffect } from 'react'
import { KITS } from '@/lib/kits'
import { CATALOG, type CatalogItem } from '../items'
import type { InvItem } from '../../api/minecraft/inventory/route'

// ── Types ─────────────────────────────────────────────────────────────────────

type Toast = { id: number; variant: 'ok' | 'error' | 'deactivated'; message: string }

const RCON_HISTORY_KEY = 'mcraftr:rcon:history'
const RCON_HISTORY_MAX = 20

type RconEntry = { ts: number; cmd: string; output: string; ok: boolean }

type Props = {
  players: string[]  // live player list from PlayersSection
  role?: string      // current user role — 'admin' shows RCON console
}

// ── Constants ─────────────────────────────────────────────────────────────────

const WEATHER_CMDS = [
  { id: 'day',           icon: '☀️',  label: 'Day'       },
  { id: 'night',         icon: '🌙',  label: 'Night'     },
  { id: 'clear_weather', icon: '🌤',  label: 'Clear Sky' },
  { id: 'storm',         icon: '⛈',  label: 'Storm'     },
]

const GAMEMODE_CMDS = [
  { id: 'creative',  icon: '🔨', label: 'Creative'  },
  { id: 'survival',  icon: '🛡', label: 'Survival'  },
  { id: 'adventure', icon: '🗺', label: 'Adventure' },
]

const ABILITY_CMDS = [
  { id: 'fly',          icon: '🕊',  label: 'Fly'          },
  { id: 'heal',         icon: '❤️',  label: 'Heal'         },
  { id: 'night_vision', icon: '👁',  label: 'Night Vision' },
  { id: 'speed',        icon: '⚡',  label: 'Speed'        },
  { id: 'invisibility', icon: '👻',  label: 'Invisible'    },
  { id: 'jump',         icon: '🦘',  label: 'Super Jump'   },
  { id: 'strength',     icon: '💪',  label: 'Strength'     },
  { id: 'haste',        icon: '⛏',  label: 'Haste'        },
  { id: 'clear_fx',     icon: '✨',  label: 'Clear FX'     },
]

const CAT_PAGE_SIZE = 24

// ── Sub-component: PlayerChip ─────────────────────────────────────────────────

function PlayerChip({ name, selected, variant = 'default', onClick }: {
  name: string
  selected: boolean
  variant?: 'default' | 'from' | 'to'
  onClick: () => void
}) {
  const base = 'px-3 py-1.5 rounded-lg text-xs font-mono border transition-all cursor-pointer select-none'
  if (variant === 'from')
    return <button onClick={onClick} className={`${base} ${selected ? 'border-orange-500 bg-orange-500/10 text-orange-400' : 'border-[var(--border)] text-[var(--text-dim)] hover:border-orange-700'}`}>{name}</button>
  if (variant === 'to')
    return <button onClick={onClick} className={`${base} ${selected ? 'border-[var(--accent)] bg-[var(--accent-dim)] text-[var(--accent)]' : 'border-[var(--border)] text-[var(--text-dim)] hover:border-[var(--accent-mid)]'}`}>{name}</button>
  return (
    <button onClick={onClick} className={`${base} ${selected ? 'border-[var(--accent)] bg-[var(--accent-dim)] text-[var(--accent)]' : 'border-[var(--border)] text-[var(--text-dim)] hover:border-[var(--accent-mid)]'}`}>
      {name}
    </button>
  )
}

// ── Sub-component: SectionHeader ──────────────────────────────────────────────

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-[9px] font-mono text-[var(--text-dim)] tracking-widest pb-1 border-b border-[var(--border)] mb-2">
      {children}
    </div>
  )
}

// ── Main component ─────────────────────────────────────────────────────────────

export default function ActionsSection({ players, role }: Props) {
  const addToast = (variant: Toast['variant'], message: string) => {
    const id = Date.now()
    setToasts(prev => [...prev, { id, variant, message }])
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4000)
  }

  // ── Global state ────────────────────────────────────────────────────────────

  const [toasts,    setToasts]   = useState<Toast[]>([])
  const [busyCmd,   setBusyCmd]  = useState<string | null>(null)
  const [cmdPlayer,    setCmdPlayer]    = useState('')
  const [kitCmdPlayer, setKitCmdPlayer] = useState('')

  // Reset selections if players go offline
  useEffect(() => {
    if (players.length === 0) return
    if (cmdPlayer && !players.includes(cmdPlayer)) setCmdPlayer('')
    if (kitCmdPlayer && !players.includes(kitCmdPlayer)) setKitCmdPlayer('')
  }, [players, cmdPlayer, kitCmdPlayer])

  // ── Effects state ────────────────────────────────────────────────────────────

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
    if (!cmdPlayer) return
    fetchEffects(cmdPlayer)
    const interval = setInterval(() => fetchEffects(cmdPlayer), 8000)
    return () => clearInterval(interval)
  }, [cmdPlayer, fetchEffects])

  const isActive = (effectId: string) =>
    cmdPlayer ? (activeEffects[cmdPlayer]?.has(effectId) ?? false) : false

  const handleCmdPlayerClick = (p: string) => {
    const next = cmdPlayer === p ? '' : p
    setCmdPlayer(next)
    if (next) {
      if (effectsTimerRef.current) clearTimeout(effectsTimerRef.current)
      effectsTimerRef.current = setTimeout(() => fetchEffects(next), 300)
    }
  }

  // ── Commands ─────────────────────────────────────────────────────────────────

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

  const cmdBtn = (id: string, icon: string, label: string, player?: string) => {
    const key  = id + (player ?? '')
    const busy = busyCmd === key
    return (
      <button
        key={id}
        onClick={() => issueCmd(id, player)}
        disabled={busy || !!busyCmd}
        className="flex flex-col items-center gap-1 px-2 py-3 rounded-lg border transition-all disabled:opacity-40 disabled:cursor-not-allowed hover:border-[var(--accent-mid)] border-[var(--border)] text-[var(--text-dim)]"
      >
        <span className="text-lg leading-none">{busy ? '…' : icon}</span>
        <span className="text-[9px] font-mono tracking-wide">{label}</span>
      </button>
    )
  }

  // ── Kick / Ban ───────────────────────────────────────────────────────────────

  const [modTarget,   setModTarget]   = useState('')
  const [modReason,   setModReason]   = useState('')
  const [modBanIp,    setModBanIp]    = useState(false)
  const [modPardonIp, setModPardonIp] = useState(false)
  const [modBusy,     setModBusy]     = useState<'kick' | 'ban' | 'pardon' | null>(null)

  // ── Op / Deop ─────────────────────────────────────────────────────────────────

  const [opBusy, setOpBusy] = useState<'op' | 'deop' | null>(null)

  const opAction = async (action: 'op' | 'deop') => {
    if (!cmdPlayer) return
    setOpBusy(action)
    try {
      const r = await fetch('/api/minecraft/op', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ player: cmdPlayer, action }),
      })
      const d = await r.json()
      addToast(d.ok ? 'ok' : 'error', d.ok ? d.message : (d.error || `${action} failed`))
    } catch (e) {
      addToast('error', e instanceof Error ? e.message : 'Network error')
    } finally {
      setOpBusy(null)
    }
  }

  // ── Whitelist ─────────────────────────────────────────────────────────────────

  const [wlPlayers,  setWlPlayers]  = useState<string[] | null>(null)
  const [wlLoading,  setWlLoading]  = useState(false)
  const [wlInput,    setWlInput]    = useState('')
  const [wlBusy,     setWlBusy]     = useState<string | null>(null)

  const fetchWhitelist = async () => {
    setWlLoading(true)
    try {
      const r = await fetch('/api/minecraft/whitelist')
      const d = await r.json()
      if (d.ok) setWlPlayers(d.players ?? [])
      else addToast('error', d.error || 'Failed to fetch whitelist')
    } catch (e) {
      addToast('error', e instanceof Error ? e.message : 'Network error')
    } finally {
      setWlLoading(false)
    }
  }

  const wlAction = async (player: string, action: 'add' | 'remove') => {
    setWlBusy(player + action)
    try {
      const r = await fetch('/api/minecraft/whitelist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ player, action }),
      })
      const d = await r.json()
      addToast(d.ok ? 'ok' : 'error', d.ok ? d.message : (d.error || 'Whitelist action failed'))
      if (d.ok) {
        if (action === 'add') {
          setWlPlayers(prev => prev ? [...prev, player].sort() : [player])
          setWlInput('')
        } else {
          setWlPlayers(prev => prev ? prev.filter(p => p !== player) : null)
        }
      }
    } catch (e) {
      addToast('error', e instanceof Error ? e.message : 'Network error')
    } finally {
      setWlBusy(null)
    }
  }

  // ── Broadcast ─────────────────────────────────────────────────────────────────

  const [bcMessage, setBcMessage] = useState('')
  const [bcBusy,    setBcBusy]    = useState(false)

  const sendBroadcast = async () => {
    if (!bcMessage.trim()) return
    setBcBusy(true)
    try {
      const r = await fetch('/api/minecraft/broadcast', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: bcMessage }),
      })
      const d = await r.json()
      addToast(d.ok ? 'ok' : 'error', d.ok ? d.message : (d.error || 'Broadcast failed'))
      if (d.ok) setBcMessage('')
    } catch (e) {
      addToast('error', e instanceof Error ? e.message : 'Network error')
    } finally {
      setBcBusy(false)
    }
  }

  // ── RCON Console ──────────────────────────────────────────────────────────────

  const [rconInput,   setRconInput]   = useState('')
  const [rconBusy,    setRconBusy]    = useState(false)
  const [rconEntries, setRconEntries] = useState<RconEntry[]>([])
  const [rconHistIdx, setRconHistIdx] = useState(-1)
  const rconOutputRef = useRef<HTMLDivElement>(null)
  const rconInputRef  = useRef<HTMLInputElement>(null)
  const isAdmin = role === 'admin'

  // Load history from localStorage on mount
  useEffect(() => {
    if (!isAdmin) return
    try {
      const raw = localStorage.getItem(RCON_HISTORY_KEY)
      if (raw) setRconEntries(JSON.parse(raw) as RconEntry[])
    } catch {}
  }, [isAdmin])

  // Persist entries to localStorage whenever they change
  useEffect(() => {
    if (!isAdmin) return
    try {
      localStorage.setItem(RCON_HISTORY_KEY, JSON.stringify(rconEntries.slice(-RCON_HISTORY_MAX)))
    } catch {}
  }, [rconEntries, isAdmin])

  // Scroll output pane to bottom on new entries
  useLayoutEffect(() => {
    if (rconOutputRef.current) {
      rconOutputRef.current.scrollTop = rconOutputRef.current.scrollHeight
    }
  }, [rconEntries])

  const sendRcon = async () => {
    const cmd = rconInput.trim()
    if (!cmd || rconBusy) return
    setRconBusy(true)
    setRconInput('')
    setRconHistIdx(-1)
    try {
      const r = await fetch('/api/minecraft/rcon', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command: cmd }),
      })
      const d = await r.json()
      setRconEntries(prev => [...prev, {
        ts: Date.now(),
        cmd,
        output: d.ok ? (d.output ?? '(no output)') : (d.error ?? 'Error'),
        ok: d.ok,
      }].slice(-RCON_HISTORY_MAX))
    } catch (e) {
      setRconEntries(prev => [...prev, {
        ts: Date.now(),
        cmd,
        output: e instanceof Error ? e.message : 'Network error',
        ok: false,
      }].slice(-RCON_HISTORY_MAX))
    } finally {
      setRconBusy(false)
      setTimeout(() => rconInputRef.current?.focus(), 50)
    }
  }

  const rconKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') { e.preventDefault(); sendRcon(); return }
    // Command history navigation: up/down through past commands
    const cmds = rconEntries.map(en => en.cmd)
    if (e.key === 'ArrowUp') {
      e.preventDefault()
      const idx = rconHistIdx < cmds.length - 1 ? rconHistIdx + 1 : rconHistIdx
      setRconHistIdx(idx)
      setRconInput(cmds[cmds.length - 1 - idx] ?? '')
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      const idx = rconHistIdx > 0 ? rconHistIdx - 1 : -1
      setRconHistIdx(idx)
      setRconInput(idx === -1 ? '' : (cmds[cmds.length - 1 - idx] ?? ''))
    }
  }

  const kickPlayer = async () => {
    if (!modTarget) return
    setModBusy('kick')
    try {
      const r = await fetch('/api/minecraft/kick', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ player: modTarget, reason: modReason }),
      })
      const d = await r.json()
      addToast(d.ok ? 'ok' : 'error', d.ok ? d.message : (d.error || 'Kick failed'))
      if (d.ok) { setModTarget(''); setModReason('') }
    } catch (e) {
      addToast('error', e instanceof Error ? e.message : 'Network error')
    } finally {
      setModBusy(null)
    }
  }

  const banPlayer = async () => {
    if (!modTarget) return
    if (!confirm(`Ban ${modTarget}? This will prevent them from rejoining.`)) return
    setModBusy('ban')
    try {
      const r = await fetch('/api/minecraft/ban', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ player: modTarget, reason: modReason, banIp: modBanIp }),
      })
      const d = await r.json()
      addToast(d.ok ? 'ok' : 'error', d.ok ? d.message : (d.error || 'Ban failed'))
      if (d.ok) { setModTarget(''); setModReason(''); setModBanIp(false) }
    } catch (e) {
      addToast('error', e instanceof Error ? e.message : 'Network error')
    } finally {
      setModBusy(null)
    }
  }

  const pardonPlayer = async () => {
    if (!modTarget) return
    setModBusy('pardon')
    try {
      const r = await fetch('/api/minecraft/pardon', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ player: modTarget, pardonIp: modPardonIp }),
      })
      const d = await r.json()
      addToast(d.ok ? 'ok' : 'error', d.ok ? d.message : (d.error || 'Pardon failed'))
      if (d.ok) { setModTarget(''); setModPardonIp(false) }
    } catch (e) {
      addToast('error', e instanceof Error ? e.message : 'Network error')
    } finally {
      setModBusy(null)
    }
  }

  // ── Teleport ─────────────────────────────────────────────────────────────────

  const [tpFrom,  setTpFrom]  = useState('')
  const [tpTo,    setTpTo]    = useState('')
  const [tping,   setTping]   = useState(false)
  // Coordinate teleport
  const [tpLocPlayer, setTpLocPlayer] = useState('')
  const [tpX, setTpX] = useState('')
  const [tpY, setTpY] = useState('')
  const [tpZ, setTpZ] = useState('')
  const [tpLocing, setTpLocing] = useState(false)

  const handleTpClick = (p: string) => {
    if (!tpFrom || tpFrom === p) {
      setTpFrom(s => s === p ? '' : p)
      if (tpTo === p) setTpTo('')
    } else {
      setTpTo(s => s === p ? '' : p)
    }
  }

  const tpRole = (p: string): 'from' | 'to' | undefined =>
    tpFrom === p ? 'from' : tpTo === p ? 'to' : undefined

  const teleport = async () => {
    if (!tpFrom || !tpTo) return
    setTping(true)
    try {
      const r = await fetch('/api/minecraft/tp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ from: tpFrom, to: tpTo }),
      })
      const d = await r.json()
      addToast(d.ok ? 'ok' : 'error', d.ok ? d.message : (d.error || 'Teleport failed'))
      if (d.ok) { setTpFrom(''); setTpTo('') }
    } catch (e) {
      addToast('error', e instanceof Error ? e.message : 'Network error')
    } finally {
      setTping(false)
    }
  }

  const teleportToCoords = async () => {
    if (!tpLocPlayer || !tpX || !tpY || !tpZ) return
    setTpLocing(true)
    try {
      const r = await fetch('/api/minecraft/tploc', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ player: tpLocPlayer, x: Number(tpX), y: Number(tpY), z: Number(tpZ) }),
      })
      const d = await r.json()
      addToast(d.ok ? 'ok' : 'error', d.ok ? d.message : (d.error || 'Teleport failed'))
      if (d.ok) { setTpLocPlayer(''); setTpX(''); setTpY(''); setTpZ('') }
    } catch (e) {
      addToast('error', e instanceof Error ? e.message : 'Network error')
    } finally {
      setTpLocing(false)
    }
  }

  // ── Kits ──────────────────────────────────────────────────────────────────────

  const [kitManual,   setKitManual]   = useState('')
  const [selectedKit, setSelectedKit] = useState('')
  const [assigning,   setAssigning]   = useState(false)

  const assignKit = async () => {
    const player = kitCmdPlayer || kitManual.trim()
    if (!player || !selectedKit) return
    setAssigning(true)
    try {
      const r = await fetch('/api/minecraft/kit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ player, kit: selectedKit }),
      })
      const d = await r.json()
      addToast(d.ok ? 'ok' : 'error', d.ok ? d.message : (d.error || 'Kit assignment failed'))
      if (d.ok) setSelectedKit('')
    } catch (e) {
      addToast('error', e instanceof Error ? e.message : 'Network error')
    } finally {
      setAssigning(false)
    }
  }

  // ── Catalog ───────────────────────────────────────────────────────────────────

  const [catPlayer,   setCatPlayer]   = useState('')
  const [catManual,   setCatManual]   = useState('')
  const [catCatId,    setCatCatId]    = useState(CATALOG[0].id)
  const [catPage,     setCatPage]     = useState(0)
  const [catSearch,   setCatSearch]   = useState('')
  const [catSelected, setCatSelected] = useState<CatalogItem | null>(null)
  const [catQty,      setCatQty]      = useState(1)
  const [catGiving,   setCatGiving]   = useState(false)

  const activeCat   = CATALOG.find(c => c.id === catCatId) ?? CATALOG[0]
  const filtered    = catSearch.trim()
    ? activeCat.items.filter(i => i.label.toLowerCase().includes(catSearch.toLowerCase()))
    : activeCat.items
  const totalPages  = Math.ceil(filtered.length / CAT_PAGE_SIZE)
  const pageItems   = filtered.slice(catPage * CAT_PAGE_SIZE, (catPage + 1) * CAT_PAGE_SIZE)

  const giveItem = async () => {
    const player = catPlayer || catManual.trim()
    if (!player || !catSelected) return
    setCatGiving(true)
    try {
      const r = await fetch('/api/minecraft/give', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ player, item: catSelected.id, qty: catQty }),
      })
      const d = await r.json()
      addToast(d.ok ? 'ok' : 'error', d.ok ? d.message : (d.error || 'Give failed'))
      if (d.ok) { setCatSelected(null); setCatQty(1) }
    } catch (e) {
      addToast('error', e instanceof Error ? e.message : 'Network error')
    } finally {
      setCatGiving(false)
    }
  }

  // ── Inventory ─────────────────────────────────────────────────────────────────

  const [invPlayer,   setInvPlayer]   = useState('')
  const [invItems,    setInvItems]    = useState<InvItem[]>([])
  const [invLoading,  setInvLoading]  = useState(false)
  const [invDeleting, setInvDeleting] = useState<string | null>(null)

  const loadInventory = async () => {
    if (!invPlayer) return
    setInvLoading(true)
    setInvItems([])
    try {
      const r = await fetch(`/api/minecraft/inventory?player=${encodeURIComponent(invPlayer)}`)
      const d = await r.json()
      if (d.ok) setInvItems(d.items ?? [])
      else addToast('error', d.error || 'Failed to load inventory')
    } catch (e) {
      addToast('error', e instanceof Error ? e.message : 'Network error')
    } finally {
      setInvLoading(false)
    }
  }

  const deleteItem = async (player: string, item: InvItem) => {
    const key = `${item.slot}`
    setInvDeleting(key)
    try {
      const r = await fetch('/api/minecraft/inventory', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ player, item: item.id, count: item.count }),
      })
      const d = await r.json()
      if (d.ok) {
        addToast('ok', `Cleared ${item.label}`)
        setInvItems(prev => prev.filter(i => i.slot !== item.slot))
      } else {
        addToast('error', d.error || 'Failed to clear item')
      }
    } catch (e) {
      addToast('error', e instanceof Error ? e.message : 'Network error')
    } finally {
      setInvDeleting(null)
    }
  }

  const slotLabel = (slot: number) =>
    slot === 150 ? 'Offhand' :
    slot === 103 ? 'Helmet' :
    slot === 102 ? 'Chestplate' :
    slot === 101 ? 'Leggings' :
    slot === 100 ? 'Boots' :
    slot < 9     ? `Hotbar ${slot}` :
                   `Slot ${slot}`

  const noPlayers = players.length === 0

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-4 pb-6">
      <h2 className="font-mono text-base tracking-widest text-[var(--accent)]">// ACTIONS</h2>

      {/* ── WORLD COMMANDS ── */}
      <div className="glass-card p-4 space-y-4">
        <div className="text-[10px] font-mono tracking-widest text-[var(--text-dim)]">WORLD</div>
        <div>
          <SectionLabel>WEATHER / TIME</SectionLabel>
          <div className="grid grid-cols-4 gap-2">
            {WEATHER_CMDS.map(c => cmdBtn(c.id, c.icon, c.label))}
          </div>
        </div>
      </div>

      {/* ── PLAYER COMMANDS ── */}
      <div className="glass-card p-4 space-y-4">
        <div className="text-[10px] font-mono tracking-widest text-[var(--text-dim)]">PLAYER COMMANDS</div>

        {/* Player selector */}
        <div>
          <SectionLabel>SELECT PLAYER</SectionLabel>
          {noPlayers ? (
            <div className="text-[10px] font-mono text-[var(--text-dim)] opacity-50">No players online</div>
          ) : (
            <div className="flex flex-wrap gap-2">
              {players.map(p => (
                <PlayerChip key={p} name={p} selected={cmdPlayer === p} onClick={() => handleCmdPlayerClick(p)} />
              ))}
            </div>
          )}
        </div>

        {/* Gamemode */}
        <div>
          <SectionLabel>GAMEMODE {cmdPlayer && <span className="text-[var(--accent)] normal-case">— {cmdPlayer}</span>}</SectionLabel>
          {cmdPlayer ? (
            <div className="grid grid-cols-3 gap-2">
              {GAMEMODE_CMDS.map(c => cmdBtn(c.id, c.icon, c.label, cmdPlayer))}
            </div>
          ) : <div className="text-[10px] font-mono text-[var(--text-dim)] opacity-40">Select a player above</div>}
        </div>

        {/* Abilities */}
        <div>
          <SectionLabel>ABILITIES {cmdPlayer && <span className="text-[var(--accent)] normal-case">— {cmdPlayer}</span>}</SectionLabel>
          {cmdPlayer ? (
            <div className="grid grid-cols-4 gap-2">
              {ABILITY_CMDS.map(c => {
                const key     = c.id + cmdPlayer
                const busy    = busyCmd === key
                const oneShot = c.id === 'heal' || c.id === 'clear_fx'
                const active  = !oneShot && isActive(c.id)
                return (
                  <button
                    key={c.id}
                    onClick={() => issueCmd(c.id, cmdPlayer)}
                    disabled={busy || !!busyCmd}
                    className="flex flex-col items-center gap-1 px-2 py-3 rounded-lg border transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                    style={active ? {
                      borderColor: 'var(--accent)', background: 'var(--accent-dim)',
                      color: 'var(--accent)', boxShadow: '0 0 8px var(--accent-mid)',
                    } : { borderColor: 'var(--border)', color: 'var(--text-dim)' }}
                  >
                    <span className="text-lg leading-none">{busy ? '…' : c.icon}</span>
                    <span className="text-[9px] font-mono tracking-wide">{c.label}</span>
                  </button>
                )
              })}
            </div>
          ) : <div className="text-[10px] font-mono text-[var(--text-dim)] opacity-40">Select a player above</div>}
        </div>

        {/* Op / Deop */}
        <div>
          <SectionLabel>OPERATOR {cmdPlayer && <span className="text-[var(--accent)] normal-case">— {cmdPlayer}</span>}</SectionLabel>
          {cmdPlayer ? (
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => opAction('op')}
                disabled={!!opBusy}
                className="py-2.5 rounded-lg font-mono text-xs tracking-widest transition-all disabled:opacity-40 disabled:cursor-not-allowed border border-[var(--border)] text-[var(--text-dim)] hover:border-[var(--accent-mid)]"
              >
                {opBusy === 'op' ? '…' : '⭐ Op'}
              </button>
              <button
                onClick={() => opAction('deop')}
                disabled={!!opBusy}
                className="py-2.5 rounded-lg font-mono text-xs tracking-widest transition-all disabled:opacity-40 disabled:cursor-not-allowed border border-[var(--border)] text-[var(--text-dim)] hover:border-orange-800 hover:text-orange-400"
              >
                {opBusy === 'deop' ? '…' : '✕ Deop'}
              </button>
            </div>
          ) : <div className="text-[10px] font-mono text-[var(--text-dim)] opacity-40">Select a player above</div>}
        </div>
      </div>

      {/* ── MODERATION ── */}
      <div className="glass-card p-4 space-y-4">
        <div className="text-[10px] font-mono tracking-widest text-[var(--text-dim)]">MODERATION</div>

        <div>
          <SectionLabel>TARGET PLAYER</SectionLabel>
          {players.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-2">
              {players.map(p => (
                <PlayerChip key={p} name={p} selected={modTarget === p} onClick={() => setModTarget(s => s === p ? '' : p)} />
              ))}
            </div>
          )}
          <input
            type="text"
            placeholder="Or type player name…"
            value={modTarget}
            onChange={e => setModTarget(e.target.value)}
            className="w-full bg-[var(--panel)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm font-mono text-[var(--text)] placeholder:text-[var(--text-dim)] focus:outline-none focus:border-[var(--accent-mid)]"
            style={{ fontSize: '16px' }}
          />
        </div>

        <div>
          <SectionLabel>REASON (OPTIONAL)</SectionLabel>
          <input
            type="text"
            placeholder="e.g. Breaking rules"
            value={modReason}
            onChange={e => setModReason(e.target.value)}
            className="w-full bg-[var(--panel)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm font-mono text-[var(--text)] placeholder:text-[var(--text-dim)] focus:outline-none focus:border-[var(--accent-mid)]"
            style={{ fontSize: '16px' }}
          />
        </div>

        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="ban-ip"
            checked={modBanIp}
            onChange={e => setModBanIp(e.target.checked)}
            className="accent-[var(--accent)]"
          />
          <label htmlFor="ban-ip" className="text-xs font-mono text-[var(--text-dim)] cursor-pointer">
            Also ban IP address
          </label>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={kickPlayer}
            disabled={!modTarget || !!modBusy}
            className="py-2.5 rounded-lg font-mono text-xs tracking-widest transition-all disabled:opacity-40 disabled:cursor-not-allowed border border-yellow-800 text-yellow-400 hover:border-yellow-600"
          >
            {modBusy === 'kick' ? 'Kicking...' : 'Kick'}
          </button>
          <button
            onClick={banPlayer}
            disabled={!modTarget || !!modBusy}
            className="py-2.5 rounded-lg font-mono text-xs tracking-widest transition-all disabled:opacity-40 disabled:cursor-not-allowed border border-red-900 text-red-400 hover:border-red-700"
          >
            {modBusy === 'ban' ? 'Banning...' : 'Ban'}
          </button>
        </div>

        {/* Pardon */}
        <div className="border-t border-[var(--border)] pt-3 space-y-3">
          <SectionLabel>PARDON (UNBAN)</SectionLabel>
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="pardon-ip"
              checked={modPardonIp}
              onChange={e => setModPardonIp(e.target.checked)}
              className="accent-[var(--accent)]"
            />
            <label htmlFor="pardon-ip" className="text-xs font-mono text-[var(--text-dim)] cursor-pointer">
              Also pardon IP address
            </label>
          </div>
          <button
            onClick={pardonPlayer}
            disabled={!modTarget || !!modBusy}
            className="w-full py-2.5 rounded-lg font-mono text-xs tracking-widest transition-all disabled:opacity-40 disabled:cursor-not-allowed border border-green-900 text-green-400 hover:border-green-700"
          >
            {modBusy === 'pardon' ? 'Pardoning...' : 'Pardon'}
          </button>
        </div>
      </div>

      {/* ── WHITELIST ── */}
      <div className="glass-card p-4 space-y-4">
        <div className="text-[10px] font-mono tracking-widest text-[var(--text-dim)]">WHITELIST</div>

        {wlPlayers === null ? (
          <button
            onClick={fetchWhitelist}
            disabled={wlLoading}
            className="w-full py-2.5 rounded-lg font-mono text-xs tracking-widest border border-[var(--border)] text-[var(--text-dim)] hover:border-[var(--accent-mid)] transition-all disabled:opacity-40"
          >
            {wlLoading ? 'Loading...' : 'Load Whitelist'}
          </button>
        ) : (
          <div className="space-y-3">
            {/* Current entries */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <SectionLabel>CURRENT ENTRIES ({wlPlayers.length})</SectionLabel>
                <button
                  onClick={fetchWhitelist}
                  disabled={wlLoading}
                  className="text-[9px] font-mono text-[var(--accent)] opacity-60 hover:opacity-100 transition-opacity"
                >
                  {wlLoading ? '…' : 'Refresh'}
                </button>
              </div>
              {wlPlayers.length === 0 ? (
                <div className="text-[10px] font-mono text-[var(--text-dim)] opacity-40">Whitelist is empty</div>
              ) : (
                <div className="flex flex-wrap gap-1.5 max-h-40 overflow-y-auto">
                  {wlPlayers.map(p => (
                    <div key={p} className="flex items-center gap-1 px-2 py-1 rounded border border-[var(--border)] bg-[var(--panel)]">
                      <span className="text-[10px] font-mono text-[var(--text)]">{p}</span>
                      <button
                        onClick={() => wlAction(p, 'remove')}
                        disabled={wlBusy === p + 'remove'}
                        className="text-[9px] font-mono text-red-400 opacity-60 hover:opacity-100 ml-1 disabled:opacity-20"
                        title="Remove from whitelist"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Add player */}
            <div>
              <SectionLabel>ADD PLAYER</SectionLabel>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Player name…"
                  value={wlInput}
                  onChange={e => setWlInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && wlInput.trim() && wlAction(wlInput.trim(), 'add')}
                  className="flex-1 bg-[var(--panel)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm font-mono text-[var(--text)] placeholder:text-[var(--text-dim)] focus:outline-none focus:border-[var(--accent-mid)]"
                  style={{ fontSize: '16px' }}
                />
                <button
                  onClick={() => wlInput.trim() && wlAction(wlInput.trim(), 'add')}
                  disabled={!wlInput.trim() || !!wlBusy}
                  className="px-4 py-2 rounded-lg font-mono text-xs tracking-widest border border-[var(--border)] text-[var(--accent)] hover:border-[var(--accent-mid)] transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {wlBusy?.endsWith('add') ? '…' : 'Add'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── BROADCAST ── */}
      <div className="glass-card p-4 space-y-4">
        <div className="text-[10px] font-mono tracking-widest text-[var(--text-dim)]">BROADCAST</div>
        <div>
          <SectionLabel>MESSAGE TO ALL PLAYERS</SectionLabel>
          <textarea
            placeholder="Type a message…"
            value={bcMessage}
            onChange={e => setBcMessage(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendBroadcast() } }}
            rows={3}
            className="w-full bg-[var(--panel)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm font-mono text-[var(--text)] placeholder:text-[var(--text-dim)] focus:outline-none focus:border-[var(--accent-mid)] resize-none"
            style={{ fontSize: '16px' }}
          />
          <div className="flex items-center justify-between mt-1">
            <span className="text-[9px] font-mono text-[var(--text-dim)] opacity-40">{bcMessage.length}/256 · Enter to send · Shift+Enter for newline</span>
            <button
              onClick={sendBroadcast}
              disabled={!bcMessage.trim() || bcBusy}
              className="px-4 py-2 rounded-lg font-mono text-xs tracking-widest border border-[var(--border)] text-[var(--accent)] hover:border-[var(--accent-mid)] transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {bcBusy ? 'Sending...' : 'Send'}
            </button>
          </div>
        </div>
      </div>

      {/* ── TELEPORT ── */}
      <div className="glass-card p-4 space-y-4">
        <div className="text-[10px] font-mono tracking-widest text-[var(--text-dim)]">TELEPORT</div>

        {/* Player → Player */}
        <div>
          <SectionLabel>PLAYER → PLAYER</SectionLabel>
          {players.length < 2 ? (
            <div className="text-xs font-mono text-[var(--text-dim)] opacity-50">Need at least 2 players online</div>
          ) : (
            <div className="space-y-3">
              <div className="text-[10px] font-mono text-[var(--text-dim)]">
                Tap <span className="text-orange-400">FROM</span> then <span className="text-[var(--accent)]">TO</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {players.map(p => {
                  const role = tpRole(p)
                  return <PlayerChip key={p} name={p} selected={!!role} variant={role ?? 'default'} onClick={() => handleTpClick(p)} />
                })}
              </div>
              <div className="flex items-center gap-3 py-2 px-3 rounded-lg bg-[var(--panel)] border border-[var(--border)] font-mono text-xs min-h-[38px]">
                {tpFrom ? <span className="text-orange-400">{tpFrom}</span> : <span className="text-[var(--text-dim)] opacity-40">from</span>}
                <span className="text-[var(--text-dim)]">→</span>
                {tpTo   ? <span className="text-[var(--accent)]">{tpTo}</span>   : <span className="text-[var(--text-dim)] opacity-40">to</span>}
              </div>
              <button
                onClick={teleport}
                disabled={tping || !tpFrom || !tpTo}
                className="w-full py-2.5 rounded-lg font-mono text-xs tracking-widest transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                style={{ background: 'var(--accent-dim)', border: '1px solid var(--accent-mid)', color: 'var(--accent)' }}
              >
                {tping ? 'Teleporting...' : 'Teleport'}
              </button>
            </div>
          )}
        </div>

        {/* Player → Coordinates */}
        <div>
          <SectionLabel>PLAYER → COORDINATES</SectionLabel>
          <div className="space-y-3">
            {players.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {players.map(p => (
                  <PlayerChip key={p} name={p} selected={tpLocPlayer === p} onClick={() => setTpLocPlayer(s => s === p ? '' : p)} />
                ))}
              </div>
            )}
            <input
              type="text"
              placeholder="Or type player name…"
              value={tpLocPlayer}
              onChange={e => setTpLocPlayer(e.target.value)}
              className="w-full bg-[var(--panel)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm font-mono text-[var(--text)] placeholder:text-[var(--text-dim)] focus:outline-none focus:border-[var(--accent-mid)]"
              style={{ fontSize: '16px' }}
            />
            <div className="grid grid-cols-3 gap-2">
              {(['X', 'Y', 'Z'] as const).map((axis, i) => (
                <div key={axis}>
                  <div className="text-[9px] font-mono text-[var(--text-dim)] mb-1">{axis}</div>
                  <input
                    type="number"
                    placeholder="0"
                    value={[tpX, tpY, tpZ][i]}
                    onChange={e => [setTpX, setTpY, setTpZ][i](e.target.value)}
                    className="w-full bg-[var(--panel)] border border-[var(--border)] rounded-lg px-2 py-2 text-sm font-mono text-[var(--text)] placeholder:text-[var(--text-dim)] focus:outline-none focus:border-[var(--accent-mid)]"
                    style={{ fontSize: '16px' }}
                  />
                </div>
              ))}
            </div>
            <button
              onClick={teleportToCoords}
              disabled={tpLocing || !tpLocPlayer || !tpX || !tpY || !tpZ}
              className="w-full py-2.5 rounded-lg font-mono text-xs tracking-widest transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              style={{ background: 'var(--accent-dim)', border: '1px solid var(--accent-mid)', color: 'var(--accent)' }}
            >
              {tpLocing ? 'Teleporting...' : 'Teleport to Coordinates'}
            </button>
          </div>
        </div>
      </div>

      {/* ── KITS ── */}
      <div className="glass-card p-4 space-y-4">
        <div className="text-[10px] font-mono tracking-widest text-[var(--text-dim)]">KIT ASSIGNMENT</div>

        <div>
          <SectionLabel>1 · SELECT PLAYER</SectionLabel>
          {players.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-2">
              {players.map(p => (
                <PlayerChip key={p} name={p} selected={kitCmdPlayer === p}
                  onClick={() => { setKitCmdPlayer(s => s === p ? '' : p); setKitManual(''); setSelectedKit('') }} />
              ))}
            </div>
          )}
          <input
            type="text"
            placeholder="Or type player name…"
            value={kitManual}
            onChange={e => { setKitManual(e.target.value); if (kitCmdPlayer) setKitCmdPlayer(''); setSelectedKit('') }}
            className="w-full bg-[var(--panel)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm font-mono text-[var(--text)] placeholder:text-[var(--text-dim)] focus:outline-none focus:border-[var(--accent-mid)]"
            style={{ fontSize: '16px' }}
          />
        </div>

        {(kitCmdPlayer || kitManual.trim()) && (
          <>
            <div>
              <SectionLabel>2 · SELECT KIT</SectionLabel>
              <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
                {KITS.map(k => (
                  <button
                    key={k.id}
                    onClick={() => setSelectedKit(s => s === k.id ? '' : k.id)}
                    className={`flex flex-col items-center gap-1 px-2 py-3 rounded-xl border transition-all ${
                      selectedKit === k.id
                        ? 'border-[var(--accent)] bg-[var(--accent-dim)] text-[var(--accent)]'
                        : 'border-[var(--border)] text-[var(--text-dim)] hover:border-[var(--accent-mid)]'
                    }`}
                  >
                    <span className="text-xl leading-none">{k.icon}</span>
                    <span className="text-[9px] font-mono tracking-wide">{k.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {selectedKit && (() => {
              const kit = KITS.find(k => k.id === selectedKit)!
              return (
                <div>
                  <SectionLabel>3 · PREVIEW — {kit.label.toUpperCase()}</SectionLabel>
                  <div className="space-y-1 mb-3 max-h-48 overflow-y-auto">
                    {kit.items.map((item, i) => (
                      <div key={i} className="flex items-baseline gap-2 px-2 py-1 rounded bg-[var(--panel)] text-xs font-mono">
                        <span className="text-[var(--accent)] shrink-0">×{item.qty}</span>
                        <span className="text-[var(--text)]">{item.name}</span>
                        {item.enchants && <span className="text-purple-400 text-[9px] opacity-70">{item.enchants}</span>}
                      </div>
                    ))}
                  </div>
                  <button
                    onClick={assignKit}
                    disabled={assigning}
                    className="w-full py-2.5 rounded-lg font-mono text-xs tracking-widest transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                    style={{ background: 'var(--accent-dim)', border: '1px solid var(--accent-mid)', color: 'var(--accent)' }}
                  >
                    {assigning ? 'Assigning...' : `Give ${kit.label} Kit → ${kitCmdPlayer || kitManual}`}
                  </button>
                </div>
              )
            })()}
          </>
        )}
      </div>

      {/* ── ITEM CATALOG ── */}
      <div className="glass-card p-4 space-y-4">
        <div className="text-[10px] font-mono tracking-widest text-[var(--text-dim)]">ITEM CATALOG</div>

        <div>
          <SectionLabel>SELECT PLAYER</SectionLabel>
          {players.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-2">
              {players.map(p => (
                <PlayerChip key={p} name={p} selected={catPlayer === p}
                  onClick={() => { setCatPlayer(s => s === p ? '' : p); setCatManual('') }} />
              ))}
            </div>
          )}
          <input
            type="text"
            placeholder="Or type player name…"
            value={catManual}
            onChange={e => { setCatManual(e.target.value); if (catPlayer) setCatPlayer('') }}
            className="w-full bg-[var(--panel)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm font-mono text-[var(--text)] placeholder:text-[var(--text-dim)] focus:outline-none focus:border-[var(--accent-mid)]"
            style={{ fontSize: '16px' }}
          />
        </div>

        {(catPlayer || catManual.trim()) && (
          <>
            {/* Category tabs */}
            <div className="flex gap-1.5 flex-wrap">
              {CATALOG.map(cat => (
                <button
                  key={cat.id}
                  onClick={() => { setCatCatId(cat.id); setCatPage(0); setCatSearch(''); setCatSelected(null) }}
                  className={`px-2 py-1 rounded text-[9px] font-mono transition-all border ${
                    catCatId === cat.id
                      ? 'border-[var(--accent)] bg-[var(--accent-dim)] text-[var(--accent)]'
                      : 'border-[var(--border)] text-[var(--text-dim)] hover:border-[var(--accent-mid)]'
                  }`}
                >
                  {cat.label}
                </button>
              ))}
            </div>

            {/* Search */}
            <input
              type="text"
              placeholder={`Search ${activeCat.label}…`}
              value={catSearch}
              onChange={e => { setCatSearch(e.target.value); setCatPage(0); setCatSelected(null) }}
              className="w-full bg-[var(--panel)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm font-mono text-[var(--text)] placeholder:text-[var(--text-dim)] focus:outline-none focus:border-[var(--accent-mid)]"
              style={{ fontSize: '16px' }}
            />

            {/* Item grid */}
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-1.5">
              {pageItems.map(item => (
                <button
                  key={item.id}
                  onClick={() => { setCatSelected(s => s?.id === item.id ? null : item); setCatQty(1) }}
                  className={`flex flex-col items-center gap-1 px-2 py-2.5 rounded-lg border transition-all ${
                    catSelected?.id === item.id
                      ? 'border-[var(--accent)] bg-[var(--accent-dim)] text-[var(--accent)]'
                      : 'border-[var(--border)] text-[var(--text-dim)] hover:border-[var(--accent-mid)]'
                  }`}
                >
                  <span className="text-[8px] font-mono leading-tight text-center line-clamp-2">{item.label}</span>
                </button>
              ))}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between">
                <button onClick={() => setCatPage(p => Math.max(0, p - 1))} disabled={catPage === 0}
                  className="text-[10px] font-mono text-[var(--accent)] disabled:opacity-30">← Prev</button>
                <span className="text-[9px] font-mono text-[var(--text-dim)]">{catPage + 1} / {totalPages}</span>
                <button onClick={() => setCatPage(p => Math.min(totalPages - 1, p + 1))} disabled={catPage === totalPages - 1}
                  className="text-[10px] font-mono text-[var(--accent)] disabled:opacity-30">Next →</button>
              </div>
            )}

            {/* Give controls */}
            {catSelected && (
              <div className="space-y-3 pt-1">
                <div className="flex items-center gap-3 p-3 rounded-lg bg-[var(--panel)] border border-[var(--accent-mid)]">
                  <span className="text-2xl">{activeCat.icon}</span>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-mono text-[var(--text)] truncate">{catSelected.label}</div>
                    <div className="text-[9px] font-mono text-[var(--text-dim)]">minecraft:{catSelected.id}</div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <button onClick={() => setCatQty(q => Math.max(1, q - 1))} className="w-8 h-8 rounded border border-[var(--border)] text-[var(--text-dim)] font-mono hover:border-[var(--accent-mid)]">−</button>
                  <span className="flex-1 text-center font-mono text-sm text-[var(--text)]">{catQty}</span>
                  <button onClick={() => setCatQty(q => Math.min(catSelected.maxStack ?? 64, q + 1))} className="w-8 h-8 rounded border border-[var(--border)] text-[var(--text-dim)] font-mono hover:border-[var(--accent-mid)]">+</button>
                  <button onClick={() => setCatQty(catSelected.maxStack ?? 64)} className="px-3 py-1.5 rounded border border-[var(--border)] text-[9px] font-mono text-[var(--text-dim)] hover:border-[var(--accent-mid)]">Max</button>
                </div>
                <button
                  onClick={giveItem}
                  disabled={catGiving}
                  className="w-full py-2.5 rounded-lg font-mono text-xs tracking-widest transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                  style={{ background: 'var(--accent-dim)', border: '1px solid var(--accent-mid)', color: 'var(--accent)' }}
                >
                  {catGiving ? 'Giving...' : `Give ×${catQty} ${catSelected.label} → ${catPlayer || catManual}`}
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* ── INVENTORY ── */}
      <div className="glass-card p-4 space-y-4">
        <div className="text-[10px] font-mono tracking-widest text-[var(--text-dim)]">INVENTORY VIEWER</div>

        <div>
          <SectionLabel>SELECT PLAYER</SectionLabel>
          {players.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-2">
              {players.map(p => (
                <PlayerChip key={p} name={p} selected={invPlayer === p}
                  onClick={() => { setInvPlayer(s => s === p ? '' : p); setInvItems([]) }} />
              ))}
            </div>
          )}
          <input
            type="text"
            placeholder="Or type player name…"
            value={invPlayer}
            onChange={e => { setInvPlayer(e.target.value); setInvItems([]) }}
            className="w-full bg-[var(--panel)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm font-mono text-[var(--text)] placeholder:text-[var(--text-dim)] focus:outline-none focus:border-[var(--accent-mid)]"
            style={{ fontSize: '16px' }}
          />
        </div>

        <button
          onClick={loadInventory}
          disabled={invLoading || !invPlayer}
          className="w-full py-2.5 rounded-lg font-mono text-xs tracking-widest transition-all disabled:opacity-40 disabled:cursor-not-allowed border border-[var(--border)] text-[var(--text-dim)] hover:border-[var(--accent-mid)]"
        >
          {invLoading ? 'Loading...' : 'Load Inventory'}
        </button>

        {invItems.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="text-[9px] font-mono text-[var(--text-dim)]">
                {invItems.length} item{invItems.length !== 1 ? 's' : ''}
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {invItems.map(item => {
                const key = `${item.slot}`
                return (
                  <div key={key} className="flex items-start justify-between gap-2 px-3 py-2.5 rounded-lg border border-[var(--border)] bg-[var(--panel)]">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline gap-2">
                        <span className="text-[9px] font-mono text-[var(--text-dim)] shrink-0">{slotLabel(item.slot)}</span>
                        <span className="text-xs font-mono text-[var(--text)] truncate">{item.label}</span>
                        {item.count > 1 && <span className="text-[9px] font-mono text-[var(--accent)] shrink-0">×{item.count}</span>}
                      </div>
                      {item.enchants && (
                        <div className="text-[9px] font-mono text-purple-400 opacity-80 mt-0.5 leading-relaxed">{item.enchants}</div>
                      )}
                    </div>
                    <button
                      onClick={() => deleteItem(invPlayer, item)}
                      disabled={!!invDeleting}
                      className="shrink-0 w-7 h-7 flex items-center justify-center rounded-lg border border-[var(--border)] text-[var(--text-dim)] hover:border-red-700 hover:text-red-400 disabled:opacity-30 transition-all text-sm"
                      title={`Clear ${item.label}`}
                    >
                      {invDeleting === key ? '…' : '🗑'}
                    </button>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {!invLoading && invPlayer && invItems.length === 0 && (
          <div className="text-[10px] font-mono text-[var(--text-dim)] opacity-50 text-center py-4">
            No items found — player may not be online or inventory is empty
          </div>
        )}
      </div>

      {/* ── RCON CONSOLE (admin only) ── */}
      {isAdmin && (
        <div className="glass-card p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="text-[10px] font-mono tracking-widest text-[var(--text-dim)]">RCON CONSOLE</div>
            {rconEntries.length > 0 && (
              <button
                onClick={() => { setRconEntries([]); localStorage.removeItem(RCON_HISTORY_KEY) }}
                className="text-[9px] font-mono text-[var(--text-dim)] opacity-50 hover:opacity-100 transition-opacity"
              >
                Clear
              </button>
            )}
          </div>

          {/* Output pane */}
          <div
            ref={rconOutputRef}
            className="rounded-lg border border-[var(--border)] bg-black/60 p-3 h-52 overflow-y-auto font-mono text-[11px] leading-relaxed space-y-2"
          >
            {rconEntries.length === 0 ? (
              <div className="text-[var(--text-dim)] opacity-30">No output yet. Enter a command below.</div>
            ) : (
              rconEntries.map((en, i) => (
                <div key={i}>
                  <div className="text-[var(--accent)] opacity-70">
                    <span className="opacity-50 mr-1">{new Date(en.ts).toLocaleTimeString()}</span>
                    <span className="text-[var(--text-dim)]">&gt;</span>{' '}
                    {en.cmd}
                  </div>
                  <div className={en.ok ? 'text-[var(--text)] opacity-80 pl-3' : 'text-red-400 pl-3'}>
                    {en.output}
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Input row */}
          <div className="flex gap-2 items-center">
            <span className="font-mono text-xs text-[var(--text-dim)] shrink-0">&gt;</span>
            <input
              ref={rconInputRef}
              type="text"
              value={rconInput}
              onChange={e => { setRconInput(e.target.value); setRconHistIdx(-1) }}
              onKeyDown={rconKeyDown}
              disabled={rconBusy}
              placeholder="e.g. list, time set day, give Player diamond 1"
              maxLength={256}
              className="flex-1 bg-[var(--panel)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm font-mono text-[var(--text)] placeholder:text-[var(--text-dim)] focus:outline-none focus:border-[var(--accent-mid)] disabled:opacity-50"
              style={{ fontSize: '16px' }}
            />
            <button
              onClick={sendRcon}
              disabled={!rconInput.trim() || rconBusy}
              className="px-4 py-2 rounded-lg font-mono text-xs tracking-widest border border-[var(--border)] text-[var(--accent)] hover:border-[var(--accent-mid)] transition-all disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
            >
              {rconBusy ? '…' : 'Run'}
            </button>
          </div>
          <div className="text-[9px] font-mono text-[var(--text-dim)] opacity-30">
            Enter to run · ↑↓ history · {rconInput.length}/256
          </div>
        </div>
      )}

      {/* Toasts */}
      <div className="fixed bottom-20 right-4 flex flex-col gap-2 z-50 pointer-events-none md:bottom-6 md:right-6">
        {toasts.map(toast => {
          const styles =
            toast.variant === 'ok'
              ? { background: 'var(--accent-dim)', border: '1px solid var(--accent-mid)', color: 'var(--accent)' }
              : toast.variant === 'deactivated'
              ? { background: '#2a1500', border: '1px solid #92400e', color: '#fb923c' }
              : { background: '#2a0f0f', border: '1px solid #7f1d1d', color: '#fca5a5' }
          const prefix = toast.variant === 'ok' ? '✓ ' : toast.variant === 'deactivated' ? '○ ' : '✗ '
          return (
            <div key={toast.id} className="px-4 py-3 rounded-lg font-mono text-xs shadow-lg pointer-events-auto max-w-xs" style={styles}>
              {prefix}{toast.message}
            </div>
          )
        })}
      </div>
    </div>
  )
}
