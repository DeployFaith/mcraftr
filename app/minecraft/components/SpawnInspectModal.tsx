'use client'

import { useEffect, useMemo } from 'react'
import { X } from 'lucide-react'
import type { CatalogArtPayload } from '@/lib/catalog-art/types'
import CatalogArtwork, { isCatalogArtworkEnabled } from './CatalogArtwork'
import type { PlacementCheckResult } from '@/lib/placement-randomize'

const ENTITY_COUNT_PRESETS = ['1', '4', '8', '16', '32', '64']

export type LocationMode = 'player' | 'world-player' | 'coords'

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
  art?: CatalogArtPayload | null
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
  art?: CatalogArtPayload | null
  summary?: string | null
}

type Props = {
  mode: 'place-structure' | 'remove-structure' | 'spawn-entity'
  structure?: StructureCatalogEntry | null
  entity?: EntityCatalogEntry | null
  locationMode: LocationMode
  onLocationModeChange: (mode: LocationMode) => void
  worlds: string[]
  players: string[]
  playerWorlds?: Record<string, string | null>
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
  randomizeBusy?: boolean
  placementCheck?: PlacementCheckResult | null
  onRandomize?: () => void
  onCancel: () => void
  onConfirm: () => void
}

function formatBytes(value: number | null | undefined) {
  if (value === null || value === undefined || Number.isNaN(value)) return '—'
  if (value < 1024) return `${value} B`
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`
  return `${(value / (1024 * 1024)).toFixed(1)} MB`
}

function buildFootprint(width: number | null | undefined, length: number | null | undefined) {
  const actualWidth = Math.max(1, width ?? 1)
  const actualLength = Math.max(1, length ?? 1)
  const maxCells = 8
  const scale = Math.min(1, maxCells / Math.max(actualWidth, actualLength))
  return {
    actualWidth,
    actualLength,
    cellsWide: Math.max(1, Math.round(actualWidth * scale)),
    cellsLong: Math.max(1, Math.round(actualLength * scale)),
    scaled: scale < 1,
  }
}

function StructureFootprintCard({ structure }: { structure: StructureCatalogEntry }) {
  if (!structure.dimensions) return null
  const footprint = buildFootprint(structure.dimensions.width, structure.dimensions.length)
  const widthPx = footprint.cellsWide * 18
  const lengthPx = footprint.cellsLong * 18

  return (
    <div className="rounded-2xl border px-3 py-3 font-mono text-[11px]" style={{ borderColor: 'var(--border)', background: 'color-mix(in srgb, var(--bg) 68%, transparent)' }}>
      <div style={{ color: 'var(--text-dim)' }}>Footprint</div>
      <div className="mt-1" style={{ color: 'var(--text)' }}>
        {footprint.actualWidth}W × {footprint.actualLength}L
        {structure.dimensions.height ? ` × ${structure.dimensions.height}H` : ''}
      </div>
      <div className="mt-3 flex items-start gap-3">
        <div
          className="relative grid shrink-0 place-items-center rounded-xl border p-3"
          style={{
            borderColor: 'var(--accent-mid)',
            background: 'color-mix(in srgb, var(--accent) 12%, var(--panel))',
            minWidth: '116px',
            minHeight: '116px',
          }}
        >
          <div
            className="relative rounded-lg border"
            style={{
              width: `${widthPx}px`,
              height: `${lengthPx}px`,
              borderColor: 'color-mix(in srgb, var(--accent) 56%, var(--border))',
              background: 'repeating-linear-gradient(135deg, color-mix(in srgb, var(--accent) 34%, transparent) 0 10px, transparent 10px 18px), color-mix(in srgb, var(--accent) 18%, transparent)',
              boxShadow: 'inset 0 0 0 1px color-mix(in srgb, var(--accent) 18%, transparent)',
            }}
          >
            <span className="absolute left-1.5 top-1.5 h-2.5 w-2.5 rounded-full" style={{ background: 'var(--accent)' }} />
            <span className="absolute -bottom-5 left-1/2 -translate-x-1/2 text-[10px]" style={{ color: 'var(--text-dim)' }}>
              W {footprint.actualWidth}
            </span>
            <span className="absolute -right-5 top-1/2 -translate-y-1/2 rotate-90 text-[10px]" style={{ color: 'var(--text-dim)' }}>
              L {footprint.actualLength}
            </span>
          </div>
        </div>
        <div className="space-y-1" style={{ color: 'var(--text-dim)' }}>
          <div>Top-down footprint scaled from the real width and length.</div>
          <div>The glowing marker shows the anchor corner used for placement.</div>
          {footprint.scaled && <div>Scaled down to fit this preview card.</div>}
        </div>
      </div>
    </div>
  )
}

export default function SpawnInspectModal({
  mode,
  structure,
  entity,
  locationMode,
  onLocationModeChange,
  worlds,
  players,
  playerWorlds = {},
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
  randomizeBusy = false,
  placementCheck = null,
  onRandomize,
  onCancel,
  onConfirm,
}: Props) {
  const target = structure ?? entity
  const selectedPlayerWorld = selectedPlayer ? playerWorlds[selectedPlayer] ?? null : null
  const worldPlayers = useMemo(
    () => players.filter(player => !world || playerWorlds[player] === world),
    [playerWorlds, players, world],
  )

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
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto p-3 sm:items-center sm:p-4"
      style={{ background: 'rgba(4, 8, 14, 0.78)', backdropFilter: 'blur(10px)' }}
      onClick={onCancel}
    >
      <div
        className="flex w-full max-w-[920px] flex-col overflow-hidden rounded-[28px] border"
        style={{
          maxHeight: 'calc(100dvh - 1.5rem)',
          borderColor: dangerLabel ? 'rgba(255,90,114,0.5)' : 'var(--accent-mid)',
          background: 'linear-gradient(180deg, color-mix(in srgb, var(--panel) 94%, transparent), color-mix(in srgb, var(--bg2) 90%, transparent))',
          boxShadow: '0 28px 90px rgba(0,0,0,0.42)',
        }}
        onClick={event => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b px-5 py-4 sm:px-6" style={{ borderColor: 'var(--border)' }}>
          <div className="font-mono text-[12px] tracking-[0.16em]" style={{ color: 'var(--text-dim)' }}>
            {mode === 'remove-structure' ? 'REMOVE TARGET' : 'PLACEMENT TARGET'}
          </div>
          <button
            type="button"
            onClick={onCancel}
            className="tap-target grid h-10 w-10 place-items-center rounded-2xl border transition-all"
            aria-label="Close picker"
            style={{ borderColor: 'var(--border)', background: 'var(--panel)', color: 'var(--text-dim)' }}
          >
            <X size={18} strokeWidth={2} />
          </button>
        </div>

        <div className="min-h-0 overflow-y-auto touch-pan-y [-webkit-overflow-scrolling:touch]">
          <div className={`grid gap-0 ${isCatalogArtworkEnabled(structure ? 'structure' : 'entity') ? 'md:grid-cols-[1.05fr_0.95fr]' : ''}`}>
          <div className={`p-5 ${isCatalogArtworkEnabled(structure ? 'structure' : 'entity') ? 'border-b md:border-b-0 md:border-r' : ''}`} style={{ borderColor: 'var(--border)' }}>
            {isCatalogArtworkEnabled(structure ? 'structure' : 'entity') && (
              <CatalogArtwork
                kind={structure ? 'structure' : 'entity'}
                label={target.label}
                category={target.category}
                sourceKind={structure?.sourceKind ?? null}
                imageUrl={target.imageUrl}
                art={target.art}
                className={structure
                  ? 'h-[260px] w-full rounded-[22px] border bg-[var(--bg2)] object-contain p-3'
                  : 'mx-auto h-[260px] w-full max-w-[22rem] rounded-[22px] border bg-[var(--bg2)] object-contain p-3'}
              />
            )}
            <div className="mt-4">
              <div className="font-mono text-[18px] tracking-[0.12em]" style={{ color: 'var(--text)' }}>
                {target.label}
              </div>
              <div className="mt-1 font-mono text-[11px] tracking-[0.14em]" style={{ color: 'var(--text-dim)' }}>
                {target.category.toUpperCase()}
                {structure ? ` · ${structure.sourceKind.toUpperCase()}${structure.placementKind ? ` · ${structure.placementKind.replace(/_/g, ' ').toUpperCase()}` : ''}` : ''}
                {entity?.sourceKind ? ` · ${entity.sourceKind.toUpperCase()}` : ''}
                {entity?.dangerous ? ' · !' : ''}
              </div>
              {target.summary && (
                <div className="mt-3 rounded-2xl border px-4 py-3 font-mono text-[12px]" style={{ borderColor: 'var(--border)', color: 'var(--text-dim)', background: 'color-mix(in srgb, var(--bg) 68%, transparent)' }}>
                  {target.summary}
                </div>
              )}
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                {structure && (
                  <StructureFootprintCard structure={structure} />
                )}
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
            <div className="mt-4 space-y-4">
              {mode !== 'remove-structure' && (
                <>
                  <div className="grid gap-2 sm:grid-cols-3">
                    {(['player', 'world-player', 'coords'] as const).map(entry => (
                      <button
                        key={entry}
                        type="button"
                        onClick={() => onLocationModeChange(entry)}
                        className="rounded-2xl border px-4 py-3 text-left font-mono text-[12px] transition-all"
                        style={locationMode === entry
                          ? { borderColor: 'var(--accent-mid)', background: 'var(--accent-dim)', color: 'var(--accent)' }
                          : { borderColor: 'var(--border)', background: 'var(--panel)', color: 'var(--text-dim)' }}
                      >
                        <div className="tracking-[0.16em]">
                          {entry === 'player' ? 'Selected Player' : entry === 'world-player' ? 'World + Player' : 'Coordinates'}
                        </div>
                        <div className="mt-1 text-[10px] leading-4 opacity-80">
                          {entry === 'player'
                            ? 'Follow the active player and infer the world automatically.'
                            : entry === 'world-player'
                              ? 'Lock the target world first, then choose a player already inside it.'
                              : 'Place directly with an explicit world and coordinates.'}
                        </div>
                      </button>
                    ))}
                  </div>

                  {locationMode === 'player' ? (
                    <div className="space-y-3 rounded-2xl border px-4 py-4" style={{ borderColor: 'var(--border)', background: 'color-mix(in srgb, var(--bg) 70%, transparent)' }}>
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
                      <div className="grid gap-2 sm:grid-cols-2">
                        <div className="rounded-xl border px-3 py-3 font-mono text-[11px]" style={{ borderColor: 'var(--border)', background: 'var(--panel)' }}>
                          <div style={{ color: 'var(--text-dim)' }}>Resolved World</div>
                          <div className="mt-1" style={{ color: 'var(--text)' }}>{selectedPlayerWorld ?? 'Waiting for live player location'}</div>
                        </div>
                        <div className="rounded-xl border px-3 py-3 font-mono text-[11px]" style={{ borderColor: 'var(--border)', background: 'var(--panel)' }}>
                          <div style={{ color: 'var(--text-dim)' }}>Target Mode</div>
                          <div className="mt-1" style={{ color: 'var(--text)' }}>Use live player position</div>
                        </div>
                      </div>
                      <div className="font-mono text-[11px]" style={{ color: 'var(--text-dim)' }}>
                        World and coordinates are inferred from the selected player&apos;s current live location.
                      </div>
                    </div>
                  ) : locationMode === 'world-player' ? (
                    <div className="space-y-3 rounded-2xl border px-4 py-4" style={{ borderColor: 'var(--border)', background: 'color-mix(in srgb, var(--bg) 70%, transparent)' }}>
                      <label className="block space-y-1">
                        <div className="font-mono text-[11px] tracking-[0.14em]" style={{ color: 'var(--text-dim)' }}>
                          WORLD
                        </div>
                        <select
                          value={world}
                          onChange={event => onWorldChange(event.target.value)}
                          className="w-full rounded-2xl border px-3 py-3 font-mono text-[13px] focus:outline-none"
                          style={{ borderColor: 'var(--border)', background: 'var(--panel)', color: 'var(--text)' }}
                        >
                          <option value="">Select world</option>
                          {worlds.map(entry => <option key={entry} value={entry}>{entry}</option>)}
                        </select>
                      </label>
                      <label className="block space-y-1">
                        <div className="font-mono text-[11px] tracking-[0.14em]" style={{ color: 'var(--text-dim)' }}>
                          PLAYER IN THAT WORLD
                        </div>
                        <select
                          value={selectedPlayer}
                          onChange={event => onSelectedPlayerChange(event.target.value)}
                          className="w-full rounded-2xl border px-3 py-3 font-mono text-[13px] focus:outline-none"
                          style={{ borderColor: 'var(--border)', background: 'var(--panel)', color: 'var(--text)' }}
                        >
                          <option value="">{world ? 'Select player in world' : 'Select world first'}</option>
                          {worldPlayers.map(player => <option key={player} value={player}>{player}</option>)}
                        </select>
                        <div className="font-mono text-[11px]" style={{ color: 'var(--text-dim)' }}>
                          Choose a player already standing in the selected world, or switch to Coordinates.
                        </div>
                      </label>
                      <div className="rounded-xl border px-3 py-3 font-mono text-[11px]" style={{ borderColor: 'var(--border)', background: 'var(--panel)', color: 'var(--text-dim)' }}>
                        Mcraftr will keep the selected world locked, then resolve coordinates from that player only if they are already in it.
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-3 rounded-2xl border px-4 py-4" style={{ borderColor: 'var(--border)', background: 'color-mix(in srgb, var(--bg) 70%, transparent)' }}>
                      <label className="block space-y-1">
                        <div className="font-mono text-[11px] tracking-[0.14em]" style={{ color: 'var(--text-dim)' }}>
                          WORLD
                        </div>
                        <select
                          value={world}
                          onChange={event => onWorldChange(event.target.value)}
                          className="w-full rounded-2xl border px-3 py-3 font-mono text-[13px] focus:outline-none"
                          style={{ borderColor: 'var(--border)', background: 'var(--panel)', color: 'var(--text)' }}
                        >
                          <option value="">Select world</option>
                          {worlds.map(entry => <option key={entry} value={entry}>{entry}</option>)}
                        </select>
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
                      {onRandomize && (
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={onRandomize}
                            disabled={randomizeBusy || !world}
                            className="rounded-2xl border px-4 py-3 font-mono text-[12px] tracking-[0.14em] disabled:opacity-40"
                            style={{ borderColor: 'var(--accent-mid)', background: 'var(--accent-dim)', color: 'var(--accent)' }}
                          >
                            {randomizeBusy ? 'Randomizing…' : x || y || z ? 'Randomize Again' : 'Randomize'}
                          </button>
                          <div className="rounded-xl border px-3 py-3 font-mono text-[11px]" style={{ borderColor: 'var(--border)', background: 'var(--panel)', color: 'var(--text-dim)' }}>
                            Mcraftr will look for a safer spot with ground support and open space before filling the coordinates.
                          </div>
                        </div>
                      )}
                      {placementCheck && (
                        <div
                          className="rounded-xl border px-3 py-3 font-mono text-[11px]"
                          style={{
                            borderColor: placementCheck.status === 'good' ? 'color-mix(in srgb, var(--accent) 42%, var(--border))' : placementCheck.status === 'warn' ? 'rgba(245, 177, 87, 0.45)' : 'rgba(255, 90, 114, 0.45)',
                            background: placementCheck.status === 'good' ? 'color-mix(in srgb, var(--accent) 10%, var(--panel))' : placementCheck.status === 'warn' ? 'rgba(245, 177, 87, 0.08)' : 'rgba(255, 90, 114, 0.08)',
                            color: placementCheck.status === 'good' ? 'var(--text-dim)' : placementCheck.status === 'warn' ? '#ffd7a3' : '#ffb3bd',
                          }}
                        >
                          <div>{placementCheck.message}</div>
                          {placementCheck.details && placementCheck.details.length > 0 && (
                            <div className="mt-2 space-y-1">
                              {placementCheck.details.map(detail => (
                                <div key={detail}>- {detail}</div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                      <div className="rounded-xl border px-3 py-3 font-mono text-[11px]" style={{ borderColor: 'var(--border)', background: 'var(--panel)', color: 'var(--text-dim)' }}>
                        Best for precise structure anchors, scripted entity drops, and repeatable placement tests.
                      </div>
                    </div>
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
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-3">
                    <div className="font-mono text-[11px] tracking-[0.14em]" style={{ color: 'var(--text-dim)' }}>
                      COUNT
                    </div>
                    <div className="font-mono text-[11px]" style={{ color: 'var(--text-dim)' }}>
                      Spawn {Math.max(1, Math.min(64, Number(count) || 1))} at once
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {ENTITY_COUNT_PRESETS.map(option => (
                      <button
                        key={option}
                        type="button"
                        onClick={() => onCountChange(option)}
                        className="rounded-xl border px-3 py-2 font-mono text-[11px] transition-all"
                        style={count === option
                          ? { borderColor: 'var(--accent-mid)', background: 'var(--accent-dim)', color: 'var(--accent)' }
                          : { borderColor: 'var(--border)', background: 'var(--panel)', color: 'var(--text-dim)' }}
                      >
                        x{option}
                      </button>
                    ))}
                  </div>
                  <label className="block space-y-1">
                    <div className="font-mono text-[11px] tracking-[0.14em]" style={{ color: 'var(--text-dim)' }}>
                      CUSTOM COUNT
                    </div>
                    <input
                      type="number"
                      min="1"
                      max="64"
                      value={count}
                      onChange={event => onCountChange(event.target.value)}
                      className="w-full rounded-2xl border px-3 py-3 font-mono text-[13px] focus:outline-none"
                      style={{ borderColor: 'var(--border)', background: 'var(--panel)', color: 'var(--text)' }}
                    />
                  </label>
                </div>
              )}
            </div>

          </div>
        </div>
        </div>

        <div className="flex shrink-0 gap-3 border-t px-5 py-4 sm:px-6" style={{ borderColor: 'var(--border)' }}>
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
  )
}
