'use client'

type IntegrationCardProps = {
  label: string
  description: string
  owner: 'mcraftr' | 'third-party'
  installState: 'ready' | 'missing' | 'unsupported' | 'unknown'
  detectedVersion: string | null
  pinnedVersion: string
  restartRequired: boolean
  featureSummaries: string[]
  notes: string[]
  isPreferred?: boolean
}

const STATUS_COPY: Record<IntegrationCardProps['installState'], { label: string; tone: string; fill: string }> = {
  ready: { label: 'READY', tone: '#4ade80', fill: 'rgba(74,222,128,0.15)' },
  missing: { label: 'MISSING', tone: '#fbbf24', fill: 'rgba(251,191,36,0.14)' },
  unsupported: { label: 'UNSUPPORTED', tone: '#f87171', fill: 'rgba(248,113,113,0.14)' },
  unknown: { label: 'UNKNOWN', tone: '#93c5fd', fill: 'rgba(147,197,253,0.14)' },
}

export default function IntegrationCard(props: IntegrationCardProps) {
  const status = STATUS_COPY[props.installState]

  return (
    <div className="rounded-[22px] border border-[var(--border)] bg-[var(--panel)] p-4 shadow-[0_18px_36px_rgba(0,0,0,0.12)]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-[10px] font-mono tracking-[0.28em] text-[var(--text-dim)]">{props.owner === 'mcraftr' ? 'FIRST-PARTY' : 'CURATED'}</div>
          <div className="mt-1 text-[16px] font-mono text-[var(--text)]">{props.label}</div>
          <div className="mt-1 text-[12px] font-mono leading-relaxed text-[var(--text-dim)]">{props.description}</div>
        </div>
        <div className="space-y-2 text-right">
          <div className="rounded-full border px-2 py-1 text-[10px] font-mono tracking-[0.18em]" style={{ borderColor: status.tone, color: status.tone, background: status.fill }}>
            {status.label}
          </div>
          {props.isPreferred && (
            <div className="rounded-full border border-[var(--accent-mid)] bg-[var(--accent-dim)] px-2 py-1 text-[10px] font-mono tracking-[0.16em] text-[var(--accent)]">
              SELECTED
            </div>
          )}
        </div>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-3">
        <div className="rounded-2xl border border-[var(--border)] bg-[color-mix(in_srgb,var(--bg2)_68%,transparent)] p-3">
          <div className="text-[10px] font-mono tracking-[0.24em] text-[var(--text-dim)]">DETECTED</div>
          <div className="mt-1 text-[13px] font-mono text-[var(--text)]">{props.detectedVersion || 'Not detected'}</div>
        </div>
        <div className="rounded-2xl border border-[var(--border)] bg-[color-mix(in_srgb,var(--bg2)_68%,transparent)] p-3">
          <div className="text-[10px] font-mono tracking-[0.24em] text-[var(--text-dim)]">CURATED PIN</div>
          <div className="mt-1 text-[13px] font-mono text-[var(--text)]">{props.pinnedVersion}</div>
        </div>
        <div className="rounded-2xl border border-[var(--border)] bg-[color-mix(in_srgb,var(--bg2)_68%,transparent)] p-3">
          <div className="text-[10px] font-mono tracking-[0.24em] text-[var(--text-dim)]">RESTART</div>
          <div className="mt-1 text-[13px] font-mono text-[var(--text)]">{props.restartRequired ? 'Required after install/update' : 'No restart expected'}</div>
        </div>
      </div>

      <div className="mt-4 grid gap-3 lg:grid-cols-2">
        <div className="rounded-2xl border border-[var(--border)] bg-black/10 p-3">
          <div className="text-[10px] font-mono tracking-[0.24em] text-[var(--text-dim)]">UNLOCKS</div>
          <div className="mt-2 space-y-2">
            {props.featureSummaries.map(item => (
              <div key={item} className="text-[12px] font-mono leading-relaxed text-[var(--text)]">{item}</div>
            ))}
          </div>
        </div>
        <div className="rounded-2xl border border-[var(--border)] bg-black/10 p-3">
          <div className="text-[10px] font-mono tracking-[0.24em] text-[var(--text-dim)]">NOTES</div>
          <div className="mt-2 space-y-2">
            {props.notes.map(item => (
              <div key={item} className="text-[12px] font-mono leading-relaxed text-[var(--text-dim)]">{item}</div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
