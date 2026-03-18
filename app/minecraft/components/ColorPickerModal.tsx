'use client'

import { useEffect, useState } from 'react'
import { Pipette, X } from 'lucide-react'

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

type HslColor = {
  h: number
  s: number
  l: number
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

function normalizeHex(value: string) {
  const trimmed = value.trim().toLowerCase()
  if (/^#[0-9a-f]{6}$/.test(trimmed)) return trimmed
  return '#7df9ff'
}

function hexToRgb(hex: string) {
  const normalized = normalizeHex(hex)
  return {
    r: Number.parseInt(normalized.slice(1, 3), 16),
    g: Number.parseInt(normalized.slice(3, 5), 16),
    b: Number.parseInt(normalized.slice(5, 7), 16),
  }
}

function rgbToHex(r: number, g: number, b: number) {
  return `#${[r, g, b].map(value => clamp(Math.round(value), 0, 255).toString(16).padStart(2, '0')).join('')}`
}

function rgbToHsl(r: number, g: number, b: number): HslColor {
  const red = r / 255
  const green = g / 255
  const blue = b / 255
  const max = Math.max(red, green, blue)
  const min = Math.min(red, green, blue)
  const delta = max - min
  const lightness = (max + min) / 2

  if (delta === 0) {
    return { h: 0, s: 0, l: Math.round(lightness * 100) }
  }

  const saturation = delta / (1 - Math.abs(2 * lightness - 1))
  let hue = 0

  switch (max) {
    case red:
      hue = 60 * (((green - blue) / delta) % 6)
      break
    case green:
      hue = 60 * ((blue - red) / delta + 2)
      break
    default:
      hue = 60 * ((red - green) / delta + 4)
      break
  }

  return {
    h: Math.round((hue + 360) % 360),
    s: Math.round(saturation * 100),
    l: Math.round(lightness * 100),
  }
}

function hslToHex(h: number, s: number, l: number) {
  const hue = ((h % 360) + 360) % 360
  const saturation = clamp(s, 0, 100) / 100
  const lightness = clamp(l, 0, 100) / 100
  const chroma = (1 - Math.abs(2 * lightness - 1)) * saturation
  const x = chroma * (1 - Math.abs((hue / 60) % 2 - 1))
  const match = lightness - chroma / 2
  let red = 0
  let green = 0
  let blue = 0

  if (hue < 60) {
    red = chroma
    green = x
  } else if (hue < 120) {
    red = x
    green = chroma
  } else if (hue < 180) {
    green = chroma
    blue = x
  } else if (hue < 240) {
    green = x
    blue = chroma
  } else if (hue < 300) {
    red = x
    blue = chroma
  } else {
    red = chroma
    blue = x
  }

  return rgbToHex((red + match) * 255, (green + match) * 255, (blue + match) * 255)
}

function hexToHsl(hex: string) {
  const { r, g, b } = hexToRgb(hex)
  return rgbToHsl(r, g, b)
}

export default function ColorPickerModal({
  initialColor,
  theme,
  onApply,
  onCancel,
}: ColorPickerModalProps) {
  const [draftColor, setDraftColor] = useState(normalizeHex(initialColor))
  const [draftHsl, setDraftHsl] = useState<HslColor>(() => hexToHsl(initialColor))
  const [hexInput, setHexInput] = useState(normalizeHex(initialColor))
  const [eyeDropperAvailable, setEyeDropperAvailable] = useState(false)
  const [eyeDropperBusy, setEyeDropperBusy] = useState(false)
  const [eyeDropperStatus, setEyeDropperStatus] = useState<string>('')

  useEffect(() => {
    const normalized = normalizeHex(initialColor)
    setDraftColor(normalized)
    setDraftHsl(hexToHsl(normalized))
    setHexInput(normalized)
  }, [initialColor])

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

  const updateColor = (nextColor: string) => {
    const normalized = normalizeHex(nextColor)
    setDraftColor(normalized)
    setDraftHsl(hexToHsl(normalized))
    setHexInput(normalized)
  }

  const updateFromHsl = (next: Partial<HslColor>) => {
    setDraftHsl(current => {
      const merged = {
        h: next.h ?? current.h,
        s: next.s ?? current.s,
        l: next.l ?? current.l,
      }
      const hex = hslToHex(merged.h, merged.s, merged.l)
      setDraftColor(hex)
      setHexInput(hex)
      return merged
    })
  }

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
      updateColor(result.sRGBHex)
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
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto p-3 sm:items-center sm:p-4"
      style={{ background: 'rgba(4, 8, 14, 0.76)', backdropFilter: 'blur(10px)' }}
      onClick={onCancel}
    >
      <div
        data-color-mode={theme}
        className="flex w-full max-w-[560px] flex-col overflow-hidden rounded-[28px] border"
        style={{
          maxHeight: 'calc(100dvh - 1.5rem)',
          borderColor: 'var(--accent-mid)',
          background: 'linear-gradient(180deg, color-mix(in srgb, var(--panel) 94%, transparent), color-mix(in srgb, var(--bg2) 90%, transparent))',
          boxShadow: '0 28px 90px rgba(0,0,0,0.42)',
        }}
        onClick={event => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 border-b px-5 py-4 sm:px-6 sm:py-5" style={{ borderColor: 'var(--border)' }}>
          <div>
            <div className="font-mono text-[15px] tracking-[0.18em]" style={{ color: 'var(--text)' }}>
              CUSTOM ACCENT PICKER
            </div>
            <div className="mt-2 font-mono text-[11px]" style={{ color: 'var(--text-dim)' }}>
              Use the picker below. Mobile always has an on-screen close button.
            </div>
          </div>
          <div className="flex items-start gap-2">
            <div
              className="h-12 w-12 rounded-2xl border sm:h-14 sm:w-14"
              style={{ borderColor: 'var(--accent-mid)', background: draftColor }}
            />
            <button
              type="button"
              onClick={onCancel}
              className="tap-target grid h-10 w-10 place-items-center rounded-2xl border transition-all"
              aria-label="Close color picker"
              style={{ borderColor: 'var(--border)', background: 'var(--panel)', color: 'var(--text-dim)' }}
            >
              <X size={18} strokeWidth={2} />
            </button>
          </div>
        </div>

        <div className="min-h-0 overflow-y-auto px-5 py-5 sm:px-6 sm:py-6 touch-pan-y [-webkit-overflow-scrolling:touch]">
          <div className="grid gap-5 md:grid-cols-[minmax(0,1fr)_160px]">
            <div className="overflow-hidden rounded-[22px] border p-4" style={{ borderColor: 'var(--border)', background: 'color-mix(in srgb, var(--bg) 68%, transparent)' }}>
              <div className="space-y-4">
                <div>
                  <div className="mb-2 font-mono text-[11px] tracking-[0.18em]" style={{ color: 'var(--text-dim)' }}>
                    PICKER
                  </div>
                  <input
                    type="color"
                    value={draftColor}
                    onChange={event => updateColor(event.target.value)}
                    className="h-24 w-full cursor-pointer rounded-[18px] border"
                    style={{ borderColor: 'var(--accent-mid)', background: 'transparent' }}
                  />
                </div>

                <div className="space-y-3">
                  <label className="block space-y-2">
                    <div className="flex items-center justify-between font-mono text-[11px] tracking-[0.18em]" style={{ color: 'var(--text-dim)' }}>
                      <span>HUE</span>
                      <span>{draftHsl.h}</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="360"
                      value={draftHsl.h}
                      onChange={event => updateFromHsl({ h: Number(event.target.value) })}
                      className="w-full cursor-pointer"
                      style={{ accentColor: draftColor }}
                    />
                  </label>

                  <label className="block space-y-2">
                    <div className="flex items-center justify-between font-mono text-[11px] tracking-[0.18em]" style={{ color: 'var(--text-dim)' }}>
                      <span>SATURATION</span>
                      <span>{draftHsl.s}%</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={draftHsl.s}
                      onChange={event => updateFromHsl({ s: Number(event.target.value) })}
                      className="w-full cursor-pointer"
                      style={{ accentColor: draftColor }}
                    />
                  </label>

                  <label className="block space-y-2">
                    <div className="flex items-center justify-between font-mono text-[11px] tracking-[0.18em]" style={{ color: 'var(--text-dim)' }}>
                      <span>LIGHTNESS</span>
                      <span>{draftHsl.l}%</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={draftHsl.l}
                      onChange={event => updateFromHsl({ l: Number(event.target.value) })}
                      className="w-full cursor-pointer"
                      style={{ accentColor: draftColor }}
                    />
                  </label>
                </div>

                <label className="block space-y-2">
                  <div className="font-mono text-[11px] tracking-[0.18em]" style={{ color: 'var(--text-dim)' }}>
                    HEX
                  </div>
                  <input
                    value={hexInput}
                    onChange={event => setHexInput(event.target.value)}
                    onBlur={() => updateColor(hexInput)}
                    onKeyDown={event => {
                      if (event.key === 'Enter') {
                        event.preventDefault()
                        updateColor(hexInput)
                      }
                    }}
                    className="w-full rounded-2xl border px-3 py-3 font-mono text-[13px]"
                    style={{ borderColor: 'var(--border)', background: 'var(--panel)', color: 'var(--text)' }}
                  />
                </label>
              </div>
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
                  <div>Use the color field, sliders, or HEX input.</div>
                  <div>The preview updates live on desktop and mobile.</div>
                  <div>Apply Accent saves the color to your theme settings.</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="flex shrink-0 gap-3 border-t px-5 py-4 sm:px-6 sm:py-5" style={{ borderColor: 'var(--border)' }}>
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
