'use client'

import * as Switch from '@radix-ui/react-switch'

type Props = {
  checked: boolean
  onCheckedChange?: (checked: boolean) => void
  disabled?: boolean
  busy?: boolean
  label: string
  description?: string
  className?: string
}

function cn(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(' ')
}

export default function McraftrSwitch({
  checked,
  onCheckedChange,
  disabled = false,
  busy = false,
  label,
  description,
  className,
}: Props) {
  const inactiveThumb = '#8ea3b5'

  return (
    <label
      className={cn(
        'flex items-center justify-between gap-4 rounded-xl border px-3 py-3 transition-all',
        disabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer hover:border-[var(--accent-mid)]',
        className,
      )}
      style={{
        borderColor: 'var(--border)',
        background: 'var(--panel)',
      }}
    >
      {(label || description) && (
        <div className="min-w-0">
          {label && (
            <div className="text-[12px] font-mono tracking-widest" style={{ color: 'var(--text)' }}>
              {label}
            </div>
          )}
          {description && (
            <div className="mt-1 text-[11px] font-mono leading-5" style={{ color: 'var(--text-dim)' }}>
              {description}
            </div>
          )}
        </div>
      )}

      <div className="flex items-center gap-2 shrink-0">
        <span className="text-[10px] font-mono tracking-[0.16em]" style={{ color: checked ? 'var(--accent)' : 'var(--text-dim)' }}>
          {busy ? '...' : checked ? 'ON' : 'OFF'}
        </span>
        <Switch.Root
          checked={checked}
          onCheckedChange={onCheckedChange}
          disabled={disabled || busy}
          className="relative h-7 w-12 rounded-full border transition-all outline-none disabled:cursor-not-allowed"
          style={{
            borderColor: checked ? 'var(--accent-mid)' : 'var(--border)',
            background: checked ? 'var(--accent-dim)' : 'color-mix(in srgb, var(--bg2) 80%, transparent)',
            boxShadow: checked ? '0 0 18px color-mix(in srgb, var(--accent) 24%, transparent)' : 'none',
          }}
        >
          <Switch.Thumb
            className="block h-5 w-5 rounded-full shadow-md transition-transform duration-200 will-change-transform data-[state=checked]:translate-x-[1.35rem] data-[state=unchecked]:translate-x-[0.2rem]"
            style={{ background: checked ? 'var(--accent)' : inactiveThumb, marginTop: '3px' }}
          />
        </Switch.Root>
      </div>
    </label>
  )
}
