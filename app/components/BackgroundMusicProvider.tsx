'use client'

import { useEffect, useRef } from 'react'
import { loadMusicSettings, resolveSourceUrl, type MediaSource } from './soundfx'

export default function BackgroundMusicProvider({ children }: { children: React.ReactNode }) {
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const stopRef = useRef(false)

  useEffect(() => {
    stopRef.current = false

    const playLoop = async () => {
      const settings = loadMusicSettings()
      if (!settings.enabled || settings.tracks.length === 0) {
        if (audioRef.current) {
          audioRef.current.pause()
          audioRef.current = null
        }
        return
      }

      const pool: MediaSource[] = [...settings.tracks]
      let index = 0

      const pickNextTrack = () => {
        if (settings.shuffle) {
          index = Math.floor(Math.random() * pool.length)
        } else {
          index = (index + 1) % pool.length
        }
        return pool[index]
      }

      const startTrack = async (track: MediaSource) => {
        if (stopRef.current) return
        const url = await resolveSourceUrl(track)
        if (!url || stopRef.current) return

        const audio = new Audio(url)
        audio.volume = settings.volume
        audioRef.current = audio
        audio.onended = () => {
          void startTrack(pickNextTrack())
        }
        void audio.play().catch(() => {})
      }

      if (!settings.shuffle) index = -1
      await startTrack(pickNextTrack())
    }

    const refresh = () => {
      stopRef.current = true
      if (audioRef.current) {
        audioRef.current.pause()
        audioRef.current = null
      }
      stopRef.current = false
      void playLoop()
    }

    void playLoop()
    window.addEventListener('mcraftr:music-settings-updated', refresh)
    return () => {
      stopRef.current = true
      window.removeEventListener('mcraftr:music-settings-updated', refresh)
      if (audioRef.current) {
        audioRef.current.pause()
        audioRef.current = null
      }
    }
  }, [])

  return <>{children}</>
}
