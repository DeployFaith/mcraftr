import { randomUUID } from 'crypto'
import { getDb } from './db'

export type StructurePlacement = {
  id: string
  user_id: string
  server_id: string
  world: string
  structure_id: string
  structure_label: string
  source_kind: string
  bridge_ref: string
  origin_x: number
  origin_y: number
  origin_z: number
  rotation: number
  include_air: number
  min_x: number
  min_y: number
  min_z: number
  max_x: number
  max_y: number
  max_z: number
  metadata_json: string | null
  created_at: number
  removed_at: number | null
}

export type StructurePlacementInput = {
  userId: string
  serverId: string
  world: string
  structureId: string
  structureLabel: string
  sourceKind: string
  bridgeRef: string
  origin: { x: number; y: number; z: number }
  rotation: number
  includeAir: boolean
  bounds: {
    minX: number
    minY: number
    minZ: number
    maxX: number
    maxY: number
    maxZ: number
  }
  metadata?: Record<string, unknown> | null
}

export function createStructurePlacement(input: StructurePlacementInput): string {
  const db = getDb()
  const id = randomUUID()
  db.prepare(`
    INSERT INTO world_structure_placements (
      id, user_id, server_id, world, structure_id, structure_label, source_kind, bridge_ref,
      origin_x, origin_y, origin_z, rotation, include_air,
      min_x, min_y, min_z, max_x, max_y, max_z, metadata_json
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    input.userId,
    input.serverId,
    input.world,
    input.structureId,
    input.structureLabel,
    input.sourceKind,
    input.bridgeRef,
    input.origin.x,
    input.origin.y,
    input.origin.z,
    input.rotation,
    input.includeAir ? 1 : 0,
    input.bounds.minX,
    input.bounds.minY,
    input.bounds.minZ,
    input.bounds.maxX,
    input.bounds.maxY,
    input.bounds.maxZ,
    input.metadata ? JSON.stringify(input.metadata) : null,
  )
  return id
}

export function getStructurePlacementById(id: string, serverId?: string | null): StructurePlacement | null {
  const db = getDb()
  const row = serverId
    ? db.prepare('SELECT * FROM world_structure_placements WHERE id = ? AND server_id = ?').get(id, serverId)
    : db.prepare('SELECT * FROM world_structure_placements WHERE id = ?').get(id)
  return (row as StructurePlacement | undefined) ?? null
}

export function listStructurePlacements(serverId: string, world?: string, location?: { x: number; y: number; z: number }, limit = 100): StructurePlacement[] {
  const db = getDb()
  if (world && location) {
    return db.prepare(`
      SELECT *
      FROM world_structure_placements
      WHERE server_id = ?
        AND world = ?
        AND removed_at IS NULL
        AND ? BETWEEN min_x AND max_x
        AND ? BETWEEN min_y AND max_y
        AND ? BETWEEN min_z AND max_z
      ORDER BY created_at DESC
      LIMIT ?
    `).all(serverId, world, location.x, location.y, location.z, limit) as StructurePlacement[]
  }
  if (world) {
    return db.prepare(`
      SELECT *
      FROM world_structure_placements
      WHERE server_id = ?
        AND world = ?
        AND removed_at IS NULL
      ORDER BY created_at DESC
      LIMIT ?
    `).all(serverId, world, limit) as StructurePlacement[]
  }
  return db.prepare(`
    SELECT *
    FROM world_structure_placements
    WHERE server_id = ?
      AND removed_at IS NULL
    ORDER BY created_at DESC
    LIMIT ?
  `).all(serverId, limit) as StructurePlacement[]
}

export function listAllStructurePlacements(serverId: string, world?: string): StructurePlacement[] {
  const db = getDb()
  if (world) {
    return db.prepare(`
      SELECT *
      FROM world_structure_placements
      WHERE server_id = ?
        AND world = ?
        AND removed_at IS NULL
      ORDER BY created_at DESC
    `).all(serverId, world) as StructurePlacement[]
  }
  return db.prepare(`
    SELECT *
    FROM world_structure_placements
    WHERE server_id = ?
      AND removed_at IS NULL
    ORDER BY created_at DESC
  `).all(serverId) as StructurePlacement[]
}

export function markStructurePlacementRemoved(id: string, serverId: string): void {
  const db = getDb()
  db.prepare('UPDATE world_structure_placements SET removed_at = unixepoch() WHERE id = ? AND server_id = ?').run(id, serverId)
}
