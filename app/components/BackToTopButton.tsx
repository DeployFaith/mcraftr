'use client'

import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import { ArrowUp } from 'lucide-react'

export default function BackToTopButton() {
  const pathname = usePathname()
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const onScroll = () => {
      setVisible(window.scrollY > 320)
    }

    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  const bottomClass = pathname?.startsWith('/minecraft')
    ? 'bottom-24 md:bottom-8'
    : 'bottom-8'

  return (
    <button
      type="button"
      aria-label="Return to top"
      onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
      className={[
        'fixed right-4 z-40 flex items-center gap-2 rounded-full border px-4 py-3',
        'font-mono text-[11px] tracking-[0.16em] shadow-[0_12px_32px_rgba(0,0,0,0.28)]',
        'backdrop-blur-xl transition-all duration-300 md:right-6',
        bottomClass,
        visible
          ? 'translate-y-0 opacity-100 pointer-events-auto'
          : 'translate-y-6 opacity-0 pointer-events-none',
      ].join(' ')}
      style={{
        background: 'color-mix(in srgb, var(--panel) 88%, transparent)',
        borderColor: 'var(--accent-mid)',
        color: 'var(--accent)',
      }}
    >
      <span className="grid h-6 w-6 place-items-center rounded-full" style={{ background: 'var(--accent-dim)' }}>
        <ArrowUp size={14} strokeWidth={2} />
      </span>
      <span>TOP</span>
    </button>
  )
}
