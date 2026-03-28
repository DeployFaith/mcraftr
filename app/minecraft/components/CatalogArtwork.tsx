'use client'

import { useState } from 'react'
import type { CatalogArtPayload } from '@/lib/catalog-art/types'

type Props = {
  kind: 'structure' | 'entity' | 'item'
  label: string
  category?: string | null
  sourceKind?: string | null
  imageUrl?: string | null
  art?: CatalogArtPayload | null
  className?: string
}

export const CATALOG_ARTWORK_ENABLED: Record<Props['kind'], boolean> = {
  structure: false,
  entity: true,
  item: true,
}

export function isCatalogArtworkEnabled(kind: Props['kind']) {
  return CATALOG_ARTWORK_ENABLED[kind]
}

function encodeSvg(svg: string) {
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`
}

function hashValue(value: string) {
  let hash = 0
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0
  }
  return hash
}

function fallbackUrl(kind: 'structure' | 'entity' | 'item', label: string, category?: string | null, sourceKind?: string | null) {
  const seed = hashValue(`${kind}:${label}`)
  const hue = seed % 360
  const meta = [category, sourceKind].filter(Boolean).join(' · ').slice(0, 28)
  const glyph = kind === 'entity' ? 'E' : kind === 'structure' ? 'S' : 'I'
  return encodeSvg(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 480 270">
      <defs>
        <linearGradient id="g" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0%" stop-color="hsl(${hue} 18% 18%)"/>
          <stop offset="100%" stop-color="hsl(${hue} 14% 11%)"/>
        </linearGradient>
      </defs>
      <rect width="480" height="270" rx="30" fill="url(#g)"/>
      <rect x="14" y="14" width="452" height="242" rx="28" fill="rgba(6,10,16,0.18)" stroke="rgba(255,255,255,0.08)" stroke-width="2"/>
      <rect x="40" y="52" width="400" height="166" rx="24" fill="rgba(255,255,255,0.04)" stroke="rgba(255,255,255,0.08)"/>
      <circle cx="240" cy="130" r="44" fill="rgba(255,255,255,0.06)" stroke="rgba(255,255,255,0.10)" />
      <text x="240" y="144" text-anchor="middle" font-size="40" fill="rgba(245,247,255,0.72)" font-family="monospace">${glyph}</text>
      <text x="240" y="198" text-anchor="middle" font-size="12" fill="rgba(245,247,255,0.84)" font-family="monospace">${label.slice(0, 22)}</text>
      <text x="240" y="218" text-anchor="middle" font-size="10" fill="rgba(245,247,255,0.58)" font-family="monospace">${meta || `${kind} art unavailable`}</text>
    </svg>
  `)
}

export default function CatalogArtwork({
  kind,
  label,
  category,
  sourceKind,
  imageUrl,
  art,
  className = '',
}: Props) {
  const fallback = fallbackUrl(
    kind,
    label,
    [category, art?.class, art?.strategy].filter(Boolean).join(' · ') || category,
    sourceKind,
  )
  return <ArtworkImage key={`${art?.url ?? imageUrl ?? fallback}:${fallback}`} src={art?.url ?? imageUrl ?? null} fallback={fallback} label={label} className={className} artClass={art?.class ?? kind} artStrategy={art?.strategy ?? 'fallback-card'} />
}

function ArtworkImage({ src, fallback, label, className, artClass, artStrategy }: { src: string | null; fallback: string; label: string; className: string; artClass: string; artStrategy: string }) {
  const [loaded, setLoaded] = useState(false)
  const [useFallback, setUseFallback] = useState(false)
  const resolvedSrc = useFallback ? fallback : (src || fallback)

  return (
    <div
      className={`relative overflow-hidden ${className}`}
      data-art-class={artClass}
      data-art-strategy={artStrategy}
    >
      {!loaded && (
        <div className="absolute inset-0 animate-pulse bg-[linear-gradient(120deg,rgba(255,255,255,0.04),rgba(255,255,255,0.12),rgba(255,255,255,0.04))]" />
      )}
      {/* eslint-disable-next-line @next/next/no-img-element -- dynamic fallback/data URL artwork is not a good fit for next/image */}
      <img
        src={resolvedSrc}
        alt={`${label} preview`}
        className={`h-full w-full object-contain transition-opacity duration-300 ${loaded ? 'opacity-100' : 'opacity-0'}`}
        loading="lazy"
        onLoad={() => setLoaded(true)}
        onError={() => {
          if (!useFallback && src) {
            setUseFallback(true)
            setLoaded(false)
            return
          }
          setLoaded(true)
        }}
      />
    </div>
  )
}
