'use client'
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Megaphone, MessageSquare, SendHorizontal, Trash2, Users } from 'lucide-react'
import type { ChatEntry } from '@/app/api/minecraft/chat-log/route'
import CollapsibleCard from './CollapsibleCard'

const POLL_MS = 10_000
type ComposeMode = 'broadcast' | 'msg'

export default function ChatSection() {
  const [entries, setEntries] = useState<ChatEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [lastTs, setLastTs] = useState(0)
  const [mode, setMode] = useState<ComposeMode>('broadcast')
  const [message, setMessage] = useState('')
  const [targetPlayer, setTargetPlayer] = useState('')
  const [onlinePlayers, setOnlinePlayers] = useState<string[]>([])
  const [busy, setBusy] = useState(false)
  const [deletingId, setDeletingId] = useState<number | null>(null)
  const [status, setStatus] = useState<{ ok: boolean; text: string } | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)

  const fetchEntries = async (since: number, initial = false) => {
    if (initial) setLoading(true)
    try {
      const r = await fetch(`/api/minecraft/chat-log?since=${since}`, { cache: 'no-store' })
      const d = await r.json()
      if (d.ok && Array.isArray(d.entries)) {
        if (since === 0) {
          setEntries(d.entries)
        } else if (d.entries.length > 0) {
          setEntries(prev => {
            const merged = [...prev, ...d.entries]
            const seen = new Set<number>()
            return merged.filter(entry => {
              if (seen.has(entry.id)) return false
              seen.add(entry.id)
              return true
            })
          })
        }
        if (d.entries.length > 0) setLastTs(d.entries[d.entries.length - 1].ts)
      }
    } catch {
      // Keep the panel quiet on polling errors; the compose status handles explicit failures.
    } finally {
      if (initial) setLoading(false)
    }
  }

  const fetchPlayers = async () => {
    try {
      const r = await fetch('/api/players', { cache: 'no-store' })
      const d = await r.json()
      const parsed = typeof d.players === 'string'
        ? d.players.split(',').map((name: string) => name.trim()).filter(Boolean)
        : []
      setOnlinePlayers(parsed)
    } catch {
      // Keep the last known player list.
    }
  }

  useEffect(() => {
    void fetchEntries(0, true)
    void fetchPlayers()
  }, [])

  useEffect(() => {
    const id = setInterval(() => {
      void fetchEntries(lastTs)
      void fetchPlayers()
    }, POLL_MS)
    return () => clearInterval(id)
  }, [lastTs])

  useLayoutEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [entries])

  const formatTime = (ts: number) =>
    new Date(ts * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })

  const canSend = message.trim().length > 0 && (mode === 'broadcast' || targetPlayer.trim().length > 0)
  const recentPlayers = useMemo(
    () => Array.from(new Set(entries.map(entry => entry.player).filter((value): value is string => !!value))),
    [entries]
  )

  const refreshEntries = async () => {
    setLastTs(0)
    await fetchEntries(0, false)
  }

  const sendMessage = async () => {
    if (!canSend || busy) return
    setBusy(true)
    setStatus(null)
    try {
      const endpoint = mode === 'broadcast' ? '/api/minecraft/broadcast' : '/api/minecraft/msg'
      const body = mode === 'broadcast'
        ? { message }
        : { player: targetPlayer.trim(), message }
      const r = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const d = await r.json()
      if (!d.ok) {
        setStatus({ ok: false, text: d.error || 'Failed to send message' })
        return
      }

      setMessage('')
      setStatus({
        ok: true,
        text: mode === 'broadcast'
          ? 'Broadcast sent'
          : `Direct message sent to ${targetPlayer.trim()}`,
      })
      await refreshEntries()
    } catch (e) {
      setStatus({ ok: false, text: e instanceof Error ? e.message : 'Network error' })
    } finally {
      setBusy(false)
    }
  }

  const deleteEntry = async (id: number) => {
    if (deletingId != null) return
    setDeletingId(id)
    setStatus(null)
    try {
      const r = await fetch('/api/minecraft/chat-log', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      })
      const d = await r.json()
      if (!d.ok) {
        setStatus({ ok: false, text: d.error || 'Failed to delete chat entry' })
        return
      }
      setEntries(prev => prev.filter(entry => entry.id !== id))
      setStatus({ ok: true, text: 'Chat entry deleted from history' })
    } catch (e) {
      setStatus({ ok: false, text: e instanceof Error ? e.message : 'Network error' })
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <div className="space-y-4 pb-6">
      <h2 className="font-mono text-base tracking-widest text-[var(--accent)]">CHAT</h2>

      <CollapsibleCard title="COMPOSE" storageKey="chat:compose" bodyClassName="p-4 space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex gap-2">
            <button
              onClick={() => setMode('broadcast')}
              className={`px-3 py-1.5 rounded-lg border text-[12px] font-mono tracking-widest transition-all ${
                mode === 'broadcast'
                  ? 'border-[var(--accent)] bg-[var(--accent-dim)] text-[var(--accent)]'
                  : 'border-[var(--border)] text-[var(--text-dim)] hover:border-[var(--accent-mid)]'
              }`}
            >
              <span className="flex items-center gap-1.5"><Megaphone size={12} strokeWidth={1.5} />ALL</span>
            </button>
            <button
              onClick={() => setMode('msg')}
              className={`px-3 py-1.5 rounded-lg border text-[12px] font-mono tracking-widest transition-all ${
                mode === 'msg'
                  ? 'border-[var(--accent)] bg-[var(--accent-dim)] text-[var(--accent)]'
                  : 'border-[var(--border)] text-[var(--text-dim)] hover:border-[var(--accent-mid)]'
              }`}
            >
              <span className="flex items-center gap-1.5"><MessageSquare size={12} strokeWidth={1.5} />DM</span>
            </button>
          </div>
        </div>

        {mode === 'msg' && (
          <div className="space-y-3">
            <div className="text-[11px] font-mono tracking-widest text-[var(--text-dim)] flex items-center gap-1.5">
              <Users size={11} strokeWidth={1.5} />
              TARGET PLAYER
            </div>
            {onlinePlayers.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {onlinePlayers.map(name => (
                  <button
                    key={name}
                    onClick={() => setTargetPlayer(name)}
                    className={`px-3 py-1.5 rounded-lg border text-[12px] font-mono transition-all ${
                      targetPlayer === name
                        ? 'border-[var(--accent)] bg-[var(--accent-dim)] text-[var(--accent)]'
                        : 'border-[var(--border)] text-[var(--text-dim)] hover:border-[var(--accent-mid)]'
                    }`}
                  >
                    {name}
                  </button>
                ))}
              </div>
            )}
            {recentPlayers.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {recentPlayers
                  .filter(name => !onlinePlayers.includes(name))
                  .map(name => (
                    <button
                      key={name}
                      onClick={() => setTargetPlayer(name)}
                      className={`px-3 py-1.5 rounded-lg border text-[12px] font-mono transition-all ${
                        targetPlayer === name
                          ? 'border-[var(--accent)] bg-[var(--accent-dim)] text-[var(--accent)]'
                          : 'border-[var(--border)] text-[var(--text-dim)] opacity-80 hover:border-[var(--accent-mid)]'
                      }`}
                    >
                      {name}
                    </button>
                  ))}
              </div>
            )}
            <input
              type="text"
              placeholder="Player name"
              value={targetPlayer}
              onChange={e => setTargetPlayer(e.target.value)}
              className="w-full bg-[var(--panel)] border border-[var(--border)] rounded-lg px-3 py-2 text-[15px] font-mono text-[var(--text)] placeholder:text-[var(--text-dim)] focus:outline-none focus:border-[var(--accent-mid)]"
              style={{ fontSize: '16px' }}
            />
          </div>
        )}

        <div className="flex gap-2">
          <input
            type="text"
            placeholder={mode === 'broadcast' ? 'Message everyone' : 'Message player'}
            value={message}
            onChange={e => setMessage(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') {
                e.preventDefault()
                void sendMessage()
              }
            }}
            className="flex-1 bg-[var(--panel)] border border-[var(--border)] rounded-lg px-3 py-2 text-[15px] font-mono text-[var(--text)] placeholder:text-[var(--text-dim)] focus:outline-none focus:border-[var(--accent-mid)]"
            style={{ fontSize: '16px' }}
          />
          <button
            onClick={() => void sendMessage()}
            disabled={!canSend || busy}
            className="px-4 py-2 rounded-lg border border-[var(--border)] font-mono text-[13px] tracking-widest text-[var(--accent)] hover:border-[var(--accent-mid)] transition-all disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {busy ? '…' : <span className="flex items-center gap-1.5"><SendHorizontal size={13} strokeWidth={1.5} />SEND</span>}
          </button>
        </div>

        {status && (
          <div className={`text-[13px] font-mono ${status.ok ? 'text-[var(--accent)]' : 'text-red-400'}`}>
            {status.text}
          </div>
        )}
      </CollapsibleCard>

      <CollapsibleCard title="OUTBOUND HISTORY" storageKey="chat:history" bodyClassName="p-4 flex flex-col">
        <div className="flex items-center justify-between gap-3 mb-3">
          <button
            onClick={() => void refreshEntries()}
            className="text-[12px] font-mono text-[var(--text-dim)] hover:text-[var(--accent)] transition-colors"
          >
            Refresh
          </button>
        </div>

        {loading ? (
          <div className="flex-1 flex items-center justify-center text-[13px] font-mono text-[var(--text-dim)] opacity-60 tracking-widest animate-pulse">
            Loading…
          </div>
        ) : entries.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-2 text-center">
            <div className="text-[13px] font-mono text-[var(--text-dim)] opacity-60 tracking-widest">No saved outbound messages yet</div>
            <div className="text-[13px] font-mono text-[var(--text-dim)] opacity-30">
              Broadcasts and DMs sent from this account will appear here.
            </div>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto space-y-2 pr-1" style={{ minHeight: '50vh' }}>
            {entries.map(entry => (
              <div
                key={entry.id}
                className={`flex flex-col gap-1 px-3 py-2.5 rounded-lg border ${
                  entry.type === 'broadcast'
                    ? 'border-[var(--accent-mid)] bg-[var(--accent-dim)]'
                    : 'border-[var(--border)] bg-[var(--panel)]'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className={`text-[13px] font-mono tracking-widest ${
                    entry.type === 'broadcast' ? 'text-[var(--accent)]' : 'text-[var(--text-dim)]'
                  }`}>
                    {entry.type === 'broadcast'
                      ? <span className="flex items-center gap-1"><Megaphone size={10} strokeWidth={1.5} />BROADCAST</span>
                      : <span className="flex items-center gap-1"><MessageSquare size={10} strokeWidth={1.5} />DM → {entry.player}</span>}
                  </span>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-[13px] font-mono text-[var(--text-dim)] opacity-60">
                      {formatTime(entry.ts)}
                    </span>
                    <button
                      onClick={() => void deleteEntry(entry.id)}
                      disabled={deletingId === entry.id}
                      className="text-[var(--text-dim)] hover:text-red-400 transition-colors disabled:opacity-40"
                      title="Delete from history"
                    >
                      <Trash2 size={13} strokeWidth={1.5} />
                    </button>
                  </div>
                </div>
                <div className="text-[15px] font-mono text-[var(--text)]">{entry.message}</div>
              </div>
            ))}
            <div ref={bottomRef} />
          </div>
        )}

        <div className="mt-3 pt-3 border-t border-[var(--border)] text-[13px] font-mono text-[var(--text-dim)] opacity-30 text-right">
          Polls every 10s
        </div>
      </CollapsibleCard>
    </div>
  )
}
