'use client'

import { useEffect } from 'react'
import CatalogArtwork from './CatalogArtwork'

export type LocationMode = 'player' | 'coords'

export type StructureCatalogEntry = {
  id: string
  label: string
  category: string
  sourceKind: string
  placementKind?: string
  bridgeRef: string
  resourceKey?: string | null
  relativePath?: string | null
  imageUrl?: string | null
  summary?: string | null
  format?: string | null
  sizeBytes?: number | null
  updatedAt?: number | null
  dimensions?: { width: number | null; height: number | null; length: number | null } | null
  removable?: boolean
  editable?: boolean
}

export type EntityCatalogEntry = {
  id: string
  label: string
  category: string
  dangerous: boolean
  sourceKind?: string
  entityId?: string
  presetId?: string
  editable?: boolean
  defaultCount?: number
  relativePath?: string | null
  customName?: string | null
  health?: number | null
  persistenceRequired?: boolean
  noAi?: boolean
  silent?: boolean
  glowing?: boolean
  invulnerable?: boolean
  noGravity?: boolean
  advancedNbt?: string | null
  imageUrl?: string | null
  summary?: string | null
}

type Props = {
  mode: 'place-structure' | 'remove-structure' | 'spawn-entity'
  structure?: StructureCatalogEntry | null
  entity?: EntityCatalogEntry | null
  locationMode: LocationMode
  onLocationModeChange: (mode: LocationMode) => void
  players: string[]
  selectedPlayer: string
  onSelectedPlayerChange: (player: string) => void
  world: string
  onWorldChange: (world: string) => void
  x: string
  y: string
  z: string
  onCoordChange: (axis: 'x' | 'y' | 'z', value: string) => void
  rotation?: string
  onRotationChange?: (rotation: string) => void
  includeAir?: boolean
  onIncludeAirChange?: (value: boolean) => void
  count?: string
  onCountChange?: (value: string) => void
  confirmLabel: string
  dangerLabel?: string | null
  busy?: boolean
  onCancel: () => void
  onConfirm: () => void
}

function formatBytes(value: number | null | undefined) {
  if (value === null || value === undefined || Number.isNaN(value)) return '—'
  if (value < 1024) return `${value} B`
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`
  return `${(value / (1024 * 1024)).toFixed(1)} MB`
}

export default function SpawnInspectModal({
  mode,
  structure,
  entity,
  locationMode,
  onLocationModeChange,
  players,
  selectedPlayer,
  onSelectedPlayerChange,
  world,
  onWorldChange,
  x,
  y,
  z,
  onCoordChange,
  rotation = '0',
  onRotationChange,
  includeAir = false,
  onIncludeAirChange,
  count = '1',
  onCountChange,
  confirmLabel,
  dangerLabel,
  busy = false,
  onCancel,
  onConfirm,
}: Props) {
  const target = structure ?? entity

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onCancel()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onCancel])

  if (!target) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(4, 8, 14, 0.78)', backdropFilter: 'blur(10px)' }}
      onClick={onCancel}
    >
      <div
        className="w-full max-w-[920px] overflow-hidden rounded-[28px] border"
        style={{
          borderColor: dangerLabel ? 'rgba(255,90,114,0.5)' : 'var(--accent-mid)',
          background: 'linear-gradient(180deg, color-mix(in srgb, var(--panel) 94%, transparent), color-mix(in srgb, var(--bg2) 90%, transparent))',
          boxShadow: '0 28px 90px rgba(0,0,0,0.42)',
        }}
        onClick={event => event.stopPropagation()}
      >
        <div className="grid gap-0 md:grid-cols-[1.05fr_0.95fr]">
          <div className="border-b p-5 md:border-b-0 md:border-r" style={{ borderColor: 'var(--border)' }}>
            <CatalogArtwork
              kind={structure ? 'structure' : 'entity'}
              label={target.label}
              category={target.category}
              sourceKind={structure?.sourceKind ?? null}
              imageUrl={target.imageUrl}
              className="h-[220px] w-full rounded-[22px] border object-cover"
            />
            <div className="mt-4">
              <div className="font-mono text-[18px] tracking-[0.12em]" style={{ color: 'var(--text)' }}>
                {target.label}
              </div>
              <div className="mt-1 font-mono text-[11px] tracking-[0.14em]" style={{ color: 'var(--text-dim)' }}>
                {target.category.toUpperCase()}
                {structure ? ` · ${structure.sourceKind.toUpperCase()}${structure.placementKind ? ` · ${structure.placementKind.replace(/_/g, ' ').toUpperCase()}` : ''}` : ''}
                {entity?.sourceKind ? ` · ${entity.sourceKind.toUpperCase()}` : ''}
                {entity?.dangerous ? ' · DANGEROUS' : ''}
              </div>
              {target.summary && (
                <div className="mt-3 rounded-2xl border px-4 py-3 font-mono text-[12px]" style={{ borderColor: 'var(--border)', color: 'var(--text-dim)', background: 'color-mix(in srgb, var(--bg) 68%, transparent)' }}>
                  {target.summary}
                </div>
              )}
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                {structure?.dimensions && (
                  <div className="rounded-2xl border px-3 py-3 font-mono text-[11px]" style={{ borderColor: 'var(--border)', background: 'color-mix(in srgb, var(--bg) 68%, transparent)' }}>
                    <div style={{ color: 'var(--text-dim)' }}>Dimensions</div>
                    <div className="mt-1" style={{ color: 'var(--text)' }}>
                      {structure.dimensions.width ?? '?'} × {structure.dimensions.height ?? '?'} × {structure.dimensions.length ?? '?'}
                    </div>
                  </div>
                )}
                {structure && (
                  <div className="rounded-2xl border px-3 py-3 font-mono text-[11px]" style={{ borderColor: 'var(--border)', background: 'color-mix(in srgb, var(--bg) 68%, transparent)' }}>
                    <div style={{ color: 'var(--text-dim)' }}>File</div>
                    <div className="mt-1" style={{ color: 'var(--text)' }}>
                      {(structure.format ?? 'schematic').toUpperCase()} · {formatBytes(structure.sizeBytes)}
                    </div>
                  </div>
                )}
              </div>
              {dangerLabel && (
                <div className="mt-3 rounded-2xl border px-4 py-3 font-mono text-[12px]" style={{ borderColor: 'rgba(255,90,114,0.38)', background: 'rgba(255,90,114,0.08)', color: '#ffb3bd' }}>
                  {dangerLabel}
                </div>
              )}
            </div>
          </div>

          <div className="p-5">
            <div className="font-mono text-[12px] tracking-[0.16em]" style={{ color: 'var(--text-dim)' }}>
              {mode === 'remove-structure' ? 'REMOVE TARGET' : 'PLACEMENT TARGET'}
            </div>

            <div className="mt-4 space-y-4">
              {mode !== 'remove-structure' && (
                <>
                  <div className="flex gap-2">
                    {(['player', 'coords'] as const).map(entry => (
                      <button
                        key={entry}
                        type="button"
                        onClick={() => onLocationModeChange(entry)}
                        className="rounded-2xl border px-4 py-3 font-mono text-[12px] tracking-[0.16em] transition-all"
                        style={locationMode === entry
                          ? { borderColor: 'var(--accent-mid)', background: 'var(--accent-dim)', color: 'var(--accent)' }
                          : { borderColor: 'var(--border)', background: 'var(--panel)', color: 'var(--text-dim)' }}
                      >
                        {entry === 'player' ? 'Selected Player' : 'Coordinates'}
                      </button>
                    ))}
                  </div>

                  {locationMode === 'player' ? (
                    <label className="block space-y-1">
                      <div className="font-mono text-[11px] tracking-[0.14em]" style={{ color: 'var(--text-dim)' }}>
                        PLAYER
                      </div>
                      <select
                        value={selectedPlayer}
                        onChange={event => onSelectedPlayerChange(event.target.value)}
                        className="w-full rounded-2xl border px-3 py-3 font-mono text-[13px] focus:outline-none"
                        style={{ borderColor: 'var(--border)', background: 'var(--panel)', color: 'var(--text)' }}
                      >
                        <option value="">Select player</option>
                        {players.map(player => <option key={player} value={player}>{player}</option>)}
                      </select>
                    </label>
                  ) : (
                    <>
                      <label className="block space-y-1">
                        <div className="font-mono text-[11px] tracking-[0.14em]" style={{ color: 'var(--text-dim)' }}>
                          WORLD
                        </div>
                        <input
                          value={world}
                          onChange={event => onWorldChange(event.target.value)}
                          className="w-full rounded-2xl border px-3 py-3 font-mono text-[13px] focus:outline-none"
                          style={{ borderColor: 'var(--border)', background: 'var(--panel)', color: 'var(--text)' }}
                        />
                      </label>
                      <div className="grid gap-3 sm:grid-cols-3">
                        {([
                          ['x', x],
                          ['y', y],
                          ['z', z],
                        ] as const).map(([axis, value]) => (
                          <label key={axis} className="block space-y-1">
                            <div className="font-mono text-[11px] tracking-[0.14em]" style={{ color: 'var(--text-dim)' }}>
                              {axis.toUpperCase()}
                            </div>
                            <input
                              value={value}
                              onChange={event => onCoordChange(axis, event.target.value)}
                              className="w-full rounded-2xl border px-3 py-3 font-mono text-[13px] focus:outline-none"
                              style={{ borderColor: 'var(--border)', background: 'var(--panel)', color: 'var(--text)' }}
                            />
                          </label>
                        ))}
                      </div>
                    </>
                  )}
                </>
              )}

              {structure && onRotationChange && (
                <label className="block space-y-1">
                  <div className="font-mono text-[11px] tracking-[0.14em]" style={{ color: 'var(--text-dim)' }}>
                    ROTATION
                  </div>
                  <select
                    value={rotation}
                    onChange={event => onRotationChange(event.target.value)}
                    className="w-full rounded-2xl border px-3 py-3 font-mono text-[13px] focus:outline-none"
                    style={{ borderColor: 'var(--border)', background: 'var(--panel)', color: 'var(--text)' }}
                  >
                    <option value="0">0°</option>
                    <option value="90">90°</option>
                    <option value="180">180°</option>
                    <option value="270">270°</option>
                  </select>
                </label>
              )}

              {structure && onIncludeAirChange && mode === 'place-structure' && (
                <label className="flex items-center gap-3 rounded-2xl border px-4 py-3" style={{ borderColor: 'var(--border)', background: 'var(--panel)' }}>
                  <input
                    type="checkbox"
                    checked={includeAir}
                    onChange={event => onIncludeAirChange(event.target.checked)}
                  />
                  <span className="font-mono text-[12px]" style={{ color: 'var(--text)' }}>
                    Include air blocks when placing
                  </span>
                </label>
              )}

              {entity && onCountChange && (
                <label className="block space-y-1">
                  <div className="font-mono text-[11px] tracking-[0.14em]" style={{ color: 'var(--text-dim)' }}>
                    COUNT
                  </div>
                  <input
                    value={count}
                    onChange={event => onCountChange(event.target.value)}
                    className="w-full rounded-2xl border px-3 py-3 font-mono text-[13px] focus:outline-none"
                    style={{ borderColor: 'var(--border)', background: 'var(--panel)', color: 'var(--text)' }}
                  />
                </label>
              )}
            </div>

            <div className="mt-6 flex gap-3">
              <button
                type="button"
                onClick={onCancel}
                className="flex-1 rounded-2xl border px-4 py-3 font-mono text-[12px] tracking-[0.16em]"
                style={{ borderColor: 'var(--border)', color: 'var(--text-dim)', background: 'var(--panel)' }}
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={onConfirm}
                className="flex-1 rounded-2xl border px-4 py-3 font-mono text-[12px] tracking-[0.16em] disabled:opacity-50"
                style={dangerLabel
                  ? { borderColor: 'rgba(255,90,114,0.48)', background: 'rgba(255,90,114,0.12)', color: '#ffb3bd' }
                  : { borderColor: 'var(--accent-mid)', background: 'var(--accent-dim)', color: 'var(--accent)' }}
              >
                {busy ? 'Working…' : confirmLabel}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
