export function shouldUseStructureVoxelPreview(type: 'structure' | 'entity' | 'item', voxelData: { voxels?: unknown[] } | null | undefined) {
  return type === 'structure' && Boolean(voxelData?.voxels?.length)
}
