'use client'
import { useCallback, useEffect, useState, Suspense } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { useSession } from 'next-auth/react'
import BrandLockup from '@/app/components/BrandLockup'
import { sanitizeBridgePrefix, sanitizeBridgeProviderLabel } from '@/lib/public-branding'
import { getServerStackDescription, getServerStackLabel, type ServerStackMode } from '@/lib/server-stack'

type TestState = 'idle' | 'testing' | 'success' | 'fail'

type SavedServer = {
  id: string
  label: string | null
  host: string
  port: number
  stackMode: ServerStackMode
  stackLabel: string
  stackDescription: string
  minecraftVersion: {
    override: string | null
    resolved: string | null
    source: 'manual' | 'bridge' | 'fallback'
    detectedAt: number | null
  }
  bridge?: {
    enabled: boolean
    commandPrefix: string
    providerId: string | null
    providerLabel: string | null
    protocolVersion: string | null
    lastSeen: number | null
    lastError: string | null
    capabilities: string[]
  }
  sidecar?: {
    enabled: boolean
    url: string | null
    lastSeen: number | null
    capabilities: string[]
    structureRoots: string[]
    entityPresetRoots: string[]
  }
  createdAt: number
  updatedAt: number
}

function ConnectForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const wantsEdit = searchParams?.get('edit') === '1'
  const { status, update: updateSession } = useSession()

  const [label, setLabel] = useState('')
  const [host, setHost] = useState('')
  const [port, setPort] = useState('25575')
  const [password, setPassword] = useState('')
  const [stackMode, setStackMode] = useState<ServerStackMode>('full')
  const [bridgeEnabled, setBridgeEnabled] = useState(true)
  const [bridgeCommandPrefix, setBridgeCommandPrefix] = useState('mcraftr')
  const [sidecarEnabled, setSidecarEnabled] = useState(true)
  const [sidecarUrl, setSidecarUrl] = useState('http://mcraftr-beacon:9419/')
  const [sidecarToken, setSidecarToken] = useState('')
  const [sidecarStructureRoots, setSidecarStructureRoots] = useState('')
  const [sidecarEntityPresetRoots, setSidecarEntityPresetRoots] = useState('')
  const [minecraftVersionOverride, setMinecraftVersionOverride] = useState('')
  const [showHelp, setShowHelp] = useState(false)
  const [testState, setTestState] = useState<TestState>('idle')
  const [testMsg, setTestMsg] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')
  const [loadingServers, setLoadingServers] = useState(true)
  const [servers, setServers] = useState<SavedServer[]>([])
  const [activeServerId, setActiveServerId] = useState<string | null>(null)
  const [editingServerId, setEditingServerId] = useState<string | null>(null)

  const applyStackMode = useCallback((mode: ServerStackMode) => {
    setStackMode(mode)
    setBridgeEnabled(mode === 'full')
    setSidecarEnabled(mode === 'full')
    if (mode === 'full') {
      setBridgeCommandPrefix(current => current.trim() || 'mcraftr')
      setSidecarUrl(current => current.trim() || 'http://mcraftr-beacon:9419/')
    }
    setTestState('idle')
    setTestMsg('')
    setError('')
    setInfo('')
  }, [])

  const resetForm = useCallback(() => {
    setEditingServerId(null)
    setLabel('')
    setHost('')
    setPort('25575')
    setPassword('')
    setStackMode('full')
    setBridgeEnabled(true)
    setBridgeCommandPrefix('mcraftr')
    setSidecarEnabled(true)
    setSidecarUrl('http://mcraftr-beacon:9419/')
    setSidecarToken('')
    setSidecarStructureRoots('')
    setSidecarEntityPresetRoots('')
    setMinecraftVersionOverride('')
    setTestState('idle')
    setTestMsg('')
    setError('')
    setInfo('')
  }, [])

  const loadServers = useCallback(async () => {
    setLoadingServers(true)
    try {
      const res = await fetch('/api/servers', { cache: 'no-store' })
      const data = await res.json()
      if (!data.ok) throw new Error(data.error || 'Failed to load servers')
      const nextServers = (data.servers ?? []) as SavedServer[]
      setServers(nextServers)
      setActiveServerId(data.activeServerId ?? null)
      if (wantsEdit && !editingServerId) {
        const active = nextServers.find(server => server.id === data.activeServerId) ?? nextServers[0]
        if (active) {
          setEditingServerId(active.id)
          setLabel(active.label ?? '')
          setHost(active.host)
          setPort(String(active.port ?? 25575))
          setPassword('')
          setStackMode(active.stackMode ?? 'quick')
          setBridgeEnabled(!!active.bridge?.enabled)
          setBridgeCommandPrefix(active.bridge?.commandPrefix ?? 'mcraftr')
          setSidecarEnabled(!!active.sidecar?.enabled)
          setSidecarUrl(active.sidecar?.url ?? 'http://mcraftr-beacon:9419/')
          setSidecarToken('')
          setSidecarStructureRoots((active.sidecar?.structureRoots ?? []).join('\n'))
          setSidecarEntityPresetRoots((active.sidecar?.entityPresetRoots ?? []).join('\n'))
          setMinecraftVersionOverride(active.minecraftVersion?.override ?? '')
        }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load servers')
    } finally {
      setLoadingServers(false)
    }
  }, [editingServerId, wantsEdit])

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.replace('/login')
    }
  }, [router, status])

  useEffect(() => {
    if (status !== 'authenticated') return
    void loadServers()
  }, [loadServers, status])

  if (status !== 'authenticated') {
    return null
  }

  const startEditing = (server: SavedServer) => {
    setEditingServerId(server.id)
    setLabel(server.label ?? '')
    setHost(server.host)
    setPort(String(server.port ?? 25575))
    setPassword('')
    setStackMode(server.stackMode ?? 'quick')
    setBridgeEnabled(!!server.bridge?.enabled)
    setBridgeCommandPrefix(server.bridge?.commandPrefix ?? 'mcraftr')
    setSidecarEnabled(!!server.sidecar?.enabled)
    setSidecarUrl(server.sidecar?.url ?? 'http://mcraftr-beacon:9419/')
    setSidecarToken('')
    setSidecarStructureRoots((server.sidecar?.structureRoots ?? []).join('\n'))
    setSidecarEntityPresetRoots((server.sidecar?.entityPresetRoots ?? []).join('\n'))
    setMinecraftVersionOverride(server.minecraftVersion?.override ?? '')
    setTestState('idle')
    setTestMsg('')
    setError('')
    setInfo('')
  }

  const handleTest = async () => {
    if (!host || !password) {
      setTestMsg('Enter your server address and RCON password first')
      setTestState('fail')
      return
    }
    if (stackMode === 'full' && !sidecarUrl.trim()) {
      setTestMsg('Beacon URL is required for the Full Mcraftr Stack')
      setTestState('fail')
      return
    }
    setTestState('testing')
    setTestMsg('')
    try {
      const res = await fetch('/api/server', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          host,
          port: parseInt(port) || 25575,
          password,
          stackMode,
          bridgeEnabled: stackMode === 'full',
          bridgeCommandPrefix: bridgeCommandPrefix.trim() || 'mcraftr',
          sidecarEnabled: stackMode === 'full',
          sidecarUrl: sidecarUrl.trim() || null,
          sidecarToken: sidecarToken.trim() || null,
          minecraftVersionOverride: minecraftVersionOverride.trim() || null,
        }),
      })
      const data = await res.json()
      if (data.ok) {
        setTestState('success')
        setTestMsg(data.message || 'Connection successful!')
      } else {
        setTestState('fail')
        setTestMsg(data.error || 'Could not connect to your server')
      }
    } catch {
      setTestState('fail')
      setTestMsg('Something went wrong. Check your connection.')
    }
  }

  const handleSave = async () => {
    if (!host || !password) {
      setError('Server address and RCON password are required')
      return
    }
    if (stackMode === 'full' && !sidecarUrl.trim()) {
      setError('Beacon URL is required for the Full Mcraftr Stack')
      return
    }
    setSaving(true)
    setError('')
    setInfo('')
    try {
      const payload = {
        label: label.trim() || null,
        host,
        port: parseInt(port) || 25575,
        password,
        stackMode,
        bridgeEnabled: stackMode === 'full',
        bridgeCommandPrefix: bridgeCommandPrefix.trim() || 'mcraftr',
        sidecarEnabled: stackMode === 'full',
        sidecarUrl: sidecarUrl.trim() || null,
        sidecarToken: sidecarToken.trim() || null,
        sidecarStructureRoots,
        sidecarEntityPresetRoots,
        minecraftVersionOverride: minecraftVersionOverride.trim() || null,
      }
      const res = await fetch(editingServerId ? `/api/servers/${editingServerId}` : '/api/servers', {
        method: editingServerId ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (!data.ok) {
        setError(data.error || 'Failed to save server')
        setSaving(false)
        return
      }

      await updateSession()
      await loadServers()

      const savedServer = data.server as SavedServer | undefined
      const warnings = Array.isArray(data.warnings) ? data.warnings.filter((entry: unknown): entry is string => typeof entry === 'string' && entry.trim().length > 0) : []
      const warningSuffix = warnings.length > 0 ? ` Warning: ${warnings.join(' ')}` : ''
      if (editingServerId) {
        setInfo(`Server updated as ${getServerStackLabel(savedServer?.stackMode ?? stackMode)}.${warningSuffix}`)
      } else if (servers.length === 0) {
        window.location.href = '/minecraft'
        return
      } else {
        setInfo(`Server added as ${getServerStackLabel(savedServer?.stackMode ?? stackMode)}.${warningSuffix}`)
      }

      resetForm()
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  const handleActivate = async (serverId: string) => {
    try {
      const res = await fetch('/api/servers/active', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ serverId }),
      })
      const data = await res.json()
      if (!data.ok) throw new Error(data.error || 'Failed to switch server')
      await updateSession()
      await loadServers()
      setInfo('Active server updated')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to switch server')
    }
  }

  const handleDelete = async (server: SavedServer) => {
    if (!confirm(`Delete ${server.label?.trim() || `${server.host}:${server.port}`}?`)) return
    try {
      const res = await fetch(`/api/servers/${server.id}`, { method: 'DELETE' })
      const data = await res.json()
      if (!data.ok) throw new Error(data.error || 'Failed to delete server')
      await updateSession()
      await loadServers()
      if (editingServerId === server.id) resetForm()
      setInfo('Server removed')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to delete server')
    }
  }

  const heading = servers.length > 0 ? 'manage your minecraft servers' : 'connect your minecraft server'
  const stackModeLabel = getServerStackLabel(stackMode)
  const stackModeDescription = getServerStackDescription(stackMode)
  const fullStackSelected = stackMode === 'full'

  return (
    <div className="min-h-screen p-4 sm:p-6" style={{ background: 'var(--bg)' }}>
      <div className="w-full max-w-5xl mx-auto py-6 sm:py-10">
        <div className="text-center mb-8">
          <Link href="/minecraft" className="inline-flex rounded-2xl px-3 py-2 transition-transform hover:-translate-y-0.5" aria-label="Return to Mcraftr">
            <BrandLockup size="hero" className="justify-center" />
          </Link>
          <div className="text-xs font-mono mt-1" style={{ color: 'var(--text-dim)' }}>
            {heading}
          </div>
          <div className="text-[11px] font-mono mt-3" style={{ color: 'var(--text-dim)' }}>
            Click the mark to go back, or finish here and return below.
          </div>
        </div>

        <div className="grid gap-5 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="glass-card p-6 space-y-5">
            <p className="text-sm font-mono" style={{ color: 'var(--text-dim)' }}>
              {editingServerId
                ? 'Update the selected saved server. Enter the password again when saving changes.'
                : servers.length > 0
                  ? 'Add another server or edit an existing saved server connection.'
                  : 'Choose Quick Connect for a fast RCON-only setup, or use the Full Mcraftr Stack for the experience Mcraftr is designed around.'}
            </p>

            <div className="space-y-3 rounded-[22px] border border-[var(--border)] bg-[var(--panel)] p-4">
              <div>
                <div className="text-[11px] font-mono tracking-widest" style={{ color: 'var(--text-dim)' }}>CONNECTION PROFILE</div>
                <div className="mt-1 text-[12px] font-mono" style={{ color: 'var(--text-dim)' }}>
                  Quick Connect works with any RCON server. Full Mcraftr Stack is the recommended path for Worlds, structures, entities, maps, and version-aware surfaces.
                </div>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                {([
                  {
                    mode: 'quick',
                    title: 'Quick Connect',
                    description: 'RCON-only compatibility mode for chat, moderation, actions, kits, and terminal basics.',
                  },
                  {
                    mode: 'full',
                    title: 'Full Mcraftr Stack',
                    description: 'RCON + Relay + Beacon for Worlds, structures, entities, maps, catalog art, and the designed Mcraftr workflow.',
                  },
                ] as const).map(option => {
                  const active = stackMode === option.mode
                  return (
                    <button
                      key={option.mode}
                      type="button"
                      onClick={() => applyStackMode(option.mode)}
                      className="rounded-[20px] border px-4 py-4 text-left transition-all"
                      style={active
                        ? { borderColor: 'var(--accent-mid)', background: 'var(--accent-dim)' }
                        : { borderColor: 'var(--border)', background: 'var(--bg2)' }}
                    >
                      <div className="text-[13px] font-mono tracking-[0.14em]" style={{ color: active ? 'var(--accent)' : 'var(--text)' }}>
                        {option.title.toUpperCase()}
                      </div>
                      <div className="mt-2 text-[12px] font-mono" style={{ color: 'var(--text-dim)' }}>
                        {option.description}
                      </div>
                    </button>
                  )
                })}
              </div>
              <div className="rounded-2xl border px-4 py-3 text-[12px] font-mono" style={{ borderColor: 'var(--border)', background: 'var(--bg2)', color: 'var(--text-dim)' }}>
                <span style={{ color: 'var(--accent)' }}>{stackModeLabel}</span> — {stackModeDescription}
              </div>
            </div>

            <div>
              <label className="block text-[9px] font-mono tracking-widest mb-1.5" style={{ color: 'var(--text-dim)' }}>
                SERVER LABEL <span style={{ color: 'var(--text-dim)', fontWeight: 'normal' }}>(optional)</span>
              </label>
              <input
                type="text"
                value={label}
                onChange={e => { setLabel(e.target.value); setTestState('idle'); setTestMsg('') }}
                placeholder="Family SMP, Kids World, Survival..."
                className="w-full px-3 py-2.5 rounded-lg font-mono text-sm focus:outline-none transition-colors"
                style={{ background: 'var(--panel)', border: '1px solid var(--border)', color: 'var(--text)', fontSize: '16px' }}
              />
            </div>

            <div>
              <label className="block text-[9px] font-mono tracking-widest mb-1.5" style={{ color: 'var(--text-dim)' }}>
                SERVER ADDRESS
              </label>
              <input
                type="text"
                value={host}
                onChange={e => { setHost(e.target.value); setTestState('idle'); setTestMsg('') }}
                placeholder="play.yourserver.com or 192.168.1.100"
                className="w-full px-3 py-2.5 rounded-lg font-mono text-sm focus:outline-none transition-colors"
                style={{ background: 'var(--panel)', border: '1px solid var(--border)', color: 'var(--text)', fontSize: '16px' }}
              />
            </div>

            <div>
              <label className="block text-[9px] font-mono tracking-widest mb-1.5" style={{ color: 'var(--text-dim)' }}>
                RCON PORT
              </label>
              <input
                type="number"
                value={port}
                onChange={e => { setPort(e.target.value); setTestState('idle'); setTestMsg('') }}
                className="w-full px-3 py-2.5 rounded-lg font-mono text-sm focus:outline-none transition-colors"
                style={{ background: 'var(--panel)', border: '1px solid var(--border)', color: 'var(--text)', fontSize: '16px' }}
              />
            </div>

            <div>
              <label className="block text-[9px] font-mono tracking-widest mb-1.5" style={{ color: 'var(--text-dim)' }}>
                RCON PASSWORD
              </label>
              <input
                type="password"
                value={password}
                onChange={e => { setPassword(e.target.value); setTestState('idle'); setTestMsg('') }}
                placeholder={editingServerId ? 'Enter password again to save changes' : 'Found in your server control panel'}
                className="w-full px-3 py-2.5 rounded-lg font-mono text-sm focus:outline-none transition-colors"
                style={{ background: 'var(--panel)', border: '1px solid var(--border)', color: 'var(--text)', fontSize: '16px' }}
              />

              <button
                type="button"
                onClick={() => setShowHelp(h => !h)}
                className="text-[10px] font-mono mt-1.5 underline"
                style={{ color: 'var(--accent)' }}
              >
                {showHelp ? 'Hide help' : 'Where do I find this?'}
              </button>

              {showHelp && (
                <div className="mt-3 p-3 rounded-lg space-y-2 text-[11px] font-mono" style={{ background: 'var(--panel)', border: '1px solid var(--border)', color: 'var(--text-dim)' }}>
                  <p className="font-bold" style={{ color: 'var(--text)' }}>Finding your RCON password:</p>
                  <ul className="space-y-1.5 list-none">
                    <li><span style={{ color: 'var(--accent)' }}>Apex Hosting</span> — Game Panel → Config Files → server.properties → look for <code>rcon.password</code></li>
                    <li><span style={{ color: 'var(--accent)' }}>Shockbyte</span> — Multicraft panel → Files → Config Files → server.properties</li>
                    <li><span style={{ color: 'var(--accent)' }}>Bisect Hosting</span> — Game Panel → Configuration → server.properties</li>
                    <li><span style={{ color: 'var(--accent)' }}>Nodecraft</span> — Game panel → Configuration → server.properties</li>
                    <li><span style={{ color: 'var(--accent)' }}>Self-hosted</span> — Open <code>server.properties</code>, set <code>enable-rcon=true</code>, and set <code>rcon.password</code>.</li>
                  </ul>
                </div>
              )}
            </div>

            <div>
              <label className="block text-[9px] font-mono tracking-widest mb-1.5" style={{ color: 'var(--text-dim)' }}>
                MINECRAFT VERSION <span style={{ color: 'var(--text-dim)', fontWeight: 'normal' }}>{fullStackSelected ? '(optional override)' : '(recommended)'}</span>
              </label>
              <input
                type="text"
                value={minecraftVersionOverride}
                onChange={e => setMinecraftVersionOverride(e.target.value)}
                placeholder={fullStackSelected ? 'Leave blank to use Relay detection' : '1.21.11'}
                className="w-full px-3 py-2.5 rounded-lg font-mono text-sm focus:outline-none transition-colors"
                style={{ background: 'var(--panel)', border: '1px solid var(--border)', color: 'var(--text)', fontSize: '16px' }}
              />
              <div className="mt-1 text-[10px] font-mono" style={{ color: 'var(--text-dim)' }}>
                {fullStackSelected
                  ? 'Override the detected Minecraft version only if Relay reporting is unavailable or wrong. Version-aware art and compatibility will use this value first.'
                  : 'Quick Connect cannot detect Minecraft version on its own. Set this so version-aware art and compatibility match the server you are connecting to.'}
              </div>
            </div>

            {fullStackSelected ? (
              <>
                <div className="rounded-xl border border-[var(--border)] bg-[var(--panel)] p-4 space-y-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-[11px] font-mono tracking-widest" style={{ color: 'var(--text-dim)' }}>MCRAFTR RELAY</div>
                      <div className="text-[12px] font-mono mt-1" style={{ color: 'var(--text-dim)' }}>
                        Mcraftr's live integration layer for world operations, plugin stack data, typed server actions, and the deeper workflow. Your server needs a Relay API integration that exposes a relay prefix over RCON.
                      </div>
                    </div>
                    <div className="rounded border px-2 py-1 text-[10px] font-mono tracking-widest" style={{ borderColor: 'var(--accent-mid)', background: 'var(--accent-dim)', color: 'var(--accent)' }}>
                      ENABLED IN FULL STACK
                    </div>
                  </div>

                  <div>
                    <label className="block text-[9px] font-mono tracking-widest mb-1.5" style={{ color: 'var(--text-dim)' }}>
                      RELAY PREFIX
                    </label>
                    <input
                      type="text"
                      value={bridgeCommandPrefix}
                      onChange={e => setBridgeCommandPrefix(e.target.value)}
                      placeholder="mcraftr"
                      className="w-full px-3 py-2.5 rounded-lg font-mono text-sm focus:outline-none transition-colors"
                      style={{ background: 'var(--panel)', border: '1px solid var(--border)', color: 'var(--text)', fontSize: '16px' }}
                    />
                    <div className="mt-1 text-[10px] font-mono" style={{ color: 'var(--text-dim)' }}>
                      Enter the relay prefix exposed by your server's Relay API integration. Change this only if your plugin or mod uses a custom prefix.
                    </div>
                  </div>
                </div>

                <div className="rounded-xl border border-[var(--border)] bg-[var(--panel)] p-4 space-y-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-[11px] font-mono tracking-widest" style={{ color: 'var(--text-dim)' }}>MCRAFTR BEACON</div>
                      <div className="text-[12px] font-mono mt-1" style={{ color: 'var(--text-dim)' }}>
                        Catalog and world-context service for structure discovery, preset scanning, map links, generated previews, and filesystem-backed metadata.
                      </div>
                    </div>
                    <div className="rounded border px-2 py-1 text-[10px] font-mono tracking-widest" style={{ borderColor: 'var(--accent-mid)', background: 'var(--accent-dim)', color: 'var(--accent)' }}>
                      ENABLED IN FULL STACK
                    </div>
                  </div>

                  <div>
                    <label className="block text-[9px] font-mono tracking-widest mb-1.5" style={{ color: 'var(--text-dim)' }}>
                      BEACON URL
                    </label>
                    <input
                      type="text"
                      value={sidecarUrl}
                      onChange={e => setSidecarUrl(e.target.value)}
                      placeholder="http://mcraftr-beacon:9419/"
                      className="w-full px-3 py-2.5 rounded-lg font-mono text-sm focus:outline-none transition-colors"
                      style={{ background: 'var(--panel)', border: '1px solid var(--border)', color: 'var(--text)', fontSize: '16px' }}
                    />
                  </div>

                  <div>
                    <label className="block text-[9px] font-mono tracking-widest mb-1.5" style={{ color: 'var(--text-dim)' }}>
                      BEACON TOKEN <span style={{ color: 'var(--text-dim)', fontWeight: 'normal' }}>(optional on edit)</span>
                    </label>
                    <input
                      type="password"
                      value={sidecarToken}
                      onChange={e => setSidecarToken(e.target.value)}
                      placeholder={editingServerId ? 'Leave blank to keep current token' : 'Shared beacon token'}
                      className="w-full px-3 py-2.5 rounded-lg font-mono text-sm focus:outline-none transition-colors"
                      style={{ background: 'var(--panel)', border: '1px solid var(--border)', color: 'var(--text)', fontSize: '16px' }}
                    />
                  </div>

                  <div>
                    <label className="block text-[9px] font-mono tracking-widest mb-1.5" style={{ color: 'var(--text-dim)' }}>
                      STRUCTURE DIRECTORIES <span style={{ color: 'var(--text-dim)', fontWeight: 'normal' }}>(one relative path per line)</span>
                    </label>
                    <textarea
                      value={sidecarStructureRoots}
                      onChange={e => setSidecarStructureRoots(e.target.value)}
                      rows={3}
                      placeholder={'plugins/WorldEdit/schematics/custom\nmcraftr/structures'}
                      className="w-full px-3 py-2.5 rounded-lg font-mono text-sm focus:outline-none transition-colors"
                      style={{ background: 'var(--panel)', border: '1px solid var(--border)', color: 'var(--text)', fontSize: '16px' }}
                    />
                    <div className="mt-1 text-[10px] font-mono" style={{ color: 'var(--text-dim)' }}>
                      Paths are relative to the server data folder at <code>/data</code>.
                    </div>
                  </div>

                  <div>
                    <label className="block text-[9px] font-mono tracking-widest mb-1.5" style={{ color: 'var(--text-dim)' }}>
                      ENTITY PRESET DIRECTORIES <span style={{ color: 'var(--text-dim)', fontWeight: 'normal' }}>(one relative path per line)</span>
                    </label>
                    <textarea
                      value={sidecarEntityPresetRoots}
                      onChange={e => setSidecarEntityPresetRoots(e.target.value)}
                      rows={3}
                      placeholder={'mcraftr/entity-presets\nplugins/FancyNpcs/presets'}
                      className="w-full px-3 py-2.5 rounded-lg font-mono text-sm focus:outline-none transition-colors"
                      style={{ background: 'var(--panel)', border: '1px solid var(--border)', color: 'var(--text)', fontSize: '16px' }}
                    />
                    <div className="mt-1 text-[10px] font-mono" style={{ color: 'var(--text-dim)' }}>
                      These folders are scanned for custom JSON entity presets.
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <div className="rounded-xl border border-[var(--border)] bg-[var(--panel)] p-4 space-y-3">
                <div className="text-[11px] font-mono tracking-widest" style={{ color: 'var(--text-dim)' }}>QUICK CONNECT ACTIVE</div>
                <div className="text-[12px] font-mono" style={{ color: 'var(--text-dim)' }}>
                  This server will run in RCON-only compatibility mode. Worlds, structures, entities, maps, and the designed Mcraftr workflow stay hidden until you switch this server to the Full Mcraftr Stack.
                </div>
                <button
                  type="button"
                  onClick={() => applyStackMode('full')}
                  className="rounded-xl border px-3 py-2 text-[11px] font-mono tracking-[0.12em]"
                  style={{ borderColor: 'var(--accent-mid)', background: 'var(--accent-dim)', color: 'var(--accent)' }}
                >
                  SWITCH TO FULL MCRAFTR STACK
                </button>
              </div>
            )}

            {testState !== 'idle' && (
              <div
                className="text-xs font-mono px-3 py-2 rounded-lg"
                style={{
                  background: testState === 'success' ? '#0f2a0f' : testState === 'fail' ? '#2a0f0f' : 'var(--panel)',
                  color: testState === 'success' ? '#86efac' : testState === 'fail' ? '#fca5a5' : 'var(--text-dim)',
                  border: `1px solid ${testState === 'success' ? '#166534' : testState === 'fail' ? '#7f1d1d' : 'var(--border)'}`,
                }}
              >
                {testState === 'testing' ? 'Testing connection…' : testMsg}
              </div>
            )}

            {error && (
              <div className="text-xs font-mono px-3 py-2 rounded-lg" style={{ background: '#2a0f0f', color: '#fca5a5', border: '1px solid #7f1d1d' }}>
                {error}
              </div>
            )}

            {info && (
              <div className="text-xs font-mono px-3 py-2 rounded-lg" style={{ background: 'var(--accent-dim)', color: 'var(--accent)', border: '1px solid var(--accent-mid)' }}>
                {info}
              </div>
            )}

            <div className="flex flex-wrap gap-3 pt-1">
              <button
                type="button"
                onClick={handleTest}
                disabled={testState === 'testing'}
                className="flex-1 min-w-[160px] py-3 rounded-lg font-mono text-xs tracking-widest transition-all disabled:opacity-50"
                style={{ background: 'var(--panel)', border: '1px solid var(--border)', color: 'var(--text)' }}
              >
                {testState === 'testing' ? 'Testing…' : fullStackSelected ? 'Test Full Stack' : 'Test Quick Connect'}
              </button>

              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className="flex-1 min-w-[160px] py-3 rounded-lg font-mono text-xs tracking-widest transition-all disabled:opacity-50"
                style={{ background: 'var(--accent-dim)', border: '1px solid var(--accent-mid)', color: 'var(--accent)' }}
              >
                {saving ? 'Saving…' : editingServerId ? `Save ${stackModeLabel}` : servers.length > 0 ? `Add ${stackModeLabel}` : `Save ${stackModeLabel} →`}
              </button>

              {(editingServerId || servers.length > 0) && (
                <button
                  type="button"
                  onClick={resetForm}
                  className="py-3 px-4 rounded-lg font-mono text-xs tracking-widest transition-all border"
                  style={{ background: 'var(--panel)', borderColor: 'var(--border)', color: 'var(--text-dim)' }}
                >
                  New Server
                </button>
              )}
            </div>
          </div>

          <div className="glass-card p-6 space-y-4">
            <div className="flex items-center justify-between gap-2">
              <div>
                <div className="text-[13px] font-mono tracking-widest text-[var(--accent)]">SAVED SERVERS</div>
                <div className="text-[11px] font-mono text-[var(--text-dim)] mt-1">One account can manage multiple servers. Pick one active server at a time.</div>
              </div>
            </div>

            {loadingServers ? (
              <div className="text-[12px] font-mono text-[var(--text-dim)]">Loading…</div>
            ) : servers.length === 0 ? (
              <div className="rounded-lg border border-[var(--border)] bg-[var(--panel)] p-4 text-[12px] font-mono text-[var(--text-dim)]">
                No saved servers yet.
              </div>
            ) : (
              <div className="space-y-3">
                {servers.map(server => {
                  const isActive = server.id === activeServerId
                  const labelText = server.label?.trim() || `${server.host}:${server.port}`
                  return (
                    <div key={server.id} className="rounded-lg border border-[var(--border)] bg-[var(--panel)] p-4 space-y-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="text-[13px] font-mono text-[var(--text)] truncate">{labelText}</div>
                          <div className="text-[11px] font-mono text-[var(--text-dim)] mt-1 break-all">{server.host}:{server.port}</div>
                          <div className="mt-2 inline-flex rounded-full border px-2 py-1 text-[10px] font-mono tracking-[0.14em]" style={server.stackMode === 'full'
                            ? { borderColor: 'var(--accent-mid)', background: 'var(--accent-dim)', color: 'var(--accent)' }
                            : { borderColor: 'var(--border)', background: 'var(--bg2)', color: 'var(--text-dim)' }}>
                            {server.stackLabel.toUpperCase()}
                          </div>
                          <div className="text-[10px] font-mono text-[var(--text-dim)] mt-2 break-words">{server.stackDescription}</div>
                          <div className="text-[10px] font-mono text-[var(--text-dim)] mt-2 break-all">
                            minecraft {server.minecraftVersion?.resolved || 'unknown'} · {server.minecraftVersion?.source || 'fallback'}
                            {server.minecraftVersion?.override ? ' · override set' : ''}
                          </div>
                          {server.bridge?.enabled && (
                            <div className="text-[10px] font-mono text-[var(--text-dim)] mt-1 break-all">
                              relay · {sanitizeBridgePrefix(server.bridge.commandPrefix)}{server.bridge.providerLabel ? ` · ${sanitizeBridgeProviderLabel(server.bridge.providerLabel)}` : ''}{server.bridge.lastSeen ? ` · seen ${new Date(server.bridge.lastSeen * 1000).toLocaleString()}` : ''}
                            </div>
                          )}
                          {server.bridge?.enabled && server.bridge.lastError && (
                            <div className="text-[10px] font-mono text-red-300 mt-1 break-all">
                              bridge error · {server.bridge.lastError}
                            </div>
                          )}
                          {server.sidecar?.enabled && (
                            <div className="text-[10px] font-mono text-[var(--text-dim)] mt-1 break-all">
                              beacon · {server.sidecar.url || 'configured'}{server.sidecar.lastSeen ? ` · seen ${new Date(server.sidecar.lastSeen * 1000).toLocaleString()}` : ''}
                            </div>
                          )}
                          {((server.sidecar?.structureRoots?.length ?? 0) > 0 || (server.sidecar?.entityPresetRoots?.length ?? 0) > 0) && (
                            <div className="text-[10px] font-mono text-[var(--text-dim)] mt-1">
                              {(server.sidecar?.structureRoots?.length ?? 0) > 0 ? `${server.sidecar?.structureRoots.length} structure dir(s)` : '0 structure dirs'}
                              {' · '}
                              {(server.sidecar?.entityPresetRoots?.length ?? 0) > 0 ? `${server.sidecar?.entityPresetRoots.length} entity dir(s)` : '0 entity dirs'}
                            </div>
                          )}
                        </div>
                        <span
                          className="shrink-0 rounded border px-2 py-1 text-[10px] font-mono tracking-widest"
                          style={isActive
                            ? { borderColor: 'var(--accent-mid)', background: 'var(--accent-dim)', color: 'var(--accent)' }
                            : { borderColor: 'var(--border)', color: 'var(--text-dim)' }}
                        >
                          {isActive ? 'ACTIVE' : 'SAVED'}
                        </span>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        {!isActive && (
                          <button
                            type="button"
                            onClick={() => void handleActivate(server.id)}
                            className="rounded border border-[var(--accent-mid)] bg-[var(--accent-dim)] px-3 py-2 text-[11px] font-mono text-[var(--accent)]"
                          >
                            Use This Server
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => startEditing(server)}
                          className="rounded border border-[var(--border)] px-3 py-2 text-[11px] font-mono text-[var(--text-dim)]"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleDelete(server)}
                          className="rounded border border-red-900 px-3 py-2 text-[11px] font-mono text-red-400"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        <div className="mt-8 flex justify-center">
          <Link
            href="/minecraft"
            className="group inline-flex items-center gap-3 rounded-full border px-5 py-3 text-[12px] font-mono tracking-[0.14em] transition-all"
            style={{
              borderColor: 'var(--accent-mid)',
              background: 'color-mix(in srgb, var(--accent) 10%, transparent)',
              color: 'var(--accent)',
            }}
          >
            <span className="grid h-7 w-7 place-items-center rounded-full" style={{ background: 'var(--accent-dim)' }}>
              <span className="transition-transform group-hover:-translate-x-0.5">←</span>
            </span>
            <span>RETURN TO MCRAFTR</span>
          </Link>
        </div>
      </div>
    </div>
  )
}

export default function ConnectPage() {
  return (
    <Suspense fallback={null}>
      <ConnectForm />
    </Suspense>
  )
}
