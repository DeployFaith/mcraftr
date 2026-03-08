'use client'

import { startTransition, useState, useCallback, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { usePathname } from 'next/navigation'
import { Users, Zap, Shield, MessageSquare, Settings } from 'lucide-react'
import PlayersSection from './components/PlayersSection'
import ActionsSection from './components/ActionsSection'
import ChatSection from './components/ChatSection'
import AdminSection from './components/AdminSection'
import SettingsSection from './components/SettingsSection'
import type { FeatureKey } from '@/lib/features'

export type TabId = 'players' | 'actions' | 'admin' | 'chat' | 'settings'

type FeatureFlags = Record<FeatureKey, boolean>

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
  const { data: session } = useSession()
  const role = session?.role ?? initialRole
  const pathname = usePathname()

  const [activeTab, setActiveTab] = useState<TabId>(initialTab)
  const [visitedTabs, setVisitedTabs] = useState<TabId[]>([initialTab])
  const [players, setPlayers] = useState<string[]>([])
  const [features, setFeatures] = useState<FeatureFlags | null>(null)

  const loadFeatures = useCallback(async () => {
    try {
      const r = await fetch('/api/account/preferences')
      const d = await r.json()
      if (d.ok && d.features) setFeatures(d.features)
    } catch {
      setFeatures(null)
    }
  }, [])

  useEffect(() => {
    loadFeatures()
    const onFeatures = () => { void loadFeatures() }
    window.addEventListener('mcraftr:features-updated', onFeatures)
    return () => window.removeEventListener('mcraftr:features-updated', onFeatures)
  }, [loadFeatures])

  useEffect(() => {
    const syncFromUrl = () => {
      const params = new URLSearchParams(window.location.search)
      const urlTab = normalizeTab(params.get('tab'))
      startTransition(() => {
        setActiveTab(urlTab)
        setVisitedTabs(prev => (prev.includes(urlTab) ? prev : [...prev, urlTab]))
      })
    }
    window.addEventListener('popstate', syncFromUrl)
    return () => window.removeEventListener('popstate', syncFromUrl)
  }, [])

  const handleTabChange = useCallback((id: TabId) => {
    startTransition(() => {
      setActiveTab(id)
      setVisitedTabs(prev => (prev.includes(id) ? prev : [...prev, id]))
    })
    const params = new URLSearchParams(window.location.search)
    params.set('tab', id)
    const qs = params.toString()
    const nextUrl = qs ? `${pathname}?${qs}` : pathname
    window.history.replaceState(null, '', nextUrl)
  }, [pathname])

  const handlePlayersChange = useCallback((list: string[]) => {
    setPlayers(list)
  }, [])

  const tabs = ALL_TABS.filter(t => {
    if (t.id === 'players' && features && !features.enable_players_tab) return false
    if (t.id === 'actions' && features && !features.enable_actions_tab) return false
    if (t.id === 'chat' && features && !features.enable_chat) return false
    if (t.id === 'actions' && features) {
      const hasAnyAction = features.enable_world || features.enable_player_commands || features.enable_chat_write || features.enable_teleport || features.enable_kits || features.enable_item_catalog || features.enable_inventory
      if (!hasAnyAction) return false
    }
    if (t.id === 'admin') {
      if (role !== 'admin') return false
      if (features && !features.enable_admin) return false
    }
    return !t.adminOnly || role === 'admin'
  })
  const visibleTab = tabs.find(t => t.id === activeTab) ? activeTab : 'players'

  useEffect(() => {
    setVisitedTabs(prev => (prev.includes(visibleTab) ? prev : [...prev, visibleTab]))
  }, [visibleTab])

  const shouldRenderTab = useCallback(
      (id: TabId) => visibleTab === id || visitedTabs.includes(id),
      [visibleTab, visitedTabs])

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

      <div className="flex-1 max-w-4xl mx-auto w-full px-3 sm:px-4 py-3 md:py-4 md:pb-6" style={{ paddingBottom: 'calc(5.5rem + env(safe-area-inset-bottom))' }}>
        {shouldRenderTab('players') && (
          <div className={visibleTab === 'players' ? 'block' : 'hidden'} aria-hidden={visibleTab !== 'players'}>
            <PlayersSection onPlayersChange={handlePlayersChange} />
          </div>
        )}
        {shouldRenderTab('actions') && (
          <div className={visibleTab === 'actions' ? 'block' : 'hidden'} aria-hidden={visibleTab !== 'actions'}>
            <ActionsSection players={players} />
          </div>
        )}
        {role === 'admin' && shouldRenderTab('admin') && (
          <div className={visibleTab === 'admin' ? 'block' : 'hidden'} aria-hidden={visibleTab !== 'admin'}>
            <AdminSection players={players} />
          </div>
        )}
        {shouldRenderTab('chat') && (
          <div className={visibleTab === 'chat' ? 'block' : 'hidden'} aria-hidden={visibleTab !== 'chat'}>
            <ChatSection />
          </div>
        )}
        {shouldRenderTab('settings') && (
          <div className={visibleTab === 'settings' ? 'block' : 'hidden'} aria-hidden={visibleTab !== 'settings'}>
            <SettingsSection role={role} />
          </div>
        )}
      </div>

      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 border-t border-[var(--border)] safe-bottom" style={{ background: 'rgba(10,10,15,0.95)', backdropFilter: 'blur(12px)' }}>
        <div className="flex">
          {tabs.map(({ id, label, Icon }) => {
            const active = visibleTab === id
            return (
              <button key={id} onClick={() => handleTabChange(id)} className="tap-target relative flex-1 flex flex-col items-center gap-1 py-3 transition-all">
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
