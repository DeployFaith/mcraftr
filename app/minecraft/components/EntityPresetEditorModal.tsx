'use client'

import { useEffect, useState } from 'react'
import { X } from 'lucide-react'
import type { EntityCatalogEntry } from './SpawnInspectModal'

type Props = {
  initial?: EntityCatalogEntry | null
  busy?: boolean
  onCancel: () => void
  onSave: (payload: Record<string, unknown>) => void
}

type Draft = {
  id: string
  label: string
  entityId: string
  category: string
  summary: string
  dangerous: boolean
  defaultCount: string
  customName: string
  health: string
  persistenceRequired: boolean
  noAi: boolean
  silent: boolean
  glowing: boolean
  invulnerable: boolean
  noGravity: boolean
  advancedNbt: string
}

function createDraft(initial?: EntityCatalogEntry | null): Draft {
  return {
    id: initial?.presetId ?? '',
    label: initial?.label ?? '',
    entityId: initial?.entityId ?? initial?.id ?? '',
    category: initial?.category ?? 'custom',
    summary: initial?.summary ?? '',
    dangerous: initial?.dangerous ?? false,
    defaultCount: String(initial?.defaultCount ?? 1),
    customName: initial?.customName ?? '',
    health: initial?.health === null || initial?.health === undefined ? '' : String(initial.health),
    persistenceRequired: initial?.persistenceRequired === true,
    noAi: initial?.noAi === true,
    silent: initial?.silent === true,
    glowing: initial?.glowing === true,
    invulnerable: initial?.invulnerable === true,
    noGravity: initial?.noGravity === true,
    advancedNbt: initial?.advancedNbt ?? '',
  }
}

export default function EntityPresetEditorModal({ initial, busy = false, onCancel, onSave }: Props) {
  const [draft, setDraft] = useState<Draft>(() => createDraft(initial))

  useEffect(() => {
    setDraft(createDraft(initial))
  }, [initial])

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onCancel()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onCancel])

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto p-3 sm:items-center sm:p-4"
      style={{ background: 'rgba(4, 8, 14, 0.78)', backdropFilter: 'blur(10px)' }}
      onClick={onCancel}
    >
      <div
        className="flex w-full max-w-[880px] flex-col overflow-hidden rounded-[28px] border border-[var(--accent-mid)]"
        style={{
          maxHeight: 'calc(100dvh - 1.5rem)',
          background: 'linear-gradient(180deg, color-mix(in srgb, var(--panel) 94%, transparent), color-mix(in srgb, var(--bg2) 90%, transparent))',
          boxShadow: '0 28px 90px rgba(0,0,0,0.42)',
        }}
        onClick={event => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b px-5 py-4" style={{ borderColor: 'var(--border)' }}>
          <div>
            <div className="font-mono text-[15px] tracking-[0.14em]" style={{ color: 'var(--accent)' }}>
              {initial ? 'EDIT ENTITY PRESET' : 'NEW ENTITY PRESET'}
            </div>
            <div className="mt-1 text-[12px] font-mono" style={{ color: 'var(--text-dim)' }}>
              Universal fields first, raw NBT last.
            </div>
          </div>
          <button
            type="button"
            onClick={onCancel}
            className="tap-target grid h-10 w-10 place-items-center rounded-2xl border transition-all"
            aria-label="Close entity preset editor"
            style={{ borderColor: 'var(--border)', background: 'var(--panel)', color: 'var(--text-dim)' }}
          >
            <X size={18} strokeWidth={2} />
          </button>
        </div>

        <div className="min-h-0 overflow-y-auto p-5 touch-pan-y [-webkit-overflow-scrolling:touch]">
          <div className="grid gap-6 lg:grid-cols-[1fr_1fr]">
          <div className="space-y-4">
            {([
              ['Preset Id', 'id', draft.id],
              ['Label', 'label', draft.label],
              ['Entity Id', 'entityId', draft.entityId],
              ['Category', 'category', draft.category],
            ] as const).map(([label, key, value]) => (
              <label key={key} className="block space-y-1">
                <div className="font-mono text-[11px] tracking-[0.14em]" style={{ color: 'var(--text-dim)' }}>{label}</div>
                <input
                  value={value}
                  onChange={event => setDraft(current => ({ ...current, [key]: event.target.value }))}
                  className="w-full rounded-2xl border px-3 py-3 font-mono text-[13px] focus:outline-none"
                  style={{ borderColor: 'var(--border)', background: 'var(--panel)', color: 'var(--text)' }}
                />
              </label>
            ))}

            <label className="block space-y-1">
              <div className="font-mono text-[11px] tracking-[0.14em]" style={{ color: 'var(--text-dim)' }}>Summary</div>
              <textarea
                value={draft.summary}
                onChange={event => setDraft(current => ({ ...current, summary: event.target.value }))}
                rows={3}
                className="w-full rounded-2xl border px-3 py-3 font-mono text-[13px] focus:outline-none"
                style={{ borderColor: 'var(--border)', background: 'var(--panel)', color: 'var(--text)' }}
              />
            </label>

            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block space-y-1">
                <div className="font-mono text-[11px] tracking-[0.14em]" style={{ color: 'var(--text-dim)' }}>Default Count</div>
                <input
                  value={draft.defaultCount}
                  onChange={event => setDraft(current => ({ ...current, defaultCount: event.target.value }))}
                  className="w-full rounded-2xl border px-3 py-3 font-mono text-[13px] focus:outline-none"
                  style={{ borderColor: 'var(--border)', background: 'var(--panel)', color: 'var(--text)' }}
                />
              </label>
              <label className="block space-y-1">
                <div className="font-mono text-[11px] tracking-[0.14em]" style={{ color: 'var(--text-dim)' }}>Health</div>
                <input
                  value={draft.health}
                  onChange={event => setDraft(current => ({ ...current, health: event.target.value }))}
                  className="w-full rounded-2xl border px-3 py-3 font-mono text-[13px] focus:outline-none"
                  style={{ borderColor: 'var(--border)', background: 'var(--panel)', color: 'var(--text)' }}
                />
              </label>
            </div>

            <label className="block space-y-1">
              <div className="font-mono text-[11px] tracking-[0.14em]" style={{ color: 'var(--text-dim)' }}>Custom Name</div>
              <input
                value={draft.customName}
                onChange={event => setDraft(current => ({ ...current, customName: event.target.value }))}
                className="w-full rounded-2xl border px-3 py-3 font-mono text-[13px] focus:outline-none"
                style={{ borderColor: 'var(--border)', background: 'var(--panel)', color: 'var(--text)' }}
              />
            </label>
          </div>

          <div className="space-y-4">
            <div className="grid gap-2 sm:grid-cols-2">
              {([
                ['Dangerous', 'dangerous'],
                ['Persistent', 'persistenceRequired'],
                ['No AI', 'noAi'],
                ['Silent', 'silent'],
                ['Glowing', 'glowing'],
                ['Invulnerable', 'invulnerable'],
                ['No Gravity', 'noGravity'],
              ] as const).map(([label, key]) => (
                <label key={key} className="flex items-center gap-2 rounded-2xl border px-3 py-3 font-mono text-[12px]" style={{ borderColor: 'var(--border)', background: 'var(--panel)', color: 'var(--text)' }}>
                  <input
                    type="checkbox"
                    checked={draft[key]}
                    onChange={event => setDraft(current => ({ ...current, [key]: event.target.checked }))}
                  />
                  {label}
                </label>
              ))}
            </div>

            <label className="block space-y-1">
              <div className="font-mono text-[11px] tracking-[0.14em]" style={{ color: 'var(--text-dim)' }}>Advanced NBT</div>
              <textarea
                value={draft.advancedNbt}
                onChange={event => setDraft(current => ({ ...current, advancedNbt: event.target.value }))}
                rows={8}
                placeholder={`{Tags:["guardian"],ArmorDropChances:[0f,0f,0f,0f]}`}
                className="w-full rounded-2xl border px-3 py-3 font-mono text-[13px] focus:outline-none"
                style={{ borderColor: 'var(--border)', background: 'var(--panel)', color: 'var(--text)' }}
              />
            </label>

            <div className="text-[11px] font-mono" style={{ color: 'var(--text-dim)' }}>
              Advanced NBT is optional. If present, it is appended to the generated summon NBT.
            </div>
          </div>
        </div>
        </div>

        <div className="flex shrink-0 gap-3 border-t px-5 py-4" style={{ borderColor: 'var(--border)' }}>
          <button
            type="button"
            onClick={onCancel}
            className="rounded-2xl border px-4 py-3 font-mono text-[12px] tracking-[0.14em]"
            style={{ borderColor: 'var(--border)', background: 'var(--panel)', color: 'var(--text-dim)' }}
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => onSave(draft)}
            className="rounded-2xl border px-4 py-3 font-mono text-[12px] tracking-[0.14em] disabled:opacity-40"
            style={{ borderColor: 'var(--accent-mid)', background: 'var(--accent-dim)', color: 'var(--accent)' }}
          >
            {busy ? 'Saving…' : initial ? 'Save Preset' : 'Create Preset'}
          </button>
        </div>
      </div>
    </div>
  )
}
