'use client'

import { useCallback, useEffect, useState } from 'react'
import type { AuditEntry } from '@/lib/audit'

type DashboardData = {
  ok: boolean
  server: {
    id: string
    label: string | null
    host: string
    port: number
  }
  overview: {
    online: number
    max: number
    players: string[]
    version: string | null
    tps: number | null
    weather: string | null
    timeOfDay: string | null
    difficulty: string | null
  }
  rules: {
    keepInventory: string | null
    mobGriefing: string | null
    pvp: string | null
    whitelistCount: number | null
  }
  recentChat: Array<{ id: number; type: string; player: string | null; message: string; ts: number }>
  recentAudit: AuditEntry[]
}

function SummaryCard({ label, value, sub }: { label: string; value: React.ReactNode; sub?: React.ReactNode }) {
  return (
    <div className="glass-card p-4 space-y-1">
      <div className="text-[11px] font-mono tracking-widest text-[var(--text-dim)]">{label}</div>
      <div className="text-[18px] font-mono text-[var(--text)]">{value}</div>
      {sub && <div className="text-[12px] font-mono text-[var(--text-dim)]">{sub}</div>}
    </div>
  )
}

function RulePill({ label, value }: { label: string; value: string | number | null }) {
  const active = value === 'true' || value === 'on'
  const neutral = value === null
  return (
    <div
      className="rounded-lg border px-3 py-2"
      style={neutral
        ? { borderColor: 'var(--border)', color: 'var(--text-dim)' }
        : active
          ? { borderColor: 'var(--accent-mid)', background: 'var(--accent-dim)', color: 'var(--accent)' }
          : { borderColor: 'var(--border)', color: 'var(--text)' }}
    >
      <div className="text-[11px] font-mono tracking-widest opacity-70">{label}</div>
      <div className="text-[13px] font-mono mt-1">
        {value === null ? '—' : typeof value === 'number' ? value : value === 'true' ? 'ON' : value === 'false' ? 'OFF' : value}
      </div>
    </div>
  )
}

export default function DashboardSection({ onNavigate }: { onNavigate: (tab: 'players' | 'actions' | 'admin' | 'chat' | 'settings') => void }) {
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async (showSpinner = false) => {
    if (showSpinner) setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/minecraft/dashboard')
      const next = await res.json()
      if (!next.ok) throw new Error(next.error || 'Failed to load dashboard')
      setData(next)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load dashboard')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load(true)
    const id = setInterval(() => void load(false), 30_000)
    return () => clearInterval(id)
  }, [load])

  return (
    <div className="space-y-4 pb-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="font-mono text-base tracking-widest text-[var(--accent)]">DASHBOARD</h2>
          <div className="text-[12px] font-mono text-[var(--text-dim)] mt-1">
            {data?.server.label?.trim() || (data ? `${data.server.host}:${data.server.port}` : 'Loading active server…')}
          </div>
        </div>
        <button
          onClick={() => void load(true)}
          className="rounded border border-[var(--border)] px-3 py-2 text-[12px] font-mono text-[var(--text-dim)] hover:border-[var(--accent-mid)]"
        >
          Refresh
        </button>
      </div>

      {error && (
        <div className="glass-card p-4 text-[13px] font-mono text-red-400">
          {error}
        </div>
      )}

      {loading && !data ? (
        <div className="glass-card p-4 text-[13px] font-mono text-[var(--text-dim)]">Loading dashboard…</div>
      ) : data && (
        <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <SummaryCard label="PLAYERS" value={`${data.overview.online} / ${data.overview.max}`} sub={data.overview.players.length > 0 ? data.overview.players.join(', ') : 'No one online'} />
            <SummaryCard label="TPS" value={data.overview.tps !== null ? data.overview.tps.toFixed(2) : '—'} sub={data.overview.version ? `Paper ${data.overview.version}` : 'Version unavailable'} />
            <SummaryCard label="WORLD" value={data.overview.timeOfDay ?? '—'} sub={data.overview.weather ? `${data.overview.weather} weather` : 'Weather unavailable'} />
            <SummaryCard label="DIFFICULTY" value={data.overview.difficulty?.toUpperCase() ?? '—'} sub={`Whitelist ${data.rules.whitelistCount ?? '—'}`} />
          </div>

          <div className="glass-card p-4 space-y-3">
            <div className="text-[13px] font-mono tracking-widest text-[var(--text-dim)]">SAFE SERVER SETTINGS SNAPSHOT</div>
            <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
              <RulePill label="Keep Inventory" value={data.rules.keepInventory} />
              <RulePill label="Mob Griefing" value={data.rules.mobGriefing} />
              <RulePill label="PvP" value={data.rules.pvp} />
              <RulePill label="Whitelist Entries" value={data.rules.whitelistCount} />
            </div>
          </div>

          <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
            <div className="glass-card p-4 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div className="text-[13px] font-mono tracking-widest text-[var(--text-dim)]">RECENT CHAT</div>
                <button onClick={() => onNavigate('chat')} className="text-[12px] font-mono text-[var(--accent)]">Open Chat</button>
              </div>
              {data.recentChat.length === 0 ? (
                <div className="text-[13px] font-mono text-[var(--text-dim)]">No recent chat saved for this server.</div>
              ) : (
                <div className="space-y-2">
                  {data.recentChat.map(entry => (
                    <div key={entry.id} className="rounded-lg border border-[var(--border)] bg-[var(--panel)] px-3 py-2">
                      <div className="text-[11px] font-mono text-[var(--text-dim)]">
                        {entry.player ? `${entry.player} · ` : ''}{new Date(entry.ts * 1000).toLocaleTimeString()}
                      </div>
                      <div className="text-[13px] font-mono text-[var(--text)] mt-1 break-words">{entry.message}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="space-y-4">
              <div className="glass-card p-4 space-y-3">
                <div className="text-[13px] font-mono tracking-widest text-[var(--text-dim)]">QUICK JUMPS</div>
                <div className="grid gap-2 sm:grid-cols-2">
                  <button onClick={() => onNavigate('players')} className="rounded-lg border border-[var(--border)] px-3 py-2 text-[13px] font-mono text-[var(--text-dim)] hover:border-[var(--accent-mid)]">Players</button>
                  <button onClick={() => onNavigate('actions')} className="rounded-lg border border-[var(--border)] px-3 py-2 text-[13px] font-mono text-[var(--text-dim)] hover:border-[var(--accent-mid)]">Actions</button>
                  <button onClick={() => onNavigate('admin')} className="rounded-lg border border-[var(--border)] px-3 py-2 text-[13px] font-mono text-[var(--text-dim)] hover:border-[var(--accent-mid)]">Admin</button>
                  <button onClick={() => onNavigate('settings')} className="rounded-lg border border-[var(--border)] px-3 py-2 text-[13px] font-mono text-[var(--text-dim)] hover:border-[var(--accent-mid)]">Settings</button>
                </div>
              </div>

              <div className="glass-card p-4 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="text-[13px] font-mono tracking-widest text-[var(--text-dim)]">RECENT AUDIT</div>
                  <button onClick={() => onNavigate('admin')} className="text-[12px] font-mono text-[var(--accent)]">Open Admin</button>
                </div>
                {data.recentAudit.length === 0 ? (
                  <div className="text-[13px] font-mono text-[var(--text-dim)]">No recent admin actions on this server.</div>
                ) : (
                  <div className="space-y-2">
                    {data.recentAudit.map(entry => (
                      <div key={entry.id} className="rounded-lg border border-[var(--border)] bg-[var(--panel)] px-3 py-2">
                        <div className="text-[11px] font-mono text-[var(--accent)]">{entry.action}</div>
                        <div className="text-[12px] font-mono text-[var(--text-dim)] mt-1">
                          {entry.target ? `${entry.target} · ` : ''}{new Date(entry.ts * 1000).toLocaleTimeString()}
                        </div>
                        {entry.detail && <div className="text-[12px] font-mono text-[var(--text)] mt-1 break-words">{entry.detail}</div>}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
