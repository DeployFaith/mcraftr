'use client'

type IntegrationStatus = {
  id: string
  label: string
  installState: 'ready' | 'missing' | 'unsupported' | 'unknown' | 'outdated' | 'drifted' | 'user-managed'
  detectedVersion: string | null
  pinnedVersion: string
  reasons: string[]
}

export default function IntegrationDependencyPrompt({
  eyebrow,
  title,
  description,
  selectedIntegrationId,
  statuses,
  busyKey,
  statusMessage,
  errorMessage,
  onInstall,
  onRepair,
  onSelect,
  onRecommend,
  compact = false,
}: {
  eyebrow: string
  title: string
  description: string
  selectedIntegrationId?: string | null
  statuses: IntegrationStatus[]
  busyKey: string | null
  statusMessage?: { ok: boolean; msg: string } | null
  errorMessage?: string | null
  onInstall: (integrationId: string) => void
  onRepair: (integrationId: string) => void
  onSelect: (integrationId: string) => void
  onRecommend: () => void
  compact?: boolean
}) {
  const activeCount = statuses.filter(integration => ['ready', 'outdated', 'drifted', 'user-managed'].includes(integration.installState)).length

  return (
    <div className={`rounded-[24px] border border-[var(--accent-mid)] bg-[linear-gradient(180deg,color-mix(in_srgb,var(--accent)_10%,transparent),rgba(8,12,18,0.55))] ${compact ? 'p-3' : 'p-4'}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-2">
          <div className="text-[10px] font-mono tracking-[0.28em] text-[var(--accent)]">{eyebrow}</div>
          <div className={`${compact ? 'text-[13px]' : 'text-[15px]'} font-mono text-[var(--text)]`}>{title}</div>
          <div className={`max-w-3xl ${compact ? 'text-[11px]' : 'text-[12px]'} font-mono leading-relaxed text-[var(--text-dim)]`}>{description}</div>
        </div>
        {selectedIntegrationId && (
          <div className={`rounded-full border border-[var(--accent-mid)] bg-[var(--accent-dim)] ${compact ? 'px-2 py-1 text-[9px]' : 'px-3 py-1 text-[10px]'} font-mono tracking-[0.18em] text-[var(--accent)]`}>
            SELECTED: {selectedIntegrationId.toUpperCase()}
          </div>
        )}
      </div>

      {statusMessage && (
        <div className={`mt-3 rounded-2xl border px-3 py-3 ${compact ? 'text-[10px]' : 'text-[11px]'} font-mono ${statusMessage.ok ? 'border-emerald-900/60 bg-emerald-950/20 text-emerald-300' : 'border-red-900/60 bg-red-950/20 text-red-300'}`}>
          {statusMessage.msg}
        </div>
      )}

      {errorMessage && (
        <div className={`mt-3 rounded-2xl border border-red-900/60 bg-red-950/20 px-3 py-3 ${compact ? 'text-[10px]' : 'text-[11px]'} font-mono text-red-300`}>
          {errorMessage}
        </div>
      )}

      <div className={`mt-4 grid gap-3 ${compact ? 'md:grid-cols-1' : 'lg:grid-cols-2'}`}>
        {statuses.map(integration => {
          const isInstalled = ['ready', 'outdated', 'drifted', 'user-managed'].includes(integration.installState)
          const canInstall = ['missing', 'unknown', 'outdated'].includes(integration.installState)
          const canRepair = ['ready', 'outdated', 'drifted'].includes(integration.installState)
          const isBusy = busyKey === `install:${integration.id}` || busyKey === `repair:${integration.id}` || busyKey === `remove:${integration.id}` || busyKey === `preference:${integration.id}`

          return (
            <div key={integration.id} className={`rounded-2xl border border-[var(--border)] ${compact ? 'bg-black/10 p-3' : 'bg-[var(--panel)] p-4'}`}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className={`${compact ? 'text-[12px]' : 'text-[14px]'} font-mono text-[var(--text)]`}>{integration.label}</div>
                  <div className={`mt-1 ${compact ? 'text-[10px]' : 'text-[11px]'} font-mono text-[var(--text-dim)]`}>
                    {integration.detectedVersion ? `Detected ${integration.detectedVersion}` : 'Not currently detected'} • Curated pin {integration.pinnedVersion}
                  </div>
                </div>
                <div className={`rounded-full border px-2 py-1 ${compact ? 'text-[9px]' : 'text-[10px]'} font-mono tracking-[0.16em]`} style={{ borderColor: 'var(--border)', color: 'var(--text-dim)' }}>
                  {integration.installState.toUpperCase()}
                </div>
              </div>
              <div className={`mt-3 ${compact ? 'text-[10px]' : 'text-[11px]'} font-mono leading-relaxed text-[var(--text-dim)]`}>
                {integration.reasons[0] || 'Mcraftr can use this provider for advanced structure workflows.'}
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {canInstall && (
                  <button
                    type="button"
                    disabled={!!busyKey}
                    onClick={() => onInstall(integration.id)}
                    className={`rounded-xl border border-[var(--accent-mid)] bg-[var(--accent-dim)] ${compact ? 'px-2.5 py-1.5 text-[10px]' : 'px-3 py-2 text-[11px]'} font-mono tracking-[0.18em] text-[var(--accent)] disabled:opacity-40`}
                  >
                    {isBusy ? 'WORKING...' : `INSTALL ${integration.label.toUpperCase()}`}
                  </button>
                )}
                {canRepair && (
                  <button
                    type="button"
                    disabled={!!busyKey}
                    onClick={() => onRepair(integration.id)}
                    className={`rounded-xl border border-[var(--border)] ${compact ? 'px-2.5 py-1.5 text-[10px]' : 'px-3 py-2 text-[11px]'} font-mono tracking-[0.18em] text-[var(--text)] disabled:opacity-40`}
                  >
                    {isBusy ? 'WORKING...' : 'REPAIR'}
                  </button>
                )}
                {isInstalled && (
                  <button
                    type="button"
                    disabled={!!busyKey}
                    onClick={() => onSelect(integration.id)}
                    className={`rounded-xl border border-[var(--border)] ${compact ? 'px-2.5 py-1.5 text-[10px]' : 'px-3 py-2 text-[11px]'} font-mono tracking-[0.18em] text-[var(--text-dim)] disabled:opacity-40`}
                  >
                    {selectedIntegrationId === integration.id ? 'SELECTED' : 'USE HERE'}
                  </button>
                )}
              </div>
            </div>
          )
        })}
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          disabled={!!busyKey}
          onClick={onRecommend}
          className={`rounded-xl border border-[var(--accent-mid)] bg-[var(--accent-dim)] ${compact ? 'px-2.5 py-1.5 text-[10px]' : 'px-3 py-2 text-[11px]'} font-mono tracking-[0.18em] text-[var(--accent)] disabled:opacity-40`}
        >
          {activeCount === 0 ? 'LET MCRAFTR CHOOSE' : 'REVIEW RECOMMENDATION'}
        </button>
      </div>
    </div>
  )
}
