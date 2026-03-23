'use client'

import { useEffect, useState } from 'react'
import { PanelLeftClose, PanelLeftOpen } from 'lucide-react'

export default function MobileNavHeaderButton() {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const sync = (event: Event) => {
      const custom = event as CustomEvent<{ open?: boolean }>
      setOpen(Boolean(custom.detail?.open))
    }

    window.addEventListener('mcraftr:mobile-nav-state', sync as EventListener)
    return () => window.removeEventListener('mcraftr:mobile-nav-state', sync as EventListener)
  }, [])

  return (
    <button
      type="button"
      onClick={() => window.dispatchEvent(new CustomEvent('mcraftr:mobile-nav-toggle'))}
      className="md:hidden grid h-11 w-11 place-items-center rounded-2xl border shadow-[0_18px_36px_rgba(0,0,0,0.22)] transition-all"
      aria-label={open ? 'Close section navigation' : 'Open section navigation'}
      style={{
        borderColor: open ? 'var(--accent-mid)' : 'var(--border)',
        background: open
          ? 'linear-gradient(180deg, color-mix(in srgb, var(--accent) 12%, transparent), color-mix(in srgb, var(--panel) 88%, transparent))'
          : 'color-mix(in srgb, var(--panel) 92%, transparent)',
        color: open ? 'var(--accent)' : 'var(--text)',
      }}
    >
      {open ? <PanelLeftClose size={18} strokeWidth={1.9} /> : <PanelLeftOpen size={18} strokeWidth={1.9} />}
    </button>
  )
}
