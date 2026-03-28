'use client'

import { useMemo, useState } from 'react'
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
  structure: true,
  entity: true,
  item: true,
}

export function isCatalogArtworkEnabled(kind: Props['kind']) {
  return CATALOG_ARTWORK_ENABLED[kind]
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
  const placeholderMeta = [category, sourceKind].filter(Boolean).join(' · ') || `${kind} art unavailable`
  return <ArtworkImage key={`${art?.url ?? imageUrl ?? 'missing'}:${label}`} src={art?.url ?? imageUrl ?? null} label={label} className={className} artClass={art?.class ?? kind} artStrategy={art?.strategy ?? 'missing-real-art'} placeholderMeta={placeholderMeta} kind={kind} />
}

function ArtworkImage({ src, label, className, artClass, artStrategy, placeholderMeta, kind }: { src: string | null; label: string; className: string; artClass: string; artStrategy: string; placeholderMeta: string; kind: Props['kind'] }) {
  const [loaded, setLoaded] = useState(false)
  const [failed, setFailed] = useState(false)
  const glyph = useMemo(() => (kind === 'entity' ? 'E' : kind === 'structure' ? 'S' : 'I'), [kind])
  const showPlaceholder = !src || failed

  return (
    <div
      className={`relative overflow-hidden ${className}`}
      data-art-class={artClass}
      data-art-strategy={artStrategy}
    >
      {!loaded && !showPlaceholder && (
        <div className="absolute inset-0 animate-pulse bg-[linear-gradient(120deg,rgba(255,255,255,0.04),rgba(255,255,255,0.12),rgba(255,255,255,0.04))]" />
      )}
      {showPlaceholder ? (
        <div className="flex h-full w-full items-center justify-center rounded-[inherit] border border-white/8 bg-[linear-gradient(180deg,rgba(255,255,255,0.04),rgba(255,255,255,0.02))] px-4 text-center">
          <div>
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-black/10 text-[22px] font-mono text-[var(--text-dim)]">{glyph}</div>
            <div className="text-[11px] font-mono text-[var(--text)]">{label}</div>
            <div className="mt-1 text-[10px] font-mono text-[var(--text-dim)]">{placeholderMeta}</div>
          </div>
        </div>
      ) : (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element -- dynamic fallback/data URL artwork is not a good fit for next/image */}
          <img
            src={src}
            alt={`${label} preview`}
            className={`h-full w-full object-contain transition-opacity duration-300 ${loaded ? 'opacity-100' : 'opacity-0'}`}
            loading="lazy"
            onLoad={() => setLoaded(true)}
            onError={() => {
              setFailed(true)
              setLoaded(true)
            }}
          />
        </>
      )}
    </div>
  )
}
