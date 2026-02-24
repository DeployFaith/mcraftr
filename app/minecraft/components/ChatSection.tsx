'use client'
import { useState, useEffect, useRef, useLayoutEffect } from 'react'
import { Megaphone, MessageSquare } from 'lucide-react'
import type { ChatEntry } from '@/app/api/minecraft/chat-log/route'

const POLL_MS = 10_000

export default function ChatSection() {
  const [entries,  setEntries]  = useState<ChatEntry[]>([])
  const [loading,  setLoading]  = useState(true)
  const [lastTs,   setLastTs]   = useState(0)
  const bottomRef = useRef<HTMLDivElement>(null)

  const fetchEntries = async (since: number, initial = false) => {
    if (initial) setLoading(true)
    try {
      const r = await fetch(`/api/minecraft/chat-log?since=${since}`)
      const d = await r.json()
      if (d.ok && d.entries.length > 0) {
        setEntries(prev => {
          const merged = [...prev, ...d.entries]
          // deduplicate by id
          const seen = new Set<number>()
          return merged.filter(e => { if (seen.has(e.id)) return false; seen.add(e.id); return true })
        })
        setLastTs(d.entries[d.entries.length - 1].ts)
      }
    } catch {} finally {
      if (initial) setLoading(false)
    }
  }

  useEffect(() => {
    fetchEntries(0, true)
  }, [])

  useEffect(() => {
    const id = setInterval(() => fetchEntries(lastTs), POLL_MS)
    return () => clearInterval(id)
  }, [lastTs])

  useLayoutEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [entries])

  const formatTime = (ts: number) =>
    new Date(ts * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })

  return (
    <div className="space-y-4 pb-6">
      <h2 className="font-mono text-base tracking-widest text-[var(--accent)]">CHAT</h2>

      <div className="glass-card p-4 flex flex-col" style={{ minHeight: '60vh' }}>
        <div className="text-[13px] font-mono tracking-widest text-[var(--text-dim)] mb-3">OUTBOUND MESSAGES</div>

        {loading ? (
          <div className="flex-1 flex items-center justify-center text-[13px] font-mono text-[var(--text-dim)] opacity-60 tracking-widest animate-pulse">
            Loading…
          </div>
        ) : entries.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-2 text-center">
            <div className="text-[13px] font-mono text-[var(--text-dim)] opacity-60 tracking-widest">The chat is quieter than a creeper in water</div>
            <div className="text-[13px] font-mono text-[var(--text-dim)] opacity-30">
              Use Broadcast or Private Message in Actions — messages will appear here.
            </div>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto space-y-2 pr-1">
            {entries.map(entry => (
              <div key={entry.id} className={`flex flex-col gap-0.5 px-3 py-2.5 rounded-lg border ${
                entry.type === 'broadcast'
                  ? 'border-[var(--accent-mid)] bg-[var(--accent-dim)]'
                  : 'border-[var(--border)] bg-[var(--panel)]'
              }`}>
                <div className="flex items-center justify-between gap-2">
                  <span className={`text-[13px] font-mono tracking-widest ${
                    entry.type === 'broadcast' ? 'text-[var(--accent)]' : 'text-[var(--text-dim)]'
                  }`}>
                    {entry.type === 'broadcast'
                      ? <span className="flex items-center gap-1"><Megaphone size={10} strokeWidth={1.5} />BROADCAST</span>
                      : <span className="flex items-center gap-1"><MessageSquare size={10} strokeWidth={1.5} />→ {entry.player}</span>}
                  </span>
                  <span className="text-[13px] font-mono text-[var(--text-dim)] opacity-60 shrink-0">
                    {formatTime(entry.ts)}
                  </span>
                </div>
                <div className="text-[15px] font-mono text-[var(--text)]">{entry.message}</div>
              </div>
            ))}
            <div ref={bottomRef} />
          </div>
        )}

        <div className="mt-3 pt-3 border-t border-[var(--border)] text-[13px] font-mono text-[var(--text-dim)] opacity-30 text-right">
          Polls every 10s · Shows messages sent from this session
        </div>
      </div>
    </div>
  )
}
