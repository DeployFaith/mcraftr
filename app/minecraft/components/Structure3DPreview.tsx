'use client'

import { AlertCircle, Box, RotateCcw } from 'lucide-react'
import { Component, useMemo, useState, type ReactNode } from 'react'
import type { StructurePreviewDescriptor } from '@/lib/minecraft-assets/structure-art'
import { getStructure3DPreview, summarizeStructure3DMeta } from '@/lib/catalog-art/structure-3d'
import Structure3DViewport from './Structure3DViewport'

class Structure3DErrorBoundary extends Component<{
  fallback: ReactNode
  resetKey: string
  onError?: () => void
  children?: ReactNode
}, { hasError: boolean }> {
  constructor(props: {
    fallback: ReactNode
    resetKey: string
    onError?: () => void
    children?: ReactNode
  }) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  override componentDidCatch() {
    this.props.onError?.()
  }

  override componentDidUpdate(prevProps: Readonly<{ resetKey: string }>) {
    if (prevProps.resetKey !== this.props.resetKey && this.state.hasError) {
      this.setState({ hasError: false })
    }
  }

  override render() {
    return this.state.hasError ? this.props.fallback : this.props.children
  }
}

export default function Structure3DPreview({
  preview,
  className = '',
  onError,
}: {
  preview: StructurePreviewDescriptor | null | undefined
  className?: string
  onError?: () => void
}) {
  const [resetToken, setResetToken] = useState(0)
  const preview3d = useMemo(() => getStructure3DPreview(preview), [preview])
  const meta = useMemo(() => (preview3d ? summarizeStructure3DMeta(preview3d) : null), [preview3d])

  const unavailableFallback = (
    <div className={`flex h-full w-full items-center justify-center rounded-[inherit] border border-white/8 bg-[linear-gradient(180deg,rgba(255,255,255,0.04),rgba(255,255,255,0.02))] p-4 text-center ${className}`}>
      <div>
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-black/10 text-[var(--text-dim)]"><Box size={20} /></div>
        <div className="text-[12px] font-mono text-[var(--text)]">3D preview unavailable</div>
        <div className="mt-1 text-[10px] font-mono text-[var(--text-dim)]">This structure does not have enough preview data for a 3D render yet.</div>
      </div>
    </div>
  )

  if (!preview3d) return unavailableFallback

  return (
    <div className={`relative overflow-hidden rounded-[inherit] border border-white/8 bg-[var(--bg2)] ${className}`}>
      <div className="absolute left-3 top-3 z-10 flex flex-wrap gap-2">
        <span className="rounded-full border border-[var(--accent-mid)] bg-[var(--accent-dim)] px-3 py-1 text-[10px] font-mono tracking-[0.16em] text-[var(--accent)]">3D</span>
        <span className="rounded-full border border-white/10 bg-black/20 px-3 py-1 text-[10px] font-mono tracking-[0.16em] text-[var(--text-dim)]">{meta?.boundsLabel}</span>
        <span className="rounded-full border border-white/10 bg-black/20 px-3 py-1 text-[10px] font-mono tracking-[0.16em] text-[var(--text-dim)]">{meta?.voxelCount} voxels</span>
        {meta?.sampled && (
          <span className="rounded-full border border-yellow-500/30 bg-yellow-500/10 px-3 py-1 text-[10px] font-mono tracking-[0.16em] text-yellow-200">sampled</span>
        )}
        {meta?.truncated && (
          <span className="rounded-full border border-orange-500/30 bg-orange-500/10 px-3 py-1 text-[10px] font-mono tracking-[0.16em] text-orange-200">truncated</span>
        )}
      </div>
      <button
        type="button"
        onClick={() => setResetToken(value => value + 1)}
        className="absolute right-3 top-3 z-10 rounded-full border border-white/10 bg-black/30 p-2 text-[var(--text-dim)] transition-colors hover:text-[var(--accent)]"
        aria-label="Reset 3D camera"
      >
        <RotateCcw size={14} />
      </button>
      <div className="absolute bottom-3 left-3 z-10 flex items-center gap-2 rounded-full border border-white/10 bg-black/30 px-3 py-1 text-[10px] font-mono text-[var(--text-dim)]">
        <AlertCircle size={12} /> Drag to orbit · scroll to zoom
      </div>
      <div className="h-full w-full">
        <Structure3DErrorBoundary fallback={unavailableFallback} resetKey={`${preview3d.voxelCount}:${resetToken}`} onError={onError}>
          <Structure3DViewport preview3d={preview3d} resetToken={resetToken} />
        </Structure3DErrorBoundary>
      </div>
    </div>
  )
}
