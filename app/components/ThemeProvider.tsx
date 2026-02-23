'use client'
import { createContext, useContext, useEffect, useState } from 'react'

// ── Accent palette ─────────────────────────────────────────────────────────────

export type AccentId = 'cyan' | 'blue' | 'purple' | 'pink' | 'orange' | 'yellow' | 'red' | 'white'

export const ACCENTS: { id: AccentId; label: string; color: string }[] = [
  { id: 'cyan',   label: 'Cyan',   color: '#00ffc8' },
  { id: 'blue',   label: 'Blue',   color: '#4d9fff' },
  { id: 'purple', label: 'Purple', color: '#b57bff' },
  { id: 'pink',   label: 'Pink',   color: '#ff6eb4' },
  { id: 'orange', label: 'Orange', color: '#ff9500' },
  { id: 'yellow', label: 'Yellow', color: '#ffd60a' },
  { id: 'red',    label: 'Red',    color: '#ff453a' },
  { id: 'white',  label: 'White',  color: '#e8e8f0' },
]

// ── Context ───────────────────────────────────────────────────────────────────

type Theme = 'dark' | 'light'

type ThemeContextValue = {
  theme:     Theme
  setTheme:  (t: Theme) => void
  accent:    AccentId
  setAccent: (a: AccentId) => void
}

const ThemeContext = createContext<ThemeContextValue>({
  theme:     'dark',
  setTheme:  () => {},
  accent:    'cyan',
  setAccent: () => {},
})

export function useTheme() {
  return useContext(ThemeContext)
}

// ── Provider ──────────────────────────────────────────────────────────────────

function applyTheme(theme: Theme, accentId: AccentId) {
  const root = document.documentElement
  root.setAttribute('data-theme', theme)
  const entry = ACCENTS.find(a => a.id === accentId) ?? ACCENTS[0]
  root.style.setProperty('--accent', entry.color)
}

export default function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme,  setThemeState]  = useState<Theme>('dark')
  const [accent, setAccentState] = useState<AccentId>('cyan')

  // Read from localStorage on mount and apply
  useEffect(() => {
    const storedTheme  = (localStorage.getItem('mcraftr-theme')  as Theme    | null) ?? 'dark'
    const storedAccent = (localStorage.getItem('mcraftr-accent') as AccentId | null) ?? 'cyan'
    setThemeState(storedTheme)
    setAccentState(storedAccent)
    applyTheme(storedTheme, storedAccent)
  }, [])

  const setTheme = (t: Theme) => {
    setThemeState(t)
    localStorage.setItem('mcraftr-theme', t)
    applyTheme(t, accent)
  }

  const setAccent = (a: AccentId) => {
    setAccentState(a)
    localStorage.setItem('mcraftr-accent', a)
    applyTheme(theme, a)
  }

  return (
    <ThemeContext.Provider value={{ theme, setTheme, accent, setAccent }}>
      {children}
    </ThemeContext.Provider>
  )
}
