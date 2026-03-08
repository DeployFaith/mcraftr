'use client'
import { useState, useEffect, useMemo } from 'react'
import { signOut, useSession } from 'next-auth/react'
import { useTheme, ACCENTS, FONTS, FONT_SIZES, type ThemePack } from '@/app/components/ThemeProvider'
import { FEATURE_DEFS, FEATURE_CATEGORIES, type FeatureKey, type FeatureCategory } from '@/lib/features'
import CollapsibleCard from './CollapsibleCard'
import ColorPickerModal from './ColorPickerModal'
import { BUILTIN_MUSIC, BUILTIN_SOUNDS, DEFAULT_MUSIC_SETTINGS, DEFAULT_SOUND_SETTINGS, cleanupUnusedUploadedMedia, describeSource, loadMusicSettings, loadSoundSettings, playMediaSource, registerUploadedMediaIds, saveMusicSettings, saveSoundSettings, type MediaSource, type SoundEffectKey, type SoundSettings, type MusicSettings } from '@/app/components/soundfx'
import { saveUploadedFiles } from '@/app/components/mediaLibrary'

async function fileToAvatarDataUrl(file: File): Promise<string> {
  const rawUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result || ''))
    reader.onerror = () => reject(new Error('Could not read image file'))
    reader.readAsDataURL(file)
  })

  const image = await new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('Could not load image'))
    img.src = rawUrl
  })

  const size = 160
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Could not prepare avatar canvas')

  const scale = Math.max(size / image.width, size / image.height)
  const drawWidth = image.width * scale
  const drawHeight = image.height * scale
  const dx = (size - drawWidth) / 2
  const dy = (size - drawHeight) / 2
  ctx.clearRect(0, 0, size, size)
  ctx.drawImage(image, dx, dy, drawWidth, drawHeight)
  return canvas.toDataURL('image/png', 0.92)
}
// ── Small helpers ─────────────────────────────────────────────────────────────

function StatusMsg({ ok, msg }: { ok: boolean; msg: string }) {
  return (
    <div
      className="text-[13px] font-mono mt-2 px-3 py-2 rounded-lg border"
      style={{
        color: ok ? 'var(--accent)' : '#ff3355',
        borderColor: ok ? 'var(--accent-mid)' : '#ff335540',
        background: ok ? 'var(--accent-dim)' : '#ff335510',
      }}
    >
      {msg}
    </div>
  )
}

type FeatureFlags = Record<FeatureKey, boolean>
type SavedServerSummary = {
  id: string
  label: string | null
  host: string
  port: number
}

type AccountAvatar = {
  type: 'none' | 'builtin' | 'upload'
  value: string | null
}

const BUILTIN_PROFILE_AVATARS = [
  { id: 'creeper', label: 'Creeper' },
  { id: 'grass-block', label: 'Grass Block' },
  { id: 'diamond-pickaxe', label: 'Diamond Pickaxe' },
  { id: 'redstone', label: 'Redstone' },
  { id: 'slime', label: 'Slime' },
  { id: 'nether-star', label: 'Nether Star' },
] as const

function resolveAvatarSrc(avatar: AccountAvatar | null) {
  if (!avatar || avatar.type === 'none' || !avatar.value) return null
  if (avatar.type === 'upload') return avatar.value
  return `/profile-avatars/${avatar.value}.svg`
}

// ── Main component ────────────────────────────────────────────────────────────

export default function SettingsSection({ role: _role }: { role?: string }) {
  const { data: session, update: updateSession } = useSession()
  const [servers, setServers] = useState<SavedServerSummary[]>([])
  const [activeServerId, setActiveServerId] = useState<string | null>(null)
  const [disconnecting, setDisconnecting] = useState(false)
  const { theme, setTheme, accent, setAccent, customAccent, setCustomAccent, themePack, setThemePack, font, setFont, fontSize, setFontSize } = useTheme()
  const [customAccentInput, setCustomAccentInput] = useState(customAccent)
  const [showAccentPicker, setShowAccentPicker] = useState(false)
  const [customAccentStatus, setCustomAccentStatus] = useState<{ ok: boolean; msg: string } | null>(null)
  const [soundSettings, setSoundSettings] = useState<SoundSettings>(DEFAULT_SOUND_SETTINGS)
  const [musicSettings, setMusicSettings] = useState<MusicSettings>(DEFAULT_MUSIC_SETTINGS)
  const [avatar, setAvatar] = useState<AccountAvatar>({ type: 'none', value: null })
  const [avatarSaving, setAvatarSaving] = useState(false)
  const [avatarStatus, setAvatarStatus] = useState<{ ok: boolean; msg: string } | null>(null)
  const [soundUrlInputs, setSoundUrlInputs] = useState<Record<SoundEffectKey, string>>({
    uiClick: '',
    success: '',
    notify: '',
    error: '',
  })
  const [musicUrlInput, setMusicUrlInput] = useState('')

  // Feature flags state
  const [features, setFeatures] = useState<FeatureFlags | null>(null)
  const [featuresLoading, setFeaturesLoading] = useState(true)
  const [featuresSaving, setFeaturesSaving] = useState(false)
  const [featuresStatus, setFeaturesStatus] = useState<{ ok: boolean; msg: string } | null>(null)
  const [expandedCategories, setExpandedCategories] = useState<Record<FeatureCategory, boolean>>({
    tabs: false,
    actions: true,
    players: false,
    chat: false,
    admin: false,
  })

  const defsByCategory = useMemo(() => {
    const grouped: Record<FeatureCategory, Array<{ key: FeatureKey; label: string; desc: string; category: FeatureCategory }>> = {
      tabs: [],
      actions: [],
      players: [],
      chat: [],
      admin: [],
    }
    for (const def of FEATURE_DEFS) {
      grouped[def.category].push(def)
    }
    return grouped
  }, [])

  useEffect(() => {
    fetch('/api/account/preferences').then(r => r.json()).then(d => {
      if (d.ok && d.features) setFeatures(d.features)
      if (d.ok && d.avatar) setAvatar(d.avatar)
    }).catch(() => {}).finally(() => setFeaturesLoading(false))
  }, [])

  useEffect(() => {
    setCustomAccentInput(customAccent)
  }, [customAccent])

  useEffect(() => {
    const syncSounds = () => setSoundSettings(loadSoundSettings())
    syncSounds()
    window.addEventListener('mcraftr:sound-settings-updated', syncSounds)
    return () => window.removeEventListener('mcraftr:sound-settings-updated', syncSounds)
  }, [])

  useEffect(() => {
    const syncMusic = () => setMusicSettings(loadMusicSettings())
    syncMusic()
    window.addEventListener('mcraftr:music-settings-updated', syncMusic)
    return () => window.removeEventListener('mcraftr:music-settings-updated', syncMusic)
  }, [])

  const saveFeatureUpdates = async (updates: Partial<FeatureFlags>, optimistic: FeatureFlags) => {
    if (!features || featuresSaving) return
    setFeatures(optimistic)
    setFeaturesSaving(true)
    setFeaturesStatus(null)
    try {
      const res = await fetch('/api/account/preferences', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      })
      const d = await res.json()
      if (d.ok) {
        if (d.features) setFeatures(d.features)
        setFeaturesStatus({ ok: true, msg: 'Preferences saved' })
        window.dispatchEvent(new Event('mcraftr:features-updated'))
      } else {
        setFeatures(features)
        setFeaturesStatus({ ok: false, msg: d.error || 'Failed to save' })
      }
    } catch {
      setFeatures(features)
      setFeaturesStatus({ ok: false, msg: 'Network error' })
    } finally { setFeaturesSaving(false) }
  }

  const toggleFeature = async (key: FeatureKey) => {
    if (!features || featuresSaving) return
    const optimistic = { ...features, [key]: !features[key] }
    await saveFeatureUpdates({ [key]: optimistic[key] }, optimistic)
  }

  const toggleCategory = async (category: FeatureCategory, targetOn: boolean) => {
    if (!features || featuresSaving) return
    const defs = defsByCategory[category]
    const updates: Partial<FeatureFlags> = {}
    const optimistic = { ...features }
    for (const def of defs) {
      updates[def.key] = targetOn
      optimistic[def.key] = targetOn
    }
    await saveFeatureUpdates(updates, optimistic)
  }

  // Change password state
  const [pwCurrent, setPwCurrent] = useState('')
  const [pwNew, setPwNew] = useState('')
  const [pwConfirm, setPwConfirm] = useState('')
  const [pwStatus, setPwStatus] = useState<{ ok: boolean; msg: string } | null>(null)
  const [pwLoading, setPwLoading] = useState(false)

  // Change email state
  const [emailNew, setEmailNew] = useState('')
  const [emailPw, setEmailPw] = useState('')
  const [emailStatus, setEmailStatus] = useState<{ ok: boolean; msg: string } | null>(null)
  const [emailLoading, setEmailLoading] = useState(false)

  // Delete account state
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [deletePw, setDeletePw] = useState('')
  const [deleteStatus, setDeleteStatus] = useState<{ ok: boolean; msg: string } | null>(null)
  const [deleteLoading, setDeleteLoading] = useState(false)

  useEffect(() => {
    fetch('/api/servers').then(r => r.json()).then(d => {
      if (d.ok) {
        setServers(d.servers ?? [])
        setActiveServerId(d.activeServerId ?? null)
      }
    }).catch(() => {})
  }, [])

  const disconnectServer = async () => {
    if (!confirm('Remove the current active server from this account?')) return
    setDisconnecting(true)
    try {
      const res = await fetch('/api/server', { method: 'DELETE' })
      const data = await res.json().catch(() => ({ ok: false }))
      if (!data.ok) throw new Error(data.error || 'Failed to remove server')
      await updateSession()
      if (data.hasServer && data.activeServerId) {
        window.location.reload()
      } else {
        window.location.href = '/connect'
      }
    } catch {
      alert('Failed to disconnect. Please try again.')
      setDisconnecting(false)
    }
  }

  const activeServer = servers.find(server => server.id === activeServerId) ?? null

  // ── Change password ─────────────────────────────────────────────────────────

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setPwStatus(null)
    if (pwNew !== pwConfirm) {
      setPwStatus({ ok: false, msg: 'New passwords do not match' })
      return
    }
    if (pwNew.length < 8) {
      setPwStatus({ ok: false, msg: 'New password must be at least 8 characters' })
      return
    }
    setPwLoading(true)
    try {
      const res = await fetch('/api/account/password', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword: pwCurrent, newPassword: pwNew }),
      })
      const data = await res.json()
      if (data.ok) {
        setPwStatus({ ok: true, msg: 'Password updated successfully' })
        setPwCurrent(''); setPwNew(''); setPwConfirm('')
      } else {
        setPwStatus({ ok: false, msg: data.error || 'Failed to update password' })
      }
    } catch {
      setPwStatus({ ok: false, msg: 'Network error — please try again' })
    } finally {
      setPwLoading(false)
    }
  }

  // ── Change email ────────────────────────────────────────────────────────────

  const handleChangeEmail = async (e: React.FormEvent) => {
    e.preventDefault()
    setEmailStatus(null)
    setEmailLoading(true)
    try {
      const res = await fetch('/api/account/email', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newEmail: emailNew, currentPassword: emailPw }),
      })
      const data = await res.json()
      if (data.ok) {
        setEmailStatus({ ok: true, msg: `Email updated to ${data.email}. Sign in again with your new email.` })
        setEmailNew(''); setEmailPw('')
      } else {
        setEmailStatus({ ok: false, msg: data.error || 'Failed to update email' })
      }
    } catch {
      setEmailStatus({ ok: false, msg: 'Network error — please try again' })
    } finally {
      setEmailLoading(false)
    }
  }

  // ── Delete account ──────────────────────────────────────────────────────────

  const handleDeleteAccount = async (e: React.FormEvent) => {
    e.preventDefault()
    setDeleteStatus(null)
    setDeleteLoading(true)
    try {
      const res = await fetch('/api/account/delete', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword: deletePw }),
      })
      const data = await res.json()
      if (data.ok) {
        await signOut({ callbackUrl: '/login' })
      } else {
        setDeleteStatus({ ok: false, msg: data.error || 'Failed to delete account' })
        setDeleteLoading(false)
      }
    } catch {
      setDeleteStatus({ ok: false, msg: 'Network error — please try again' })
      setDeleteLoading(false)
    }
  }

  // ── Shared input style ──────────────────────────────────────────────────────

  const inputCls = 'w-full px-3 py-2 rounded-lg font-mono text-[13px] bg-[var(--panel)] border border-[var(--border)] text-[var(--text)] placeholder:text-[var(--text-dim)] focus:outline-none focus:border-[var(--accent-mid)] transition-colors'
  const btnPrimary = 'px-4 py-2 rounded-lg font-mono text-[13px] tracking-widest transition-all disabled:opacity-40 disabled:cursor-not-allowed border'
  const builtinSoundEntries = Object.entries(BUILTIN_SOUNDS) as Array<[SoundEffectKey, { label: string; url: string }]>

  const commitCustomAccentText = () => {
    if (!/^#[0-9a-fA-F]{6}$/.test(customAccentInput.trim())) {
      setCustomAccentInput(customAccent)
      setCustomAccentStatus({ ok: false, msg: 'Enter a full HEX color like #7df9ff.' })
      return
    }
    setAccent('custom')
    setCustomAccent(customAccentInput.trim())
    setCustomAccentStatus({ ok: true, msg: `Custom accent set to ${customAccentInput.trim().toUpperCase()}.` })
  }

  const updateSoundSettings = (next: SoundSettings) => {
    setSoundSettings(next)
    saveSoundSettings(next)
  }

  const toggleAllSounds = (enabled: boolean) => {
    updateSoundSettings({
      masterEnabled: enabled,
      volume: soundSettings.volume,
      effects: { ...soundSettings.effects },
    })
  }

  const toggleSoundEffect = (key: SoundEffectKey, enabled: boolean) => {
    updateSoundSettings({
      masterEnabled: soundSettings.masterEnabled,
      volume: soundSettings.volume,
      effects: {
        ...soundSettings.effects,
        [key]: {
          ...soundSettings.effects[key],
          enabled,
        },
      },
    })
  }

  const setSoundSource = (key: SoundEffectKey, source: MediaSource) => {
    updateSoundSettings({
      masterEnabled: soundSettings.masterEnabled,
      volume: soundSettings.volume,
      effects: {
        ...soundSettings.effects,
        [key]: {
          ...soundSettings.effects[key],
          source,
        },
      },
    })
  }

  const updateMusic = (next: MusicSettings) => {
    setMusicSettings(next)
    saveMusicSettings(next)
  }

  const addMusicTrack = (source: MediaSource) => {
    updateMusic({
      ...musicSettings,
      tracks: [...musicSettings.tracks, source],
    })
  }

  const removeMusicTrack = async (index: number) => {
    const track = musicSettings.tracks[index]
    const tracks = musicSettings.tracks.filter((_, i) => i !== index)
    updateMusic({
      ...musicSettings,
      tracks: tracks.length > 0 ? tracks : DEFAULT_MUSIC_SETTINGS.tracks,
    })
    if (track?.type === 'upload') await cleanupUnusedUploadedMedia()
  }

  const importThemePack = async (file: File) => {
    const raw = await file.text()
    const parsed = JSON.parse(raw) as ThemePack
    setThemePack(parsed)
  }

  const exportThemePack = () => {
    const pack: ThemePack = {
      name: themePack?.name || 'Mcraftr Theme',
      vars: themePack?.vars || {},
      accent: themePack?.accent || (accent === 'custom' ? customAccent : undefined),
    }
    const blob = new Blob([JSON.stringify(pack, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'mcraftr-theme.json'
    a.click()
    URL.revokeObjectURL(url)
  }

  const setSoundUrlSource = (key: SoundEffectKey) => {
    const url = soundUrlInputs[key].trim()
    if (!/^https?:\/\/\S+/i.test(url)) return
    setSoundSource(key, { type: 'url', url, label: url })
    setSoundUrlInputs(prev => ({ ...prev, [key]: '' }))
  }

  const uploadSoundFile = async (key: SoundEffectKey, files: FileList | null) => {
    if (!files || files.length === 0) return
    const saved = await saveUploadedFiles('sound', Array.from(files).slice(0, 1))
    registerUploadedMediaIds(saved.map(file => file.id))
    const asset = saved[0]
    setSoundSource(key, { type: 'upload', assetId: asset.id, label: asset.label })
  }

  const addMusicUrl = () => {
    const url = musicUrlInput.trim()
    if (!/^https?:\/\/\S+/i.test(url)) return
    addMusicTrack({ type: 'url', url, label: url })
    setMusicUrlInput('')
  }

  const uploadMusicFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return
    const saved = await saveUploadedFiles('music', Array.from(files))
    registerUploadedMediaIds(saved.map(file => file.id))
    updateMusic({
      ...musicSettings,
      tracks: [
        ...musicSettings.tracks,
        ...saved.map(file => ({ type: 'upload', assetId: file.id, label: file.label } as MediaSource)),
      ],
    })
  }

  const persistAvatar = async (next: AccountAvatar, successMessage: string) => {
    setAvatarSaving(true)
    setAvatarStatus(null)
    try {
      const res = await fetch('/api/account/preferences', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ avatar: next }),
      })
      const data = await res.json()
      if (!data.ok) throw new Error(data.error || 'Failed to save profile picture')
      setAvatar(data.avatar ?? next)
      setAvatarStatus({ ok: true, msg: successMessage })
      window.dispatchEvent(new Event('mcraftr:account-preferences-updated'))
    } catch (error) {
      setAvatarStatus({ ok: false, msg: error instanceof Error ? error.message : 'Failed to save profile picture' })
    } finally {
      setAvatarSaving(false)
    }
  }

  const handleBuiltinAvatar = async (value: string) => {
    await persistAvatar({ type: 'builtin', value }, 'Profile picture updated.')
  }

  const handleUnsetAvatar = async () => {
    await persistAvatar({ type: 'none', value: null }, 'Profile picture removed. Letter avatar restored.')
  }

  const handleAvatarUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return
    try {
      const dataUrl = await fileToAvatarDataUrl(files[0])
      await persistAvatar({ type: 'upload', value: dataUrl }, 'Uploaded profile picture saved.')
    } catch (error) {
      setAvatarStatus({ ok: false, msg: error instanceof Error ? error.message : 'Failed to process uploaded profile picture' })
      setAvatarSaving(false)
    }
  }

  const avatarSrc = resolveAvatarSrc(avatar)

  return (
    <div className="space-y-4">
      <h2 className="font-mono text-base tracking-widest text-[var(--accent)]">SETTINGS</h2>

      {/* Appearance */}
      <CollapsibleCard title="APPEARANCE" storageKey="settings:appearance" bodyClassName="p-5 space-y-4">
        <div>
          <div className="text-[13px] font-mono text-[var(--text-dim)] tracking-widest mb-2">THEME</div>
          <div className="flex gap-2">
            {(['dark', 'light'] as const).map(t => (
              <button
                key={t}
                onClick={() => setTheme(t)}
                className="flex-1 py-2 rounded-lg font-mono text-[13px] tracking-widest transition-all border"
                style={theme === t ? {
                  borderColor: 'var(--accent)',
                  background: 'var(--accent-dim)',
                  color: 'var(--accent)',
                } : {
                  borderColor: 'var(--border)',
                  color: 'var(--text-dim)',
                }}
              >
                {t.toUpperCase()}
              </button>
            ))}
          </div>
        </div>

        <div>
          <div className="text-[13px] font-mono text-[var(--text-dim)] tracking-widest mb-2">ACCENT COLOR</div>
          <div className="flex flex-wrap gap-2.5">
            {ACCENTS.map(a => (
              <button
                key={a.id}
                onClick={() => setAccent(a.id)}
                title={a.label}
                className="w-8 h-8 rounded-full border-2 transition-all flex items-center justify-center"
                style={{
                  background: a.color,
                  borderColor: accent === a.id ? 'var(--text)' : 'transparent',
                  boxShadow: accent === a.id ? `0 0 8px ${a.color}` : 'none',
                }}
                >
                  {accent === a.id && (
                    <span className="text-[13px] font-bold" style={{ color: '#000', mixBlendMode: 'multiply' }}>✓</span>
                  )}
                </button>
            ))}
            <button
              onClick={() => setAccent('custom')}
              title="Custom"
              className="w-8 h-8 rounded-full border-2 transition-all flex items-center justify-center"
              style={{
                background: 'conic-gradient(from 180deg, #ff4d4d, #ff9a3c, #ffe45e, #8cff66, #56ffd2, #5aa9ff, #9d63ff, #ff6ad5, #ff4d4d)',
                borderColor: accent === 'custom' ? 'var(--text)' : 'transparent',
                boxShadow: accent === 'custom' ? `0 0 10px ${customAccent}` : 'none',
              }}
            >
              {accent === 'custom' && (
                <span className="text-[13px] font-bold" style={{ color: '#000', mixBlendMode: 'multiply' }}>✓</span>
              )}
            </button>
          </div>

          {accent === 'custom' && (
            <div className="mt-4 rounded-2xl border p-4 space-y-4" style={{ borderColor: 'var(--accent-mid)', background: 'color-mix(in srgb, var(--panel) 88%, transparent)' }}>
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center">
                <div
                  className="h-20 w-20 rounded-[22px] border shadow-[0_18px_40px_rgba(0,0,0,0.18)]"
                  style={{ background: customAccent, borderColor: 'var(--accent-mid)' }}
                />
                <div className="flex-1 space-y-2">
                  <div className="text-[13px] font-mono tracking-[0.16em]" style={{ color: 'var(--text)' }}>
                    CUSTOM ACCENT
                  </div>
                  <div className="text-[11px] font-mono" style={{ color: 'var(--text-dim)' }}>
                    Current color: {customAccent.toUpperCase()}
                  </div>
                  <div className="text-[11px] font-mono" style={{ color: 'var(--text-dim)' }}>
                    Open the full picker modal for the wheel, sliders, text input, and built-in eyedropper.
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setAccent('custom')
                      setShowAccentPicker(true)
                    }}
                    className="rounded-xl border px-4 py-3 text-[12px] font-mono tracking-widest"
                    style={{ borderColor: 'var(--accent-mid)', background: 'var(--accent-dim)', color: 'var(--accent)' }}
                  >
                    Open Picker
                  </button>
                  <button
                    type="button"
                    onClick={commitCustomAccentText}
                    className="rounded-xl border px-4 py-3 text-[12px] font-mono tracking-widest"
                    style={{ borderColor: 'var(--border)', background: 'var(--panel)', color: 'var(--text-dim)' }}
                  >
                    Apply HEX
                  </button>
                </div>
              </div>

              <div>
                <div className="text-[11px] font-mono tracking-widest text-[var(--text-dim)] mb-1.5">HEX</div>
                <input
                  value={customAccentInput}
                  onChange={e => setCustomAccentInput(e.target.value)}
                  onBlur={commitCustomAccentText}
                  onKeyDown={e => {
                    if (e.key === 'Enter') commitCustomAccentText()
                  }}
                  className={inputCls}
                />
              </div>
              {customAccentStatus && <StatusMsg ok={customAccentStatus.ok} msg={customAccentStatus.msg} />}
            </div>
          )}
        </div>

        <div>
          <div className="text-[13px] font-mono text-[var(--text-dim)] tracking-widest mb-2">FONT</div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {FONTS.map(option => (
              <button
                key={option.id}
                onClick={() => setFont(option.id)}
                className="text-left rounded-lg border px-3 py-3 transition-all"
                style={font === option.id
                  ? {
                      borderColor: 'var(--accent)',
                      background: 'var(--accent-dim)',
                      color: 'var(--accent)',
                    }
                  : {
                      borderColor: 'var(--border)',
                      color: 'var(--text-dim)',
                    }}
              >
                <div className="text-[13px] font-mono tracking-widest">{option.label}</div>
                <div className="text-[15px] mt-1" style={{ color: font === option.id ? 'var(--accent)' : 'var(--text)' }}>
                  {option.sample}
                </div>
              </button>
            ))}
          </div>
        </div>

        <div>
          <div className="text-[13px] font-mono text-[var(--text-dim)] tracking-widest mb-2">FONT SIZE</div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {FONT_SIZES.map(option => (
              <button
                key={option.id}
                onClick={() => setFontSize(option.id)}
                className="text-left rounded-lg border px-3 py-3 transition-all"
                style={fontSize === option.id
                  ? {
                      borderColor: 'var(--accent)',
                      background: 'var(--accent-dim)',
                      color: 'var(--accent)',
                    }
                  : {
                      borderColor: 'var(--border)',
                      color: 'var(--text-dim)',
                    }}
              >
                <div className="text-[13px] font-mono tracking-widest">{option.label}</div>
                <div
                  className="mt-1"
                  style={{
                    fontSize: option.size,
                    color: fontSize === option.id ? 'var(--accent)' : 'var(--text)',
                  }}
                >
                  {option.sample}
                </div>
              </button>
            ))}
          </div>
        </div>
      </CollapsibleCard>

      <CollapsibleCard title="THEME PACKS" storageKey="settings:theme-packs" bodyClassName="p-5 space-y-4">
        <div className="rounded-2xl border p-4 space-y-4" style={{ borderColor: 'var(--border)', background: 'color-mix(in srgb, var(--panel) 84%, transparent)' }}>
          <div>
            <div className="text-[13px] font-mono tracking-widest text-[var(--text)]">CUSTOM THEME PACK</div>
            <div className="text-[11px] font-mono text-[var(--text-dim)] mt-1">Upload a JSON theme pack to reskin the app, or export the current custom pack.</div>
          </div>
          <div className="flex flex-wrap gap-2">
            <label className="rounded-xl border px-4 py-3 text-[12px] font-mono tracking-widest cursor-pointer" style={{ borderColor: 'var(--accent-mid)', background: 'var(--accent-dim)', color: 'var(--accent)' }}>
              Upload Theme
              <input
                type="file"
                accept="application/json,.json"
                className="hidden"
                onChange={async e => {
                  const file = e.target.files?.[0]
                  if (file) await importThemePack(file)
                  e.currentTarget.value = ''
                }}
              />
            </label>
            <button type="button" onClick={exportThemePack} className="rounded-xl border px-4 py-3 text-[12px] font-mono tracking-widest" style={{ borderColor: 'var(--border)', background: 'var(--panel)', color: 'var(--text)' }}>
              Export Theme
            </button>
            <button type="button" onClick={() => setThemePack(null)} className="rounded-xl border px-4 py-3 text-[12px] font-mono tracking-widest" style={{ borderColor: 'var(--border)', background: 'var(--panel)', color: 'var(--text-dim)' }}>
              Clear Theme
            </button>
          </div>
          <div className="text-[11px] font-mono text-[var(--text-dim)]">
            {themePack ? `Loaded theme pack: ${themePack.name || 'Custom Theme'}` : 'No custom theme pack loaded.'}
          </div>
        </div>
      </CollapsibleCard>

      <CollapsibleCard title="SOUND FX" storageKey="settings:soundfx" bodyClassName="p-5 space-y-4">
        <div className="rounded-2xl border p-4 space-y-4" style={{ borderColor: 'var(--border)', background: 'color-mix(in srgb, var(--panel) 84%, transparent)' }}>
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-[13px] font-mono tracking-widest text-[var(--text)]">ALL SOUND FX</div>
              <div className="text-[11px] font-mono text-[var(--text-dim)] mt-1">Master mute plus per-effect custom sources. Built-in Minecraft-style effects are included by default.</div>
            </div>
            <button
              type="button"
              onClick={() => toggleAllSounds(!soundSettings.masterEnabled)}
              className="rounded-full border px-4 py-2 text-[11px] font-mono tracking-widest transition-all"
              style={soundSettings.masterEnabled
                ? { borderColor: 'var(--accent-mid)', background: 'var(--accent-dim)', color: 'var(--accent)' }
                : { borderColor: 'var(--border)', background: 'var(--panel)', color: 'var(--text-dim)' }}
            >
              {soundSettings.masterEnabled ? 'ON' : 'OFF'}
            </button>
          </div>

          <label className="space-y-1.5 block">
            <div className="flex items-center justify-between text-[11px] font-mono tracking-widest text-[var(--text-dim)]">
              <span>VOLUME</span>
              <span>{Math.round(soundSettings.volume * 100)}%</span>
            </div>
            <input
              type="range"
              min={0}
              max={100}
              value={Math.round(soundSettings.volume * 100)}
              onChange={e => updateSoundSettings({ ...soundSettings, volume: Number(e.target.value) / 100 })}
              className="w-full"
            />
          </label>

          <div className="rounded-xl border p-3 space-y-3" style={{ borderColor: 'var(--border)', background: 'color-mix(in srgb, var(--bg2) 70%, transparent)' }}>
            <div>
              <div className="text-[12px] font-mono tracking-widest text-[var(--text)]">BUILT-IN SOUND BANK</div>
              <div className="text-[11px] font-mono text-[var(--text-dim)] mt-1">Included sounds: UI Click, Success Orb, Notify Pling, and Villager No.</div>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              {builtinSoundEntries.map(([key, entry]) => (
                <div key={key} className="flex items-center justify-between gap-3 rounded-xl border px-3 py-2" style={{ borderColor: 'var(--border)', background: 'var(--panel)' }}>
                  <div className="min-w-0">
                    <div className="truncate text-[12px] font-mono tracking-widest text-[var(--text)]">{entry.label}</div>
                    <div className="text-[11px] font-mono text-[var(--text-dim)]">{key}</div>
                  </div>
                  <button
                    type="button"
                    onClick={() => void playMediaSource({ type: 'builtin', id: key }, Math.max(0.3, soundSettings.volume))}
                    className="rounded-xl border px-3 py-2 text-[11px] font-mono tracking-widest"
                    style={{ borderColor: 'var(--border)', background: 'var(--panel)', color: 'var(--text)' }}
                  >
                    Preview
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            {([
              ['uiClick', 'UI Click', 'Navigation and interface clicks.'],
              ['success', 'Success', 'Completed actions and positive toasts.'],
              ['notify', 'Notification', 'Softer notices and inactive-state toasts.'],
              ['error', 'Error', 'Failed actions and rejected operations.'],
            ] as const).map(([key, label, desc]) => (
              <div key={key} className="rounded-xl border p-3 space-y-3" style={{ borderColor: 'var(--border)', background: 'color-mix(in srgb, var(--bg2) 70%, transparent)' }}>
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-[12px] font-mono tracking-widest text-[var(--text)]">{label}</div>
                    <div className="text-[11px] font-mono text-[var(--text-dim)] mt-1">{desc}</div>
                  </div>
                  <button
                    type="button"
                    onClick={() => toggleSoundEffect(key, !soundSettings.effects[key].enabled)}
                    className="rounded-full border px-4 py-2 text-[11px] font-mono tracking-widest transition-all"
                    style={soundSettings.effects[key].enabled
                      ? { borderColor: 'var(--accent-mid)', background: 'var(--accent-dim)', color: 'var(--accent)' }
                      : { borderColor: 'var(--border)', background: 'var(--panel)', color: 'var(--text-dim)' }}
                  >
                    {soundSettings.effects[key].enabled ? 'ON' : 'OFF'}
                  </button>
                </div>
                <div className="text-[11px] font-mono text-[var(--text-dim)]">Source: {describeSource(soundSettings.effects[key].source)}</div>
                <div className="grid gap-2">
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => void playMediaSource(soundSettings.effects[key].source, Math.max(0.3, soundSettings.volume))}
                      className="rounded-xl border px-3 py-2 text-[11px] font-mono tracking-widest"
                      style={{ borderColor: 'var(--border)', background: 'var(--panel)', color: 'var(--text)' }}
                    >
                      Preview Current
                    </button>
                  </div>
                  <div className="flex gap-2">
                    <input
                      value={soundUrlInputs[key]}
                      onChange={e => setSoundUrlInputs(prev => ({ ...prev, [key]: e.target.value }))}
                      placeholder="https://example.com/sound.ogg"
                      className={inputCls}
                    />
                    <button type="button" onClick={() => setSoundUrlSource(key)} className="rounded-xl border px-3 py-2 text-[11px] font-mono tracking-widest" style={{ borderColor: 'var(--border)', background: 'var(--panel)', color: 'var(--text)' }}>
                      Use URL
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <label className="rounded-xl border px-3 py-2 text-[11px] font-mono tracking-widest cursor-pointer" style={{ borderColor: 'var(--border)', background: 'var(--panel)', color: 'var(--text)' }}>
                      Upload
                      <input type="file" accept="audio/*" className="hidden" onChange={async e => { await uploadSoundFile(key, e.target.files); e.currentTarget.value = '' }} />
                    </label>
                    <button type="button" onClick={() => setSoundSource(key, { type: 'builtin', id: key })} className="rounded-xl border px-3 py-2 text-[11px] font-mono tracking-widest" style={{ borderColor: 'var(--border)', background: 'var(--panel)', color: 'var(--text-dim)' }}>
                      Reset Built-in
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </CollapsibleCard>

      <CollapsibleCard title="BACKGROUND MUSIC" storageKey="settings:music" bodyClassName="p-5 space-y-4">
        <div className="rounded-2xl border p-4 space-y-4" style={{ borderColor: 'var(--border)', background: 'color-mix(in srgb, var(--panel) 84%, transparent)' }}>
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-[13px] font-mono tracking-widest text-[var(--text)]">MUSIC PLAYER</div>
              <div className="text-[11px] font-mono text-[var(--text-dim)] mt-1">Loop gentle Minecraft music in the background or use your own tracks.</div>
            </div>
            <button
              type="button"
              onClick={() => updateMusic({ ...musicSettings, enabled: !musicSettings.enabled })}
              className="rounded-full border px-4 py-2 text-[11px] font-mono tracking-widest transition-all"
              style={musicSettings.enabled
                ? { borderColor: 'var(--accent-mid)', background: 'var(--accent-dim)', color: 'var(--accent)' }
                : { borderColor: 'var(--border)', background: 'var(--panel)', color: 'var(--text-dim)' }}
            >
              {musicSettings.enabled ? 'ON' : 'OFF'}
            </button>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <label className="space-y-1.5 block">
              <div className="flex items-center justify-between text-[11px] font-mono tracking-widest text-[var(--text-dim)]">
                <span>MUSIC VOLUME</span>
                <span>{Math.round(musicSettings.volume * 100)}%</span>
              </div>
              <input type="range" min={0} max={100} value={Math.round(musicSettings.volume * 100)} onChange={e => updateMusic({ ...musicSettings, volume: Number(e.target.value) / 100 })} className="w-full" />
            </label>
            <div className="flex items-end">
              <button
                type="button"
                onClick={() => updateMusic({ ...musicSettings, shuffle: !musicSettings.shuffle })}
                className="rounded-full border px-4 py-2 text-[11px] font-mono tracking-widest transition-all"
                style={musicSettings.shuffle
                  ? { borderColor: 'var(--accent-mid)', background: 'var(--accent-dim)', color: 'var(--accent)' }
                  : { borderColor: 'var(--border)', background: 'var(--panel)', color: 'var(--text-dim)' }}
              >
                {musicSettings.shuffle ? 'SHUFFLE ON' : 'SHUFFLE OFF'}
              </button>
            </div>
          </div>

          <div className="grid gap-2">
            <div className="flex gap-2">
              <input value={musicUrlInput} onChange={e => setMusicUrlInput(e.target.value)} placeholder="https://example.com/music.ogg" className={inputCls} />
              <button type="button" onClick={addMusicUrl} className="rounded-xl border px-3 py-2 text-[11px] font-mono tracking-widest" style={{ borderColor: 'var(--border)', background: 'var(--panel)', color: 'var(--text)' }}>
                Add URL
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              <label className="rounded-xl border px-3 py-2 text-[11px] font-mono tracking-widest cursor-pointer" style={{ borderColor: 'var(--border)', background: 'var(--panel)', color: 'var(--text)' }}>
                Upload Files
                <input type="file" accept="audio/*" multiple className="hidden" onChange={async e => { await uploadMusicFiles(e.target.files); e.currentTarget.value = '' }} />
              </label>
              <label className="rounded-xl border px-3 py-2 text-[11px] font-mono tracking-widest cursor-pointer" style={{ borderColor: 'var(--border)', background: 'var(--panel)', color: 'var(--text)' }}>
                Upload Folder
                <input type="file" accept="audio/*" multiple className="hidden" {...({ webkitdirectory: 'true', directory: '' } as any)} onChange={async e => { await uploadMusicFiles(e.target.files); e.currentTarget.value = '' }} />
              </label>
              <button type="button" onClick={() => updateMusic({ ...musicSettings, tracks: DEFAULT_MUSIC_SETTINGS.tracks })} className="rounded-xl border px-3 py-2 text-[11px] font-mono tracking-widest" style={{ borderColor: 'var(--border)', background: 'var(--panel)', color: 'var(--text-dim)' }}>
                Reset Built-ins
              </button>
            </div>
          </div>

          <div className="space-y-2">
            {musicSettings.tracks.map((track, index) => (
              <div key={`${describeSource(track)}-${index}`} className="flex items-center justify-between gap-3 rounded-xl border px-3 py-2" style={{ borderColor: 'var(--border)', background: 'color-mix(in srgb, var(--bg2) 70%, transparent)' }}>
                <div className="min-w-0">
                  <div className="truncate text-[12px] font-mono text-[var(--text)]">{describeSource(track)}</div>
                  <div className="text-[11px] font-mono text-[var(--text-dim)]">{track.type.toUpperCase()}</div>
                </div>
                <button type="button" onClick={() => void removeMusicTrack(index)} className="rounded-xl border px-3 py-2 text-[11px] font-mono tracking-widest" style={{ borderColor: 'var(--border)', background: 'var(--panel)', color: 'var(--text-dim)' }}>
                  Remove
                </button>
              </div>
            ))}
          </div>
        </div>
      </CollapsibleCard>

      {/* Feature Toggles */}
      <CollapsibleCard title="FEATURE TOGGLES" storageKey="settings:features" bodyClassName="p-5 space-y-4">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setExpandedCategories({ tabs: true, actions: true, players: true, chat: true, admin: true })}
              className="text-[11px] font-mono text-[var(--text-dim)] hover:text-[var(--text)] border border-[var(--border)] rounded px-2 py-1"
            >
              Expand all
            </button>
            <button
              onClick={() => setExpandedCategories({ tabs: false, actions: false, players: false, chat: false, admin: false })}
              className="text-[11px] font-mono text-[var(--text-dim)] hover:text-[var(--text)] border border-[var(--border)] rounded px-2 py-1"
            >
              Collapse all
            </button>
          </div>
        </div>
        <div className="text-[11px] font-mono text-[var(--text-dim)] opacity-60 mb-2">
          Turn off features you don't need. Admins can also restrict features for other users.
        </div>
        {featuresLoading ? (
          <div className="text-[13px] font-mono text-[var(--text-dim)] animate-pulse">Loading...</div>
        ) : (
          <div className="space-y-2">
            {FEATURE_CATEGORIES.map(cat => {
              const defs = defsByCategory[cat.id]
              const onCount = defs.filter(d => features?.[d.key]).length
              const allOn = onCount === defs.length
              const allOff = onCount === 0
              const mixed = !allOn && !allOff
              const expanded = expandedCategories[cat.id]
              const status = allOn ? 'ON' : allOff ? 'OFF' : 'MIXED'
              return (
                <div key={cat.id} className="rounded-lg bg-[var(--panel)] border border-[var(--border)] overflow-hidden">
                  <div className="flex items-center justify-between gap-2 px-3 py-2">
                    <button
                      onClick={() => setExpandedCategories(prev => ({ ...prev, [cat.id]: !prev[cat.id] }))}
                      className="text-left min-w-0"
                    >
                      <div className="text-[13px] font-mono text-[var(--text)]">{cat.label}</div>
                      <div className="text-[11px] font-mono text-[var(--text-dim)]">{cat.desc}</div>
                    </button>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-[11px] font-mono text-[var(--text-dim)]">{onCount}/{defs.length}</span>
                      <span className={`text-[11px] font-mono px-1.5 py-0.5 rounded border ${
                        allOn
                          ? 'border-[var(--accent-mid)] text-[var(--accent)] bg-[var(--accent-dim)]'
                          : mixed
                            ? 'border-[var(--accent-mid)] text-[var(--accent)]'
                            : 'border-[var(--border)] text-[var(--text-dim)]'
                      }`}>{status}</span>
                      <button
                        onClick={() => toggleCategory(cat.id, !allOn)}
                        disabled={featuresSaving}
                        className={`w-12 h-6 rounded-full transition-all border ${
                          allOn
                            ? 'border-[var(--accent-mid)] bg-[var(--accent-dim)]'
                            : mixed
                              ? 'border-[var(--accent-mid)] bg-[var(--panel)]'
                              : 'border-[var(--border)] bg-[var(--bg)]'
                        }`}
                        title={allOn ? 'Turn all off' : 'Turn all on'}
                      >
                        <div
                          className={`w-5 h-5 rounded-full transition-all shadow-sm ${
                            allOn ? 'translate-x-6' : mixed ? 'translate-x-3' : 'translate-x-0.5'
                          }`}
                          style={{ background: allOn || mixed ? 'var(--accent)' : 'var(--text-dim)' }}
                        />
                      </button>
                      <button
                        onClick={() => setExpandedCategories(prev => ({ ...prev, [cat.id]: !prev[cat.id] }))}
                        className="text-[11px] font-mono text-[var(--text-dim)] px-1"
                      >
                        {expanded ? '▲' : '▼'}
                      </button>
                    </div>
                  </div>

                  {expanded && (
                    <div className="border-t border-[var(--border)] px-3 py-2 space-y-2">
                      {defs.map(f => (
                        <div key={f.key} className="flex items-center justify-between gap-3 px-2 py-1.5 rounded bg-[var(--bg)] border border-[var(--border)]">
                          <div className="min-w-0">
                            <div className="text-[13px] font-mono text-[var(--text)]">{f.label}</div>
                            <div className="text-[11px] font-mono text-[var(--text-dim)]">{f.desc}</div>
                          </div>
                          <button
                            onClick={() => toggleFeature(f.key)}
                            disabled={featuresSaving}
                            className={`w-12 h-6 rounded-full transition-all border ${
                              features?.[f.key]
                                ? 'border-[var(--accent-mid)] bg-[var(--accent-dim)]'
                                : 'border-[var(--border)] bg-[var(--bg)]'
                            }`}
                          >
                            <div
                              className={`w-5 h-5 rounded-full transition-all shadow-sm ${
                                features?.[f.key]
                                  ? 'translate-x-6'
                                  : 'translate-x-0.5'
                              }`}
                              style={{
                                background: features?.[f.key] ? 'var(--accent)' : 'var(--text-dim)',
                              }}
                            />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
        {featuresStatus && (
          <div className={`text-[11px] font-mono px-2 py-1 rounded ${
            featuresStatus.ok
              ? 'text-[var(--accent)] bg-[var(--accent-dim)]'
              : 'text-red-400 bg-red-950/30'
          }`}>
            {featuresStatus.msg}
          </div>
        )}
      </CollapsibleCard>

      {/* Server connection info */}
      <CollapsibleCard title="SERVER CONNECTION" storageKey="settings:server-connection" bodyClassName="p-5 space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-[var(--panel)] rounded-lg p-3 border border-[var(--border)]">
            <div className="text-[13px] font-mono text-[var(--text-dim)] tracking-widest mb-1">ACTIVE SERVER</div>
            <div className="text-[13px] font-mono text-[var(--text)] truncate">
              {activeServer ? (activeServer.label?.trim() || `${activeServer.host}:${activeServer.port}`) : '—'}
            </div>
          </div>
          <div className="bg-[var(--panel)] rounded-lg p-3 border border-[var(--border)]">
            <div className="text-[13px] font-mono text-[var(--text-dim)] tracking-widest mb-1">SAVED SERVERS</div>
            <div className="text-[13px] font-mono text-[var(--text)]">{servers.length}</div>
          </div>
        </div>
        {servers.length > 0 && (
          <div className="space-y-2">
            {servers.map(server => {
              const isActive = server.id === activeServerId
              return (
                <div key={server.id} className="flex items-center justify-between gap-3 rounded-lg border border-[var(--border)] bg-[var(--panel)] px-3 py-2">
                  <div className="min-w-0">
                    <div className="text-[13px] font-mono text-[var(--text)] truncate">
                      {server.label?.trim() || `${server.host}:${server.port}`}
                    </div>
                    <div className="text-[11px] font-mono text-[var(--text-dim)] truncate">
                      {server.host}:{server.port}
                    </div>
                  </div>
                  <span
                    className="rounded border px-2 py-1 text-[10px] font-mono tracking-widest"
                    style={isActive
                      ? { borderColor: 'var(--accent-mid)', background: 'var(--accent-dim)', color: 'var(--accent)' }
                      : { borderColor: 'var(--border)', color: 'var(--text-dim)' }}
                  >
                    {isActive ? 'ACTIVE' : 'SAVED'}
                  </span>
                </div>
              )
            })}
          </div>
        )}
        <div className="flex flex-col sm:flex-row gap-2 pt-1">
          <a
            href="/connect"
            className="flex-1 py-2.5 rounded-lg font-mono text-[13px] tracking-widest text-center transition-all border border-[var(--border)] text-[var(--text-dim)] hover:border-[var(--accent-mid)]"
          >
            Manage Servers
          </a>
          <button
            onClick={disconnectServer}
            disabled={disconnecting}
            className="flex-1 py-2.5 rounded-lg font-mono text-[13px] tracking-widest transition-all disabled:opacity-40 disabled:cursor-not-allowed border border-red-900 text-red-400 hover:border-red-700"
          >
            {disconnecting ? 'Removing...' : 'Remove Active Server'}
          </button>
        </div>
      </CollapsibleCard>

      {/* Account Update */}
      <CollapsibleCard title="ACCOUNT UPDATE" storageKey="settings:account-update" bodyClassName="p-5 space-y-4">
        <div className="rounded-lg border border-[var(--border)] bg-[var(--panel)] p-4 space-y-4">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
            <div className="space-y-3">
              <div className="text-[13px] font-mono tracking-widest text-[var(--text-dim)]">PROFILE PICTURE</div>
              {avatarSrc ? (
                <img
                  src={avatarSrc}
                  alt="Current profile picture"
                  className="h-24 w-24 rounded-full border object-cover"
                  style={{ borderColor: 'var(--accent-mid)', background: 'var(--bg2)' }}
                />
              ) : (
                <div className="grid h-24 w-24 place-items-center rounded-full border font-mono text-3xl font-bold" style={{ borderColor: 'var(--accent-mid)', background: 'var(--accent-dim)', color: 'var(--accent)' }}>
                  {(session?.user?.email ?? 'M').trim().charAt(0).toUpperCase() || 'M'}
                </div>
              )}
              <div className="text-[11px] font-mono text-[var(--text-dim)]">
                {avatar.type === 'builtin' ? 'Using a built-in avatar.' : avatar.type === 'upload' ? 'Using an uploaded avatar.' : 'No profile picture set. Letter avatar is active.'}
              </div>
            </div>

            <div className="flex-1 space-y-4">
              <div>
                <div className="text-[11px] font-mono tracking-widest text-[var(--text-dim)] mb-2">BUILT-IN MINECRAFT AVATARS</div>
                <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                  {BUILTIN_PROFILE_AVATARS.map(option => {
                    const selected = avatar.type === 'builtin' && avatar.value === option.id
                    return (
                      <button
                        key={option.id}
                        type="button"
                        disabled={avatarSaving}
                        onClick={() => void handleBuiltinAvatar(option.id)}
                        className="rounded-2xl border p-2 transition-all disabled:opacity-50"
                        style={selected
                          ? { borderColor: 'var(--accent-mid)', background: 'var(--accent-dim)' }
                          : { borderColor: 'var(--border)', background: 'color-mix(in srgb, var(--bg2) 75%, transparent)' }}
                      >
                        <img src={`/profile-avatars/${option.id}.svg`} alt={option.label} className="mx-auto h-12 w-12 rounded-xl object-cover" />
                        <div className="mt-2 text-center text-[10px] font-mono tracking-widest" style={{ color: selected ? 'var(--accent)' : 'var(--text-dim)' }}>
                          {option.label}
                        </div>
                      </button>
                    )
                  })}
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <label className="rounded-xl border px-4 py-3 text-[12px] font-mono tracking-widest cursor-pointer" style={{ borderColor: 'var(--accent-mid)', background: 'var(--accent-dim)', color: 'var(--accent)' }}>
                  Upload Picture
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp,image/gif,image/svg+xml"
                    className="hidden"
                    onChange={async e => {
                      await handleAvatarUpload(e.target.files)
                      e.currentTarget.value = ''
                    }}
                  />
                </label>
                <button
                  type="button"
                  disabled={avatarSaving || avatar.type === 'none'}
                  onClick={() => void handleUnsetAvatar()}
                  className="rounded-xl border px-4 py-3 text-[12px] font-mono tracking-widest disabled:opacity-40"
                  style={{ borderColor: 'var(--border)', background: 'var(--panel)', color: 'var(--text-dim)' }}
                >
                  Unset Picture
                </button>
              </div>
              <div className="text-[11px] font-mono text-[var(--text-dim)]">Uploads are resized to a square account avatar and can be replaced or removed at any time.</div>
              {avatarStatus && <StatusMsg ok={avatarStatus.ok} msg={avatarStatus.msg} />}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          <div className="rounded-lg border border-[var(--border)] bg-[var(--panel)] p-4 space-y-3">
            <div>
              <div className="text-[13px] font-mono tracking-widest text-[var(--text-dim)]">EMAIL</div>
              <div className="text-[11px] font-mono text-[var(--text-dim)] opacity-70 mt-1">Change the address you sign in with.</div>
            </div>
            <form onSubmit={handleChangeEmail} className="space-y-2">
              <input
                type="email"
                placeholder="New email address"
                value={emailNew}
                onChange={e => setEmailNew(e.target.value)}
                className={inputCls}
                required
                autoComplete="email"
              />
              <input
                type="password"
                placeholder="Confirm with current password"
                value={emailPw}
                onChange={e => setEmailPw(e.target.value)}
                className={inputCls}
                required
                autoComplete="current-password"
              />
              <button
                type="submit"
                disabled={emailLoading}
                className={btnPrimary}
                style={{ borderColor: 'var(--accent-mid)', color: 'var(--accent)', background: 'var(--accent-dim)' }}
              >
                {emailLoading ? 'Updating...' : 'Update Email'}
              </button>
              {emailStatus && <StatusMsg ok={emailStatus.ok} msg={emailStatus.msg} />}
            </form>
          </div>

          <div className="rounded-lg border border-[var(--border)] bg-[var(--panel)] p-4 space-y-3">
            <div>
              <div className="text-[13px] font-mono tracking-widest text-[var(--text-dim)]">PASSWORD</div>
              <div className="text-[11px] font-mono text-[var(--text-dim)] opacity-70 mt-1">Keep the current password for confirmation, then set the new one.</div>
            </div>
            <form onSubmit={handleChangePassword} className="space-y-2">
              <input
                type="password"
                placeholder="Current password"
                value={pwCurrent}
                onChange={e => setPwCurrent(e.target.value)}
                className={inputCls}
                required
                autoComplete="current-password"
              />
              <input
                type="password"
                placeholder="New password (min 8 chars)"
                value={pwNew}
                onChange={e => setPwNew(e.target.value)}
                className={inputCls}
                required
                autoComplete="new-password"
              />
              <input
                type="password"
                placeholder="Confirm new password"
                value={pwConfirm}
                onChange={e => setPwConfirm(e.target.value)}
                className={inputCls}
                required
                autoComplete="new-password"
              />
              <button
                type="submit"
                disabled={pwLoading}
                className={btnPrimary}
                style={{ borderColor: 'var(--accent-mid)', color: 'var(--accent)', background: 'var(--accent-dim)' }}
              >
                {pwLoading ? 'Updating...' : 'Update Password'}
              </button>
              {pwStatus && <StatusMsg ok={pwStatus.ok} msg={pwStatus.msg} />}
            </form>
          </div>
        </div>
      </CollapsibleCard>

      {/* Account — Danger Zone */}
      <CollapsibleCard
        title={<span className="text-red-500">DANGER ZONE</span>}
        storageKey="settings:danger-zone"
        bodyClassName="p-5 space-y-3"
      >
        <div className="flex items-center justify-between">
          <div>
            <div className="text-[15px] font-mono text-[var(--text)]">Delete Account</div>
            <div className="text-[13px] font-mono text-[var(--text-dim)] mt-0.5">Permanently removes your account and all data. This cannot be undone.</div>
          </div>
          <button
            onClick={() => { setShowDeleteModal(true); setDeleteStatus(null); setDeletePw('') }}
            className="px-3 py-1.5 rounded-lg font-mono text-[13px] border border-red-900 text-red-400 hover:border-red-700 transition-colors flex-shrink-0 ml-4"
          >
            Delete
          </button>
        </div>
      </CollapsibleCard>

      {/* Delete modal */}
      {showAccentPicker && (
        <ColorPickerModal
          initialColor={customAccent}
          theme={theme}
          onCancel={() => setShowAccentPicker(false)}
          onApply={(color) => {
            setAccent('custom')
            setCustomAccent(color)
            setCustomAccentInput(color)
            setCustomAccentStatus({ ok: true, msg: `Custom accent set to ${color.toUpperCase()}.` })
            setShowAccentPicker(false)
          }}
        />
      )}

      {showDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.7)' }}>
          <div className="glass-card p-6 w-full max-w-sm space-y-4" style={{ borderColor: '#ff335540' }}>
            <div className="text-[15px] font-mono text-red-400 tracking-widest">DELETE ACCOUNT</div>
            <p className="text-[13px] font-mono text-[var(--text-dim)]">
              This is permanent. All your data, server connections, and settings will be erased. Enter your password to confirm.
            </p>
            <form onSubmit={handleDeleteAccount} className="space-y-3">
              <input
                type="password"
                placeholder="Your password"
                value={deletePw}
                onChange={e => setDeletePw(e.target.value)}
                className={inputCls}
                required
                autoFocus
                autoComplete="current-password"
              />
              {deleteStatus && <StatusMsg ok={deleteStatus.ok} msg={deleteStatus.msg} />}
              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setShowDeleteModal(false)}
                  className="flex-1 py-2 rounded-lg font-mono text-[13px] border border-[var(--border)] text-[var(--text-dim)] hover:border-[var(--accent-mid)] transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={deleteLoading}
                  className="flex-1 py-2 rounded-lg font-mono text-[13px] border border-red-800 text-red-400 hover:border-red-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  {deleteLoading ? 'Deleting...' : 'Confirm Delete'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
