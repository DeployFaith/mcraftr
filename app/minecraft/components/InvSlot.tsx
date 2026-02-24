'use client'
import { useState } from 'react'
import type { InvItem } from '../../api/minecraft/inventory/route'

export function slotLabel(slot: number): string {
  if (slot >= 0  && slot <= 8)  return `Hotbar ${slot + 1}`
  if (slot >= 9  && slot <= 35) return `Slot ${slot - 8}`
  if (slot === 100) return 'Boots'
  if (slot === 101) return 'Leggings'
  if (slot === 102) return 'Chestplate'
  if (slot === 103) return 'Helmet'
  if (slot === 150) return 'Offhand'
  return `Slot ${slot}`
}

// Builds a flat array of slots in the canonical Minecraft layout order:
// hotbar (0-8), main (9-35), armor (103,102,101,100), offhand (150)
export function buildInventoryLayout(items: InvItem[]) {
  const bySlot = new Map(items.map(i => [i.slot, i]))

  const hotbar  = Array.from({ length: 9  }, (_, i) => bySlot.get(i))
  const main    = Array.from({ length: 27 }, (_, i) => bySlot.get(i + 9))
  const armor   = [103, 102, 101, 100].map(s => bySlot.get(s))
  const offhand = bySlot.get(150)

  return { hotbar, main, armor, offhand }
}

export default function InvSlot({
  item,
  onDelete,
  deleting,
}: {
  item: InvItem | undefined
  onDelete?: (item: InvItem) => void
  deleting?: boolean
}) {
  const [hovered, setHovered] = useState(false)

  // Border styles:
  // empty  → very faint white (non-intrusive structure guide)
  // filled → soft white (visible but not loud)
  // hover  → accent color
  const emptyBorder  = 'rgba(255,255,255,0.10)'
  const filledBorder = 'rgba(255,255,255,0.22)'
  const accentBorder = 'var(--accent)'

  const borderColor = !item
    ? emptyBorder
    : hovered
    ? accentBorder
    : filledBorder

  return (
    <div
      className="relative group"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div
        className="w-10 h-10 rounded bg-[var(--panel)] flex flex-col items-center justify-center cursor-default transition-colors"
        style={{ border: `1px solid ${borderColor}` }}
      >
        {!item ? null : deleting ? (
          <span className="text-[11px] font-mono text-[var(--text-dim)] animate-pulse">…</span>
        ) : (
          <>
            <span className="text-[11px] font-mono text-[var(--accent)] leading-tight text-center px-0.5 w-full truncate">
              {item.label.slice(0, 6)}
            </span>
            {item.count > 1 && (
              <span className="text-[10px] font-mono text-[var(--text-dim)]">×{item.count}</span>
            )}
          </>
        )}
      </div>

      {/* Delete button — appears on hover when onDelete is provided */}
      {item && onDelete && !deleting && (
        <button
          onClick={e => {
            e.stopPropagation()
            if (confirm(`Clear ${item.label} from inventory? This cannot be undone.`)) {
              onDelete(item)
            }
          }}
          className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-red-900 border border-red-700 text-red-300 text-[10px] font-mono leading-none flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity z-10 hover:bg-red-700"
          title={`Clear ${item.label}`}
        >
          ✕
        </button>
      )}

      {/* Tooltip */}
      {item && hovered && !deleting && (
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 z-20 bg-[var(--bg)] border border-[var(--border)] rounded px-2 py-1.5 text-[11px] font-mono text-[var(--text)] whitespace-nowrap shadow-lg pointer-events-none">
          <div className="font-medium">{item.label}</div>
          {item.count > 1 && <div className="text-[var(--text-dim)]">×{item.count}</div>}
          {item.enchants && <div className="text-[var(--accent)] opacity-80 mt-0.5">{item.enchants}</div>}
          <div className="text-[var(--text-dim)] mt-0.5">{slotLabel(item.slot)}</div>
        </div>
      )}
    </div>
  )
}
