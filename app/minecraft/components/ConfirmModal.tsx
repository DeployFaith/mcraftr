'use client'
import { useEffect } from 'react'

export type ConfirmModalProps = {
  title: string
  body: string
  confirmLabel?: string
  destructive?: boolean
  onConfirm: () => void
  onCancel: () => void
}

export default function ConfirmModal({
  title,
  body,
  confirmLabel = 'Confirm',
  destructive = false,
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onCancel() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onCancel])

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(4px)' }}
      onClick={onCancel}
    >
      <div
        className="glass-card p-4 w-full max-w-[280px] space-y-3"
        onClick={e => e.stopPropagation()}
      >
        <div className="space-y-1">
          <div className="font-mono text-[13px] text-[var(--text)] tracking-wide">{title}</div>
          {body && <div className="font-mono text-[11px] text-[var(--text-dim)]">{body}</div>}
        </div>
        <div className="flex gap-2">
          <button
            onClick={onCancel}
            className="flex-1 py-1.5 rounded font-mono text-[11px] tracking-widest border border-[var(--border)] text-[var(--text-dim)] hover:border-[var(--accent-mid)] hover:text-[var(--text)] transition-all"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 py-1.5 rounded font-mono text-[11px] tracking-widest transition-all"
            style={destructive
              ? { background: 'rgba(127,29,29,0.4)', border: '1px solid #7f1d1d', color: '#fca5a5' }
              : { background: 'var(--accent-dim)', border: '1px solid var(--accent-mid)', color: 'var(--accent)' }
            }
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
