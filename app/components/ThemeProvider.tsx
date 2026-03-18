'use client'
import { createContext, useContext, useEffect, useState } from 'react'

// ── Accent palette ─────────────────────────────────────────────────────────────

export type AccentId = 'cyan' | 'blue' | 'purple' | 'pink' | 'orange' | 'yellow' | 'red'
export type AccentPresetId = AccentId
export type AccentChoice = AccentPresetId | 'custom'

export const ACCENTS: { id: AccentPresetId; label: string; color: string }[] = [
  { id: 'cyan',   label: 'Cyan',   color: '#00ffc8' },
  { id: 'blue',   label: 'Blue',   color: '#4d9fff' },
  { id: 'purple', label: 'Purple', color: '#b57bff' },
  { id: 'pink',   label: 'Pink',   color: '#ff6eb4' },
  { id: 'orange', label: 'Orange', color: '#ff9500' },
  { id: 'yellow', label: 'Yellow', color: '#ffd60a' },
  { id: 'red',    label: 'Red',    color: '#ff453a' },
]

export const DEFAULT_CUSTOM_ACCENT = '#7df9ff'

export type FontId = 'system' | 'operator' | 'minecraft' | 'pixel' | 'terminal'
export type FontSizeId = 'sm' | 'md' | 'lg' | 'xl'
export type ThemePackVars = Partial<Record<'--bg' | '--bg2' | '--panel' | '--border' | '--text' | '--text-dim' | '--red', string>>
export type ThemePackSoundEffect = {
  enabled?: boolean
  source?: unknown
}
export type ThemePack = {
  name?: string
  vars: ThemePackVars
  accent?: string
  soundEffects?: {
    masterEnabled?: boolean
    volume?: number
    effects?: Partial<Record<'uiClick' | 'success' | 'notify' | 'error', ThemePackSoundEffect>>
  }
  backgroundMusic?: {
    enabled?: boolean
    volume?: number
    shuffle?: boolean
    tracks?: unknown[]
  }
}

export const FONTS: { id: FontId; label: string; sample: string }[] = [
  { id: 'system', label: 'System', sample: 'Clean and native' },
  { id: 'operator', label: 'Operator', sample: 'Sharp and readable' },
  { id: 'minecraft', label: 'Minecraft UI', sample: 'Chunky and blocky' },
  { id: 'pixel', label: 'Pixel', sample: 'Arcade mode' },
  { id: 'terminal', label: 'Terminal', sample: 'CRT command line' },
]

export const FONT_SIZES: { id: FontSizeId; label: string; size: string; sample: string }[] = [
  { id: 'sm', label: 'Small', size: '14px', sample: 'Compact' },
  { id: 'md', label: 'Normal', size: '16px', sample: 'Default' },
  { id: 'lg', label: 'Large', size: '18px', sample: 'Readable' },
  { id: 'xl', label: 'Extra Large', size: '20px', sample: 'Big UI' },
]

// ── Context ───────────────────────────────────────────────────────────────────

type Theme = 'dark' | 'light'

type ThemeContextValue = {
  theme:     Theme
  setTheme:  (t: Theme) => void
  accent:    AccentChoice
  setAccent: (a: AccentChoice) => void
  customAccent: string
  setCustomAccent: (color: string) => void
  themePack: ThemePack | null
  setThemePack: (pack: ThemePack | null) => void
  font:      FontId
  setFont:   (f: FontId) => void
  fontSize:  FontSizeId
  setFontSize: (f: FontSizeId) => void
}

const ThemeContext = createContext<ThemeContextValue>({
  theme:     'dark',
  setTheme:  () => {},
  accent:    'cyan',
  setAccent: () => {},
  customAccent: DEFAULT_CUSTOM_ACCENT,
  setCustomAccent: () => {},
  themePack: null,
  setThemePack: () => {},
  font:      'operator',
  setFont:   () => {},
  fontSize:  'md',
  setFontSize: () => {},
})

export function useTheme() {
  return useContext(ThemeContext)
}

// ── Provider ──────────────────────────────────────────────────────────────────

function normalizeHexColor(value: string | null | undefined): string {
  if (!value) return DEFAULT_CUSTOM_ACCENT
  const trimmed = value.trim()
  return /^#[0-9a-fA-F]{6}$/.test(trimmed) ? trimmed.toLowerCase() : DEFAULT_CUSTOM_ACCENT
}

function normalizeThemePack(value: unknown): ThemePack | null {
  if (!value || typeof value !== 'object') return null
  const raw = value as {
    name?: unknown
    vars?: Record<string, unknown>
    accent?: unknown
    soundEffects?: unknown
    backgroundMusic?: unknown
  }
  const vars = Object.fromEntries(
    Object.entries(raw.vars ?? {}).filter(([key, val]) =>
      ['--bg', '--bg2', '--panel', '--border', '--text', '--text-dim', '--red'].includes(key) &&
      typeof val === 'string' &&
      /^#[0-9a-fA-F]{6}$/.test(val.trim()),
    ),
  ) as ThemePackVars
  const accent = typeof raw.accent === 'string' && /^#[0-9a-fA-F]{6}$/.test(raw.accent.trim()) ? raw.accent.trim().toLowerCase() : undefined
  if (Object.keys(vars).length === 0 && !accent) return null
  return {
    name: typeof raw.name === 'string' ? raw.name.slice(0, 80) : undefined,
    vars,
    accent,
    soundEffects: typeof raw.soundEffects === 'object' && raw.soundEffects ? raw.soundEffects as ThemePack['soundEffects'] : undefined,
    backgroundMusic: typeof raw.backgroundMusic === 'object' && raw.backgroundMusic ? raw.backgroundMusic as ThemePack['backgroundMusic'] : undefined,
  }
}

function applyTheme(theme: Theme, accentId: AccentChoice, customAccent: string, themePack: ThemePack | null, fontId: FontId, fontSizeId: FontSizeId) {
  const root = document.documentElement
  root.setAttribute('data-theme', theme)
  root.setAttribute('data-font', fontId)
  root.setAttribute('data-font-size', fontSizeId)
  const entry = ACCENTS.find(a => a.id === accentId)
  root.style.setProperty('--accent', themePack?.accent ?? (accentId === 'custom' ? normalizeHexColor(customAccent) : (entry?.color ?? ACCENTS[0].color)))
  ;(['--bg', '--bg2', '--panel', '--border', '--text', '--text-dim', '--red'] as const).forEach(key => {
    const next = themePack?.vars[key]
    if (next) root.style.setProperty(key, next)
    else root.style.removeProperty(key)
  })
}

export default function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme,  setThemeState]  = useState<Theme>('dark')
  const [accent, setAccentState] = useState<AccentChoice>('cyan')
  const [customAccent, setCustomAccentState] = useState(DEFAULT_CUSTOM_ACCENT)
  const [themePack, setThemePackState] = useState<ThemePack | null>(null)
  const [font, setFontState] = useState<FontId>('operator')
  const [fontSize, setFontSizeState] = useState<FontSizeId>('md')

  // Read from localStorage on mount and apply
  useEffect(() => {
    const storedTheme  = (localStorage.getItem('mcraftr-theme')  as Theme    | null) ?? 'dark'
    const rawAccent = localStorage.getItem('mcraftr-accent')
    const storedAccent = (rawAccent === 'custom' || ACCENTS.some(a => a.id === rawAccent))
      ? (rawAccent as AccentChoice)
      : 'cyan'
    const storedCustomAccent = normalizeHexColor(localStorage.getItem('mcraftr-custom-accent'))
    const storedThemePack = normalizeThemePack(JSON.parse(localStorage.getItem('mcraftr-theme-pack') || 'null'))
    const storedFont = (localStorage.getItem('mcraftr-font') as FontId | null) ?? 'operator'
    const storedFontSize = (localStorage.getItem('mcraftr-font-size') as FontSizeId | null) ?? 'md'
    setThemeState(storedTheme)
    setAccentState(storedAccent)
    setCustomAccentState(storedCustomAccent)
    setThemePackState(storedThemePack)
    setFontState(storedFont)
    setFontSizeState(storedFontSize)
    applyTheme(storedTheme, storedAccent, storedCustomAccent, storedThemePack, storedFont, storedFontSize)
  }, [])

  const setTheme = (t: Theme) => {
    setThemeState(t)
    localStorage.setItem('mcraftr-theme', t)
    applyTheme(t, accent, customAccent, themePack, font, fontSize)
  }

  const setAccent = (a: AccentChoice) => {
    setAccentState(a)
    localStorage.setItem('mcraftr-accent', a)
    applyTheme(theme, a, customAccent, themePack, font, fontSize)
  }

  const setCustomAccent = (color: string) => {
    const normalized = normalizeHexColor(color)
    setCustomAccentState(normalized)
    localStorage.setItem('mcraftr-custom-accent', normalized)
    applyTheme(theme, accent, normalized, themePack, font, fontSize)
  }

  const setThemePack = (pack: ThemePack | null) => {
    const normalized = normalizeThemePack(pack)
    setThemePackState(normalized)
    if (normalized) localStorage.setItem('mcraftr-theme-pack', JSON.stringify(normalized))
    else localStorage.removeItem('mcraftr-theme-pack')
    applyTheme(theme, accent, customAccent, normalized, font, fontSize)
  }

  const setFont = (f: FontId) => {
    setFontState(f)
    localStorage.setItem('mcraftr-font', f)
    applyTheme(theme, accent, customAccent, themePack, f, fontSize)
  }

  const setFontSize = (f: FontSizeId) => {
    setFontSizeState(f)
    localStorage.setItem('mcraftr-font-size', f)
    applyTheme(theme, accent, customAccent, themePack, font, f)
  }

  return (
    <ThemeContext.Provider value={{ theme, setTheme, accent, setAccent, customAccent, setCustomAccent, themePack, setThemePack, font, setFont, fontSize, setFontSize }}>
      {children}
    </ThemeContext.Provider>
  )
}
