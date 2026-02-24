'use client'

import { useState, useCallback, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { Users, Zap, Shield, MessageSquare, Settings } from 'lucide-react'
import PlayersSection from './components/PlayersSection'
import ActionsSection from './components/ActionsSection'
import ChatSection from './components/ChatSection'
import AdminSection from './components/AdminSection'
import SettingsSection from './components/SettingsSection'

export type TabId = 'players' | 'actions' | 'admin' | 'chat' | 'settings'

const ALL_TABS: {
  id: TabId
  label: string
  Icon: React.ComponentType<{ size?: number; color?: string; strokeWidth?: number }>
  adminOnly?: boolean
}[] = [
  { id: 'players', label: 'Players', Icon: Users },
  { id: 'actions', label: 'Actions', Icon: Zap },
  { id: 'admin', label: 'Admin', Icon: Shield, adminOnly: true },
  { id: 'chat', label: 'Chat', Icon: MessageSquare },
  { id: 'settings', label: 'Settings', Icon: Settings },
]

const VALID_TABS: TabId[] = ['players', 'actions', 'admin', 'chat', 'settings']

function normalizeTab(raw: string | null | undefined): TabId {
  if (!raw) return 'players'
  return VALID_TABS.includes(raw as TabId) ? (raw as TabId) : 'players'
}

export default function MinecraftClientPage({ initialTab, initialRole }: { initialTab: TabId; initialRole?: string }) {
  const { data: session, update: updateSession } = useSession()
  const role = session?.role ?? initialRole
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const [activeTab, setActiveTab] = useState<TabId>(initialTab)
  const [players, setPlayers] = useState<string[]>([])
  const [hydrated, setHydrated] = useState(false)

  useEffect(() => {
    setHydrated(true)
  }, [])

  useEffect(() => {
    const urlTab = normalizeTab(searchParams.get('tab'))
    if (urlTab !== activeTab) setActiveTab(urlTab)
  }, [searchParams, activeTab])

  const handleTabChange = useCallback((id: TabId) => {
    setActiveTab(id)
    const params = new URLSearchParams(searchParams.toString())
    params.set('tab', id)
    const qs = params.toString()
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
  }, [pathname, router, searchParams])

  const handlePlayersChange = useCallback((list: string[]) => {
    setPlayers(list)
  }, [])

  const tabs = ALL_TABS.filter(t => !t.adminOnly || role === 'admin')
  const visibleTab = tabs.find(t => t.id === activeTab) ? activeTab : 'players'

  return (
    <div className="flex flex-col min-h-[calc(100vh-48px)]">
      <nav className="hidden md:flex border-b border-[var(--border)] sticky top-12 z-30 backdrop-blur-md" style={{ background: 'rgba(10,10,15,0.9)' }}>
        <div className="max-w-4xl mx-auto flex w-full">
          {tabs.map(({ id, label, Icon }) => {
            const active = visibleTab === id
            return (
              <button
                key={id}
                onClick={() => handleTabChange(id)}
                className={`flex items-center gap-2 px-5 py-3 text-[13px] font-mono tracking-widest transition-all border-b-2 ${
                  active
                    ? 'border-[var(--accent)] text-[var(--accent)]'
                    : 'border-transparent text-[var(--text-dim)] hover:text-[var(--text)] hover:border-[var(--border)]'
                }`}
              >
                <Icon size={14} color={active ? 'var(--accent)' : 'var(--text-dim)'} strokeWidth={1.75} />
                <span>{label.toUpperCase()}</span>
              </button>
            )
          })}
        </div>
      </nav>

      <div className="flex-1 max-w-4xl mx-auto w-full px-4 py-4 pb-24 md:pb-6">
        {visibleTab === 'players' && <PlayersSection onPlayersChange={handlePlayersChange} />}
        {visibleTab === 'actions' && <ActionsSection players={players} />}
        {visibleTab === 'admin' && role === 'admin' && <AdminSection players={players} />}
        {visibleTab === 'chat' && <ChatSection />}
        {visibleTab === 'settings' && <SettingsSection role={role} />}
      </div>

      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 border-t border-[var(--border)]" style={{ background: 'rgba(10,10,15,0.95)', backdropFilter: 'blur(12px)' }}>
        <div className="flex">
          {tabs.map(({ id, label, Icon }) => {
            const active = visibleTab === id
            return (
              <button key={id} onClick={() => handleTabChange(id)} className="relative flex-1 flex flex-col items-center gap-1 py-3 transition-all">
                <Icon size={20} color={active ? 'var(--accent)' : 'var(--text-dim)'} strokeWidth={1.75} />
                <span className="text-[13px] font-mono tracking-widest" style={{ color: active ? 'var(--accent)' : 'var(--text-dim)' }}>
                  {label.toUpperCase()}
                </span>
                {active && <span className="absolute bottom-0 w-8 h-0.5 rounded-full" style={{ background: 'var(--accent)' }} />}
              </button>
            )
          })}
        </div>
      </nav>
    </div>
  )
}
