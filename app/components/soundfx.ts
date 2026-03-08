'use client'

import { deleteUploadedFile, getUploadedFileUrl, type MediaAssetKind } from './mediaLibrary'

export type SoundEffectKey = 'uiClick' | 'success' | 'notify' | 'error'

export type BuiltinSoundId = SoundEffectKey
export type BuiltinMusicId = 'dryHands' | 'livingMice' | 'miceOnVenus'
export type MediaSource =
  | { type: 'builtin'; id: BuiltinSoundId | BuiltinMusicId }
  | { type: 'url'; url: string; label: string }
  | { type: 'upload'; assetId: string; label: string }

export type SoundSettings = {
  masterEnabled: boolean
  volume: number
  effects: Record<SoundEffectKey, { enabled: boolean; source: MediaSource }>
}

export type MusicSettings = {
  enabled: boolean
  volume: number
  shuffle: boolean
  tracks: MediaSource[]
}

const SOUND_STORAGE_KEY = 'mcraftr-sound-settings'
const MUSIC_STORAGE_KEY = 'mcraftr-music-settings'

export const BUILTIN_SOUNDS: Record<BuiltinSoundId, { label: string; url: string }> = {
  uiClick: { label: 'UI Click', url: '/sounds/ui-click.ogg' },
  success: { label: 'Success Orb', url: '/sounds/success-orb.ogg' },
  notify: { label: 'Notify Pling', url: '/sounds/notify-pling.ogg' },
  error: { label: 'Villager No', url: '/sounds/error-villager-no.ogg' },
}

export const BUILTIN_MUSIC: Record<BuiltinMusicId, { label: string; url: string }> = {
  dryHands: { label: 'Dry Hands', url: '/sounds/music-dry-hands.ogg' },
  livingMice: { label: 'Living Mice', url: '/sounds/music-living-mice.ogg' },
  miceOnVenus: { label: 'Mice on Venus', url: '/sounds/music-mice-on-venus.ogg' },
}

export const DEFAULT_SOUND_SETTINGS: SoundSettings = {
  masterEnabled: true,
  volume: 0.55,
  effects: {
    uiClick: { enabled: true, source: { type: 'builtin', id: 'uiClick' } },
    success: { enabled: true, source: { type: 'builtin', id: 'success' } },
    notify: { enabled: true, source: { type: 'builtin', id: 'notify' } },
    error: { enabled: true, source: { type: 'builtin', id: 'error' } },
  },
}

export const DEFAULT_MUSIC_SETTINGS: MusicSettings = {
  enabled: false,
  volume: 0.3,
  shuffle: true,
  tracks: [
    { type: 'builtin', id: 'dryHands' },
    { type: 'builtin', id: 'livingMice' },
    { type: 'builtin', id: 'miceOnVenus' },
  ],
}

function normalizeUrl(value: string) {
  const trimmed = value.trim()
  return /^https?:\/\/\S+/i.test(trimmed) ? trimmed : ''
}

function isBuiltinSoundId(id: string): id is BuiltinSoundId {
  return id in BUILTIN_SOUNDS
}

function isBuiltinMusicId(id: string): id is BuiltinMusicId {
  return id in BUILTIN_MUSIC
}

function normalizeMediaSource(source: MediaSource | undefined, kind: MediaAssetKind, fallback: MediaSource): MediaSource {
  if (!source || typeof source !== 'object' || !('type' in source)) return fallback
  if (source.type === 'builtin') {
    if (kind === 'sound' && isBuiltinSoundId(String(source.id))) return { type: 'builtin', id: source.id }
    if (kind === 'music' && isBuiltinMusicId(String(source.id))) return { type: 'builtin', id: source.id }
    return fallback
  }
  if (source.type === 'url') {
    const url = normalizeUrl(source.url)
    if (!url) return fallback
    return { type: 'url', url, label: String(source.label || url) }
  }
  if (source.type === 'upload') {
    if (!source.assetId) return fallback
    return { type: 'upload', assetId: String(source.assetId), label: String(source.label || 'Uploaded audio') }
  }
  return fallback
}

export function loadSoundSettings(): SoundSettings {
  if (typeof window === 'undefined') return DEFAULT_SOUND_SETTINGS
  try {
    const parsed = JSON.parse(window.localStorage.getItem(SOUND_STORAGE_KEY) || 'null') as Partial<SoundSettings> | null
    if (!parsed) return DEFAULT_SOUND_SETTINGS
    return {
      masterEnabled: parsed.masterEnabled !== false,
      volume: typeof parsed.volume === 'number' ? Math.min(1, Math.max(0, parsed.volume)) : DEFAULT_SOUND_SETTINGS.volume,
      effects: {
        uiClick: {
          enabled: parsed.effects?.uiClick?.enabled !== false,
          source: normalizeMediaSource(parsed.effects?.uiClick?.source, 'sound', DEFAULT_SOUND_SETTINGS.effects.uiClick.source),
        },
        success: {
          enabled: parsed.effects?.success?.enabled !== false,
          source: normalizeMediaSource(parsed.effects?.success?.source, 'sound', DEFAULT_SOUND_SETTINGS.effects.success.source),
        },
        notify: {
          enabled: parsed.effects?.notify?.enabled !== false,
          source: normalizeMediaSource(parsed.effects?.notify?.source, 'sound', DEFAULT_SOUND_SETTINGS.effects.notify.source),
        },
        error: {
          enabled: parsed.effects?.error?.enabled !== false,
          source: normalizeMediaSource(parsed.effects?.error?.source, 'sound', DEFAULT_SOUND_SETTINGS.effects.error.source),
        },
      },
    }
  } catch {
    return DEFAULT_SOUND_SETTINGS
  }
}

export function saveSoundSettings(settings: SoundSettings) {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(SOUND_STORAGE_KEY, JSON.stringify(settings))
  window.dispatchEvent(new Event('mcraftr:sound-settings-updated'))
}

export function loadMusicSettings(): MusicSettings {
  if (typeof window === 'undefined') return DEFAULT_MUSIC_SETTINGS
  try {
    const parsed = JSON.parse(window.localStorage.getItem(MUSIC_STORAGE_KEY) || 'null') as Partial<MusicSettings> | null
    if (!parsed) return DEFAULT_MUSIC_SETTINGS
    const tracks = Array.isArray(parsed.tracks)
      ? parsed.tracks
          .map(track => normalizeMediaSource(track as MediaSource, 'music', DEFAULT_MUSIC_SETTINGS.tracks[0]))
          .filter(Boolean)
      : DEFAULT_MUSIC_SETTINGS.tracks
    return {
      enabled: parsed.enabled === true,
      volume: typeof parsed.volume === 'number' ? Math.min(1, Math.max(0, parsed.volume)) : DEFAULT_MUSIC_SETTINGS.volume,
      shuffle: parsed.shuffle !== false,
      tracks: tracks.length > 0 ? tracks : DEFAULT_MUSIC_SETTINGS.tracks,
    }
  } catch {
    return DEFAULT_MUSIC_SETTINGS
  }
}

export function saveMusicSettings(settings: MusicSettings) {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(MUSIC_STORAGE_KEY, JSON.stringify(settings))
  window.dispatchEvent(new Event('mcraftr:music-settings-updated'))
}

export function describeSource(source: MediaSource) {
  if (source.type === 'builtin') return source.id in BUILTIN_SOUNDS ? BUILTIN_SOUNDS[source.id as BuiltinSoundId].label : BUILTIN_MUSIC[source.id as BuiltinMusicId].label
  return source.label
}

export async function resolveSourceUrl(source: MediaSource) {
  if (source.type === 'builtin') {
    if (source.id in BUILTIN_SOUNDS) return BUILTIN_SOUNDS[source.id as BuiltinSoundId].url
    if (source.id in BUILTIN_MUSIC) return BUILTIN_MUSIC[source.id as BuiltinMusicId].url
    return null
  }
  if (source.type === 'url') return normalizeUrl(source.url) || null
  return await getUploadedFileUrl(source.assetId)
}

export async function playSound(key: SoundEffectKey) {
  if (typeof window === 'undefined') return
  const settings = loadSoundSettings()
  const effect = settings.effects[key]
  if (!settings.masterEnabled || !effect.enabled) return
  await playMediaSource(effect.source, settings.volume * (key === 'error' ? 0.9 : key === 'success' ? 0.72 : 0.6))
}

export async function playMediaSource(source: MediaSource, volume = 0.6) {
  if (typeof window === 'undefined') return
  const url = await resolveSourceUrl(source)
  if (!url) return
  const audio = new Audio(url)
  audio.volume = Math.min(1, Math.max(0, volume))
  void audio.play().catch(() => {})
}

export async function cleanupUnusedUploadedMedia() {
  if (typeof window === 'undefined') return
  const soundSettings = loadSoundSettings()
  const musicSettings = loadMusicSettings()
  const used = new Set<string>()
  Object.values(soundSettings.effects).forEach(effect => {
    if (effect.source.type === 'upload') used.add(effect.source.assetId)
  })
  musicSettings.tracks.forEach(track => {
    if (track.type === 'upload') used.add(track.assetId)
  })
  const known = JSON.parse(window.localStorage.getItem('mcraftr-uploaded-media-ids') || '[]') as string[]
  const next = known.filter(id => used.has(id))
  const stale = known.filter(id => !used.has(id))
  await Promise.all(stale.map(id => deleteUploadedFile(id)))
  window.localStorage.setItem('mcraftr-uploaded-media-ids', JSON.stringify(next))
}

export function registerUploadedMediaIds(ids: string[]) {
  if (typeof window === 'undefined' || ids.length === 0) return
  const current = new Set<string>(JSON.parse(window.localStorage.getItem('mcraftr-uploaded-media-ids') || '[]'))
  ids.forEach(id => current.add(id))
  window.localStorage.setItem('mcraftr-uploaded-media-ids', JSON.stringify(Array.from(current)))
}
