'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import type { AuditEntry } from '@/lib/audit'
import { Check, X, HelpCircle } from 'lucide-react'

// Utility for relative timestamps
function formatRelativeTime(ts: number): string {
  const now = Date.now()
  const diff = Math.floor((now - ts * 1000) / 1000)
  if (diff < 60) return 'just now'
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return `${Math.floor(diff / 86400)}d ago`
}

type DashboardData = {
  ok: boolean
  server: {
    id: string
    label: string | null
    host: string
    port: number
    stackMode: 'quick' | 'full'
    stackLabel: string
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
    bridgeError?: string | null
  }
  recentChat: Array<{ id: number; type: string; player: string | null; message: string; ts: number }>
  recentAudit: AuditEntry[]
  stack?: {
    mode: 'quick' | 'full'
    modeLabel: string
    modeDescription: string
    upgradeRecommended: boolean
    bridgeOk: boolean
    bridgeError?: string | null
    sidecarOk: boolean
    sidecarError?: string | null
    worldCount: number
    mapCount: number
  }
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
  const Icon = active ? Check : neutral ? HelpCircle : X
  return (
    <div
      className="rounded-lg border px-3 py-2"
      style={neutral
        ? { borderColor: 'var(--border)', color: 'var(--text-dim)' }
        : active
          ? { borderColor: 'var(--accent-mid)', background: 'var(--accent-dim)', color: 'var(--accent)' }
          : { borderColor: 'var(--border)', color: 'var(--text)' }}
    >
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-mono tracking-widest opacity-70">{label}</span>
        <span style={{ opacity: 0.7 }}>
          <Icon size={14} strokeWidth={2} />
        </span>
      </div>
      <div className="text-[13px] font-mono mt-1">
        {value === null ? '—' : typeof value === 'number' ? value : value === 'true' ? 'ON' : value === 'false' ? 'OFF' : value}
      </div>
    </div>
  )
}

export default function DashboardSection({ onNavigate }: { onNavigate: (tab: 'players' | 'actions' | 'worlds' | 'admin' | 'chat' | 'settings') => void }) {
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
            {data.server.stackMode === 'full' && data.rules.bridgeError && (
              <div className="rounded-lg border border-red-900 bg-red-950/30 px-3 py-2 text-[12px] font-mono text-red-300">
                Bridge unavailable: {data.rules.bridgeError}
              </div>
            )}
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
                        {entry.player ? `${entry.player} · ` : ''}{formatRelativeTime(entry.ts)}
                      </div>
                      <div className="text-[13px] font-mono text-[var(--text)] mt-1 break-words">{entry.message}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="space-y-4">
              {data.stack && (
                <div className="glass-card p-4 space-y-3">
                  <div className="text-[13px] font-mono tracking-widest text-[var(--text-dim)]">SERVER SURFACE</div>
                  {data.stack.upgradeRecommended && (
                    <div className="rounded-2xl border px-4 py-4" style={{ borderColor: 'var(--accent-mid)', background: 'color-mix(in srgb, var(--accent) 10%, transparent)' }}>
                      <div className="text-[12px] font-mono tracking-[0.16em] text-[var(--accent)]">QUICK CONNECT ACTIVE</div>
                      <div className="mt-2 text-[12px] font-mono text-[var(--text-dim)]">
                        {data.stack.modeDescription}
                      </div>
                      <div className="mt-2 text-[12px] font-mono text-[var(--text-dim)]">
                        Upgrade this server to the Full Mcraftr Stack to unlock Worlds, structures, entities, maps, and version-aware catalog surfaces.
                      </div>
                      <Link
                        href="/connect?edit=1"
                        className="mt-3 inline-flex rounded-xl border px-3 py-2 text-[11px] font-mono tracking-[0.12em]"
                        style={{ borderColor: 'var(--accent-mid)', background: 'var(--accent-dim)', color: 'var(--accent)' }}
                      >
                        OPEN STACK SETUP
                      </Link>
                    </div>
                  )}
                  {!data.stack.upgradeRecommended && (data.stack.bridgeError || data.stack.sidecarError) && (
                    <div className="rounded-lg border border-[var(--border)] bg-[var(--panel)] px-3 py-2 text-[12px] font-mono text-[var(--text-dim)]">
                      {data.stack.bridgeError ? `Bridge: ${data.stack.bridgeError}` : `Beacon: ${data.stack.sidecarError}`}
                    </div>
                  )}
                  <div className="grid gap-2 sm:grid-cols-2">
                    <RulePill label="Bridge" value={data.stack.bridgeOk ? 'true' : 'false'} />
                    <RulePill label="Beacon" value={data.stack.sidecarOk ? 'true' : 'false'} />
                    <RulePill label="Worlds" value={data.stack.worldCount} />
                    <RulePill label="Maps" value={data.stack.mapCount} />
                  </div>
                </div>
              )}

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
                          {entry.target ? `${entry.target} · ` : ''}{formatRelativeTime(entry.ts)}
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
