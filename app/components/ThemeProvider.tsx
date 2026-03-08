'use client'
import { createContext, useContext, useEffect, useState } from 'react'

// ── Accent palette ─────────────────────────────────────────────────────────────

export type AccentId = 'cyan' | 'blue' | 'purple' | 'pink' | 'orange' | 'yellow' | 'red'

export const ACCENTS: { id: AccentId; label: string; color: string }[] = [
  { id: 'cyan',   label: 'Cyan',   color: '#00ffc8' },
  { id: 'blue',   label: 'Blue',   color: '#4d9fff' },
  { id: 'purple', label: 'Purple', color: '#b57bff' },
  { id: 'pink',   label: 'Pink',   color: '#ff6eb4' },
  { id: 'orange', label: 'Orange', color: '#ff9500' },
  { id: 'yellow', label: 'Yellow', color: '#ffd60a' },
  { id: 'red',    label: 'Red',    color: '#ff453a' },
]

export type FontId = 'system' | 'operator' | 'minecraft' | 'pixel' | 'terminal'
export type FontSizeId = 'sm' | 'md' | 'lg' | 'xl'

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
  accent:    AccentId
  setAccent: (a: AccentId) => void
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
  font:      'operator',
  setFont:   () => {},
  fontSize:  'md',
  setFontSize: () => {},
})

export function useTheme() {
  return useContext(ThemeContext)
}

// ── Provider ──────────────────────────────────────────────────────────────────

function applyTheme(theme: Theme, accentId: AccentId, fontId: FontId, fontSizeId: FontSizeId) {
  const root = document.documentElement
  root.setAttribute('data-theme', theme)
  root.setAttribute('data-font', fontId)
  root.setAttribute('data-font-size', fontSizeId)
  const entry = ACCENTS.find(a => a.id === accentId) ?? ACCENTS[0]
  root.style.setProperty('--accent', entry.color)
}

export default function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme,  setThemeState]  = useState<Theme>('dark')
  const [accent, setAccentState] = useState<AccentId>('cyan')
  const [font, setFontState] = useState<FontId>('operator')
  const [fontSize, setFontSizeState] = useState<FontSizeId>('md')

  // Read from localStorage on mount and apply
  useEffect(() => {
    const storedTheme  = (localStorage.getItem('mcraftr-theme')  as Theme    | null) ?? 'dark'
    const storedAccent = (localStorage.getItem('mcraftr-accent') as AccentId | null) ?? 'cyan'
    const storedFont = (localStorage.getItem('mcraftr-font') as FontId | null) ?? 'operator'
    const storedFontSize = (localStorage.getItem('mcraftr-font-size') as FontSizeId | null) ?? 'md'
    setThemeState(storedTheme)
    setAccentState(storedAccent)
    setFontState(storedFont)
    setFontSizeState(storedFontSize)
    applyTheme(storedTheme, storedAccent, storedFont, storedFontSize)
  }, [])

  const setTheme = (t: Theme) => {
    setThemeState(t)
    localStorage.setItem('mcraftr-theme', t)
    applyTheme(t, accent, font, fontSize)
  }

  const setAccent = (a: AccentId) => {
    setAccentState(a)
    localStorage.setItem('mcraftr-accent', a)
    applyTheme(theme, a, font, fontSize)
  }

  const setFont = (f: FontId) => {
    setFontState(f)
    localStorage.setItem('mcraftr-font', f)
    applyTheme(theme, accent, f, fontSize)
  }

  const setFontSize = (f: FontSizeId) => {
    setFontSizeState(f)
    localStorage.setItem('mcraftr-font-size', f)
    applyTheme(theme, accent, font, f)
  }

  return (
    <ThemeContext.Provider value={{ theme, setTheme, accent, setAccent, font, setFont, fontSize, setFontSize }}>
      {children}
    </ThemeContext.Provider>
  )
}
