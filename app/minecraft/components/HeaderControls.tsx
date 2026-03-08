'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { signOut, useSession } from 'next-auth/react'
import { ChevronDown, LogOut, Menu, Plus, Server, UserRound } from 'lucide-react'

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
  const menuRef = useRef<HTMLDivElement | null>(null)

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

  return (
    <div className="relative" ref={menuRef}>
      <button
        type="button"
        aria-label="Open account menu"
        aria-expanded={open}
        onClick={() => setOpen(prev => !prev)}
        className="group flex items-center gap-3 rounded-full border px-2.5 py-2 transition-all hover:-translate-y-0.5"
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
          <span className="max-w-[180px] truncate font-mono text-[11px] tracking-[0.12em]" style={{ color: 'var(--text)' }}>
            {currentEmail}
          </span>
          <span className="max-w-[180px] truncate font-mono text-[10px] tracking-[0.12em]" style={{ color: 'var(--text-dim)' }}>
            {activeServer ? formatServerLabel(activeServer) : 'No active server'}
          </span>
        </span>
        <span
          className="grid h-8 w-8 place-items-center rounded-full border"
          style={{ borderColor: open ? 'var(--accent-mid)' : 'var(--border)', color: open ? 'var(--accent)' : 'var(--text-dim)' }}
        >
          <ChevronDown size={16} strokeWidth={2} className={`transition-transform ${open ? 'rotate-180' : 'rotate-0'}`} />
        </span>
        <span className="sm:hidden" style={{ color: open ? 'var(--accent)' : 'var(--text-dim)' }}>
          <Menu size={16} strokeWidth={2} />
        </span>
      </button>

      {open && (
        <div
          className="absolute right-0 top-[calc(100%+0.75rem)] w-[min(92vw,360px)] rounded-[24px] border p-4 shadow-[0_24px_64px_rgba(0,0,0,0.32)] backdrop-blur-2xl"
          style={{
            borderColor: 'var(--accent-mid)',
            background: 'color-mix(in srgb, var(--panel) 92%, transparent)',
          }}
        >
          <div className="space-y-4">
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
          </div>
        </div>
      )}
    </div>
  )
}
