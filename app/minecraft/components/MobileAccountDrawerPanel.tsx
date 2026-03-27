'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { signOut, useSession } from 'next-auth/react'
import { LogOut, Plus, Server, UserRound } from 'lucide-react'
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

export default function MobileAccountDrawerPanel({ onNavigate }: { onNavigate?: () => void }) {
  const { data: session, update } = useSession()
  const currentUserId = session?.user?.id ?? null
  const [accounts, setAccounts] = useState<DeviceAccount[]>([])
  const [servers, setServers] = useState<SavedServer[]>([])
  const [activeServerId, setActiveServerId] = useState<string | null>(session?.activeServerId ?? null)
  const [switchingAccount, setSwitchingAccount] = useState(false)
  const [switchingServer, setSwitchingServer] = useState(false)
  const [loadingState, setLoadingState] = useState(true)
  const [avatar, setAvatar] = useState<AccountAvatar | null>(null)
  const [soundEnabled, setSoundEnabled] = useState(true)
  const [soundVolume, setSoundVolume] = useState(0.55)
  const [musicEnabled, setMusicEnabled] = useState(false)
  const [musicVolume, setMusicVolume] = useState(0.3)
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
      // keep drawer usable even if loading state partially fails
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

  const accountValue = useMemo(() => currentUserId ?? '', [currentUserId])
  const serverValue = useMemo(() => activeServerId ?? '', [activeServerId])
  const activeServer = useMemo(
    () => servers.find(server => server.id === activeServerId) ?? null,
    [servers, activeServerId],
  )
  const currentEmail = session?.user?.email ?? 'Current account'
  const avatarLetter = currentEmail.trim().charAt(0).toUpperCase() || 'M'
  const avatarSrc = resolveAvatarSrc(avatar)

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
      window.location.href = '/minecraft'
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Failed to switch account')
      setSwitchingAccount(false)
    }
  }

  const handleAddAccount = async () => {
    try {
      await fetch('/api/account/saved-accounts', { method: 'POST' })
    } catch {
      // continue to login flow even if warm-up fails
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
      onNavigate?.()
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Failed to forget account')
    }
  }

  const handleSwitchServer = async (serverId: string) => {
    if (!serverId || serverId === activeServerId) return
    setSwitchingServer(true)
    try {
      const res = await fetch('/api/servers/active', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ serverId }),
      })
      const data = await res.json()
      if (!data.ok) throw new Error(data.error || 'Failed to switch server')
      await update()
      setActiveServerId(data.activeServerId ?? serverId)
      onNavigate?.()
      window.location.reload()
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
    <div className="space-y-4 pt-4 border-t border-[var(--border)]">
      <div className="space-y-4 rounded-[24px] border border-[var(--accent-mid)] bg-[linear-gradient(180deg,rgba(82,190,255,0.1),rgba(8,11,16,0.94))] p-4 shadow-[0_20px_40px_rgba(0,0,0,0.18)]">
        <div>
          <div className="text-[10px] font-mono uppercase tracking-[0.16em] text-[var(--accent)]">Account & Quick Settings</div>
          <div className="mt-1 text-[11px] font-mono text-[var(--text-dim)]">Everything that used to live in the avatar menu, built for touch.</div>
        </div>

        <div className="rounded-2xl border p-4" style={{ borderColor: 'var(--border)', background: 'color-mix(in srgb, var(--bg2) 74%, transparent)' }}>
          <div className="flex items-center gap-3">
            {avatarSrc ? (
              /* eslint-disable-next-line @next/next/no-img-element -- tiny avatar source can be builtin SVG, upload, or data URL */
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
              {accounts.length === 0 && <option value={accountValue}>{currentEmail}</option>}
              {accounts.map(account => (
                <option key={account.userId} value={account.userId}>{account.email}</option>
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
              {servers.length === 0 && <option value="">No saved servers</option>}
              {servers.map(server => (
                <option key={server.id} value={server.id}>{formatServerLabel(server)}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="rounded-2xl border p-4 space-y-3" style={{ borderColor: 'var(--border)', background: 'color-mix(in srgb, var(--bg2) 74%, transparent)' }}>
          <div className="text-[10px] font-mono uppercase tracking-[0.16em]" style={{ color: 'var(--text-dim)' }}>Quick Appearance</div>
          <div className="grid gap-3">
            <select value={theme} onChange={event => setTheme(event.target.value as 'dark' | 'light')} className="w-full rounded-2xl border px-3 py-3 text-[12px] font-mono focus:outline-none" style={{ borderColor: 'var(--border)', background: 'var(--panel)', color: 'var(--text)' }}>
              <option value="dark">Dark</option>
              <option value="light">Light</option>
            </select>
            <select value={accent} onChange={event => setAccent(event.target.value as typeof accent)} className="w-full rounded-2xl border px-3 py-3 text-[12px] font-mono focus:outline-none" style={{ borderColor: 'var(--border)', background: 'var(--panel)', color: 'var(--text)' }}>
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
            <select value={font} onChange={event => setFont(event.target.value as typeof font)} className="w-full rounded-2xl border px-3 py-3 text-[12px] font-mono focus:outline-none" style={{ borderColor: 'var(--border)', background: 'var(--panel)', color: 'var(--text)' }}>
              {FONTS.map(entry => <option key={entry.id} value={entry.id}>{entry.label}</option>)}
            </select>
            <select value={fontSize} onChange={event => setFontSize(event.target.value as typeof fontSize)} className="w-full rounded-2xl border px-3 py-3 text-[12px] font-mono focus:outline-none" style={{ borderColor: 'var(--border)', background: 'var(--panel)', color: 'var(--text)' }}>
              {FONT_SIZES.map(entry => <option key={entry.id} value={entry.id}>{entry.label}</option>)}
            </select>
          </div>
        </div>

        <div className="rounded-2xl border p-4 space-y-3" style={{ borderColor: 'var(--border)', background: 'color-mix(in srgb, var(--bg2) 74%, transparent)' }}>
          <div className="text-[10px] font-mono uppercase tracking-[0.16em]" style={{ color: 'var(--text-dim)' }}>Quick Audio</div>
          <div className="space-y-3">
            <label className="block">
              <div className="mb-1 flex items-center justify-between text-[11px] font-mono" style={{ color: 'var(--text)' }}>
                <span>Sound FX</span>
                <button type="button" onClick={() => updateSound(!soundEnabled, soundVolume)} style={{ color: soundEnabled ? 'var(--accent)' : 'var(--text-dim)' }}>{soundEnabled ? 'ON' : 'OFF'}</button>
              </div>
              <input type="range" min={0} max={1} step={0.01} value={soundVolume} onChange={event => updateSound(soundEnabled, Number(event.target.value))} className="w-full" />
            </label>
            <label className="block">
              <div className="mb-1 flex items-center justify-between text-[11px] font-mono" style={{ color: 'var(--text)' }}>
                <span>Music</span>
                <button type="button" onClick={() => updateMusic(!musicEnabled, musicVolume)} style={{ color: musicEnabled ? 'var(--accent)' : 'var(--text-dim)' }}>{musicEnabled ? 'ON' : 'OFF'}</button>
              </div>
              <input type="range" min={0} max={1} step={0.01} value={musicVolume} onChange={event => updateMusic(musicEnabled, Number(event.target.value))} className="w-full" />
            </label>
          </div>
        </div>

        <div className="space-y-2">
          <button type="button" onClick={() => void handleAddAccount()} className={actionRowClass('accent')} style={{ color: 'var(--accent)', borderColor: 'var(--accent-mid)', background: 'linear-gradient(180deg, color-mix(in srgb, var(--accent) 14%, transparent), color-mix(in srgb, var(--panel) 88%, transparent))' }}>
            <Plus size={14} strokeWidth={2} />
            <span>Add Account</span>
          </button>

          <Link href="/connect" onClick={onNavigate} className={actionRowClass('accent')} style={{ color: 'var(--accent)', borderColor: 'var(--accent-mid)', background: 'linear-gradient(180deg, color-mix(in srgb, var(--accent) 10%, transparent), color-mix(in srgb, var(--panel) 90%, transparent))' }}>
            <Server size={14} strokeWidth={2} />
            <span>Manage Servers</span>
          </Link>

          <button type="button" onClick={() => void handleForgetCurrentAccount()} disabled={!currentUserId} className={actionRowClass('subtle')} style={{ color: 'var(--text-dim)', borderColor: 'var(--border)', background: 'color-mix(in srgb, var(--panel) 82%, transparent)', opacity: currentUserId ? 1 : 0.45 }}>
            <UserRound size={14} strokeWidth={2} />
            <span>Forget Device Copy</span>
          </button>

          <button type="button" onClick={() => signOut({ callbackUrl: '/login' })} className={actionRowClass('danger')} style={{ color: '#ffb3bd', borderColor: 'color-mix(in srgb, #ff5a72 38%, var(--border))', background: 'linear-gradient(180deg, rgba(255,90,114,0.12), rgba(22,22,31,0.92))' }}>
            <LogOut size={14} strokeWidth={2} />
            <span>Sign out</span>
          </button>
        </div>
      </div>
    </div>
  )
}
