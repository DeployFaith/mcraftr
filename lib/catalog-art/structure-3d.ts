import type { StructurePreviewDescriptor } from '@/lib/minecraft-assets/structure-art'

export type Structure3DVoxel = NonNullable<NonNullable<StructurePreviewDescriptor['preview3d']>['voxels']>[number]
export type Structure3DPreview = NonNullable<StructurePreviewDescriptor['preview3d']>

export type Structure3DRenderGroup = {
  blockId: string
  positions: Array<[number, number, number]>
}

function synthesizeStructure3DPreview(preview: StructurePreviewDescriptor): Structure3DPreview | null {
  if (!Array.isArray(preview.cells) || preview.cells.length === 0) return null

  const rows = preview.cells.length
  const cols = Math.max(...preview.cells.map(row => row.length), 0)
  if (rows === 0 || cols === 0) return null

  const heights = Array.isArray(preview.heights) && preview.heights.length > 0 ? preview.heights : null
  const voxels: Structure3DVoxel[] = []

  for (let z = 0; z < rows; z += 1) {
    for (let x = 0; x < cols; x += 1) {
      const blockId = preview.cells[z]?.[x]
      if (!blockId || blockId === 'air') continue
      const height = Math.max(1, heights?.[z]?.[x] ?? 1)
      voxels.push({ x, y: height - 1, z, blockId })
    }
  }

  if (voxels.length === 0) return null

  return {
    voxels,
    bounds: {
      width: cols,
      height: Math.max(1, ...voxels.map(voxel => voxel.y + 1)),
      length: rows,
    },
    truncated: false,
    sampled: true,
    voxelCount: voxels.length,
  }
}

export function getStructure3DPreview(preview: StructurePreviewDescriptor | null | undefined): Structure3DPreview | null {
  if (!preview) return null
  return preview.preview3d ?? synthesizeStructure3DPreview(preview)
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
