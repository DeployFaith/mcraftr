'use client'

import { useEffect, useState } from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'

type Props = {
  title: React.ReactNode
  children: React.ReactNode
  storageKey: string
  defaultOpen?: boolean
  className?: string
  bodyClassName?: string
  headerRight?: React.ReactNode
}

export default function CollapsibleCard({
  title,
  children,
  storageKey,
  defaultOpen = true,
  className = '',
  bodyClassName = '',
  headerRight,
}: Props) {
  const [open, setOpen] = useState(defaultOpen)
  const stateKey = `mcraftr:section:${storageKey}`

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(stateKey)
      if (stored === 'open') setOpen(true)
      if (stored === 'closed') setOpen(false)
    } catch {}
  }, [stateKey])

  useEffect(() => {
    try {
      window.localStorage.setItem(stateKey, open ? 'open' : 'closed')
    } catch {}
  }, [open, stateKey])

  return (
    <div className={`glass-card overflow-hidden ${className}`.trim()}>
      <button
        type="button"
        onClick={() => setOpen(prev => !prev)}
        className="w-full flex items-center gap-3 px-4 py-3 border-b border-[var(--border)] text-left transition-colors hover:bg-[var(--panel)]/50"
        aria-expanded={open}
      >
        <div className="flex-1 min-w-0">
          <div className="text-[13px] font-mono tracking-widest text-[var(--text-dim)]">{title}</div>
        </div>
        {headerRight && <div className="shrink-0">{headerRight}</div>}
        <div className="shrink-0 text-[var(--text-dim)]">
          {open ? <ChevronUp size={16} strokeWidth={1.5} /> : <ChevronDown size={16} strokeWidth={1.5} />}
        </div>
      </button>
      {open && <div className={bodyClassName}>{children}</div>}
    </div>
  )
}
