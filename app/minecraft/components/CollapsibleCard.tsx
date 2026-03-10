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
  open?: boolean
  onOpenChange?: (open: boolean) => void
  groupKey?: string
}

const COLLAPSIBLE_GROUP_EVENT = 'mcraftr:collapsible-group-state'

export default function CollapsibleCard({
  title,
  children,
  storageKey,
  defaultOpen = true,
  className = '',
  bodyClassName = '',
  headerRight,
  open,
  onOpenChange,
  groupKey,
}: Props) {
  const [internalOpen, setInternalOpen] = useState(defaultOpen)
  const stateKey = `mcraftr:section:${storageKey}`
  const isControlled = open !== undefined
  const isOpen = isControlled ? open : internalOpen

  useEffect(() => {
    if (isControlled) return
    try {
      const stored = window.localStorage.getItem(stateKey)
      if (stored === 'open') setInternalOpen(true)
      if (stored === 'closed') setInternalOpen(false)
    } catch {}
  }, [isControlled, stateKey])

  useEffect(() => {
    try {
      window.localStorage.setItem(stateKey, isOpen ? 'open' : 'closed')
    } catch {}
  }, [isOpen, stateKey])

  useEffect(() => {
    if (!groupKey || isControlled) return
    const handler = (event: Event) => {
      const detail = (event as CustomEvent<{ groupKey?: string; open?: boolean }>).detail
      if (!detail || detail.groupKey !== groupKey || typeof detail.open !== 'boolean') return
      setInternalOpen(detail.open)
    }
    window.addEventListener(COLLAPSIBLE_GROUP_EVENT, handler as EventListener)
    return () => window.removeEventListener(COLLAPSIBLE_GROUP_EVENT, handler as EventListener)
  }, [groupKey, isControlled])

  const handleToggle = () => {
    const next = !isOpen
    if (!isControlled) setInternalOpen(next)
    onOpenChange?.(next)
  }

  return (
    <div className={`glass-card overflow-hidden ${className}`.trim()}>
      <button
        type="button"
        onClick={handleToggle}
        className="w-full flex items-center gap-3 px-4 py-3 border-b border-[var(--border)] text-left transition-colors hover:bg-[var(--panel)]/50"
        aria-expanded={isOpen}
      >
        <div className="flex-1 min-w-0">
          <div className="text-[13px] font-mono tracking-widest text-[var(--text-dim)]">{title}</div>
        </div>
        {headerRight && <div className="shrink-0">{headerRight}</div>}
        <div className="shrink-0 text-[var(--text-dim)]">
          {isOpen ? <ChevronUp size={16} strokeWidth={1.5} /> : <ChevronDown size={16} strokeWidth={1.5} />}
        </div>
      </button>
      {isOpen && <div className={bodyClassName}>{children}</div>}
    </div>
  )
}

export function setCollapsibleGroupState(groupKey: string, open: boolean) {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent(COLLAPSIBLE_GROUP_EVENT, { detail: { groupKey, open } }))
}
