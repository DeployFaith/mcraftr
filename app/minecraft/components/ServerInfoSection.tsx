'use client'
import { useState, useEffect, useCallback } from 'react'

// ── Types ─────────────────────────────────────────────────────────────────────

type ServerInfo = {
  online: number
  max: number
  version: string | null
  tps: number | null
}

// ── TPS gauge ─────────────────────────────────────────────────────────────────

function TpsGauge({ tps }: { tps: number }) {
  const pct   = Math.round((tps / 20) * 100)
  const color = tps >= 18 ? '#4ade80' : tps >= 15 ? '#fb923c' : '#f87171'
  const label = tps >= 18 ? 'Good' : tps >= 15 ? 'Lag' : 'Bad'

  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between">
        <span className="font-mono text-2xl font-bold" style={{ color }}>{tps.toFixed(2)}</span>
        <span className="text-[9px] font-mono tracking-widest" style={{ color }}>{label}</span>
      </div>
      <div className="h-1.5 rounded-full bg-[var(--panel)] overflow-hidden border border-[var(--border)]">
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{ width: `${pct}%`, background: color }}
        />
      </div>
      <div className="text-[9px] font-mono text-[var(--text-dim)] opacity-50">ticks/sec (max 20)</div>
    </div>
  )
}

// ── Stat tile ─────────────────────────────────────────────────────────────────

function StatTile({ label, value, sub }: { label: string; value: React.ReactNode; sub?: string }) {
  return (
    <div className="glass-card p-4 space-y-1">
      <div className="text-[9px] font-mono tracking-widest text-[var(--text-dim)]">{label}</div>
      <div className="font-mono text-lg text-[var(--text)]">{value}</div>
      {sub && <div className="text-[9px] font-mono text-[var(--text-dim)] opacity-50">{sub}</div>}
    </div>
  )
}

// ── Main component ─────────────────────────────────────────────────────────────

const POLL_MS = 30_000

export default function ServerInfoSection() {
  const [info,    setInfo]    = useState<ServerInfo | null>(null)
  const [error,   setError]   = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [lastAt,  setLastAt]  = useState<Date | null>(null)

  const fetch_ = useCallback(async (showSpinner = false) => {
    if (showSpinner) setLoading(true)
    setError(null)
    try {
      const r = await fetch('/api/minecraft/server-info')
      const d = await r.json()
      if (d.ok) {
        setInfo(d as ServerInfo)
        setLastAt(new Date())
      } else {
        setError(d.error || 'Failed to fetch server info')
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Network error')
    } finally {
      setLoading(false)
    }
  }, [])

  // Initial load + polling
  useEffect(() => {
    fetch_(true)
    const id = setInterval(() => fetch_(false), POLL_MS)
    return () => clearInterval(id)
  }, [fetch_])

  return (
    <div className="space-y-4 pb-6">
      <div className="flex items-center justify-between">
        <h2 className="font-mono text-base tracking-widest text-[var(--accent)]">// SERVER</h2>
        <div className="flex items-center gap-3">
          {lastAt && (
            <span className="text-[9px] font-mono text-[var(--text-dim)] opacity-40">
              updated {lastAt.toLocaleTimeString()}
            </span>
          )}
          <button
            onClick={() => fetch_(true)}
            disabled={loading}
            className="text-[9px] font-mono text-[var(--accent)] opacity-60 hover:opacity-100 transition-opacity disabled:opacity-20"
          >
            {loading ? '…' : 'Refresh'}
          </button>
        </div>
      </div>

      {error && (
        <div className="glass-card p-4 text-xs font-mono text-red-400 border border-red-900/50">
          {error}
        </div>
      )}

      {loading && !info && (
        <div className="glass-card p-6 text-center text-[10px] font-mono text-[var(--text-dim)] opacity-40 tracking-widest">
          Connecting…
        </div>
      )}

      {info && (
        <>
          {/* Players + Version row */}
          <div className="grid grid-cols-2 gap-3">
            <StatTile
              label="PLAYERS ONLINE"
              value={
                <span>
                  <span className="text-[var(--accent)]">{info.online}</span>
                  <span className="text-[var(--text-dim)] text-sm"> / {info.max}</span>
                </span>
              }
              sub="currently connected"
            />
            <StatTile
              label="VERSION"
              value={
                <span className="text-sm break-all">
                  {info.version ?? <span className="opacity-40 text-xs">Unknown</span>}
                </span>
              }
              sub="server version"
            />
          </div>

          {/* TPS */}
          <div className="glass-card p-4">
            <div className="text-[9px] font-mono tracking-widest text-[var(--text-dim)] mb-3">TPS</div>
            {info.tps !== null ? (
              <TpsGauge tps={info.tps} />
            ) : (
              <div className="text-[10px] font-mono text-[var(--text-dim)] opacity-40">
                Not available — vanilla servers do not expose TPS via RCON
              </div>
            )}
          </div>

          {/* Poll cadence note */}
          <div className="text-[9px] font-mono text-[var(--text-dim)] opacity-30 text-right">
            Auto-refreshes every 30s
          </div>
        </>
      )}
    </div>
  )
}
