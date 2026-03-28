'use client'

import { AlertCircle, Box, RotateCcw } from 'lucide-react'
import { useMemo, useState } from 'react'
import type { StructurePreviewDescriptor } from '@/lib/minecraft-assets/structure-art'
import { getStructure3DPreview, summarizeStructure3DMeta } from '@/lib/catalog-art/structure-3d'
import Structure3DViewport from './Structure3DViewport'

export default function Structure3DPreview({ preview, className = '' }: { preview: StructurePreviewDescriptor | null | undefined; className?: string }) {
  const [resetKey, setResetKey] = useState(0)
  const preview3d = useMemo(() => getStructure3DPreview(preview), [preview])
  const meta = useMemo(() => (preview3d ? summarizeStructure3DMeta(preview3d) : null), [preview3d])

  if (!preview3d) {
    return (
      <div className={`flex h-full w-full items-center justify-center rounded-[inherit] border border-white/8 bg-[linear-gradient(180deg,rgba(255,255,255,0.04),rgba(255,255,255,0.02))] p-4 text-center ${className}`}>
        <div>
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-black/10 text-[var(--text-dim)]"><Box size={20} /></div>
          <div className="text-[12px] font-mono text-[var(--text)]">3D preview unavailable</div>
          <div className="mt-1 text-[10px] font-mono text-[var(--text-dim)]">This structure does not have enough preview data for a 3D render yet.</div>
        </div>
      </div>
    )
  }

  return (
    <div className={`relative overflow-hidden rounded-[inherit] border border-white/8 bg-[var(--bg2)] ${className}`}>
      <div className="absolute left-3 top-3 z-10 flex flex-wrap gap-2">
        <span className="rounded-full border border-[var(--accent-mid)] bg-[var(--accent-dim)] px-3 py-1 text-[10px] font-mono tracking-[0.16em] text-[var(--accent)]">3D</span>
        <span className="rounded-full border border-white/10 bg-black/20 px-3 py-1 text-[10px] font-mono tracking-[0.16em] text-[var(--text-dim)]">{meta?.boundsLabel}</span>
        <span className="rounded-full border border-white/10 bg-black/20 px-3 py-1 text-[10px] font-mono tracking-[0.16em] text-[var(--text-dim)]">{meta?.voxelCount} voxels</span>
        {meta?.sampled && (
          <span className="rounded-full border border-yellow-500/30 bg-yellow-500/10 px-3 py-1 text-[10px] font-mono tracking-[0.16em] text-yellow-200">sampled</span>
        )}
      </div>
      <button
        type="button"
        onClick={() => setResetKey(value => value + 1)}
        className="absolute right-3 top-3 z-10 rounded-full border border-white/10 bg-black/30 p-2 text-[var(--text-dim)] transition-colors hover:text-[var(--accent)]"
        aria-label="Reset 3D camera"
      >
        <RotateCcw size={14} />
      </button>
      <div className="absolute bottom-3 left-3 z-10 flex items-center gap-2 rounded-full border border-white/10 bg-black/30 px-3 py-1 text-[10px] font-mono text-[var(--text-dim)]">
        <AlertCircle size={12} /> Drag to orbit · scroll to zoom
      </div>
      <div className="h-full w-full">
        <Structure3DViewport key={resetKey} preview3d={preview3d} />
      </div>
    </div>
  )
}
