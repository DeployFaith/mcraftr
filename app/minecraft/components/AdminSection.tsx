'use client'
import { useState, useEffect, useCallback, useLayoutEffect, useRef } from 'react'
import {
  Sun, Moon, CloudSun, CloudRain, CloudLightning, Sunrise, Sunset, MoonStar,
  Save, Square, Star, X,
} from 'lucide-react'
import PlayerPicker from './PlayerPicker'
import type { AuditEntry } from '@/lib/audit'
import type { UserSummary } from '@/lib/users'
import { useToast } from './useToast'
import Toasts from './Toasts'

const RCON_HISTORY_KEY = 'mcraftr:rcon:history'
const RCON_HISTORY_MAX = 20
type RconEntry = { ts: number; cmd: string; output: string; ok: boolean }

type ServerInfo = {
  online: number; max: number; version: string | null
  tps: number | null; weather: string | null; timeOfDay: string | null
}

type Props = { players: string[] }

// ── Helpers ───────────────────────────────────────────────────────────────────

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-[13px] font-mono text-[var(--text-dim)] tracking-widest pb-1 border-b border-[var(--border)] mb-2">
      {children}
    </div>
  )
}

function WeatherIcon({ w }: { w: string | null }) {
  const props = { size: 16, strokeWidth: 1.5, color: 'var(--text)' }
  if (w === 'clear')   return <Sun {...props} />
  if (w === 'rain')    return <CloudRain {...props} />
  if (w === 'thunder') return <CloudLightning {...props} />
  return <span className="text-[var(--text-dim)]">—</span>
}

function TimeIcon({ t }: { t: string | null }) {
  const props = { size: 16, strokeWidth: 1.5, color: 'var(--text)' }
  if (t === 'Dawn')      return <Sunrise {...props} />
  if (t === 'Morning')   return <CloudSun {...props} />
  if (t === 'Noon')      return <Sun {...props} />
  if (t === 'Afternoon') return <CloudSun {...props} />
  if (t === 'Dusk')      return <Sunset {...props} />
  if (t === 'Night')     return <Moon {...props} />
  if (t === 'Midnight')  return <MoonStar {...props} />
  return <span className="text-[var(--text-dim)]">—</span>
}

function TpsGauge({ tps }: { tps: number }) {
  const pct   = Math.round((tps / 20) * 100)
  const color = tps >= 18 ? '#4ade80' : tps >= 15 ? '#fb923c' : '#f87171'
  const label = tps >= 18 ? 'Good' : tps >= 15 ? 'Lag' : 'Bad'
  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between">
        <span className="font-mono text-2xl font-bold" style={{ color }}>{tps.toFixed(2)}</span>
        <span className="text-[13px] font-mono tracking-widest" style={{ color }}>{label}</span>
      </div>
      <div className="h-1.5 rounded-full bg-[var(--panel)] overflow-hidden border border-[var(--border)]">
        <div className="h-full rounded-full transition-all duration-700" style={{ width: `${pct}%`, background: color }} />
      </div>
      <div className="text-[13px] font-mono text-[var(--text-dim)]">ticks/sec (max 20)</div>
    </div>
  )
}

function StatTile({ label, value, sub }: { label: string; value: React.ReactNode; sub?: string }) {
  return (
    <div className="glass-card p-4 space-y-1">
      <div className="text-[13px] font-mono tracking-widest text-[var(--text-dim)]">{label}</div>
      <div className="font-mono text-lg text-[var(--text)]">{value}</div>
      {sub && <div className="text-[13px] font-mono text-[var(--text-dim)]">{sub}</div>}
    </div>
  )
}

// ── Main component ─────────────────────────────────────────────────────────────

export default function AdminSection({ players }: Props) {
  const { toasts, addToast } = useToast()


  // ── Server Info ───────────────────────────────────────────────────────────────

  const [info,        setInfo]        = useState<ServerInfo | null>(null)
  const [infoError,   setInfoError]   = useState<string | null>(null)
  const [infoLoading, setInfoLoading] = useState(false)
  const [infoLastAt,  setInfoLastAt]  = useState<Date | null>(null)

  const fetchInfo = useCallback(async (showSpinner = false) => {
    if (showSpinner) setInfoLoading(true)
    setInfoError(null)
    try {
      const r = await fetch('/api/minecraft/server-info')
      const d = await r.json()
      if (d.ok) { setInfo(d as ServerInfo); setInfoLastAt(new Date()) }
      else setInfoError(d.error || 'Failed to fetch server info')
    } catch (e) {
      setInfoError(e instanceof Error ? e.message : 'Network error')
    } finally {
      setInfoLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchInfo(true)
    const id = setInterval(() => fetchInfo(false), 30_000)
    return () => clearInterval(id)
  }, [fetchInfo])

  // ── Server Config ─────────────────────────────────────────────────────────────

  const [difficulty,       setDifficulty]       = useState<string | null>(null)
  const [difficultyBusy,   setDifficultyBusy]   = useState<string | null>(null)
  const [gamerules,        setGamerules]         = useState<Record<string, string> | null>(null)
  const [gamerulesLoading, setGamerulesLoading]  = useState(false)
  const [grBusy,           setGrBusy]           = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/minecraft/difficulty').then(r => r.json()).then(d => {
      if (d.ok) setDifficulty(d.current)
    }).catch(() => {})
  }, [])

  const fetchGamerules = async () => {
    setGamerulesLoading(true)
    try {
      const r = await fetch('/api/minecraft/gamerule')
      const d = await r.json()
      if (d.ok) setGamerules(d.gamerules)
      else addToast('error', d.error || 'Failed to load gamerules')
    } catch (e) {
      addToast('error', e instanceof Error ? e.message : 'Network error')
    } finally {
      setGamerulesLoading(false)
    }
  }

  const setDifficultyCmd = async (diff: string) => {
    setDifficultyBusy(diff)
    try {
      const r = await fetch('/api/minecraft/difficulty', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ difficulty: diff }),
      })
      const d = await r.json()
      if (d.ok) { setDifficulty(diff); addToast('ok', d.message) }
      else addToast('error', d.error || 'Failed')
    } catch (e) {
      addToast('error', e instanceof Error ? e.message : 'Network error')
    } finally {
      setDifficultyBusy(null)
    }
  }

  const toggleGamerule = async (rule: string, currentVal: string) => {
    const newVal = currentVal === 'true' ? 'false' : 'true'
    setGrBusy(rule)
    try {
      const r = await fetch('/api/minecraft/gamerule', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rule, value: newVal }),
      })
      const d = await r.json()
      if (d.ok) { setGamerules(prev => prev ? { ...prev, [rule]: newVal } : prev); addToast('ok', d.message) }
      else addToast('error', d.error || 'Failed')
    } catch (e) {
      addToast('error', e instanceof Error ? e.message : 'Network error')
    } finally {
      setGrBusy(null)
    }
  }

  // ── Moderation ────────────────────────────────────────────────────────────────

  const [modTarget,   setModTarget]   = useState('')
  const [modReason,   setModReason]   = useState('')
  const [modBanIp,    setModBanIp]    = useState(false)
  const [modPardonIp, setModPardonIp] = useState(false)
  const [modBusy,     setModBusy]     = useState<'kick' | 'ban' | 'pardon' | null>(null)
  const [banList,     setBanList]     = useState<string[] | null>(null)
  const [banListLoading, setBanListLoading] = useState(false)

  const fetchBanList = async () => {
    setBanListLoading(true)
    try {
      const r = await fetch('/api/minecraft/banlist')
      const d = await r.json()
      if (d.ok) setBanList(d.players ?? [])
      else addToast('error', d.error || 'Failed to fetch ban list')
    } catch (e) {
      addToast('error', e instanceof Error ? e.message : 'Network error')
    } finally {
      setBanListLoading(false)
    }
  }

  const kickPlayer = async () => {
    if (!modTarget || !/^\.?[a-zA-Z0-9_]{1,16}$/.test(modTarget.trim())) {
      addToast('error', 'Invalid player name'); return
    }
    setModBusy('kick')
    try {
      const r = await fetch('/api/minecraft/kick', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ player: modTarget, reason: modReason }),
      })
      const d = await r.json()
      addToast(d.ok ? 'ok' : 'error', d.ok ? d.message : (d.error || 'Kick failed'))
      if (d.ok) { setModTarget(''); setModReason('') }
    } catch (e) {
      addToast('error', e instanceof Error ? e.message : 'Network error')
    } finally { setModBusy(null) }
  }

  const banPlayer = async () => {
    if (!modTarget || !/^\.?[a-zA-Z0-9_]{1,16}$/.test(modTarget.trim())) {
      addToast('error', 'Invalid player name'); return
    }
    if (!confirm(`Ban ${modTarget}? This will prevent them from rejoining.`)) return
    setModBusy('ban')
    try {
      const r = await fetch('/api/minecraft/ban', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ player: modTarget, reason: modReason, banIp: modBanIp }),
      })
      const d = await r.json()
      addToast(d.ok ? 'ok' : 'error', d.ok ? d.message : (d.error || 'Ban failed'))
      if (d.ok) { setModTarget(''); setModReason(''); setModBanIp(false) }
    } catch (e) {
      addToast('error', e instanceof Error ? e.message : 'Network error')
    } finally { setModBusy(null) }
  }

  const pardonPlayer = async () => {
    if (!modTarget || !/^\.?[a-zA-Z0-9_]{1,16}$/.test(modTarget.trim())) {
      addToast('error', 'Invalid player name'); return
    }
    setModBusy('pardon')
    try {
      const r = await fetch('/api/minecraft/pardon', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ player: modTarget, pardonIp: modPardonIp }),
      })
      const d = await r.json()
      addToast(d.ok ? 'ok' : 'error', d.ok ? d.message : (d.error || 'Pardon failed'))
      if (d.ok) { setModTarget(''); setModPardonIp(false); if (banList !== null) fetchBanList() }
    } catch (e) {
      addToast('error', e instanceof Error ? e.message : 'Network error')
    } finally { setModBusy(null) }
  }

  // ── Whitelist ─────────────────────────────────────────────────────────────────

  const [wlPlayers,  setWlPlayers]  = useState<string[] | null>(null)
  const [wlLoading,  setWlLoading]  = useState(false)
  const [wlInput,    setWlInput]    = useState('')
  const [wlBusy,     setWlBusy]     = useState<string | null>(null)
  const [wlTarget,   setWlTarget]   = useState('')

  const fetchWhitelist = async () => {
    setWlLoading(true)
    try {
      const r = await fetch('/api/minecraft/whitelist')
      const d = await r.json()
      if (d.ok) setWlPlayers(d.players ?? [])
      else addToast('error', d.error || 'Failed to fetch whitelist')
    } catch (e) {
      addToast('error', e instanceof Error ? e.message : 'Network error')
    } finally { setWlLoading(false) }
  }

  const wlAction = async (player: string, action: 'add' | 'remove') => {
    setWlBusy(player + action)
    try {
      const r = await fetch('/api/minecraft/whitelist', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ player, action }),
      })
      const d = await r.json()
      addToast(d.ok ? 'ok' : 'error', d.ok ? d.message : (d.error || 'Whitelist action failed'))
      if (d.ok) {
        if (action === 'add') { setWlPlayers(prev => prev ? [...prev, player].sort() : [player]); setWlInput(''); setWlTarget('') }
        else setWlPlayers(prev => prev ? prev.filter(p => p !== player) : null)
      }
    } catch (e) {
      addToast('error', e instanceof Error ? e.message : 'Network error')
    } finally { setWlBusy(null) }
  }

  // ── Op / Deop ─────────────────────────────────────────────────────────────────

  const [opTarget, setOpTarget] = useState('')
  const [opBusy,   setOpBusy]   = useState<'op' | 'deop' | null>(null)

  const opAction = async (action: 'op' | 'deop') => {
    if (!opTarget) return
    setOpBusy(action)
    try {
      const r = await fetch('/api/minecraft/op', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ player: opTarget, action }),
      })
      const d = await r.json()
      addToast(d.ok ? 'ok' : 'error', d.ok ? d.message : (d.error || `${action} failed`))
    } catch (e) {
      addToast('error', e instanceof Error ? e.message : 'Network error')
    } finally { setOpBusy(null) }
  }

  // ── RCON Console ──────────────────────────────────────────────────────────────

  const [rconInput,   setRconInput]   = useState('')
  const [rconBusy,    setRconBusy]    = useState(false)
  const [rconEntries, setRconEntries] = useState<RconEntry[]>([])
  const [rconHistIdx, setRconHistIdx] = useState(-1)
  const rconOutputRef = useRef<HTMLDivElement>(null)
  const rconInputRef  = useRef<HTMLInputElement>(null)

  useEffect(() => {
    try {
      const raw = localStorage.getItem(RCON_HISTORY_KEY)
      if (raw) setRconEntries(JSON.parse(raw) as RconEntry[])
    } catch {}
  }, [])

  useEffect(() => {
    try {
      localStorage.setItem(RCON_HISTORY_KEY, JSON.stringify(rconEntries.slice(-RCON_HISTORY_MAX)))
    } catch {}
  }, [rconEntries])

  useLayoutEffect(() => {
    if (rconOutputRef.current) rconOutputRef.current.scrollTop = rconOutputRef.current.scrollHeight
  }, [rconEntries])

  const sendRcon = async () => {
    const cmd = rconInput.trim()
    if (!cmd || rconBusy) return
    setRconBusy(true); setRconInput(''); setRconHistIdx(-1)
    try {
      const r = await fetch('/api/minecraft/rcon', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command: cmd }),
      })
      const d = await r.json()
      setRconEntries(prev => [...prev, { ts: Date.now(), cmd, output: d.ok ? (d.output ?? '(no output)') : (d.error ?? 'Error'), ok: d.ok }].slice(-RCON_HISTORY_MAX))
    } catch (e) {
      setRconEntries(prev => [...prev, { ts: Date.now(), cmd, output: e instanceof Error ? e.message : 'Network error', ok: false }].slice(-RCON_HISTORY_MAX))
    } finally {
      setRconBusy(false)
      setTimeout(() => rconInputRef.current?.focus(), 50)
    }
  }

  const rconKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') { e.preventDefault(); sendRcon(); return }
    const cmds = rconEntries.map(en => en.cmd)
    if (e.key === 'ArrowUp') {
      e.preventDefault()
      const idx = rconHistIdx < cmds.length - 1 ? rconHistIdx + 1 : rconHistIdx
      setRconHistIdx(idx); setRconInput(cmds[cmds.length - 1 - idx] ?? '')
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      const idx = rconHistIdx > 0 ? rconHistIdx - 1 : -1
      setRconHistIdx(idx); setRconInput(idx === -1 ? '' : (cmds[cmds.length - 1 - idx] ?? ''))
    }
  }

  // ── Audit Log ─────────────────────────────────────────────────────────────────

  const [auditEntries, setAuditEntries] = useState<AuditEntry[] | null>(null)
  const [auditLoading, setAuditLoading] = useState(false)

  const fetchAuditLog = async () => {
    setAuditLoading(true)
    try {
      const r = await fetch('/api/admin/audit?limit=100')
      const d = await r.json()
      if (d.ok) setAuditEntries(d.entries)
    } catch {} finally { setAuditLoading(false) }
  }

  // ── User Management ───────────────────────────────────────────────────────────

  const [users,        setUsers]        = useState<UserSummary[] | null>(null)
  const [usersLoading, setUsersLoading] = useState(false)
  const [newEmail,     setNewEmail]     = useState('')
  const [newPassword,  setNewPassword]  = useState('')
  const [createBusy,   setCreateBusy]   = useState(false)
  const [createStatus, setCreateStatus] = useState<{ ok: boolean; msg: string } | null>(null)
  const [userBusy,     setUserBusy]     = useState<string | null>(null)

  const fetchUsers = async () => {
    setUsersLoading(true)
    try {
      const r = await fetch('/api/admin/users')
      const d = await r.json()
      if (d.ok) setUsers(d.users)
    } catch {} finally { setUsersLoading(false) }
  }

  useEffect(() => { fetchUsers() }, [])

  const createUser = async (e: React.FormEvent) => {
    e.preventDefault()
    setCreateStatus(null); setCreateBusy(true)
    try {
      const r = await fetch('/api/admin/users', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: newEmail, password: newPassword }),
      })
      const d = await r.json()
      if (d.ok) {
        setCreateStatus({ ok: true, msg: `Account created for ${newEmail}` })
        setNewEmail(''); setNewPassword('')
        fetchUsers()
      } else {
        setCreateStatus({ ok: false, msg: d.error || 'Failed to create user' })
      }
    } catch { setCreateStatus({ ok: false, msg: 'Network error' }) }
    finally { setCreateBusy(false) }
  }

  const setRole = async (id: string, role: 'admin' | 'user') => {
    setUserBusy(id + role)
    try {
      const r = await fetch(`/api/admin/users/${id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role }),
      })
      const d = await r.json()
      if (d.ok) fetchUsers()
      else addToast('error', d.error || 'Failed')
    } catch { addToast('error', 'Network error') }
    finally { setUserBusy(null) }
  }

  const deleteUser = async (id: string, email: string) => {
    if (!confirm(`Delete account for ${email}? This cannot be undone.`)) return
    setUserBusy(id + 'del')
    try {
      const r = await fetch(`/api/admin/users/${id}`, { method: 'DELETE' })
      const d = await r.json()
      if (d.ok) { fetchUsers(); addToast('ok', `Deleted ${email}`) }
      else addToast('error', d.error || 'Failed')
    } catch { addToast('error', 'Network error') }
    finally { setUserBusy(null) }
  }

  const inputCls = 'w-full px-3 py-2 rounded-lg font-mono text-[13px] bg-[var(--panel)] border border-[var(--border)] text-[var(--text)] placeholder:text-[var(--text-dim)] focus:outline-none focus:border-[var(--accent-mid)] transition-colors'

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-4 pb-6">
      <h2 className="font-mono text-base tracking-widest text-[var(--accent)]">ADMIN</h2>

      <Toasts toasts={toasts} />

      {/* ── SERVER INFO ── */}
      <div className="glass-card p-4 space-y-4">
        <div className="flex items-center justify-between">
          <div className="text-[13px] font-mono tracking-widest text-[var(--text-dim)]">SERVER INFO</div>
          <div className="flex items-center gap-3">
            {infoLastAt && (
              <span className="text-[13px] font-mono text-[var(--text-dim)] opacity-60">
                updated {infoLastAt.toLocaleTimeString()}
              </span>
            )}
            <button onClick={() => fetchInfo(true)} disabled={infoLoading}
              className="text-[13px] font-mono text-[var(--accent)] opacity-60 hover:opacity-100 transition-opacity disabled:opacity-20">
              {infoLoading ? '…' : 'Refresh'}
            </button>
          </div>
        </div>

        {infoError && <div className="text-[13px] font-mono text-red-400">{infoError}</div>}
        {infoLoading && !info && (
          <div className="text-[13px] font-mono text-[var(--text-dim)] opacity-60 tracking-widest">Connecting…</div>
        )}
        {info && (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <StatTile label="PLAYERS ONLINE"
                value={<span><span className="text-[var(--accent)]">{info.online}</span><span className="text-[var(--text-dim)] text-[15px]"> / {info.max}</span></span>}
                sub="currently connected" />
              <StatTile label="VERSION"
                value={<span className="text-[15px] break-all">{info.version ?? <span className="opacity-40 text-[13px]">Unknown</span>}</span>}
                sub="server version" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <StatTile label="WEATHER"
                value={<span className="flex items-center gap-1.5 text-[15px]">{info.weather !== null ? <><WeatherIcon w={info.weather} /><span className="capitalize">{info.weather}</span></> : <span className="opacity-40 text-[13px]">—</span>}</span>}
                sub="current conditions" />
              <StatTile label="TIME OF DAY"
                value={<span className="flex items-center gap-1.5 text-[15px]">{info.timeOfDay !== null ? <><TimeIcon t={info.timeOfDay} />{info.timeOfDay}</> : <span className="opacity-40 text-[13px]">—</span>}</span>}
                sub="in-game time" />
            </div>
            <div className="glass-card p-4">
              <div className="text-[13px] font-mono tracking-widest text-[var(--text-dim)] mb-3">TPS</div>
              {info.tps !== null ? <TpsGauge tps={info.tps} /> : (
                <div className="text-[13px] font-mono text-[var(--text-dim)] opacity-60">Not available — vanilla servers do not expose TPS via RCON</div>
              )}
            </div>
            <div className="text-[13px] font-mono text-[var(--text-dim)] opacity-30 text-right">Auto-refreshes every 30s</div>
          </div>
        )}
      </div>

      {/* ── SERVER CONFIG ── */}
      <div className="glass-card p-4 space-y-4">
        <div className="text-[13px] font-mono tracking-widest text-[var(--text-dim)]">SERVER CONFIG</div>

        <div>
          <SectionLabel>DIFFICULTY</SectionLabel>
          <div className="grid grid-cols-4 gap-2">
            {(['peaceful', 'easy', 'normal', 'hard'] as const).map(d => {
              const colors: Record<string, string> = { peaceful: '#4ade80', easy: '#60a5fa', normal: '#f59e0b', hard: '#f87171' }
              const active = difficulty === d
              return (
                <button key={d} onClick={() => setDifficultyCmd(d)} disabled={!!difficultyBusy}
                  className="py-2 rounded-lg font-mono text-[13px] tracking-widest border transition-all disabled:opacity-40"
                  style={active ? { borderColor: colors[d], background: colors[d] + '20', color: colors[d] }
                    : { borderColor: 'var(--border)', color: 'var(--text-dim)' }}>
                  {difficultyBusy === d ? '…' : d.toUpperCase()}
                </button>
              )
            })}
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <SectionLabel>GAMERULES</SectionLabel>
            <button onClick={fetchGamerules} disabled={gamerulesLoading}
              className="text-[13px] font-mono text-[var(--accent)] opacity-60 hover:opacity-100 transition-opacity">
              {gamerulesLoading ? '…' : gamerules === null ? 'Load' : 'Refresh'}
            </button>
          </div>
          {gamerules === null ? (
            <div className="text-[13px] font-mono text-[var(--text-dim)] opacity-60">Click Load to fetch gamerules from the server</div>
          ) : (
            <div className="space-y-1.5">
              {(['keepInventory', 'mobGriefing', 'pvp', 'doDaylightCycle', 'doWeatherCycle', 'doFireTick', 'doMobSpawning', 'naturalRegeneration'] as const).map(rule => {
                const val = gamerules[rule]
                const isOn = val === 'true'
                const busy = grBusy === rule
                const labels: Record<string, string> = {
                  keepInventory: 'Keep Inventory', mobGriefing: 'Mob Griefing', pvp: 'PvP',
                  doDaylightCycle: 'Daylight Cycle', doWeatherCycle: 'Weather Cycle',
                  doFireTick: 'Fire Tick', doMobSpawning: 'Mob Spawning', naturalRegeneration: 'Natural Regen',
                }
                return (
                  <div key={rule} className="flex items-center justify-between px-3 py-2 rounded-lg bg-[var(--panel)] border border-[var(--border)]">
                    <span className="text-[13px] font-mono text-[var(--text)]">{labels[rule] ?? rule}</span>
                    <button onClick={() => val !== undefined && toggleGamerule(rule, val)} disabled={busy || val === undefined}
                      className={`text-[13px] font-mono px-3 py-1 rounded border transition-all disabled:opacity-40 ${
                        isOn ? 'border-[var(--accent-mid)] text-[var(--accent)] bg-[var(--accent-dim)]' : 'border-[var(--border)] text-[var(--text-dim)]'
                      }`}>
                      {busy ? '…' : val === undefined ? '?' : isOn ? 'ON' : 'OFF'}
                    </button>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        <div>
          <SectionLabel>SERVER CONTROLS</SectionLabel>
          <div className="grid grid-cols-2 gap-2">
            <button onClick={async () => {
              const r = await fetch('/api/minecraft/server-ctrl', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ command: 'save-all' }) })
              const d = await r.json()
              addToast(d.ok ? 'ok' : 'error', d.ok ? 'World saved' : (d.error || 'Save failed'))
            }} className="py-2.5 rounded-lg font-mono text-[13px] tracking-widest border border-[var(--border)] text-[var(--text-dim)] hover:border-[var(--accent-mid)] transition-all">
              <span className="flex items-center justify-center gap-1.5"><Save size={13} strokeWidth={1.5} />Save World</span>
            </button>
            <button onClick={async () => {
              if (!confirm('Stop the server? This will kick all players and shut down Minecraft.')) return
              const r = await fetch('/api/minecraft/server-ctrl', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ command: 'stop' }) })
              const d = await r.json()
              addToast(d.ok ? 'ok' : 'error', d.ok ? 'Server stopping…' : (d.error || 'Stop failed'))
            }} className="py-2.5 rounded-lg font-mono text-[13px] tracking-widest border border-red-900 text-red-400 hover:border-red-700 transition-all">
              <span className="flex items-center justify-center gap-1.5"><Square size={13} strokeWidth={1.5} />Stop Server</span>
            </button>
          </div>
        </div>
      </div>

      {/* ── MODERATION ── */}
      <div className="glass-card p-4 space-y-4">
        <div className="text-[13px] font-mono tracking-widest text-[var(--text-dim)]">MODERATION</div>

        <div>
          <SectionLabel>TARGET PLAYER</SectionLabel>
          <PlayerPicker online={players} selected={modTarget} onSelect={setModTarget} placeholder="Or type player name…" />
        </div>

        <div>
          <SectionLabel>REASON (OPTIONAL)</SectionLabel>
          <input type="text" placeholder="e.g. Breaking rules" value={modReason} onChange={e => setModReason(e.target.value)}
            className="w-full bg-[var(--panel)] border border-[var(--border)] rounded-lg px-3 py-2 text-[15px] font-mono text-[var(--text)] placeholder:text-[var(--text-dim)] focus:outline-none focus:border-[var(--accent-mid)]"
            style={{ fontSize: '16px' }} />
        </div>

        <div className="flex items-center gap-2">
          <input type="checkbox" id="mod-ban-ip" checked={modBanIp} onChange={e => setModBanIp(e.target.checked)} className="accent-[var(--accent)]" />
          <label htmlFor="mod-ban-ip" className="text-[13px] font-mono text-[var(--text-dim)] cursor-pointer">Also ban IP address</label>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <button onClick={kickPlayer} disabled={!modTarget || !!modBusy}
            className="py-2.5 rounded-lg font-mono text-[13px] tracking-widest transition-all disabled:opacity-40 disabled:cursor-not-allowed border border-yellow-800 text-yellow-400 hover:border-yellow-600">
            {modBusy === 'kick' ? 'Kicking…' : 'Kick'}
          </button>
          <button onClick={banPlayer} disabled={!modTarget || !!modBusy}
            className="py-2.5 rounded-lg font-mono text-[13px] tracking-widest transition-all disabled:opacity-40 disabled:cursor-not-allowed border border-red-900 text-red-400 hover:border-red-700">
            {modBusy === 'ban' ? 'Banning…' : 'Ban'}
          </button>
        </div>

        <div className="border-t border-[var(--border)] pt-3 space-y-3">
          <SectionLabel>PARDON (UNBAN)</SectionLabel>
          <div className="flex items-center gap-2">
            <input type="checkbox" id="mod-pardon-ip" checked={modPardonIp} onChange={e => setModPardonIp(e.target.checked)} className="accent-[var(--accent)]" />
            <label htmlFor="mod-pardon-ip" className="text-[13px] font-mono text-[var(--text-dim)] cursor-pointer">Also pardon IP address</label>
          </div>
          <button onClick={pardonPlayer} disabled={!modTarget || !!modBusy}
            className="w-full py-2.5 rounded-lg font-mono text-[13px] tracking-widest transition-all disabled:opacity-40 disabled:cursor-not-allowed border border-[var(--border)] text-[var(--text-dim)] hover:border-[var(--accent-mid)] hover:text-[var(--accent)]">
            {modBusy === 'pardon' ? 'Pardoning…' : 'Pardon'}
          </button>
        </div>

        <div className="border-t border-[var(--border)] pt-3 space-y-3">
          <div className="flex items-center justify-between">
            <SectionLabel>BAN LIST</SectionLabel>
            <button onClick={fetchBanList} disabled={banListLoading}
              className="text-[13px] font-mono text-[var(--accent)] opacity-60 hover:opacity-100 transition-opacity">
              {banListLoading ? '…' : banList === null ? 'Load' : 'Refresh'}
            </button>
          </div>
          {banList === null ? (
            <div className="text-[13px] font-mono text-[var(--text-dim)] opacity-60">Click Load to fetch the ban list</div>
          ) : banList.length === 0 ? (
            <div className="text-[13px] font-mono text-[var(--text-dim)] opacity-60">No players are banned — everyone behaved</div>
          ) : (
            <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto">
              {banList.map(p => (
                <div key={p} className="flex items-center gap-1 px-2 py-1 rounded border border-red-900/50 bg-red-950/20">
                  <span className="text-[13px] font-mono text-red-300">{p}</span>
                  <button onClick={() => { setModTarget(p); setModPardonIp(false) }}
                    className="text-[13px] font-mono text-[var(--text-dim)] hover:text-[var(--accent)] ml-1 transition-colors" title="Set as pardon target">↑</button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── WHITELIST ── */}
      <div className="glass-card p-4 space-y-4">
        <div className="flex items-center justify-between">
          <div className="text-[13px] font-mono tracking-widest text-[var(--text-dim)]">WHITELIST</div>
          <button onClick={fetchWhitelist} disabled={wlLoading}
            className="text-[13px] font-mono text-[var(--accent)] opacity-60 hover:opacity-100 transition-opacity">
            {wlLoading ? '…' : wlPlayers === null ? 'Load' : 'Refresh'}
          </button>
        </div>
        {wlPlayers === null ? (
          <div className="text-[13px] font-mono text-[var(--text-dim)] opacity-60">Click Load to fetch the whitelist</div>
        ) : (
          <div className="space-y-3">
            <div>
              <div className="flex items-center justify-between mb-2">
                <SectionLabel>CURRENT ENTRIES ({wlPlayers.length})</SectionLabel>
              </div>
              {wlPlayers.length === 0 ? (
                <div className="text-[13px] font-mono text-[var(--text-dim)] opacity-60">Whitelist is empty — no one's on the list</div>
              ) : (
                <div className="flex flex-wrap gap-1.5 max-h-40 overflow-y-auto">
                  {wlPlayers.map(p => (
                    <div key={p} className="flex items-center gap-1 px-2 py-1 rounded border border-[var(--border)] bg-[var(--panel)]">
                      <span className="text-[13px] font-mono text-[var(--text)]">{p}</span>
                      <button onClick={() => wlAction(p, 'remove')} disabled={wlBusy === p + 'remove'}
                        className="text-[13px] font-mono text-red-400 opacity-60 hover:opacity-100 ml-1 disabled:opacity-20" title="Remove from whitelist">✕</button>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div>
              <SectionLabel>ADD PLAYER</SectionLabel>
              <PlayerPicker online={players} selected={wlTarget} onSelect={setWlTarget} placeholder="Or type player name…" />
              <button onClick={() => { const p = wlTarget.trim(); if (p) wlAction(p, 'add') }}
                disabled={!wlTarget.trim() || !!wlBusy}
                className="mt-2 w-full px-4 py-2 rounded-lg font-mono text-[13px] tracking-widest border border-[var(--border)] text-[var(--accent)] hover:border-[var(--accent-mid)] transition-all disabled:opacity-40 disabled:cursor-not-allowed">
                {wlBusy?.endsWith('add') ? '…' : 'Add to Whitelist'}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── OPERATOR ── */}
      <div className="glass-card p-4 space-y-4">
        <div className="text-[13px] font-mono tracking-widest text-[var(--text-dim)]">OPERATOR</div>
        <div>
          <SectionLabel>SELECT PLAYER</SectionLabel>
          <PlayerPicker online={players} selected={opTarget} onSelect={setOpTarget} placeholder="Or type player name…" />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <button onClick={() => opAction('op')} disabled={!opTarget || !!opBusy}
            className="py-2.5 rounded-lg font-mono text-[13px] tracking-widest transition-all disabled:opacity-40 disabled:cursor-not-allowed border border-[var(--border)] text-[var(--text-dim)] hover:border-[var(--accent-mid)]">
            {opBusy === 'op' ? '…' : <span className="flex items-center justify-center gap-1.5"><Star size={13} strokeWidth={1.5} />Op</span>}
          </button>
          <button onClick={() => opAction('deop')} disabled={!opTarget || !!opBusy}
            className="py-2.5 rounded-lg font-mono text-[13px] tracking-widest transition-all disabled:opacity-40 disabled:cursor-not-allowed border border-[var(--border)] text-[var(--text-dim)] hover:border-[var(--accent-mid)] hover:text-[var(--accent)]">
            {opBusy === 'deop' ? '…' : <span className="flex items-center justify-center gap-1.5"><X size={13} strokeWidth={1.5} />Deop</span>}
          </button>
        </div>
      </div>

      {/* ── RCON CONSOLE ── */}
      <div className="glass-card p-4 space-y-3">
        <div className="text-[13px] font-mono tracking-widest text-[var(--text-dim)]">RCON CONSOLE</div>
        <div ref={rconOutputRef} className="bg-black/40 rounded-lg border border-[var(--border)] p-3 h-48 overflow-y-auto font-mono text-[13px] space-y-2">
          {rconEntries.length === 0 ? (
            <div className="text-[var(--text-dim)] opacity-30">Awaiting orders, operator…</div>
          ) : rconEntries.map((en, i) => (
            <div key={i} className="space-y-0.5">
              <div className="flex items-center gap-2">
                <span className="text-[var(--text-dim)] opacity-60 text-[13px] shrink-0">{new Date(en.ts).toLocaleTimeString()}</span>
                <span className="text-[var(--accent)]">{'>'} {en.cmd}</span>
              </div>
              <div className={`pl-4 text-[13px] ${en.ok ? 'text-[var(--text-dim)]' : 'text-red-400'}`}>{en.output}</div>
            </div>
          ))}
        </div>
        <div className="flex gap-2">
          <input ref={rconInputRef} type="text" placeholder="Enter command…" value={rconInput}
            onChange={e => setRconInput(e.target.value)} onKeyDown={rconKeyDown}
            className="flex-1 bg-[var(--panel)] border border-[var(--border)] rounded-lg px-3 py-2 text-[15px] font-mono text-[var(--text)] placeholder:text-[var(--text-dim)] focus:outline-none focus:border-[var(--accent-mid)]"
            style={{ fontSize: '16px' }} />
          <button onClick={sendRcon} disabled={!rconInput.trim() || rconBusy}
            className="px-4 py-2 rounded-lg font-mono text-[13px] tracking-widest border border-[var(--border)] text-[var(--accent)] hover:border-[var(--accent-mid)] transition-all disabled:opacity-40 disabled:cursor-not-allowed">
            {rconBusy ? '…' : 'Run'}
          </button>
        </div>
        <div className="text-[13px] font-mono text-[var(--text-dim)] opacity-30">↑↓ to navigate history · Enter to send</div>
      </div>

      {/* ── AUDIT LOG ── */}
      <div className="glass-card p-4 space-y-4">
        <div className="flex items-center justify-between">
          <div className="text-[13px] font-mono tracking-widest text-[var(--text-dim)]">AUDIT LOG</div>
          <button onClick={fetchAuditLog} disabled={auditLoading}
            className="text-[13px] font-mono text-[var(--accent)] opacity-60 hover:opacity-100 transition-opacity">
            {auditLoading ? '…' : auditEntries === null ? 'Load' : 'Refresh'}
          </button>
        </div>
        {auditEntries === null ? (
          <div className="text-[13px] font-mono text-[var(--text-dim)] opacity-60">Click Load to fetch the audit log</div>
        ) : auditEntries.length === 0 ? (
          <div className="text-[13px] font-mono text-[var(--text-dim)] opacity-60">No actions logged yet — squeaky clean</div>
        ) : (
          <div className="space-y-1 max-h-64 overflow-y-auto">
            {auditEntries.map((e: AuditEntry) => (
              <div key={e.id} className="flex items-start gap-2 px-2 py-1.5 rounded bg-[var(--panel)] border border-[var(--border)]">
                <span className="text-[13px] font-mono text-[var(--text-dim)] shrink-0 mt-0.5 w-16">{new Date(e.ts * 1000).toLocaleTimeString()}</span>
                <span className="text-[13px] font-mono text-[var(--accent)] shrink-0 w-20">{e.action}</span>
                <span className="text-[13px] font-mono text-[var(--text-dim)] shrink-0 w-20 truncate" title={e.user_id}>{e.user_id}</span>
                {e.target && <span className="text-[13px] font-mono text-[var(--text)] shrink-0">{e.target}</span>}
                {e.detail && <span className="text-[13px] font-mono text-[var(--text-dim)] truncate opacity-60">{e.detail}</span>}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── USER MANAGEMENT ── */}
      <div className="glass-card p-4 space-y-4">
        <div className="flex items-center justify-between">
          <div className="text-[13px] font-mono tracking-widest text-[var(--text-dim)]">USER MANAGEMENT</div>
          <button onClick={fetchUsers} disabled={usersLoading}
            className="text-[13px] font-mono text-[var(--accent)] opacity-60 hover:opacity-100 transition-opacity">
            {usersLoading ? '…' : 'Refresh'}
          </button>
        </div>

        {users && users.length > 0 && (
          <div className="space-y-1.5">
            {users.map(u => (
              <div key={u.id} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[var(--panel)] border border-[var(--border)]">
                <div className="flex-1 min-w-0">
                  <div className="text-[13px] font-mono text-[var(--text)] truncate">{u.email}</div>
                  <div className="text-[13px] font-mono text-[var(--text-dim)] opacity-60">
                    {new Date(u.created_at * 1000).toLocaleDateString()}
                  </div>
                </div>
                <span className={`text-[13px] font-mono px-2 py-0.5 rounded border shrink-0 ${
                  u.role === 'admin'
                    ? 'border-[var(--accent-mid)] text-[var(--accent)] bg-[var(--accent-dim)]'
                    : 'border-[var(--border)] text-[var(--text-dim)]'
                }`}>{u.role.toUpperCase()}</span>
                <button
                  onClick={() => setRole(u.id, u.role === 'admin' ? 'user' : 'admin')}
                  disabled={userBusy === u.id + (u.role === 'admin' ? 'user' : 'admin')}
                  className="text-[13px] font-mono px-2 py-1 rounded border border-[var(--border)] text-[var(--text-dim)] hover:border-[var(--accent-mid)] hover:text-[var(--accent)] transition-all disabled:opacity-40 shrink-0"
                  title={u.role === 'admin' ? 'Demote to user' : 'Promote to admin'}>
                  {u.role === 'admin' ? '↓' : '↑'}
                </button>
                <button
                  onClick={() => deleteUser(u.id, u.email)}
                  disabled={!!userBusy}
                  className="text-[13px] font-mono px-2 py-1 rounded border border-red-900/50 text-red-400 hover:border-red-700 transition-all disabled:opacity-40 shrink-0">
                  ✕
                </button>
              </div>
            ))}
          </div>
        )}

        <div>
          <SectionLabel>CREATE USER</SectionLabel>
          <form onSubmit={createUser} className="space-y-2">
            <input type="email" placeholder="Email address" value={newEmail} onChange={e => setNewEmail(e.target.value)}
              className={inputCls} required autoComplete="off" />
            <input type="password" placeholder="Temporary password (min 8 chars)" value={newPassword} onChange={e => setNewPassword(e.target.value)}
              className={inputCls} required autoComplete="new-password" />
            <button type="submit" disabled={createBusy}
              className="w-full py-2 rounded-lg font-mono text-[13px] tracking-widest border border-[var(--accent-mid)] text-[var(--accent)] bg-[var(--accent-dim)] hover:opacity-90 transition-all disabled:opacity-40 disabled:cursor-not-allowed">
              {createBusy ? 'Creating…' : 'Create User Account'}
            </button>
            {createStatus && (
              <div className={`text-[13px] font-mono px-3 py-2 rounded-lg border ${
                createStatus.ok
                  ? 'border-[var(--accent-mid)] text-[var(--accent)] bg-[var(--accent-dim)]'
                  : 'border-red-800 text-red-400 bg-red-950/30'
              }`}>{createStatus.msg}</div>
            )}
          </form>
        </div>
      </div>
    </div>
  )
}
