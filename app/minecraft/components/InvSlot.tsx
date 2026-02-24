'use client'
import { useRef, useState } from 'react'
import { ArrowLeftRight } from 'lucide-react'
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
  slotIndex,
  selected = false,
  moveTarget = false,
  onDelete,
  onSlotClick,
  onMoveTargetHold,
  deleting = false,
}: {
  item: InvItem | undefined
  slotIndex?: number
  selected?: boolean
  moveTarget?: boolean
  onDelete?: (item: InvItem) => void
  onSlotClick?: (slotIndex?: number) => void
  onMoveTargetHold?: (slotIndex?: number) => void
  deleting?: boolean
}) {
  const [hovered, setHovered] = useState(false)
  const holdTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const firedHoldRef = useRef(false)

  // Border logic
  const borderColor = moveTarget
    ? 'var(--accent-mid)'                // accent-mid — valid move destination
    : selected
    ? 'var(--accent)'                    // accent — this slot is the "from"
    : !item
    ? 'rgba(255,255,255,0.10)'           // faint white — empty, no state
    : hovered
    ? 'var(--accent)'                    // accent on hover for filled
    : 'rgba(255,255,255,0.22)'           // soft white — filled, idle

  const isClickable = !!onSlotClick || (!!item && (!!onDelete || !!onSlotClick))

  const startHold = () => {
    if (!moveTarget || item || !onMoveTargetHold) return
    firedHoldRef.current = false
    holdTimerRef.current = setTimeout(() => {
      firedHoldRef.current = true
      onMoveTargetHold(slotIndex)
    }, 1000)
  }

  const clearHold = () => {
    if (holdTimerRef.current) {
      clearTimeout(holdTimerRef.current)
      holdTimerRef.current = null
    }
  }

  return (
    <div
      className="relative group"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div
        className={`w-10 h-10 rounded bg-[var(--panel)] flex flex-col items-center justify-center transition-colors ${moveTarget && !item ? 'slot-target-pulse' : ''} ${isClickable ? 'cursor-pointer' : 'cursor-default'}`}
        style={{ border: `1px solid ${borderColor}` }}
        onPointerDown={startHold}
        onPointerUp={clearHold}
        onPointerLeave={clearHold}
        onPointerCancel={clearHold}
        onClick={() => {
          if (firedHoldRef.current) {
            firedHoldRef.current = false
            return
          }
          onSlotClick?.(slotIndex)
        }}
      >
        {moveTarget && !item ? (
          // Empty slot that is a valid move target — show swap icon
          <ArrowLeftRight
            size={14}
            strokeWidth={1.5}
            color="var(--accent)"
            style={{ opacity: hovered ? 1 : 0.6, transition: 'opacity 0.15s' }}
          />
        ) : !item ? null : deleting ? (
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

      {/* Delete button — no confirm(); parent manages confirmation */}
      {item && onDelete && !deleting && !moveTarget && (
        <button
          onClick={e => {
            e.stopPropagation()
            onDelete(item)
          }}
          className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-red-900 border border-red-700 text-red-300 text-[10px] font-mono leading-none flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity z-10 hover:bg-red-700"
          title={`Clear ${item.label}`}
        >
          ✕
        </button>
      )}

      {/* Tooltip — not shown when move target active */}
      {item && hovered && !deleting && !moveTarget && (
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
