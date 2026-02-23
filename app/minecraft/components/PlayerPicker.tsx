'use client'
import { useState, useEffect } from 'react'

export type DirectoryPlayer = { player_name: string; last_seen: number }

type Filter = '7d' | '30d' | 'all'

type Props = {
  online: string[]
  selected: string
  onSelect: (name: string) => void
  placeholder?: string
}

export default function PlayerPicker({ online, selected, onSelect, placeholder = 'Or type player name…' }: Props) {
  const [directory, setDirectory] = useState<DirectoryPlayer[]>([])
  const [filter, setFilter]       = useState<Filter>('30d')
  const [loading, setLoading]     = useState(false)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    fetch(`/api/admin/players?filter=${filter}`)
      .then(r => r.json())
      .then(d => { if (!cancelled && d.ok) setDirectory(d.players ?? []) })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [filter])

  const onlineSet = new Set(online)
  const recent = directory.filter(p => !onlineSet.has(p.player_name))

  const chip = (name: string, dot?: 'green') => (
    <button
      key={name}
      onClick={() => onSelect(selected === name ? '' : name)}
      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono border transition-all ${
        selected === name
          ? 'border-[var(--accent)] bg-[var(--accent-dim)] text-[var(--accent)]'
          : 'border-[var(--border)] text-[var(--text-dim)] hover:border-[var(--accent-mid)]'
      }`}
    >
      {dot && <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: 'var(--accent)' }} />}
      {name}
    </button>
  )

  return (
    <div className="space-y-3">
      {/* Online players */}
      {online.length > 0 && (
        <div>
          <div className="text-[9px] font-mono text-[var(--text-dim)] tracking-widest mb-1.5">ONLINE NOW</div>
          <div className="flex flex-wrap gap-1.5">
            {online.map(n => chip(n, 'green'))}
          </div>
        </div>
      )}

      {/* Directory with filter */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <div className="text-[9px] font-mono text-[var(--text-dim)] tracking-widest">
            RECENTLY SEEN {loading && <span className="opacity-40">…</span>}
          </div>
          <div className="flex gap-1">
            {(['7d', '30d', 'all'] as Filter[]).map(f => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`text-[8px] font-mono px-1.5 py-0.5 rounded border transition-all ${
                  filter === f
                    ? 'border-[var(--accent-mid)] text-[var(--accent)]'
                    : 'border-[var(--border)] text-[var(--text-dim)] opacity-60 hover:opacity-100'
                }`}
              >
                {f}
              </button>
            ))}
          </div>
        </div>
        {recent.length > 0 ? (
          <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto">
            {recent.map(p => chip(p.player_name))}
          </div>
        ) : (
          <div className="text-[10px] font-mono text-[var(--text-dim)] opacity-40">
            {loading ? 'Loading…' : 'No recent players'}
          </div>
        )}
      </div>

      {/* Manual input */}
      <input
        type="text"
        placeholder={placeholder}
        value={onlineSet.has(selected) || directory.some(p => p.player_name === selected) ? '' : selected}
        onChange={e => onSelect(e.target.value)}
        className="w-full bg-[var(--panel)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm font-mono text-[var(--text)] placeholder:text-[var(--text-dim)] focus:outline-none focus:border-[var(--accent-mid)]"
        style={{ fontSize: '16px' }}
      />
    </div>
  )
}
