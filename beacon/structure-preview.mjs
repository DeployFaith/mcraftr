function blockKey(x, y, z) {
  return `${x},${y},${z}`
}

function countExposedFaces(voxelMap, voxel) {
  let exposedFaces = 0
  const neighbors = [
    [1, 0, 0],
    [-1, 0, 0],
    [0, 1, 0],
    [0, -1, 0],
    [0, 0, 1],
    [0, 0, -1],
  ]
  for (const [dx, dy, dz] of neighbors) {
    if (!voxelMap.has(blockKey(voxel.x + dx, voxel.y + dy, voxel.z + dz))) exposedFaces += 1
  }
  return exposedFaces
}

function buildSurfaceScore(voxelMap, voxel, bounds) {
  const exposedFaces = countExposedFaces(voxelMap, voxel)
  const edgeDistance = Math.min(
    voxel.x,
    voxel.z,
    Math.max(0, bounds.width - voxel.x - 1),
    Math.max(0, bounds.length - voxel.z - 1),
  )
  const perimeterBonus = edgeDistance === 0 ? 3 : edgeDistance === 1 ? 1.5 : 0
  const topBonus = bounds.height > 1 ? voxel.y / bounds.height : 0
  const cornerBonus = (voxel.x === 0 || voxel.x === bounds.width - 1) && (voxel.z === 0 || voxel.z === bounds.length - 1) ? 1.5 : 0
  return exposedFaces * 10 + perimeterBonus + topBonus + cornerBonus
}

function compareByScore(left, right) {
  if (right.score !== left.score) return right.score - left.score
  if (right.voxel.y !== left.voxel.y) return right.voxel.y - left.voxel.y
  if (left.voxel.z !== right.voxel.z) return left.voxel.z - right.voxel.z
  if (left.voxel.x !== right.voxel.x) return left.voxel.x - right.voxel.x
  return left.voxel.blockId.localeCompare(right.voxel.blockId)
}

export function selectStructurePreviewVoxels(renderable, bounds, maxVoxels = 6000) {
  if (!Array.isArray(renderable) || renderable.length === 0) return { voxels: [], sampled: false }

  const voxelMap = new Map(renderable.map(voxel => [blockKey(voxel.x, voxel.y, voxel.z), voxel]))
  const scored = renderable.map(voxel => ({
    voxel,
    score: buildSurfaceScore(voxelMap, voxel, bounds),
  }))

  const surface = scored
    .filter(entry => entry.score >= 10)
    .sort(compareByScore)

  const hidden = scored
    .filter(entry => entry.score < 10)
    .sort(compareByScore)

  const chosen = surface.slice(0, maxVoxels)
  if (chosen.length < maxVoxels && hidden.length > 0) {
    chosen.push(...hidden.slice(0, maxVoxels - chosen.length))
  }

  return {
    voxels: chosen.map(entry => entry.voxel),
    sampled: chosen.length < renderable.length,
  }
}
