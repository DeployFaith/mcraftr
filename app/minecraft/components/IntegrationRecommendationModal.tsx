'use client'

import { X } from 'lucide-react'

type IntegrationAlternative = {
  id: string
  acceptable: boolean
  reason: string
}

type IntegrationRecommendation = {
  recommendedId: string | null
  confidence: 'high' | 'medium' | 'low'
  summary: string
  reasons: string[]
  alternatives: IntegrationAlternative[]
  restartRequired: boolean
  pinnedVersion: string | null
}

export default function IntegrationRecommendationModal({
  open,
  recommendation,
  onClose,
  onChoose,
}: {
  open: boolean
  recommendation: IntegrationRecommendation | null
  onClose: () => void
  onChoose: (integrationId: string) => void
}) {
  if (!open || !recommendation) return null

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/65 px-4">
      <div className="w-full max-w-2xl rounded-[28px] border border-[var(--accent-mid)] bg-[linear-gradient(180deg,rgba(11,18,28,0.98),rgba(8,10,16,0.98))] p-5 shadow-[0_30px_80px_rgba(0,0,0,0.45)]">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-[10px] font-mono tracking-[0.32em] text-[var(--accent)]">LET MCRAFTR CHOOSE</div>
            <div className="mt-1 text-[20px] font-mono text-[var(--text)]">Recommendation Preview</div>
            <div className="mt-2 text-[13px] font-mono leading-relaxed text-[var(--text-dim)]">{recommendation.summary}</div>
          </div>
          <button type="button" onClick={onClose} className="rounded-2xl border border-[var(--border)] p-2 text-[var(--text-dim)] transition-colors hover:border-[var(--accent-mid)] hover:text-[var(--accent)]">
            <X size={16} />
          </button>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <div className="rounded-2xl border border-[var(--border)] bg-black/10 p-3">
            <div className="text-[10px] font-mono tracking-[0.24em] text-[var(--text-dim)]">RECOMMENDED</div>
            <div className="mt-1 text-[14px] font-mono text-[var(--text)]">{recommendation.recommendedId || 'No safe pick'}</div>
          </div>
          <div className="rounded-2xl border border-[var(--border)] bg-black/10 p-3">
            <div className="text-[10px] font-mono tracking-[0.24em] text-[var(--text-dim)]">CONFIDENCE</div>
            <div className="mt-1 text-[14px] font-mono text-[var(--text)]">{recommendation.confidence.toUpperCase()}</div>
          </div>
          <div className="rounded-2xl border border-[var(--border)] bg-black/10 p-3">
            <div className="text-[10px] font-mono tracking-[0.24em] text-[var(--text-dim)]">CURATED PIN</div>
            <div className="mt-1 text-[14px] font-mono text-[var(--text)]">{recommendation.pinnedVersion || 'Not available'}</div>
          </div>
        </div>

        <div className="mt-4 rounded-2xl border border-[var(--border)] bg-black/10 p-4">
          <div className="text-[10px] font-mono tracking-[0.24em] text-[var(--text-dim)]">WHY THIS PICK</div>
          <div className="mt-3 space-y-2">
            {recommendation.reasons.map(reason => (
              <div key={reason} className="text-[12px] font-mono leading-relaxed text-[var(--text)]">{reason}</div>
            ))}
          </div>
        </div>

        <div className="mt-4 rounded-2xl border border-[var(--border)] bg-black/10 p-4">
          <div className="text-[10px] font-mono tracking-[0.24em] text-[var(--text-dim)]">ALTERNATIVES</div>
          <div className="mt-3 space-y-3">
            {recommendation.alternatives.map(alternative => (
              <div key={alternative.id} className="flex items-center justify-between gap-3 rounded-2xl border border-[var(--border)] bg-[var(--panel)] px-3 py-3">
                <div>
                  <div className="text-[13px] font-mono text-[var(--text)]">{alternative.id}</div>
                  <div className="mt-1 text-[11px] font-mono text-[var(--text-dim)]">{alternative.reason}</div>
                </div>
                {alternative.acceptable && (
                  <button
                    type="button"
                    onClick={() => onChoose(alternative.id)}
                    className="rounded-xl border border-[var(--border)] px-3 py-2 text-[11px] font-mono tracking-[0.16em] text-[var(--text)] transition-colors hover:border-[var(--accent-mid)] hover:text-[var(--accent)]"
                  >
                    CHOOSE
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-[11px] font-mono text-[var(--text-dim)]">
            {recommendation.restartRequired ? 'A restart will be required after installation.' : 'No restart is expected for this recommended integration.'}
          </div>
          <div className="flex gap-2">
            {recommendation.recommendedId && (
              <button
                type="button"
                onClick={() => onChoose(recommendation.recommendedId!)}
                className="rounded-xl border border-[var(--accent-mid)] bg-[var(--accent-dim)] px-4 py-2 text-[12px] font-mono tracking-[0.18em] text-[var(--accent)]"
              >
                USE RECOMMENDED
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-[var(--border)] px-4 py-2 text-[12px] font-mono tracking-[0.18em] text-[var(--text-dim)]"
            >
              CANCEL
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
