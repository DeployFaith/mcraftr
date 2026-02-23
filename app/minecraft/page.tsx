'use client'
import { useState, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import PlayersSection    from './components/PlayersSection'
import ActionsSection    from './components/ActionsSection'
import SettingsSection   from './components/SettingsSection'
import ServerInfoSection from './components/ServerInfoSection'

// ── Nav config ────────────────────────────────────────────────────────────────

type TabId = 'players' | 'actions' | 'server' | 'settings'

const TABS: { id: TabId; label: string; icon: string }[] = [
  { id: 'players',  label: 'Players',  icon: '👥' },
  { id: 'actions',  label: 'Actions',  icon: '⚡' },
  { id: 'server',   label: 'Server',   icon: '🖥' },
  { id: 'settings', label: 'Settings', icon: '⚙️' },
]

// ── Page ──────────────────────────────────────────────────────────────────────

export default function MinecraftPage() {
  const { data: session } = useSession()
  const role = session?.role

  const [activeTab,  setActiveTab]  = useState<TabId>('players')
  const [players,    setPlayers]    = useState<string[]>([])
  const [whitelist,  setWhitelist]  = useState<string[] | null>(null)

  const handlePlayersChange = useCallback((list: string[]) => {
    setPlayers(list)
  }, [])

  return (
    <div className="flex flex-col min-h-[calc(100vh-48px)]">

      {/* Desktop top tab bar */}
      <nav className="hidden md:flex border-b border-[var(--border)] sticky top-12 z-30 backdrop-blur-md"
        style={{ background: 'rgba(10,10,15,0.9)' }}>
        <div className="max-w-4xl mx-auto flex w-full">
          {TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-5 py-3 text-xs font-mono tracking-widest transition-all border-b-2 ${
                activeTab === tab.id
                  ? 'border-[var(--accent)] text-[var(--accent)]'
                  : 'border-transparent text-[var(--text-dim)] hover:text-[var(--text)] hover:border-[var(--border)]'
              }`}
            >
              <span>{tab.icon}</span>
              <span>{tab.label.toUpperCase()}</span>
            </button>
          ))}
        </div>
      </nav>

      {/* Section content */}
      <div className="flex-1 max-w-4xl mx-auto w-full px-4 py-4 pb-24 md:pb-6">
        {activeTab === 'players'  && <PlayersSection    onPlayersChange={handlePlayersChange} />}
        {activeTab === 'actions'  && <ActionsSection    players={players} role={role} whitelist={whitelist} onWhitelistChange={setWhitelist} />}
        {activeTab === 'server'   && <ServerInfoSection />}
        {activeTab === 'settings' && <SettingsSection role={role} />}
      </div>

      {/* Mobile bottom nav */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 border-t border-[var(--border)]"
        style={{ background: 'rgba(10,10,15,0.95)', backdropFilter: 'blur(12px)' }}>
        <div className="flex">
          {TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`relative flex-1 flex flex-col items-center gap-1 py-3 transition-all ${
                activeTab === tab.id
                  ? 'text-[var(--accent)]'
                  : 'text-[var(--text-dim)]'
              }`}
            >
              <span className="text-xl leading-none">{tab.icon}</span>
              <span className={`text-[9px] font-mono tracking-widest ${
                activeTab === tab.id ? 'text-[var(--accent)]' : 'text-[var(--text-dim)]'
              }`}>
                {tab.label.toUpperCase()}
              </span>
              {activeTab === tab.id && (
                <span className="absolute bottom-0 w-8 h-0.5 rounded-full" style={{ background: 'var(--accent)' }} />
              )}
            </button>
          ))}
        </div>
      </nav>
    </div>
  )
}
