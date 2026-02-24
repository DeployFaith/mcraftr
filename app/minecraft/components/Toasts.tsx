'use client'
import type { Toast } from './useToast'

// Renders toast notifications fixed to bottom-right (mobile: above bottom nav).
// Supports three variants: ok (accent), deactivated (orange), error (red).
export default function Toasts({ toasts }: { toasts: Toast[] }) {
  if (toasts.length === 0) return null
  return (
    <div className="fixed bottom-20 right-4 flex flex-col gap-2 z-50 pointer-events-none md:bottom-6 md:right-6">
      {toasts.map(toast => {
        const styles =
          toast.variant === 'ok'
            ? { background: 'var(--accent-dim)', border: '1px solid var(--accent-mid)', color: 'var(--accent)' }
            : toast.variant === 'deactivated'
            ? { background: '#2a1500', border: '1px solid #92400e', color: '#fb923c' }
            : { background: '#2a0f0f', border: '1px solid #7f1d1d', color: '#fca5a5' }
        const prefix = toast.variant === 'ok' ? '✓ ' : toast.variant === 'deactivated' ? '○ ' : '✗ '
        return (
          <div
            key={toast.id}
            className="px-4 py-3 rounded-lg font-mono text-[13px] shadow-lg pointer-events-auto max-w-xs"
            style={styles}
          >
            {prefix}{toast.message}
          </div>
        )
      })}
    </div>
  )
}
