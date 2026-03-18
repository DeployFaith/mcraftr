'use client'

import { useEffect, useMemo, useRef, useState } from 'react'

type ProofChip = {
  label: string
  title: string
  body: string
}

const chipRows: ProofChip[][] = [
  [
    {
      label: 'Self-hosted',
      title: 'Self-hosted',
      body: 'Run it on your own setup and keep control of the stack.',
    },
    {
      label: 'Open source',
      title: 'Open source',
      body: 'Source available on GitHub, built in public.',
    },
    {
      label: 'RCON-first',
      title: 'RCON-first',
      body: 'Fast server operations built around direct RCON control.',
    },
  ],
  [
    {
      label: 'Quick Connect',
      title: 'Quick Connect',
      body: 'Connect over RCON and get moving fast.',
    },
    {
      label: 'Full Stack',
      title: 'Full Stack',
      body: 'Adds richer world-aware tools and deeper context.',
    },
    {
      label: 'Multi-server',
      title: 'Multi-server',
      body: 'Save and manage more than one server from the same interface.',
    },
  ],
]

const allChips = chipRows.flat()

type ActiveMetrics = {
  left: number
  width: number
  bottom: number
  panelTop: number
}

export default function HeroProofChips() {
  const [activeLabel, setActiveLabel] = useState(allChips[0].label)
  const [activeMetrics, setActiveMetrics] = useState<ActiveMetrics | null>(null)
  const clusterRef = useRef<HTMLDivElement | null>(null)
  const panelRef = useRef<HTMLDivElement | null>(null)
  const chipRefs = useRef<Record<string, HTMLButtonElement | null>>({})

  const activeChip = useMemo(
    () => allChips.find((chip) => chip.label === activeLabel) ?? allChips[0],
    [activeLabel],
  )

  useEffect(() => {
    const updateMetrics = () => {
      const cluster = clusterRef.current
      const panel = panelRef.current
      const chip = chipRefs.current[activeLabel]

      if (!cluster || !panel || !chip) {
        return
      }

      const clusterRect = cluster.getBoundingClientRect()
      const chipRect = chip.getBoundingClientRect()
      const panelRect = panel.getBoundingClientRect()

      setActiveMetrics({
        left: chipRect.left - clusterRect.left,
        width: chipRect.width,
        bottom: chipRect.bottom - clusterRect.top,
        panelTop: panelRect.top - clusterRect.top,
      })
    }

    updateMetrics()

    const resizeObserver = new ResizeObserver(updateMetrics)
    if (clusterRef.current) resizeObserver.observe(clusterRef.current)
    if (panelRef.current) resizeObserver.observe(panelRef.current)

    window.addEventListener('resize', updateMetrics)

    return () => {
      resizeObserver.disconnect()
      window.removeEventListener('resize', updateMetrics)
    }
  }, [activeLabel])

  const liquidStyle =
    activeMetrics === null
      ? undefined
      : {
          ['--hero-proof-left' as string]: `${activeMetrics.left}px`,
          ['--hero-proof-width' as string]: `${activeMetrics.width}px`,
          ['--hero-proof-bottom' as string]: `${activeMetrics.bottom}px`,
          ['--hero-proof-panel-top' as string]: `${activeMetrics.panelTop}px`,
        }

  return (
    <div className="mt-2 w-full max-w-xl lg:max-w-lg">
      <svg className="pointer-events-none absolute h-0 w-0" aria-hidden="true" focusable="false">
        <defs>
          <filter id="hero-chip-goo" x="-40%" y="-40%" width="180%" height="180%">
            <feGaussianBlur in="SourceGraphic" stdDeviation="9" result="blur" />
            <feColorMatrix
              in="blur"
              mode="matrix"
              values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 19 -7"
              result="goo"
            />
            <feComposite in="SourceGraphic" in2="goo" operator="atop" />
          </filter>
        </defs>
      </svg>

      <div ref={clusterRef} className="hero-proof-cluster">
        <div className="hero-proof-cluster__liquid" style={liquidStyle} aria-hidden="true">
          <div className="hero-proof-cluster__goo">
            <span className="hero-proof-cluster__blob hero-proof-cluster__blob--chip" />
            <span className="hero-proof-cluster__blob hero-proof-cluster__blob--stem" />
            <span className="hero-proof-cluster__blob hero-proof-cluster__blob--panel" />
          </div>
        </div>

        <div className="flex flex-col gap-2.5">
          {chipRows.map((row, rowIndex) => (
            <div key={rowIndex} className="flex flex-wrap justify-center gap-2.5 lg:justify-start">
              {row.map((chip) => {
                const isActive = chip.label === activeChip.label

                return (
                  <button
                    key={chip.label}
                    ref={(node) => {
                      chipRefs.current[chip.label] = node
                    }}
                    type="button"
                    className={`hero-proof-chip ${isActive ? 'is-active' : ''}`}
                    onMouseEnter={() => setActiveLabel(chip.label)}
                    onFocus={() => setActiveLabel(chip.label)}
                    onClick={() => setActiveLabel(chip.label)}
                    aria-pressed={isActive}
                    aria-controls="hero-proof-panel"
                  >
                    <span className="hero-proof-chip__surface" aria-hidden="true" />
                    <span className="hero-proof-chip__label">{chip.label}</span>
                  </button>
                )
              })}
            </div>
          ))}
        </div>

        <div
          id="hero-proof-panel"
          ref={panelRef}
          className="hero-proof-panel mt-3 rounded-[1.35rem] border border-[var(--border)] bg-[color:color-mix(in_srgb,var(--panel)_92%,transparent)] px-4 py-4 shadow-[0_18px_40px_rgba(0,0,0,0.16)] backdrop-blur-sm sm:px-5"
        >
          <div className="hero-proof-panel__eyebrow">{activeChip.title}</div>
          <p className="hero-proof-panel__copy">{activeChip.body}</p>
        </div>
      </div>
    </div>
  )
}
