import type { StructurePreviewDescriptor } from '@/lib/minecraft-assets/structure-art'

export type Structure3DVoxel = NonNullable<NonNullable<StructurePreviewDescriptor['preview3d']>['voxels']>[number]
export type Structure3DPreview = NonNullable<StructurePreviewDescriptor['preview3d']>

export type Structure3DRenderGroup = {
  blockId: string
  positions: Array<[number, number, number]>
}

export function getStructure3DPreview(preview: StructurePreviewDescriptor | null | undefined): Structure3DPreview | null {
  return preview?.preview3d ?? null
}

export function groupVoxelsByBlockId(preview3d: Structure3DPreview): Structure3DRenderGroup[] {
  const groups = new Map<string, Array<[number, number, number]>>()
  for (const voxel of preview3d.voxels) {
    const existing = groups.get(voxel.blockId) ?? []
    existing.push([voxel.x, voxel.y, voxel.z])
    groups.set(voxel.blockId, existing)
  }
  return Array.from(groups.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([blockId, positions]) => ({ blockId, positions }))
}

export function computeStructureCameraTarget(preview3d: Structure3DPreview): [number, number, number] {
  return [
    preview3d.bounds.width / 2,
    preview3d.bounds.height / 2,
    preview3d.bounds.length / 2,
  ]
}

export function computeStructureCameraDistance(preview3d: Structure3DPreview): number {
  return Math.max(8, Math.max(preview3d.bounds.width, preview3d.bounds.height, preview3d.bounds.length) * 1.8)
}

export function summarizeStructure3DMeta(preview3d: Structure3DPreview) {
  return {
    voxelCount: preview3d.voxelCount,
    truncated: preview3d.truncated,
    sampled: preview3d.sampled,
    boundsLabel: `${preview3d.bounds.width} × ${preview3d.bounds.height} × ${preview3d.bounds.length}`,
  }
}
