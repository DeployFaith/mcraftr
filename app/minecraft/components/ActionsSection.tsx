'use client'
import { useState, useEffect, useCallback, useRef } from 'react'
import {
  Sun, Moon, CloudSun, CloudLightning,
  Hammer, Shield, Map,
  Wind, Heart, Eye, Zap, EyeOff, ArrowUp, Swords, Pickaxe, Sparkles,
  type LucideProps,
} from 'lucide-react'
import { KITS } from '@/lib/kits'
import { CATALOG, type CatalogItem } from '../items'
import type { InvItem } from '../../api/minecraft/inventory/route'
import { useToast } from './useToast'
import Toasts from './Toasts'
import InvSlot, { buildInventoryLayout } from './InvSlot'
import ConfirmModal from './ConfirmModal'
import type { ConfirmModalProps } from './ConfirmModal'
import type { FeatureKey } from '@/lib/features'

type LucideIcon = React.ComponentType<LucideProps>

type Props = {
  players: string[]
}

type FeatureFlags = Record<FeatureKey, boolean>

// ── Constants ─────────────────────────────────────────────────────────────────

const WEATHER_CMDS: { id: string; Icon: LucideIcon; label: string }[] = [
  { id: 'day',           Icon: Sun,            label: 'Day'       },
  { id: 'night',         Icon: Moon,           label: 'Night'     },
  { id: 'clear_weather', Icon: CloudSun,       label: 'Clear Sky' },
  { id: 'storm',         Icon: CloudLightning, label: 'Storm'     },
]

const GAMEMODE_CMDS: { id: string; Icon: LucideIcon; label: string }[] = [
  { id: 'creative',  Icon: Hammer, label: 'Creative'  },
  { id: 'survival',  Icon: Shield, label: 'Survival'  },
  { id: 'adventure', Icon: Map,    label: 'Adventure' },
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

// ── Sub-components ────────────────────────────────────────────────────────────

function PlayerChip({ name, selected, variant = 'default', bothSelected = false, onClick }: {
  name: string; selected: boolean; variant?: 'default' | 'from' | 'to'; bothSelected?: boolean; onClick: () => void
}) {
  const base = 'px-3 py-1.5 rounded-lg text-[13px] font-mono border transition-all cursor-pointer select-none'
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

// ── Main component ─────────────────────────────────────────────────────────────

export default function ActionsSection({ players }: Props) {
  const { toasts, addToast } = useToast()
  const [features, setFeatures] = useState<FeatureFlags | null>(null)

  useEffect(() => {
    fetch('/api/account/preferences')
      .then(r => r.json())
      .then(d => { if (d.ok && d.features) setFeatures(d.features as FeatureFlags) })
      .catch(() => {})
  }, [])

  const [busyCmd,   setBusyCmd]   = useState<string | null>(null)
  const [cmdPlayer, setCmdPlayer] = useState('')

  useEffect(() => {
    if (players.length === 0) return
    if (cmdPlayer && !players.includes(cmdPlayer)) setCmdPlayer('')
  }, [players, cmdPlayer])

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
    if (!cmdPlayer) return
    fetchEffects(cmdPlayer)
    const interval = setInterval(() => fetchEffects(cmdPlayer), 8000)
    return () => clearInterval(interval)
  }, [cmdPlayer, fetchEffects])

  useEffect(() => {
    return () => { if (effectsTimerRef.current) clearTimeout(effectsTimerRef.current) }
  }, [])

  const isActive = (effectId: string) => cmdPlayer ? (activeEffects[cmdPlayer]?.has(effectId) ?? false) : false

  const handleCmdPlayerClick = (p: string) => {
    const next = cmdPlayer === p ? '' : p
    setCmdPlayer(next)
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
        className="flex flex-col items-center gap-1 px-2 py-3 rounded-lg border transition-all disabled:opacity-40 disabled:cursor-not-allowed hover:border-[var(--accent-mid)] border-[var(--border)] text-[var(--text-dim)]">
        <span className="flex items-center justify-center h-5">
          {busy ? <span className="text-[15px] font-mono">…</span> : <Icon size={16} color="var(--text-dim)" strokeWidth={1.5} />}
        </span>
        <span className="text-[13px] font-mono tracking-wide">{label}</span>
      </button>
    )
  }

  // ── Broadcast ─────────────────────────────────────────────────────────────────

  const [bcMessage, setBcMessage] = useState('')
  const [bcBusy,    setBcBusy]    = useState(false)

  const sendBroadcast = async () => {
    if (!bcMessage.trim()) return
    setBcBusy(true)
    try {
      const r = await fetch('/api/minecraft/broadcast', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: bcMessage }),
      })
      const d = await r.json()
      addToast(d.ok ? 'ok' : 'error', d.ok ? d.message : (d.error || 'Broadcast failed'))
      if (d.ok) setBcMessage('')
    } catch (e) {
      addToast('error', e instanceof Error ? e.message : 'Network error')
    } finally { setBcBusy(false) }
  }

  // ── Private message ───────────────────────────────────────────────────────────

  const [msgManual, setMsgManual] = useState('')
  const [msgText,   setMsgText]   = useState('')
  const [msgBusy,   setMsgBusy]   = useState(false)

  const sendPrivateMsg = async () => {
    const player = cmdPlayer || msgManual.trim()
    if (!player || !msgText.trim()) return
    setMsgBusy(true)
    try {
      const r = await fetch('/api/minecraft/msg', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ player, message: msgText }),
      })
      const d = await r.json()
      addToast(d.ok ? 'ok' : 'error', d.ok ? d.message : (d.error || 'Failed'))
      if (d.ok) setMsgText('')
    } catch (e) {
      addToast('error', e instanceof Error ? e.message : 'Network error')
    } finally { setMsgBusy(false) }
  }

  // ── Teleport ──────────────────────────────────────────────────────────────────

  const [tpFrom,      setTpFrom]      = useState('')
  const [tpTo,        setTpTo]        = useState('')
  const [tping,       setTping]       = useState(false)
  const [tpLocPlayer, setTpLocPlayer] = useState('')
  const [tpX, setTpX] = useState('')
  const [tpY, setTpY] = useState('')
  const [tpZ, setTpZ] = useState('')
  const [tpLocing,    setTpLocing]    = useState(false)

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
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ from: tpFrom, to: tpTo }),
      })
      const d = await r.json()
      addToast(d.ok ? 'ok' : 'error', d.ok ? d.message : (d.error || 'Teleport failed'))
      if (d.ok) { setTpFrom(''); setTpTo('') }
    } catch (e) {
      addToast('error', e instanceof Error ? e.message : 'Network error')
    } finally { setTping(false) }
  }

  const teleportToCoords = async () => {
    if (!tpLocPlayer || !tpX || !tpY || !tpZ) return
    setTpLocing(true)
    try {
      const r = await fetch('/api/minecraft/tploc', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ player: tpLocPlayer, x: Number(tpX), y: Number(tpY), z: Number(tpZ) }),
      })
      const d = await r.json()
      addToast(d.ok ? 'ok' : 'error', d.ok ? d.message : (d.error || 'Teleport failed'))
      if (d.ok) { setTpLocPlayer(''); setTpX(''); setTpY(''); setTpZ('') }
    } catch (e) {
      addToast('error', e instanceof Error ? e.message : 'Network error')
    } finally { setTpLocing(false) }
  }

  // ── Kits ──────────────────────────────────────────────────────────────────────

  const [kitManual,   setKitManual]   = useState('')
  const [selectedKit, setSelectedKit] = useState('')
  const [assigning,   setAssigning]   = useState(false)

  const assignKit = async () => {
    const player = cmdPlayer || kitManual.trim()
    if (!player || !selectedKit) return
    setAssigning(true)
    try {
      const r = await fetch('/api/minecraft/kit', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ player, kit: selectedKit }),
      })
      const d = await r.json()
      addToast(d.ok ? 'ok' : 'error', d.ok ? d.message : (d.error || 'Kit assignment failed'))
      if (d.ok) setSelectedKit('')
    } catch (e) {
      addToast('error', e instanceof Error ? e.message : 'Network error')
    } finally { setAssigning(false) }
  }

  // ── Catalog ───────────────────────────────────────────────────────────────────

  const [catManual,   setCatManual]   = useState('')
  const [catCatId,    setCatCatId]    = useState(CATALOG[0].id)
  const [catPage,     setCatPage]     = useState(0)
  const [catSearch,   setCatSearch]   = useState('')
  const [catSelected, setCatSelected] = useState<CatalogItem | null>(null)
  const [catQty,      setCatQty]      = useState(1)
  const [catGiving,   setCatGiving]   = useState(false)

  const activeCat  = CATALOG.find(c => c.id === catCatId) ?? CATALOG[0]
  const allItems   = CATALOG.flatMap(c => c.items)
  const filtered   = catSearch.trim()
    ? allItems.filter(i => i.label.toLowerCase().includes(catSearch.toLowerCase()))
    : activeCat.items
  const totalPages = Math.ceil(filtered.length / CAT_PAGE_SIZE)
  const pageItems  = filtered.slice(catPage * CAT_PAGE_SIZE, (catPage + 1) * CAT_PAGE_SIZE)

  const giveItem = async () => {
    const player = cmdPlayer || catManual.trim()
    if (!player || !catSelected) return
    setCatGiving(true)
    try {
      const r = await fetch('/api/minecraft/give', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ player, item: catSelected.id, qty: catQty }),
      })
      const d = await r.json()
      addToast(d.ok ? 'ok' : 'error', d.ok ? d.message : (d.error || 'Give failed'))
      if (d.ok) { setCatSelected(null); setCatQty(1) }
    } catch (e) {
      addToast('error', e instanceof Error ? e.message : 'Network error')
    } finally { setCatGiving(false) }
  }

  // ── Inventory ─────────────────────────────────────────────────────────────────

  const [invManual,      setInvManual]      = useState('')
  const [invItems,       setInvItems]       = useState<InvItem[]>([])
  const [invLoading,     setInvLoading]     = useState(false)
  const [invDeleting,    setInvDeleting]    = useState<string | null>(null)
  const [selectedInvSlot, setSelectedInvSlot] = useState<InvItem | null>(null)
  const [confirmModal,   setConfirmModal]   = useState<Omit<ConfirmModalProps, 'onCancel'> | null>(null)

  const invPlayer = cmdPlayer || invManual.trim()

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
        body: JSON.stringify({ player, item: item.id, count: item.count }),
      })
      const d = await r.json()
      if (d.ok) { addToast('ok', `Cleared ${item.label}`); setInvItems(prev => prev.filter(i => i.slot !== item.slot)) }
      else addToast('error', d.error || 'Failed to clear item')
    } catch (e) {
      addToast('error', e instanceof Error ? e.message : 'Network error')
    } finally { setInvDeleting(null) }
  }

  const doClearAll = async (player: string) => {
    setConfirmModal(null)
    setInvDeleting('all')
    let cleared = 0; let failed = 0
    for (const item of invItems) {
      try {
        const r = await fetch('/api/minecraft/inventory', {
          method: 'DELETE', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ player, item: item.id, count: item.count }),
        })
        const d = await r.json()
        if (d.ok) cleared++; else failed++
      } catch { failed++ }
    }
    setInvItems([])
    setInvDeleting(null)
    if (failed === 0) addToast('ok', `Cleared ${cleared} item${cleared !== 1 ? 's' : ''} from ${player}`)
    else addToast('error', `Cleared ${cleared}, failed ${failed}`)
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
      } else {
        moveInvItem(player, currentSelected.slot, clickedItem?.slot ?? clickedSlot)
      }
    } else if (clickedItem) {
      setSelectedInvSlot(clickedItem)
    }
  }

  const noPlayers = players.length === 0
  const canWorld = features ? features.enable_world : true
  const canPlayerCmd = features ? features.enable_player_commands : true
  const canChatWrite = features ? (features.enable_chat && features.enable_chat_write) : true
  const canTeleport = features ? features.enable_teleport : true
  const canKits = features ? features.enable_kits : true
  const canCatalog = features ? features.enable_item_catalog : true
  const canInventory = features ? features.enable_inventory : true
  const allSectionsDisabled = !canWorld && !canPlayerCmd && !canChatWrite && !canTeleport && !canKits && !canCatalog && !canInventory

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-4 pb-6">
      <h2 className="font-mono text-base tracking-widest text-[var(--accent)]">ACTIONS</h2>

      {allSectionsDisabled && (
        <div className="glass-card p-4 text-[13px] font-mono text-[var(--text-dim)]">
          All Actions features are disabled for this account.
        </div>
      )}

      {/* ── WORLD COMMANDS ── */}
      {canWorld && (
      <div className="glass-card p-4 space-y-4">
        <div className="text-[13px] font-mono tracking-widest text-[var(--text-dim)]">WORLD</div>
        <div>
          <SectionLabel>WEATHER / TIME</SectionLabel>
          <div className="grid grid-cols-4 gap-2">
            {WEATHER_CMDS.map(c => cmdBtn(c.id, c.Icon, c.label))}
          </div>
        </div>
      </div>
      )}

      {/* ── PLAYER COMMANDS ── */}
      {canPlayerCmd && (
      <div className="glass-card p-4 space-y-4">
        <div className="text-[13px] font-mono tracking-widest text-[var(--text-dim)]">PLAYER COMMANDS</div>

        <div>
          <SectionLabel>SELECT PLAYER</SectionLabel>
          {noPlayers ? (
            <div className="text-[13px] font-mono text-[var(--text-dim)]">No players online — the world is your oyster</div>
          ) : (
            <div className="flex flex-wrap gap-2">
              {players.map(p => (
                <PlayerChip key={p} name={p} selected={cmdPlayer === p} onClick={() => handleCmdPlayerClick(p)} />
              ))}
            </div>
          )}
        </div>

        <div>
          <SectionLabel>GAMEMODE {cmdPlayer && <span className="text-[var(--accent)] normal-case">— {cmdPlayer}</span>}</SectionLabel>
          {cmdPlayer ? (
            <div className="grid grid-cols-3 gap-2">
              {GAMEMODE_CMDS.map(c => cmdBtn(c.id, c.Icon, c.label, cmdPlayer))}
            </div>
          ) : <div className="text-[13px] font-mono text-[var(--text-dim)] opacity-60">Select a player above</div>}
        </div>

        <div>
          <SectionLabel>ABILITIES {cmdPlayer && <span className="text-[var(--accent)] normal-case">— {cmdPlayer}</span>}</SectionLabel>
          {cmdPlayer ? (
            <div className="grid grid-cols-4 gap-2">
              {ABILITY_CMDS.map(c => {
                const key    = c.id + cmdPlayer
                const busy   = busyCmd === key
                const active = !c.oneShot && isActive(c.id)
                const iconColor = active ? 'var(--bg)' : 'var(--text-dim)'
                return (
                  <button key={c.id} onClick={() => issueCmd(c.id, cmdPlayer)} disabled={busy || !!busyCmd}
                    className="flex flex-col items-center gap-1 px-2 py-3 rounded-lg border transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                    style={active
                      ? { borderColor: 'var(--accent)', background: 'var(--accent)', color: 'var(--bg)', boxShadow: '0 0 10px var(--accent-mid)' }
                      : { borderColor: 'var(--border)', color: 'var(--text-dim)' }}>
                    <span className="flex items-center justify-center h-5">
                      {busy
                        ? <span className="text-[15px] font-mono" style={{ color: iconColor }}>…</span>
                        : <c.Icon size={16} color={iconColor} strokeWidth={1.5} />}
                    </span>
                    <span className="text-[13px] font-mono tracking-wide" style={{ color: iconColor }}>{c.label}</span>
                  </button>
                )
              })}
            </div>
          ) : <div className="text-[13px] font-mono text-[var(--text-dim)] opacity-60">Select a player above</div>}
        </div>
      </div>
      )}

      {/* ── BROADCAST ── */}
      {canChatWrite && (
      <div className="glass-card p-4 space-y-4">
        <div className="text-[13px] font-mono tracking-widest text-[var(--text-dim)]">BROADCAST</div>
        <div>
          <SectionLabel>MESSAGE TO ALL PLAYERS</SectionLabel>
          <textarea placeholder="Type a message…" value={bcMessage} onChange={e => setBcMessage(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendBroadcast() } }}
            rows={3} maxLength={256}
            className="w-full bg-[var(--panel)] border border-[var(--border)] rounded-lg px-3 py-2 text-[15px] font-mono text-[var(--text)] placeholder:text-[var(--text-dim)] focus:outline-none focus:border-[var(--accent-mid)] resize-none"
            style={{ fontSize: '16px' }} />
          <div className="flex items-center justify-between mt-1">
            <span className={`text-[13px] font-mono ${bcMessage.length >= 256 ? 'text-red-400' : bcMessage.length >= 230 ? 'text-yellow-500 opacity-70' : 'text-[var(--text-dim)] opacity-60'}`}>
              {bcMessage.length}/256 · Enter to send · Shift+Enter for newline
            </span>
            <button onClick={sendBroadcast} disabled={!bcMessage.trim() || bcBusy}
              className="px-4 py-2 rounded-lg font-mono text-[13px] tracking-widest border border-[var(--border)] text-[var(--accent)] hover:border-[var(--accent-mid)] transition-all disabled:opacity-40 disabled:cursor-not-allowed">
              {bcBusy ? 'Sending...' : 'Send'}
            </button>
          </div>
        </div>

        <div className="border-t border-[var(--border)] pt-3">
          <SectionLabel>PRIVATE MESSAGE</SectionLabel>
          <div className="space-y-2">
            {cmdPlayer ? (
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[var(--panel)] border border-[var(--border)]">
                <span className="text-[13px] font-mono text-[var(--text-dim)]">To:</span>
                <span className="text-[13px] font-mono text-[var(--accent)]">{cmdPlayer}</span>
                <span className="text-[13px] font-mono text-[var(--text-dim)] opacity-60 ml-auto">from Player Commands</span>
              </div>
            ) : (
              <input type="text" placeholder="Type player name… (or select in Player Commands)"
                value={msgManual} onChange={e => setMsgManual(e.target.value)}
                className="w-full bg-[var(--panel)] border border-[var(--border)] rounded-lg px-3 py-2 text-[15px] font-mono text-[var(--text)] placeholder:text-[var(--text-dim)] focus:outline-none focus:border-[var(--accent-mid)]"
                style={{ fontSize: '16px' }} />
            )}
            <div className="flex gap-2">
              <input type="text" placeholder="Message…" value={msgText} onChange={e => setMsgText(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && sendPrivateMsg()} maxLength={256}
                className="flex-1 bg-[var(--panel)] border border-[var(--border)] rounded-lg px-3 py-2 text-[15px] font-mono text-[var(--text)] placeholder:text-[var(--text-dim)] focus:outline-none focus:border-[var(--accent-mid)]"
                style={{ fontSize: '16px' }} />
              <button onClick={sendPrivateMsg} disabled={(!cmdPlayer && !msgManual.trim()) || !msgText.trim() || msgBusy}
                className="px-4 py-2 rounded-lg font-mono text-[13px] tracking-widest border border-[var(--border)] text-[var(--accent)] hover:border-[var(--accent-mid)] transition-all disabled:opacity-40 disabled:cursor-not-allowed">
                {msgBusy ? '…' : 'Send'}
              </button>
            </div>
          </div>
        </div>
      </div>
      )}

      {/* ── TELEPORT ── */}
      {canTeleport && (
      <div className="glass-card p-4 space-y-4">
        <div className="text-[13px] font-mono tracking-widest text-[var(--text-dim)]">TELEPORT</div>

        <div>
          <SectionLabel>PLAYER → PLAYER</SectionLabel>
          {players.length < 2 ? (
            <div className="text-[13px] font-mono text-[var(--text-dim)]">Need at least 2 players online</div>
          ) : (
            <div className="space-y-3">
              <div className="text-[13px] font-mono text-[var(--text-dim)]">
                Tap <span className="text-[var(--accent)]">FROM</span> then <span className="text-[var(--accent)]">TO</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {players.map(p => {
                  const role = tpRole(p)
                  return <PlayerChip key={p} name={p} selected={!!role} variant={role ?? 'default'} bothSelected={!!(tpFrom && tpTo)} onClick={() => handleTpClick(p)} />
                })}
              </div>
              <div className="flex items-center gap-3 py-2 px-3 rounded-lg bg-[var(--panel)] border border-[var(--border)] font-mono text-[13px] min-h-[38px]">
                {tpFrom ? <span className="text-[var(--text)]">{tpFrom}</span> : <span className="text-[var(--text-dim)] opacity-60">from</span>}
                <span className="text-[var(--text-dim)]">→</span>
                {tpTo   ? <span className="text-[var(--accent)]">{tpTo}</span>   : <span className="text-[var(--text-dim)] opacity-60">to</span>}
              </div>
              <button onClick={teleport} disabled={tping || !tpFrom || !tpTo}
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
            {players.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {players.map(p => (
                  <PlayerChip key={p} name={p} selected={tpLocPlayer === p} onClick={() => setTpLocPlayer(s => s === p ? '' : p)} />
                ))}
              </div>
            )}
            <input type="text" placeholder="Or type player name…" value={tpLocPlayer} onChange={e => setTpLocPlayer(e.target.value)}
              className="w-full bg-[var(--panel)] border border-[var(--border)] rounded-lg px-3 py-2 text-[15px] font-mono text-[var(--text)] placeholder:text-[var(--text-dim)] focus:outline-none focus:border-[var(--accent-mid)]"
              style={{ fontSize: '16px' }} />
            <div className="grid grid-cols-3 gap-2">
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
            <button onClick={teleportToCoords} disabled={tpLocing || !tpLocPlayer || !tpX || !tpY || !tpZ}
              className="w-full py-2.5 rounded-lg font-mono text-[13px] tracking-widest transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              style={{ background: 'var(--accent-dim)', border: '1px solid var(--accent-mid)', color: 'var(--accent)' }}>
              {tpLocing ? 'Teleporting...' : 'Teleport to Coordinates'}
            </button>
          </div>
        </div>
      </div>
      )}

      {/* ── KIT ASSIGNMENT ── */}
      {canKits && (
      <div className="glass-card p-4 space-y-4">
        <div className="text-[13px] font-mono tracking-widest text-[var(--text-dim)]">KIT ASSIGNMENT</div>

        <div>
          <SectionLabel>1 · SELECT PLAYER</SectionLabel>
          {cmdPlayer ? (
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[var(--panel)] border border-[var(--border)]">
              <span className="text-[13px] font-mono text-[var(--accent)]">{cmdPlayer}</span>
              <span className="text-[13px] font-mono text-[var(--text-dim)] opacity-60 ml-auto">from Player Commands</span>
            </div>
          ) : (
            <div className="space-y-2">
              {players.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {players.map(p => (
                    <PlayerChip key={p} name={p} selected={kitManual === p}
                      onClick={() => { setKitManual(s => s === p ? '' : p); setSelectedKit('') }} />
                  ))}
                </div>
              )}
              <input type="text" placeholder="Or type player name…"
                value={kitManual} onChange={e => { setKitManual(e.target.value); setSelectedKit('') }}
                className="w-full bg-[var(--panel)] border border-[var(--border)] rounded-lg px-3 py-2 text-[15px] font-mono text-[var(--text)] placeholder:text-[var(--text-dim)] focus:outline-none focus:border-[var(--accent-mid)]"
                style={{ fontSize: '16px' }} />
            </div>
          )}
        </div>

        {(cmdPlayer || kitManual.trim()) && (
          <>
            <div>
              <SectionLabel>2 · SELECT KIT</SectionLabel>
              <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
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

            {selectedKit && (() => {
              const kit = KITS.find(k => k.id === selectedKit)!
              return (
                <div>
                  <SectionLabel>3 · PREVIEW — {kit.label.toUpperCase()}</SectionLabel>
                  <div className="space-y-1 mb-3 max-h-48 overflow-y-auto">
                    {kit.items.map((item, i) => (
                      <div key={i} className="flex items-baseline gap-2 px-2 py-1 rounded bg-[var(--panel)] text-[13px] font-mono">
                        <span className="text-[var(--accent)] shrink-0">×{item.qty}</span>
                        <span className="text-[var(--text)]">{item.name}</span>
                        {item.enchants && <span className="text-purple-400 text-[13px] opacity-70">{item.enchants}</span>}
                      </div>
                    ))}
                  </div>
                  <button onClick={assignKit} disabled={assigning}
                    className="w-full py-2.5 rounded-lg font-mono text-[13px] tracking-widest transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                    style={{ background: 'var(--accent-dim)', border: '1px solid var(--accent-mid)', color: 'var(--accent)' }}>
                    {assigning ? 'Assigning...' : `Give ${kit.label} Kit → ${cmdPlayer || kitManual}`}
                  </button>
                </div>
              )
            })()}
          </>
        )}
      </div>
      )}

      {/* ── ITEM CATALOG ── */}
      {canCatalog && (
      <div className="glass-card p-4 space-y-4">
        <div className="text-[13px] font-mono tracking-widest text-[var(--text-dim)]">ITEM CATALOG</div>

        <div>
          <SectionLabel>SELECT PLAYER</SectionLabel>
          {cmdPlayer ? (
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[var(--panel)] border border-[var(--border)]">
              <span className="text-[13px] font-mono text-[var(--accent)]">{cmdPlayer}</span>
              <span className="text-[13px] font-mono text-[var(--text-dim)] opacity-60 ml-auto">from Player Commands</span>
            </div>
          ) : (
            <div className="space-y-2">
              {players.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {players.map(p => (
                    <PlayerChip key={p} name={p} selected={catManual === p}
                      onClick={() => setCatManual(s => s === p ? '' : p)} />
                  ))}
                </div>
              )}
              <input type="text" placeholder="Or type player name…"
                value={catManual} onChange={e => setCatManual(e.target.value)}
                className="w-full bg-[var(--panel)] border border-[var(--border)] rounded-lg px-3 py-2 text-[15px] font-mono text-[var(--text)] placeholder:text-[var(--text-dim)] focus:outline-none focus:border-[var(--accent-mid)]"
                style={{ fontSize: '16px' }} />
            </div>
          )}
        </div>

        {(cmdPlayer || catManual.trim()) && (
          <>
            <div className="flex gap-1.5 flex-wrap">
              {CATALOG.map(cat => (
                <button key={cat.id} onClick={() => { setCatCatId(cat.id); setCatPage(0); setCatSearch(''); setCatSelected(null) }}
                  className={`px-2 py-1 rounded text-[13px] font-mono transition-all border ${
                    catCatId === cat.id
                      ? 'border-[var(--accent)] bg-[var(--accent-dim)] text-[var(--accent)]'
                      : 'border-[var(--border)] text-[var(--text-dim)] hover:border-[var(--accent-mid)]'
                  }`}>
                  {cat.label}
                </button>
              ))}
            </div>

            <input type="text" placeholder={catSearch ? 'Search all items…' : `Search ${activeCat.label}…`}
              value={catSearch} onChange={e => { setCatSearch(e.target.value); setCatPage(0); setCatSelected(null) }}
              className="w-full bg-[var(--panel)] border border-[var(--border)] rounded-lg px-3 py-2 text-[15px] font-mono text-[var(--text)] placeholder:text-[var(--text-dim)] focus:outline-none focus:border-[var(--accent-mid)]"
              style={{ fontSize: '16px' }} />

            <div className="grid grid-cols-3 sm:grid-cols-4 gap-1.5">
              {pageItems.map(item => (
                <button key={item.id} onClick={() => { setCatSelected(s => s?.id === item.id ? null : item); setCatQty(1) }}
                  className={`flex flex-col items-center gap-1 px-2 py-2.5 rounded-lg border transition-all ${
                    catSelected?.id === item.id
                      ? 'border-[var(--accent)] bg-[var(--accent-dim)] text-[var(--accent)]'
                      : 'border-[var(--border)] text-[var(--text-dim)] hover:border-[var(--accent-mid)]'
                  }`}>
                  <span className="text-[13px] font-mono leading-tight text-center line-clamp-2">{item.label}</span>
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

            {catSelected && (
              <div className="space-y-3 pt-1">
                <div className="flex items-center gap-3 p-3 rounded-lg bg-[var(--panel)] border border-[var(--accent-mid)]">
                  <span className="text-2xl">{activeCat.icon}</span>
                  <div className="flex-1 min-w-0">
                    <div className="text-[13px] font-mono text-[var(--text)] truncate">{catSelected.label}</div>
                    <div className="text-[13px] font-mono text-[var(--text-dim)]">minecraft:{catSelected.id}</div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <button onClick={() => setCatQty(q => Math.max(1, q - 1))} className="w-8 h-8 rounded border border-[var(--border)] text-[var(--text-dim)] font-mono hover:border-[var(--accent-mid)]">−</button>
                  <span className="flex-1 text-center font-mono text-[15px] text-[var(--text)]">{catQty}</span>
                  <button onClick={() => setCatQty(q => Math.min(catSelected.maxStack ?? 64, q + 1))} className="w-8 h-8 rounded border border-[var(--border)] text-[var(--text-dim)] font-mono hover:border-[var(--accent-mid)]">+</button>
                  <button onClick={() => setCatQty(catSelected.maxStack ?? 64)} className="px-3 py-1.5 rounded border border-[var(--border)] text-[13px] font-mono text-[var(--text-dim)] hover:border-[var(--accent-mid)]">Max</button>
                </div>
                <button onClick={giveItem} disabled={catGiving}
                  className="w-full py-2.5 rounded-lg font-mono text-[13px] tracking-widest transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                  style={{ background: 'var(--accent-dim)', border: '1px solid var(--accent-mid)', color: 'var(--accent)' }}>
                  {catGiving ? 'Giving...' : `Give ×${catQty} ${catSelected.label} → ${cmdPlayer || catManual}`}
                </button>
              </div>
            )}
          </>
        )}
      </div>
      )}

      {/* ── INVENTORY VIEWER ── */}
      {canInventory && (
      <div className="glass-card p-4 space-y-4">
        <div className="text-[13px] font-mono tracking-widest text-[var(--text-dim)]">INVENTORY VIEWER</div>

        <div>
          <SectionLabel>SELECT PLAYER</SectionLabel>
          {cmdPlayer ? (
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[var(--panel)] border border-[var(--border)]">
              <span className="text-[13px] font-mono text-[var(--accent)]">{cmdPlayer}</span>
              <span className="text-[13px] font-mono text-[var(--text-dim)] opacity-60 ml-auto">from Player Commands</span>
            </div>
          ) : (
            <div className="space-y-2">
              {players.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {players.map(p => (
                    <PlayerChip key={p} name={p} selected={invManual === p}
                      onClick={() => { setInvManual(s => s === p ? '' : p); setInvItems([]) }} />
                  ))}
                </div>
              )}
              <input type="text" placeholder="Or type player name…"
                value={invManual} onChange={e => { setInvManual(e.target.value); setInvItems([]) }}
                className="w-full bg-[var(--panel)] border border-[var(--border)] rounded-lg px-3 py-2 text-[15px] font-mono text-[var(--text)] placeholder:text-[var(--text-dim)] focus:outline-none focus:border-[var(--accent-mid)]"
                style={{ fontSize: '16px' }} />
            </div>
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
                  <span className="text-[var(--accent)]">{selectedInvSlot.label}</span> selected — click another slot to move, or click it again to deselect
                </div>
              )}
              <div>
                <div className="text-[11px] font-mono text-[var(--text-dim)] mb-1.5 tracking-widest">HOTBAR</div>
                <div className="flex flex-wrap gap-1">
                  {hotbar.map((item, i) => (
                    <InvSlot key={i} item={item} slotIndex={i}
                      selected={!!item && selectedInvSlot?.slot === item.slot}
                      moveTarget={!!selectedInvSlot && !item}
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
                        moveTarget={!!selectedInvSlot && !item}
                        onDelete={item ? (it) => setConfirmModal({ title: 'Clear item?', body: it.label, confirmLabel: 'Clear', destructive: true, onConfirm: () => { setConfirmModal(null); deleteItem(invPlayer, it) } }) : undefined}
                        onSlotClick={() => handleInvSlotClick(invPlayer, item, item?.slot ?? s, selectedInvSlot)}
                        deleting={item ? invDeleting === `${item.slot}` : false}
                      />
                    )
                  })}
                  <div className="w-px h-8 bg-[var(--border)] mx-1.5" />
                  <InvSlot item={offhand} slotIndex={150}
                    selected={!!offhand && selectedInvSlot?.slot === 150}
                    moveTarget={!!selectedInvSlot && !offhand}
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
                      moveTarget={!!selectedInvSlot && !item}
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
      </div>
      )}

      <Toasts toasts={toasts} />
      {confirmModal && (
        <ConfirmModal
          {...confirmModal}
          onCancel={() => { setConfirmModal(null); setSelectedInvSlot(null) }}
        />
      )}
    </div>
  )
}
