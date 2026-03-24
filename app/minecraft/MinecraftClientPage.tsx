'use client'

import { startTransition, useState, useCallback, useEffect, useMemo } from 'react'
import { useSession } from 'next-auth/react'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, Users, Zap, Shield, MessageSquare, Settings, Trees, SquareTerminal } from 'lucide-react'
import DashboardSection from './components/DashboardSection'
import PlayersSection from './components/PlayersSection'
import ActionsSection from './components/ActionsSection'
import WorldsSection from './components/WorldsSection'
import ChatSection from './components/ChatSection'
import AdminSection from './components/AdminSection'
import SettingsSection from './components/SettingsSection'
import AdminTerminalWorkspace from './components/AdminTerminalWorkspace'
import MobileAccountDrawerPanel from './components/MobileAccountDrawerPanel'
import type { FeatureKey } from '@/lib/features'
import { playSound } from '@/app/components/soundfx'
import type { ServerStackMode } from '@/lib/server-stack'
import type { MinecraftVersionState } from '@/lib/minecraft-version'

export type TabId = 'dashboard' | 'players' | 'actions' | 'worlds' | 'terminal' | 'admin' | 'chat' | 'settings'

type FeatureFlags = Record<FeatureKey, boolean>

const ALL_TABS: {
  id: TabId
  label: string
  Icon: React.ComponentType<{ size?: number; color?: string; strokeWidth?: number }>
  adminOnly?: boolean
  shortcut?: string
}[] = [
  { id: 'dashboard', label: 'Dashboard', Icon: LayoutDashboard, shortcut: '1' },
  { id: 'players', label: 'Players', Icon: Users, shortcut: '2' },
  { id: 'actions', label: 'Actions', Icon: Zap, shortcut: '3' },
  { id: 'worlds', label: 'Worlds', Icon: Trees, shortcut: '4' },
  { id: 'chat', label: 'Chat', Icon: MessageSquare, shortcut: '5' },
  { id: 'admin', label: 'Admin', Icon: Shield, adminOnly: true, shortcut: '6' },
  { id: 'terminal', label: 'Terminal', Icon: SquareTerminal, adminOnly: true, shortcut: '7' },
  { id: 'settings', label: 'Settings', Icon: Settings, shortcut: '8' },
]

const VALID_TABS: TabId[] = ['dashboard', 'players', 'actions', 'worlds', 'terminal', 'admin', 'chat', 'settings']

function normalizeTab(raw: string | null | undefined): TabId {
  if (!raw) return 'dashboard'
  return VALID_TABS.includes(raw as TabId) ? (raw as TabId) : 'dashboard'
}

export default function MinecraftClientPage({ initialTab, initialRole, initialStackMode }: { initialTab: TabId; initialRole?: string; initialStackMode: ServerStackMode }) {
  const { data: session } = useSession()
  const role = session?.role ?? initialRole
  const pathname = usePathname()

  const [activeTab, setActiveTab] = useState<TabId>(initialTab)
  const [visitedTabs, setVisitedTabs] = useState<TabId[]>([initialTab])
  const [players, setPlayers] = useState<string[]>([])
  const [selectedPlayer, setSelectedPlayer] = useState('')
  const [features, setFeatures] = useState<FeatureFlags | null>(null)
  const [stackMode, setStackMode] = useState<ServerStackMode>(initialStackMode)
  const [minecraftVersion, setMinecraftVersion] = useState<MinecraftVersionState | null>(null)
  const [mobileNavOpen, setMobileNavOpen] = useState(false)

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

  const loadActiveServer = useCallback(async () => {
    try {
      const response = await fetch('/api/servers/active', { cache: 'no-store' })
      const payload = await response.json()
      if (payload.ok && payload.activeServer?.stackMode) {
        setStackMode(payload.activeServer.stackMode as ServerStackMode)
        setMinecraftVersion(payload.activeServer.minecraftVersion ?? null)
      }
    } catch {
      // keep previous mode until the server switch settles
    }
  }, [])

  useEffect(() => {
    void loadActiveServer()
  }, [loadActiveServer, session?.activeServerId])

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

  useEffect(() => {
    const toggle = () => setMobileNavOpen(current => !current)
    window.addEventListener('mcraftr:mobile-nav-toggle', toggle)
    return () => window.removeEventListener('mcraftr:mobile-nav-toggle', toggle)
  }, [])

  useEffect(() => {
    window.dispatchEvent(new CustomEvent('mcraftr:mobile-nav-state', { detail: { open: mobileNavOpen } }))
  }, [mobileNavOpen])

  const handleTabChange = useCallback((id: TabId) => {
    startTransition(() => {
      setActiveTab(id)
      setVisitedTabs(prev => (prev.includes(id) ? prev : [...prev, id]))
    })
    playSound('uiClick')
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
    if (t.id === 'dashboard' && features && !features.enable_dashboard_tab) return false
    if (t.id === 'players' && features && !features.enable_players_tab) return false
    if (t.id === 'actions' && features && !features.enable_actions_tab) return false
    if (t.id === 'worlds' && features && !features.enable_worlds_tab) return false
    if (t.id === 'worlds' && stackMode === 'quick') return false
    if (t.id === 'chat' && features && !features.enable_chat) return false
    if (t.id === 'actions' && features) {
      const hasAnyAction = features.enable_world || features.enable_player_commands || features.enable_chat_write || features.enable_teleport || features.enable_kits || features.enable_item_catalog || features.enable_inventory
      if (!hasAnyAction) return false
    }
    if (t.id === 'worlds' && features) {
      const hasAnyWorldFeature =
        features.enable_world_inventory ||
        features.enable_world_build_tools ||
        features.enable_world_maps ||
        features.enable_plugin_stack_status ||
        features.enable_world_spawn_tools ||
        features.enable_structure_catalog ||
        features.enable_entity_catalog
      if (!hasAnyWorldFeature) return false
    }
    if (t.id === 'terminal') {
      if (role !== 'admin') return false
      if (features && !features.enable_rcon) return false
    }
    if (t.id === 'admin') {
      if (role !== 'admin') return false
      if (features && !features.enable_admin) return false
    }
    return !t.adminOnly || role === 'admin'
  })
  const visibleTab = tabs.find(t => t.id === activeTab) ? activeTab : 'dashboard'

  useEffect(() => {
    setVisitedTabs(prev => (prev.includes(visibleTab) ? prev : [...prev, visibleTab]))
  }, [visibleTab])

  const shouldRenderTab = useCallback(
      (id: TabId) => visibleTab === id || visitedTabs.includes(id),
      [visibleTab, visitedTabs])

  // Keyboard shortcut handler - must be after visibleTab is defined
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Only handle if not in an input/textarea
      if (document.activeElement?.tagName === 'INPUT' || document.activeElement?.tagName === 'TEXTAREA') {
        return
      }
      
      const key = e.key
      if (key >= '1' && key <= '8') {
        const index = parseInt(key) - 1
        const visibleTabs = ALL_TABS.filter(t => {
          if (t.adminOnly && role !== 'admin') return false
          if (t.id === 'worlds' && stackMode === 'quick') return false
          return true
        })
        const targetTab = visibleTabs[index]
        if (targetTab && visibleTab !== targetTab.id) {
          handleTabChange(targetTab.id)
        }
      }
    }
    
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [role, stackMode, visibleTab, handleTabChange])

  // Keyboard shortcut hints - map visible tabs to their shortcuts
  const tabShortcuts = useMemo(() => {
    const map: Record<string, string> = {}
    tabs.forEach((tab, idx) => {
      if (tab.shortcut) map[tab.id] = tab.shortcut
    })
    return map
  }, [tabs])

  return (
    <div className="flex flex-col min-h-[calc(100vh-48px)]">
      <nav className="hidden md:flex sticky top-14 z-30 border-b border-[var(--border)] backdrop-blur-md" style={{ background: 'rgba(10,10,15,0.88)' }}>
        <div className="mx-auto flex w-full max-w-6xl justify-center gap-2 px-4 py-3">
          {tabs.map(({ id, label, Icon, shortcut }) => {
            const active = visibleTab === id
            return (
              <button
                key={id}
                onClick={() => handleTabChange(id)}
                className={`group flex items-center gap-2.5 rounded-full border px-4 py-2.5 text-[12px] font-mono tracking-[0.16em] transition-all ${
                  active
                    ? 'text-[var(--accent)] shadow-[0_0_0_1px_var(--accent-mid),0_10px_30px_rgba(0,0,0,0.18)]'
                    : 'text-[var(--text-dim)] hover:text-[var(--text)]'
                }`}
                title={shortcut ? `Press ${shortcut} to switch` : undefined}
                style={active
                  ? {
                      borderColor: 'var(--accent-mid)',
                      background: 'linear-gradient(180deg, color-mix(in srgb, var(--accent) 18%, transparent), color-mix(in srgb, var(--panel) 84%, transparent))',
                    }
                  : {
                      borderColor: 'var(--border)',
                      background: 'color-mix(in srgb, var(--panel) 82%, transparent)',
                    }}
              >
                <span
                  className="grid h-7 w-7 place-items-center rounded-full transition-all"
                  style={active
                    ? { background: 'var(--accent-dim)', color: 'var(--accent)' }
                    : { background: 'color-mix(in srgb, var(--panel) 72%, transparent)', color: 'var(--text-dim)' }}
                >
                  <Icon size={14} color="currentColor" strokeWidth={1.9} />
                </span>
                <span>{label.toUpperCase()}</span>
                {shortcut && (
                  <span className={`ml-1 text-[10px] opacity-40 ${active ? 'text-[var(--accent)]' : ''}`}>
                    {shortcut}
                  </span>
                )}
              </button>
            )
          })}
        </div>
      </nav>

      {mobileNavOpen && (
        <>
          <button
            type="button"
            aria-label="Close section navigation"
            onClick={() => setMobileNavOpen(false)}
            className="fixed inset-0 z-40 bg-black/45 backdrop-blur-[2px] md:hidden"
          />
          <nav
            className="md:hidden fixed inset-y-0 left-0 z-50 w-[min(18rem,86vw)] border-r border-[var(--border)] backdrop-blur-md"
            style={{
              paddingTop: 'calc(3.5rem + env(safe-area-inset-top))',
              paddingBottom: 'env(safe-area-inset-bottom)',
              background: 'rgba(10,10,15,0.96)',
              boxShadow: '18px 0 40px rgba(0,0,0,0.28)',
            }}
            aria-label="Mobile section navigation"
          >
            <div className="flex h-full flex-col gap-2 px-3 py-3">
              <div className="px-1 pb-1">
                <div className="text-[10px] font-mono uppercase tracking-[0.16em] text-[var(--accent)]">Sections</div>
              </div>

              <div className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto pr-1">
                {tabs.map(({ id, label, Icon }) => {
                  const active = visibleTab === id
                  return (
                    <button
                      key={id}
                      onClick={() => {
                        handleTabChange(id)
                        setMobileNavOpen(false)
                      }}
                      className="tap-target flex items-center gap-3 rounded-2xl border px-3 py-3 text-left transition-all"
                      style={active
                        ? {
                            borderColor: 'transparent',
                            background: 'var(--accent)',
                            color: 'var(--bg)',
                          }
                        : {
                            borderColor: 'transparent',
                            background: 'transparent',
                            color: 'var(--text-dim)',
                          }}
                      aria-current={active ? 'page' : undefined}
                      aria-label={label}
                    >
                      <span
                        className="grid h-9 w-9 shrink-0 place-items-center rounded-xl transition-all"
                        style={active
                          ? { background: 'color-mix(in srgb, var(--bg) 16%, transparent)', color: 'var(--bg)' }
                          : { background: 'color-mix(in srgb, var(--panel) 74%, transparent)', color: 'var(--text-dim)' }}
                      >
                        <Icon size={18} color="currentColor" strokeWidth={1.9} />
                      </span>
                      <span className="min-w-0 truncate font-mono text-[11px] tracking-[0.14em]">
                        {label.toUpperCase()}
                      </span>
                    </button>
                  )
                })}

                <MobileAccountDrawerPanel onNavigate={() => setMobileNavOpen(false)} />
              </div>
            </div>
          </nav>
        </>
      )}

      <div
        className={`flex-1 mx-auto w-full px-3 py-3 sm:px-4 md:px-4 md:py-4 md:pb-6 ${
          visibleTab === 'terminal' ? 'max-w-[1600px]' : 'max-w-4xl'
        }`}
        style={{ paddingBottom: '1rem' }}
      >
        {shouldRenderTab('dashboard') && (
          <div className={visibleTab === 'dashboard' ? 'block' : 'hidden'} aria-hidden={visibleTab !== 'dashboard'}>
            <DashboardSection onNavigate={handleTabChange} />
          </div>
        )}
        {shouldRenderTab('players') && (
          <div className={visibleTab === 'players' ? 'block' : 'hidden'} aria-hidden={visibleTab !== 'players'}>
            <PlayersSection onPlayersChange={handlePlayersChange} minecraftVersion={minecraftVersion?.resolved ?? null} />
          </div>
        )}
        {shouldRenderTab('actions') && (
          <div className={visibleTab === 'actions' ? 'block' : 'hidden'} aria-hidden={visibleTab !== 'actions'}>
            <ActionsSection
              players={players}
              selectedPlayer={selectedPlayer}
              onSelectedPlayerChange={setSelectedPlayer}
              minecraftVersion={minecraftVersion?.resolved ?? null}
            />
          </div>
        )}
        {shouldRenderTab('worlds') && (
          <div className={visibleTab === 'worlds' ? 'block' : 'hidden'} aria-hidden={visibleTab !== 'worlds'}>
            <WorldsSection
              players={players}
              selectedPlayer={selectedPlayer}
              onSelectedPlayerChange={setSelectedPlayer}
            />
          </div>
        )}
        {(role === 'admin') && shouldRenderTab('admin') && (
          <div className={visibleTab === 'admin' ? 'block' : 'hidden'} aria-hidden={visibleTab !== 'admin'}>
            <AdminSection players={players} readOnly={false} />
          </div>
        )}
        {(role === 'admin') && shouldRenderTab('terminal') && (
          <div className={visibleTab === 'terminal' ? 'block' : 'hidden'} aria-hidden={visibleTab !== 'terminal'}>
            <div className="space-y-3">
              <div className="px-1">
                <div className="font-mono text-[12px] tracking-[0.18em] text-[var(--text-dim)]">TERMINAL</div>
                <div className="text-[13px] text-[var(--text-dim)]">Dedicated server terminal with transcript, command catalog, docs, wizards, and favorites.</div>
              </div>
              <AdminTerminalWorkspace fullPage readOnly={false} />
            </div>
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
    </div>
  )
}
