'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { signOut, useSession } from 'next-auth/react'
import { ChevronDown, LogOut, Plus, Server, UserRound, X } from 'lucide-react'
import { FONTS, FONT_SIZES, useTheme } from '@/app/components/ThemeProvider'
import { loadMusicSettings, loadSoundSettings, saveMusicSettings, saveSoundSettings } from '@/app/components/soundfx'

type DeviceAccount = {
  userId: string
  email: string
  lastUsedAt: number
}

type SavedServer = {
  id: string
  label: string | null
  host: string
  port: number
  createdAt: number
  updatedAt: number
}

type AccountAvatar = {
  type: 'none' | 'builtin' | 'upload'
  value: string | null
}

function formatServerLabel(server: SavedServer): string {
  return server.label?.trim() || `${server.host}:${server.port}`
}

function resolveAvatarSrc(avatar: AccountAvatar | null) {
  if (!avatar || avatar.type === 'none' || !avatar.value) return null
  if (avatar.type === 'upload') return avatar.value
  return `/profile-avatars/${avatar.value}.svg`
}

function actionRowClass(kind: 'accent' | 'subtle' | 'danger') {
  const base = 'flex w-full items-center gap-3 rounded-2xl border px-3.5 py-3 text-left text-[11px] font-mono tracking-[0.12em] transition-all'
  if (kind === 'accent') return `${base} hover:-translate-y-0.5`
  if (kind === 'danger') return `${base} hover:-translate-y-0.5`
  return base
}

export default function HeaderControls() {
  const router = useRouter()
  const pathname = usePathname()
  const { data: session, update } = useSession()
  const currentUserId = session?.user?.id ?? null

  const [accounts, setAccounts] = useState<DeviceAccount[]>([])
  const [servers, setServers] = useState<SavedServer[]>([])
  const [activeServerId, setActiveServerId] = useState<string | null>(session?.activeServerId ?? null)
  const [switchingAccount, setSwitchingAccount] = useState(false)
  const [switchingServer, setSwitchingServer] = useState(false)
  const [loadingState, setLoadingState] = useState(true)
  const [open, setOpen] = useState(false)
  const [avatar, setAvatar] = useState<AccountAvatar | null>(null)
  const [soundEnabled, setSoundEnabled] = useState(true)
  const [soundVolume, setSoundVolume] = useState(0.55)
  const [musicEnabled, setMusicEnabled] = useState(false)
  const [musicVolume, setMusicVolume] = useState(0.3)
  const menuRef = useRef<HTMLDivElement | null>(null)
  const { theme, setTheme, accent, setAccent, font, setFont, fontSize, setFontSize } = useTheme()

  const loadHeaderState = useCallback(async () => {
    setLoadingState(true)
    try {
      await fetch('/api/account/saved-accounts', { method: 'POST' })
      const [accountsRes, serversRes, preferencesRes] = await Promise.all([
        fetch('/api/account/saved-accounts', { cache: 'no-store' }),
        fetch('/api/servers', { cache: 'no-store' }),
        fetch('/api/account/preferences', { cache: 'no-store' }),
      ])
      const accountsData = await accountsRes.json()
      const serversData = await serversRes.json()
      const preferencesData = await preferencesRes.json()
      if (accountsData.ok) setAccounts(accountsData.accounts ?? [])
      if (serversData.ok) {
        setServers(serversData.servers ?? [])
        setActiveServerId(serversData.activeServerId ?? null)
      }
      if (preferencesData.ok) setAvatar(preferencesData.avatar ?? { type: 'none', value: null })
    } catch {
      // keep header usable even if one panel fails to load
    } finally {
      setLoadingState(false)
    }
  }, [])

  useEffect(() => {
    void loadHeaderState()
  }, [loadHeaderState])

  useEffect(() => {
    const sync = () => void loadHeaderState()
    window.addEventListener('mcraftr:account-preferences-updated', sync)
    return () => window.removeEventListener('mcraftr:account-preferences-updated', sync)
  }, [loadHeaderState])

  useEffect(() => {
    const sync = () => {
      const sound = loadSoundSettings()
      const music = loadMusicSettings()
      setSoundEnabled(sound.masterEnabled)
      setSoundVolume(sound.volume)
      setMusicEnabled(music.enabled)
      setMusicVolume(music.volume)
    }
    sync()
    window.addEventListener('mcraftr:sound-settings-updated', sync)
    window.addEventListener('mcraftr:music-settings-updated', sync)
    return () => {
      window.removeEventListener('mcraftr:sound-settings-updated', sync)
      window.removeEventListener('mcraftr:music-settings-updated', sync)
    }
  }, [])

  useEffect(() => {
    setActiveServerId(session?.activeServerId ?? null)
  }, [session?.activeServerId])

  useEffect(() => {
    if (!open) return

    const onPointerDown = (event: MouseEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) setOpen(false)
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }

    window.addEventListener('mousedown', onPointerDown)
    window.addEventListener('keydown', onKeyDown)
    return () => {
      window.removeEventListener('mousedown', onPointerDown)
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  const accountValue = useMemo(() => currentUserId ?? '', [currentUserId])
  const serverValue = useMemo(() => activeServerId ?? '', [activeServerId])
  const activeServer = useMemo(
    () => servers.find(server => server.id === activeServerId) ?? null,
    [servers, activeServerId],
  )
  const currentEmail = session?.user?.email ?? 'Current account'
  const avatarLetter = currentEmail.trim().charAt(0).toUpperCase() || 'M'
  const avatarSrc = resolveAvatarSrc(avatar)

  const accountSummaryCard = (
    <div className="rounded-2xl border p-4" style={{ borderColor: 'var(--border)', background: 'color-mix(in srgb, var(--bg2) 74%, transparent)' }}>
      <div className="flex items-center gap-3">
        {avatarSrc ? (
          <img
            src={avatarSrc}
            alt="Profile picture"
            className="h-10 w-10 rounded-full border object-cover"
            style={{ borderColor: 'var(--accent-mid)', background: 'var(--panel)' }}
          />
        ) : (
          <span
            className="grid h-10 w-10 place-items-center rounded-full font-mono text-[14px] font-bold"
            style={{ background: 'var(--accent-dim)', color: 'var(--accent)' }}
          >
            {avatarLetter}
          </span>
        )}
        <div className="min-w-0">
          <div className="truncate font-mono text-[12px] tracking-[0.12em]" style={{ color: 'var(--text)' }}>
            {currentEmail}
          </div>
          <div className="truncate font-mono text-[10px] tracking-[0.12em]" style={{ color: 'var(--text-dim)' }}>
            {activeServer ? formatServerLabel(activeServer) : 'No active server'}
          </div>
        </div>
      </div>
    </div>
  )

  const accountAndServerFields = (
    <div className="space-y-3">
      <div>
        <label className="mb-1.5 flex items-center gap-2 text-[10px] font-mono uppercase tracking-[0.16em]" style={{ color: 'var(--text-dim)' }}>
          <UserRound size={12} />
          Account
        </label>
        <select
          value={accountValue}
          onChange={e => void handleSwitchAccount(e.target.value)}
          disabled={loadingState || switchingAccount || accounts.length === 0}
          className="w-full rounded-2xl border px-3 py-3 text-[12px] font-mono focus:outline-none"
          style={{ borderColor: 'var(--border)', background: 'var(--panel)', color: 'var(--text)' }}
        >
          {accounts.length === 0 && (
            <option value={accountValue}>{currentEmail}</option>
          )}
          {accounts.map(account => (
            <option key={account.userId} value={account.userId}>
              {account.email}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="mb-1.5 flex items-center gap-2 text-[10px] font-mono uppercase tracking-[0.16em]" style={{ color: 'var(--text-dim)' }}>
          <Server size={12} />
          Server
        </label>
        <select
          value={serverValue}
          onChange={e => void handleSwitchServer(e.target.value)}
          disabled={loadingState || switchingServer || servers.length === 0}
          className="w-full rounded-2xl border px-3 py-3 text-[12px] font-mono focus:outline-none"
          style={{ borderColor: 'var(--border)', background: 'var(--panel)', color: 'var(--text)' }}
        >
          {servers.length === 0 && (
            <option value="">No saved servers</option>
          )}
          {servers.map(server => (
            <option key={server.id} value={server.id}>
              {formatServerLabel(server)}
            </option>
          ))}
        </select>
      </div>
    </div>
  )

  const quickAppearanceCard = (
    <div className="rounded-2xl border p-4 space-y-3" style={{ borderColor: 'var(--border)', background: 'color-mix(in srgb, var(--bg2) 74%, transparent)' }}>
      <div className="text-[10px] font-mono uppercase tracking-[0.16em]" style={{ color: 'var(--text-dim)' }}>
        Quick Appearance
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <select
          value={theme}
          onChange={event => setTheme(event.target.value as 'dark' | 'light')}
          className="w-full rounded-2xl border px-3 py-3 text-[12px] font-mono focus:outline-none"
          style={{ borderColor: 'var(--border)', background: 'var(--panel)', color: 'var(--text)' }}
        >
          <option value="dark">Dark</option>
          <option value="light">Light</option>
        </select>
        <select
          value={accent}
          onChange={event => setAccent(event.target.value as typeof accent)}
          className="w-full rounded-2xl border px-3 py-3 text-[12px] font-mono focus:outline-none"
          style={{ borderColor: 'var(--border)', background: 'var(--panel)', color: 'var(--text)' }}
        >
          <option value="cyan">Cyan</option>
          <option value="blue">Blue</option>
          <option value="green">Green</option>
          <option value="purple">Purple</option>
          <option value="pink">Pink</option>
          <option value="orange">Orange</option>
          <option value="yellow">Yellow</option>
          <option value="red">Red</option>
          <option value="custom">Custom</option>
        </select>
        <select
          value={font}
          onChange={event => setFont(event.target.value as typeof font)}
          className="w-full rounded-2xl border px-3 py-3 text-[12px] font-mono focus:outline-none"
          style={{ borderColor: 'var(--border)', background: 'var(--panel)', color: 'var(--text)' }}
        >
          {FONTS.map(entry => <option key={entry.id} value={entry.id}>{entry.label}</option>)}
        </select>
        <select
          value={fontSize}
          onChange={event => setFontSize(event.target.value as typeof fontSize)}
          className="w-full rounded-2xl border px-3 py-3 text-[12px] font-mono focus:outline-none"
          style={{ borderColor: 'var(--border)', background: 'var(--panel)', color: 'var(--text)' }}
        >
          {FONT_SIZES.map(entry => <option key={entry.id} value={entry.id}>{entry.label}</option>)}
        </select>
      </div>
    </div>
  )

  const quickAudioCard = (
    <div className="rounded-2xl border p-4 space-y-3" style={{ borderColor: 'var(--border)', background: 'color-mix(in srgb, var(--bg2) 74%, transparent)' }}>
      <div className="text-[10px] font-mono uppercase tracking-[0.16em]" style={{ color: 'var(--text-dim)' }}>
        Quick Audio
      </div>
      <div className="space-y-3">
        <label className="block">
          <div className="mb-1 flex items-center justify-between text-[11px] font-mono" style={{ color: 'var(--text)' }}>
            <span>Sound FX</span>
            <button type="button" onClick={() => updateSound(!soundEnabled, soundVolume)} style={{ color: soundEnabled ? 'var(--accent)' : 'var(--text-dim)' }}>
              {soundEnabled ? 'ON' : 'OFF'}
            </button>
          </div>
          <input type="range" min={0} max={1} step={0.01} value={soundVolume} onChange={event => updateSound(soundEnabled, Number(event.target.value))} className="w-full" />
        </label>
        <label className="block">
          <div className="mb-1 flex items-center justify-between text-[11px] font-mono" style={{ color: 'var(--text)' }}>
            <span>Music</span>
            <button type="button" onClick={() => updateMusic(!musicEnabled, musicVolume)} style={{ color: musicEnabled ? 'var(--accent)' : 'var(--text-dim)' }}>
              {musicEnabled ? 'ON' : 'OFF'}
            </button>
          </div>
          <input type="range" min={0} max={1} step={0.01} value={musicVolume} onChange={event => updateMusic(musicEnabled, Number(event.target.value))} className="w-full" />
        </label>
      </div>
    </div>
  )

  const actionButtons = (
    <div className="space-y-2">
      <button
        type="button"
        onClick={() => void handleAddAccount()}
        className={actionRowClass('accent')}
        style={{
          color: 'var(--accent)',
          borderColor: 'var(--accent-mid)',
          background: 'linear-gradient(180deg, color-mix(in srgb, var(--accent) 14%, transparent), color-mix(in srgb, var(--panel) 88%, transparent))',
        }}
      >
        <Plus size={14} strokeWidth={2} />
        <span>Add Account</span>
      </button>

      <Link
        href="/connect"
        onClick={() => setOpen(false)}
        className={actionRowClass('accent')}
        style={{
          color: 'var(--accent)',
          borderColor: 'var(--accent-mid)',
          background: 'linear-gradient(180deg, color-mix(in srgb, var(--accent) 10%, transparent), color-mix(in srgb, var(--panel) 90%, transparent))',
        }}
      >
        <Server size={14} strokeWidth={2} />
        <span>Manage Servers</span>
      </Link>

      <button
        type="button"
        onClick={() => void handleForgetCurrentAccount()}
        disabled={!currentUserId}
        className={actionRowClass('subtle')}
        style={{
          color: 'var(--text-dim)',
          borderColor: 'var(--border)',
          background: 'color-mix(in srgb, var(--panel) 82%, transparent)',
          opacity: currentUserId ? 1 : 0.45,
        }}
      >
        <UserRound size={14} strokeWidth={2} />
        <span>Forget Device Copy</span>
      </button>

      <button
        type="button"
        onClick={() => signOut({ callbackUrl: '/login' })}
        className={actionRowClass('danger')}
        style={{
          color: '#ffb3bd',
          borderColor: 'color-mix(in srgb, #ff5a72 38%, var(--border))',
          background: 'linear-gradient(180deg, rgba(255,90,114,0.12), rgba(22,22,31,0.92))',
        }}
      >
        <LogOut size={14} strokeWidth={2} />
        <span>Sign out</span>
      </button>
    </div>
  )

  const desktopMenuContent = (
    <div className="space-y-4">
      {accountSummaryCard}
      {accountAndServerFields}
      {quickAppearanceCard}
      {quickAudioCard}
      {actionButtons}
    </div>
  )

  const mobileMenuContent = (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-[10px] font-mono uppercase tracking-[0.16em] text-[var(--accent)]">Account menu</div>
          <div className="mt-1 text-[11px] font-mono text-[var(--text-dim)]">Account, server, and quick preferences in one place.</div>
        </div>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="grid h-10 w-10 place-items-center rounded-2xl border border-[var(--border)] bg-[var(--panel)] text-[var(--text-dim)]"
        >
          <X size={16} strokeWidth={2} />
        </button>
      </div>
      {accountSummaryCard}
      {accountAndServerFields}
      {quickAppearanceCard}
      {quickAudioCard}
      {actionButtons}
    </div>
  )

  const handleSwitchAccount = async (targetUserId: string) => {
    if (!targetUserId || targetUserId === currentUserId) return
    setSwitchingAccount(true)
    try {
      const res = await fetch('/api/account/saved-accounts', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: targetUserId }),
      })
      const data = await res.json()
      if (!data.ok) throw new Error(data.error || 'Failed to switch account')
      window.location.href = pathname || '/minecraft'
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Failed to switch account')
      setSwitchingAccount(false)
    }
  }

  const handleAddAccount = async () => {
    try {
      await fetch('/api/account/saved-accounts', { method: 'POST' })
    } catch {
      // best effort
    }
    window.location.href = '/login'
  }

  const handleForgetCurrentAccount = async () => {
    if (!currentUserId) return
    try {
      const res = await fetch('/api/account/saved-accounts', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: currentUserId }),
      })
      const data = await res.json()
      if (!data.ok) throw new Error(data.error || 'Failed to forget account')
      setAccounts(data.accounts ?? [])
      setOpen(false)
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Failed to forget account')
    }
  }

  const handleSwitchServer = async (targetServerId: string) => {
    if (!targetServerId || targetServerId === activeServerId) return
    setSwitchingServer(true)
    try {
      const res = await fetch('/api/servers/active', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ serverId: targetServerId }),
      })
      const data = await res.json()
      if (!data.ok) throw new Error(data.error || 'Failed to switch server')
      await update()
      setActiveServerId(data.activeServerId ?? targetServerId)
      router.refresh()
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Failed to switch server')
    } finally {
      setSwitchingServer(false)
    }
  }

  const updateSound = (nextEnabled: boolean, nextVolume: number) => {
    const current = loadSoundSettings()
    saveSoundSettings({
      ...current,
      masterEnabled: nextEnabled,
      volume: Math.max(0, Math.min(1, nextVolume)),
    })
  }

  const updateMusic = (nextEnabled: boolean, nextVolume: number) => {
    const current = loadMusicSettings()
    saveMusicSettings({
      ...current,
      enabled: nextEnabled,
      volume: Math.max(0, Math.min(1, nextVolume)),
    })
  }

  return (
    <div className="relative" ref={menuRef}>
      <button
        type="button"
        aria-label="Open account menu"
        aria-expanded={open}
        onClick={() => setOpen(prev => !prev)}
        className="group flex items-center gap-2 rounded-full border px-2 py-1.5 transition-all hover:-translate-y-0.5"
        style={{
          borderColor: open ? 'var(--accent-mid)' : 'var(--border)',
          background: open
            ? 'linear-gradient(180deg, color-mix(in srgb, var(--accent) 12%, transparent), color-mix(in srgb, var(--panel) 88%, transparent))'
            : 'color-mix(in srgb, var(--panel) 84%, transparent)',
        }}
      >
        {avatarSrc ? (
          <img
            src={avatarSrc}
            alt="Profile picture"
            className="h-8 w-8 rounded-full border object-cover"
            style={{ borderColor: 'var(--accent-mid)', background: 'var(--panel)' }}
          />
        ) : (
          <span
            className="grid h-8 w-8 place-items-center rounded-full font-mono text-[12px] font-bold"
            style={{ background: 'var(--accent-dim)', color: 'var(--accent)' }}
          >
            {avatarLetter}
          </span>
        )}
        <span className="hidden sm:flex flex-col items-start leading-none">
          <span className="max-w-[132px] truncate font-mono text-[11px] tracking-[0.12em]" style={{ color: 'var(--text)' }}>
            {currentEmail}
          </span>
          <span className="max-w-[132px] truncate font-mono text-[10px] tracking-[0.12em]" style={{ color: 'var(--text-dim)' }}>
            {activeServer ? formatServerLabel(activeServer) : 'No active server'}
          </span>
        </span>
        <span
          className="grid h-8 w-8 place-items-center rounded-full border"
          style={{ borderColor: open ? 'var(--accent-mid)' : 'var(--border)', color: open ? 'var(--accent)' : 'var(--text-dim)' }}
        >
          <ChevronDown size={16} strokeWidth={2} className={`transition-transform ${open ? 'rotate-180' : 'rotate-0'}`} />
        </span>
      </button>

      {open && (
        <>
          <button
            type="button"
            aria-label="Close account menu overlay"
            onClick={() => setOpen(false)}
            className="fixed inset-0 z-40 bg-black/50 backdrop-blur-[2px] sm:hidden"
          />
          <div
            className="fixed inset-x-0 bottom-0 top-[calc(env(safe-area-inset-top)+3.5rem)] z-50 overflow-y-auto overscroll-contain rounded-t-[28px] border border-b-0 p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] shadow-[0_-24px_64px_rgba(0,0,0,0.42)] backdrop-blur-2xl touch-pan-y [-webkit-overflow-scrolling:touch] sm:hidden"
            style={{
              borderColor: 'var(--accent-mid)',
              background: 'color-mix(in srgb, var(--panel) 96%, transparent)',
            }}
          >
            {mobileMenuContent}
          </div>

          <div
            className="absolute right-0 top-[calc(100%+0.75rem)] z-40 hidden w-[min(92vw,22rem)] overflow-y-auto rounded-[24px] border p-4 shadow-[0_24px_64px_rgba(0,0,0,0.32)] backdrop-blur-2xl sm:block"
            style={{
              borderColor: 'var(--accent-mid)',
              background: 'color-mix(in srgb, var(--panel) 96%, transparent)',
              maxHeight: 'min(82vh, 42rem)',
            }}
          >
            {desktopMenuContent}
          </div>
        </>
      )}
    </div>
  )
}
