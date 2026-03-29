'use client'

import { useEffect, useMemo, useState } from 'react'
import type { CatalogArtPayload } from '@/lib/catalog-art/types'
import { withStructureArtView, type StructureArtView } from '@/lib/catalog-art/structure-list'

type Props = {
  kind: 'structure' | 'entity' | 'item'
  label: string
  category?: string | null
  sourceKind?: string | null
  imageUrl?: string | null
  art?: CatalogArtPayload | null
  className?: string
  structureArtView?: StructureArtView
  onStructureArtViewChange?: (view: StructureArtView) => void
  hideStructureViewToggle?: boolean
  overlayNote?: string | null
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
  structureArtView,
  onStructureArtViewChange,
  hideStructureViewToggle = false,
  overlayNote = null,
}: Props) {
  const placeholderMeta = [category, sourceKind].filter(Boolean).join(' · ') || `${kind} art unavailable`
  return <ArtworkImage key={`${art?.url ?? imageUrl ?? 'missing'}:${label}`} src={art?.url ?? imageUrl ?? null} label={label} className={className} artClass={art?.class ?? kind} artStrategy={art?.strategy ?? 'missing-real-art'} placeholderMeta={placeholderMeta} kind={kind} structureArtView={structureArtView} onStructureArtViewChange={onStructureArtViewChange} hideStructureViewToggle={hideStructureViewToggle} overlayNote={overlayNote} />
}

function ArtworkImage({ src, label, className, artClass, artStrategy, placeholderMeta, kind, structureArtView: controlledStructureArtView, onStructureArtViewChange, hideStructureViewToggle, overlayNote }: { src: string | null; label: string; className: string; artClass: string; artStrategy: string; placeholderMeta: string; kind: Props['kind']; structureArtView?: StructureArtView; onStructureArtViewChange?: (view: StructureArtView) => void; hideStructureViewToggle: boolean; overlayNote?: string | null }) {
  const [loaded, setLoaded] = useState(false)
  const [failed, setFailed] = useState(false)
  const [uncontrolledStructureArtView, setStructureArtView] = useState<StructureArtView>('preview')
  const glyph = useMemo(() => (kind === 'entity' ? 'E' : kind === 'structure' ? 'S' : 'I'), [kind])
  const structureArtView = controlledStructureArtView ?? uncontrolledStructureArtView
  useEffect(() => {
    if (!controlledStructureArtView) setStructureArtView('preview')
    setLoaded(false)
    setFailed(false)
  }, [controlledStructureArtView, src])

  const structureViewUrls = useMemo(() => {
    if (kind !== 'structure' || !src || !src.includes('/api/minecraft/art/structure')) return null
    return {
      preview: withStructureArtView(src, 'preview'),
      materials: withStructureArtView(src, 'materials'),
    }
  }, [kind, src])
  const resolvedSrc = structureViewUrls ? structureViewUrls[structureArtView] : src
  const showPlaceholder = !resolvedSrc || failed
  const effectiveStrategy = kind === 'structure'
    ? (structureArtView === 'materials' ? 'structure-material-board' : 'structure-grid')
    : artStrategy

  return (
    <div
      className={`relative overflow-hidden ${className}`}
      data-art-class={artClass}
      data-art-strategy={effectiveStrategy}
    >
      {structureViewUrls && !showPlaceholder && !hideStructureViewToggle && (
        <div className="absolute left-3 top-3 z-10 flex gap-2 rounded-full border border-white/10 bg-[rgba(8,12,18,0.72)] p-1 backdrop-blur-sm">
          {([
            ['preview', 'Preview'],
            ['materials', 'Materials'],
          ] as const).map(([view, title]) => (
            <button
              key={view}
              type="button"
              onClick={() => {
                if (!controlledStructureArtView) setStructureArtView(view)
                onStructureArtViewChange?.(view)
              }}
              className="rounded-full px-3 py-1 text-[10px] font-mono tracking-[0.16em] transition-all"
              style={structureArtView === view
                ? { background: 'var(--accent-dim)', color: 'var(--accent)', border: '1px solid var(--accent-mid)' }
                : { background: 'transparent', color: 'var(--text-dim)', border: '1px solid transparent' }}
            >
              {title}
            </button>
          ))}
        </div>
      )}
      {!loaded && !showPlaceholder && (
        <div className="absolute inset-0 animate-pulse bg-[linear-gradient(120deg,rgba(255,255,255,0.04),rgba(255,255,255,0.12),rgba(255,255,255,0.04))]" />
      )}
      {overlayNote && !showPlaceholder && (
        <div className="absolute bottom-3 left-3 right-3 z-10 rounded-2xl border px-3 py-2 text-left text-[10px] font-mono tracking-[0.12em] backdrop-blur-sm" style={{ borderColor: 'rgba(255,255,255,0.12)', background: 'rgba(8,12,18,0.78)', color: 'var(--text-dim)' }}>
          {overlayNote}
        </div>
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
            src={resolvedSrc}
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
