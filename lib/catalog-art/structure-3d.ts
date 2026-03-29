import type { StructurePreviewDescriptor } from '@/lib/minecraft-assets/structure-art'

const MAX_STRUCTURE_3D_VOXELS = 6000

export type Structure3DVoxel = NonNullable<NonNullable<StructurePreviewDescriptor['preview3d']>['voxels']>[number]
export type Structure3DPreview = NonNullable<StructurePreviewDescriptor['preview3d']>

export type Structure3DRenderGroup = {
  blockId: string
  positions: Array<[number, number, number]>
}

export type Structure3DExtents = {
  min: [number, number, number]
  max: [number, number, number]
  size: [number, number, number]
  center: [number, number, number]
}

function normalizeBlockId(blockId: string) {
  const trimmed = blockId.trim()
  if (!trimmed) return 'minecraft:stone'
  return trimmed.includes(':') ? trimmed : `minecraft:${trimmed}`
}

export function computeStructureExtentsFromVoxels(voxels: Array<Pick<Structure3DVoxel, 'x' | 'y' | 'z'>>): Structure3DExtents {
  if (voxels.length === 0) {
    return {
      min: [0, 0, 0],
      max: [1, 1, 1],
      size: [1, 1, 1],
      center: [0.5, 0.5, 0.5],
    }
  }

  let minX = Number.POSITIVE_INFINITY
  let minY = Number.POSITIVE_INFINITY
  let minZ = Number.POSITIVE_INFINITY
  let maxX = Number.NEGATIVE_INFINITY
  let maxY = Number.NEGATIVE_INFINITY
  let maxZ = Number.NEGATIVE_INFINITY

  for (const voxel of voxels) {
    if (voxel.x < minX) minX = voxel.x
    if (voxel.y < minY) minY = voxel.y
    if (voxel.z < minZ) minZ = voxel.z
    if (voxel.x > maxX) maxX = voxel.x
    if (voxel.y > maxY) maxY = voxel.y
    if (voxel.z > maxZ) maxZ = voxel.z
  }

  const size: [number, number, number] = [maxX - minX + 1, maxY - minY + 1, maxZ - minZ + 1]
  return {
    min: [minX, minY, minZ],
    max: [maxX + 1, maxY + 1, maxZ + 1],
    size,
    center: [minX + size[0] / 2, minY + size[1] / 2, minZ + size[2] / 2],
  }
}

function clampStructure3DPreview(preview3d: Structure3DPreview): Structure3DPreview | null {
  if (!Array.isArray(preview3d.voxels) || preview3d.voxels.length === 0) return null

  const limitedVoxels = preview3d.voxels.slice(0, MAX_STRUCTURE_3D_VOXELS).map(voxel => ({
    x: Number(voxel.x) || 0,
    y: Number(voxel.y) || 0,
    z: Number(voxel.z) || 0,
    blockId: normalizeBlockId(voxel.blockId),
  }))

  if (limitedVoxels.length === 0) return null

  const extents = computeStructureExtentsFromVoxels(limitedVoxels)
  return {
    voxels: limitedVoxels,
    bounds: {
      width: extents.size[0],
      height: extents.size[1],
      length: extents.size[2],
    },
    truncated: preview3d.truncated || preview3d.voxels.length > limitedVoxels.length,
    sampled: preview3d.sampled,
    voxelCount: limitedVoxels.length,
  }
}

function synthesizeStructure3DPreview(preview: StructurePreviewDescriptor): Structure3DPreview | null {
  if (!Array.isArray(preview.cells) || preview.cells.length === 0) return null

  const rowCount = preview.cells.length
  const columnCount = Math.max(...preview.cells.map(row => row.length), 0)
  if (rowCount === 0 || columnCount === 0) return null

  const heights = Array.isArray(preview.heights) && preview.heights.length > 0 ? preview.heights : null
  const voxels: Structure3DVoxel[] = []
  let truncated = false

  for (let z = 0; z < rowCount; z += 1) {
    for (let x = 0; x < columnCount; x += 1) {
      const blockId = preview.cells[z]?.[x]
      if (!blockId || blockId === 'air') continue
      const normalizedBlockId = normalizeBlockId(blockId)
      const columnHeight = Math.max(1, Math.round(heights?.[z]?.[x] ?? 1))
      for (let y = 0; y < columnHeight; y += 1) {
        if (voxels.length >= MAX_STRUCTURE_3D_VOXELS) {
          truncated = true
          break
        }
        voxels.push({ x, y, z, blockId: normalizedBlockId })
      }
      if (truncated) break
    }
    if (truncated) break
  }

  if (voxels.length === 0) return null

  const extents = computeStructureExtentsFromVoxels(voxels)
  return {
    voxels,
    bounds: {
      width: extents.size[0],
      height: extents.size[1],
      length: extents.size[2],
    },
    truncated,
    sampled: true,
    voxelCount: voxels.length,
  }
}

export function getStructure3DPreview(preview: StructurePreviewDescriptor | null | undefined): Structure3DPreview | null {
  if (!preview) return null
  const rawPreview3d = preview.preview3d ?? synthesizeStructure3DPreview(preview)
  if (!rawPreview3d) return null
  return clampStructure3DPreview(rawPreview3d)
}

export function groupVoxelsByBlockId(preview3d: Structure3DPreview): Structure3DRenderGroup[] {
  const groups = new Map<string, Array<[number, number, number]>>()
  for (const voxel of preview3d.voxels) {
    const blockId = normalizeBlockId(voxel.blockId)
    const positions = groups.get(blockId) ?? []
    positions.push([voxel.x, voxel.y, voxel.z])
    groups.set(blockId, positions)
  }
  return Array.from(groups.entries()).map(([blockId, positions]) => ({ blockId, positions }))
}

export function computeStructureCameraTarget(preview3d: Structure3DPreview): [number, number, number] {
  return computeStructureExtentsFromVoxels(preview3d.voxels).center
}

export function computeStructureCameraDistance(preview3d: Structure3DPreview): number {
  const { size } = computeStructureExtentsFromVoxels(preview3d.voxels)
  return Math.max(8, Math.max(size[0], size[1], size[2]) * 1.85)
}

export function summarizeStructure3DMeta(preview3d: Structure3DPreview) {
  const { size } = computeStructureExtentsFromVoxels(preview3d.voxels)
  return {
    voxelCount: preview3d.voxelCount,
    truncated: preview3d.truncated,
    sampled: preview3d.sampled,
    boundsLabel: `${size[0]} × ${size[1]} × ${size[2]}`,
  }
}
