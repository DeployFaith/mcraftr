'use client'

import { useEffect, useState } from 'react'
import { Pipette } from 'lucide-react'
import { Chrome } from '@uiw/react-color'

type EyeDropperResult = { sRGBHex: string }
type EyeDropperLike = { open: () => Promise<EyeDropperResult> }

declare global {
  interface Window {
    EyeDropper?: new () => EyeDropperLike
  }
}

type ColorPickerModalProps = {
  initialColor: string
  theme: 'dark' | 'light'
  onApply: (color: string) => void
  onCancel: () => void
}

export default function ColorPickerModal({
  initialColor,
  theme,
  onApply,
  onCancel,
}: ColorPickerModalProps) {
  const [draftColor, setDraftColor] = useState(initialColor)
  const [eyeDropperAvailable, setEyeDropperAvailable] = useState(false)
  const [eyeDropperBusy, setEyeDropperBusy] = useState(false)
  const [eyeDropperStatus, setEyeDropperStatus] = useState<string>('')

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onCancel()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onCancel])

  useEffect(() => {
    if (typeof window === 'undefined') return
    setEyeDropperAvailable(Boolean(window.isSecureContext && window.EyeDropper))
  }, [])

  const useEyeDropper = async () => {
    if (!window.isSecureContext) {
      setEyeDropperStatus('Eyedropper needs HTTPS or another secure browser context.')
      return
    }
    if (!window.EyeDropper) {
      return
    }
    setEyeDropperBusy(true)
    setEyeDropperStatus('')
    try {
      const tool = new window.EyeDropper()
      const result = await tool.open()
      setDraftColor(result.sRGBHex)
      setEyeDropperStatus(`Picked ${result.sRGBHex.toUpperCase()}.`)
    } catch (error) {
      if (!(error instanceof DOMException && error.name === 'AbortError')) {
        setEyeDropperStatus('Eyedropper failed to read a color from the screen.')
      }
    } finally {
      setEyeDropperBusy(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(4, 8, 14, 0.76)', backdropFilter: 'blur(10px)' }}
      onClick={onCancel}
    >
      <div
        data-color-mode={theme}
        className="w-full max-w-[560px] overflow-hidden rounded-[28px] border"
        style={{
          borderColor: 'var(--accent-mid)',
          background: 'linear-gradient(180deg, color-mix(in srgb, var(--panel) 94%, transparent), color-mix(in srgb, var(--bg2) 90%, transparent))',
          boxShadow: '0 28px 90px rgba(0,0,0,0.42)',
        }}
        onClick={event => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 border-b px-6 py-5" style={{ borderColor: 'var(--border)' }}>
          <div>
            <div className="font-mono text-[15px] tracking-[0.18em]" style={{ color: 'var(--text)' }}>
              CUSTOM ACCENT PICKER
            </div>
            <div className="mt-2 font-mono text-[11px]" style={{ color: 'var(--text-dim)' }}>
              Use the picker below. The eyedropper is built into the picker when your browser supports it.
            </div>
          </div>
          <div
            className="h-14 w-14 rounded-2xl border"
            style={{ borderColor: 'var(--accent-mid)', background: draftColor }}
          />
        </div>

        <div className="grid gap-5 px-6 py-6 md:grid-cols-[minmax(0,1fr)_160px]">
          <div className="overflow-hidden rounded-[22px] border p-4" style={{ borderColor: 'var(--border)', background: 'color-mix(in srgb, var(--bg) 68%, transparent)' }}>
            <Chrome
              color={draftColor}
              showEyeDropper={false}
              showAlpha={false}
              showColorPreview
              showEditableInput
              style={{
                width: '100%',
                background: 'transparent',
                boxShadow: 'none',
              }}
              onChange={(color: { hex: string }) => setDraftColor(color.hex)}
            />
          </div>

          <div className="space-y-3">
            <div className="rounded-[22px] border p-4" style={{ borderColor: 'var(--border)', background: 'color-mix(in srgb, var(--bg) 68%, transparent)' }}>
              <div className="font-mono text-[11px] tracking-[0.18em]" style={{ color: 'var(--text-dim)' }}>
                PREVIEW
              </div>
              <div className="mt-3 rounded-[18px] border p-4" style={{ borderColor: 'var(--accent-mid)', background: draftColor }}>
                <div className="font-mono text-[11px] tracking-[0.14em]" style={{ color: '#111' }}>
                  {draftColor.toUpperCase()}
                </div>
              </div>
            </div>

            {eyeDropperAvailable && (
              <div className="rounded-[22px] border p-4" style={{ borderColor: 'var(--border)', background: 'color-mix(in srgb, var(--bg) 68%, transparent)' }}>
                <button
                  type="button"
                  onClick={() => void useEyeDropper()}
                  disabled={eyeDropperBusy}
                  className="flex w-full items-center justify-center gap-2 rounded-2xl border px-4 py-3 font-mono text-[11px] tracking-[0.16em] transition-all disabled:opacity-50"
                  style={{
                    borderColor: 'var(--accent-mid)',
                    background: 'var(--accent-dim)',
                    color: 'var(--accent)',
                  }}
                >
                  <Pipette size={14} />
                  {eyeDropperBusy ? 'Picking…' : 'Eyedropper'}
                </button>
                <div className="mt-3 font-mono text-[11px]" style={{ color: 'var(--text-dim)' }}>
                  Pick any color from the screen.
                </div>
                {eyeDropperStatus && (
                  <div className="mt-3 rounded-xl border px-3 py-2 font-mono text-[11px]" style={{ borderColor: 'var(--border)', color: 'var(--text)', background: 'var(--panel)' }}>
                    {eyeDropperStatus}
                  </div>
                )}
              </div>
            )}

            <div className="rounded-[22px] border p-4" style={{ borderColor: 'var(--border)', background: 'color-mix(in srgb, var(--bg) 68%, transparent)' }}>
              <div className="font-mono text-[11px] tracking-[0.18em]" style={{ color: 'var(--text-dim)' }}>
                HELP
              </div>
              <div className="mt-3 space-y-2 font-mono text-[11px]" style={{ color: 'var(--text-dim)' }}>
                <div>Click, drag, or type a color.</div>
                <div>Use the Eyedropper button here in the modal.</div>
                <div>Press `Esc` to close.</div>
              </div>
            </div>
          </div>
        </div>

        <div className="flex gap-3 border-t px-6 py-5" style={{ borderColor: 'var(--border)' }}>
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 rounded-2xl border px-4 py-3 font-mono text-[12px] tracking-[0.16em] transition-all"
            style={{ borderColor: 'var(--border)', color: 'var(--text-dim)', background: 'var(--panel)' }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => onApply(draftColor)}
            className="flex-1 rounded-2xl border px-4 py-3 font-mono text-[12px] tracking-[0.16em] transition-all"
            style={{ borderColor: 'var(--accent-mid)', color: 'var(--accent)', background: 'var(--accent-dim)' }}
          >
            Apply Accent
          </button>
        </div>
      </div>
    </div>
  )
}
