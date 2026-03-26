import { rconDirect, type RconResult } from './rcon-client'

export type PlacementKind = 'entity' | 'structure'
export type PlacementCheckStatus = 'good' | 'warn' | 'bad'

export type PlacementCheckResult = {
  ok: boolean
  status: PlacementCheckStatus
  x: number
  y: number
  z: number
  message: string
  details?: string[]
}

type PlacementContext = {
  host: string
  port: number
  password: string
  world: string
  kind: PlacementKind
  anchorX?: number | null
  anchorY?: number | null
  anchorZ?: number | null
  width?: number
  height?: number
  length?: number
  rotation?: number
}

const MIN_Y = -32
const MAX_Y = 160
const SURFACE_SCAN_STEP = 8
const RANDOM_ATTEMPTS = 30

function normalizedFootprint(width: number, length: number, rotation: number) {
  if (rotation === 90 || rotation === 270) {
    return { width: Math.max(1, length), length: Math.max(1, width) }
  }
  return { width: Math.max(1, width), length: Math.max(1, length) }
}

function candidateCoords(anchorX: number, anchorZ: number) {
  const radius = 8 + Math.floor(Math.random() * 48)
  const angle = Math.random() * Math.PI * 2
  return {
    x: Math.round(anchorX + Math.cos(angle) * radius),
    z: Math.round(anchorZ + Math.sin(angle) * radius),
  }
}

function fallbackCandidate(x: number, y: number, z: number, message: string, details: string[]): PlacementCheckResult {
  return {
    ok: true,
    status: 'warn',
    x,
    y,
    z,
    message,
    details,
  }
}

function isCommandTruthy(result: RconResult) {
  if (!result.ok) return false
  return !/test failed/i.test(result.stdout)
}

async function probeBlock(host: string, port: number, password: string, world: string, x: number, y: number, z: number, block: string) {
  return rconDirect(host, port, password, `execute in ${world} if block ${x} ${y} ${z} ${block} run time query daytime`)
}

async function blockIsAir(host: string, port: number, password: string, world: string, x: number, y: number, z: number) {
  return isCommandTruthy(await probeBlock(host, port, password, world, x, y, z, 'minecraft:air'))
}

async function blockIsLiquid(host: string, port: number, password: string, world: string, x: number, y: number, z: number) {
  const [water, lava] = await Promise.all([
    probeBlock(host, port, password, world, x, y, z, 'minecraft:water'),
    probeBlock(host, port, password, world, x, y, z, 'minecraft:lava'),
  ])
  return isCommandTruthy(water) || isCommandTruthy(lava)
}

async function surfaceY(host: string, port: number, password: string, world: string, x: number, z: number) {
  let coarseY: number | null = null
  for (let y = MAX_Y; y >= MIN_Y; y -= SURFACE_SCAN_STEP) {
    const belowAir = await blockIsAir(host, port, password, world, x, y - 1, z)
    const hereAir = await blockIsAir(host, port, password, world, x, y, z)
    const headAir = await blockIsAir(host, port, password, world, x, y + 1, z)
    if (!belowAir && hereAir && headAir) {
      coarseY = y
      break
    }
  }
  if (coarseY === null) return null
  for (let y = coarseY + SURFACE_SCAN_STEP; y >= coarseY - SURFACE_SCAN_STEP; y -= 1) {
    const belowAir = await blockIsAir(host, port, password, world, x, y - 1, z)
    const hereAir = await blockIsAir(host, port, password, world, x, y, z)
    const headAir = await blockIsAir(host, port, password, world, x, y + 1, z)
    if (!belowAir && hereAir && headAir) {
      return y
    }
  }
  return coarseY
}

async function scoreEntityPlacement(context: PlacementContext, x: number, y: number, z: number): Promise<PlacementCheckResult> {
  const details: string[] = []
  const onGround = !(await blockIsAir(context.host, context.port, context.password, context.world, x, y - 1, z))
  const bodyAir = await blockIsAir(context.host, context.port, context.password, context.world, x, y, z)
  const headAir = await blockIsAir(context.host, context.port, context.password, context.world, x, y + 1, z)
  const liquid = await blockIsLiquid(context.host, context.port, context.password, context.world, x, y, z)

  if (!onGround) details.push('No stable ground detected beneath the target position.')
  if (!bodyAir || !headAir) details.push('Not enough open air at the spawn point.')
  if (liquid) details.push('The target position is inside liquid.')
  if (y > 120) details.push('This spot is unusually high and may be exposed in the sky.')

  if (details.length === 0) {
    return { ok: true, status: 'good', x, y, z, message: 'Good candidate: stable ground and open space detected.' }
  }

  return {
    ok: true,
    status: details.some(item => item.includes('Not enough open air')) ? 'bad' : 'warn',
    x,
    y,
    z,
    message: details.some(item => item.includes('Not enough open air'))
      ? 'This spot looks unsafe for entity placement. Try Randomize Again.'
      : 'This spot may need review before spawning the entity.',
    details,
  }
}

async function scoreStructurePlacement(context: PlacementContext, x: number, y: number, z: number): Promise<PlacementCheckResult> {
  const width = context.width ?? 1
  const height = context.height ?? 1
  const length = context.length ?? 1
  const footprint = normalizedFootprint(width, length, context.rotation ?? 0)
  const corners = [
    [x, z],
    [x + footprint.width - 1, z],
    [x, z + footprint.length - 1],
    [x + footprint.width - 1, z + footprint.length - 1],
  ] as const
  const details: string[] = []

  for (const [cornerX, cornerZ] of corners) {
    const supportAir = await blockIsAir(context.host, context.port, context.password, context.world, cornerX, y - 1, cornerZ)
    if (supportAir) {
      details.push('Part of the structure footprint does not have solid support below it.')
      break
    }
  }

  const checkPoints = [
    [x, z],
    [x + Math.max(0, Math.floor(footprint.width / 2)), z + Math.max(0, Math.floor(footprint.length / 2))],
    [x + footprint.width - 1, z + footprint.length - 1],
  ] as const

  for (const [checkX, checkZ] of checkPoints) {
    const blockedBody = !(await blockIsAir(context.host, context.port, context.password, context.world, checkX, y, checkZ))
    const blockedHead = !(await blockIsAir(context.host, context.port, context.password, context.world, checkX, y + Math.max(1, Math.min(height - 1, 4)), checkZ))
    if (blockedBody || blockedHead) {
      details.push('The placement volume looks obstructed by existing blocks.')
      break
    }
  }

  if (y > 120) details.push('This placement is high above the world and may float in the sky.')

  if (details.length === 0) {
    return { ok: true, status: 'good', x, y, z, message: 'Good candidate: support and clearance look reasonable for placement.' }
  }

  return {
    ok: true,
    status: details.some(item => item.includes('obstructed')) ? 'bad' : 'warn',
    x,
    y,
    z,
    message: details.some(item => item.includes('obstructed'))
      ? 'This spot looks unsafe for the structure footprint. Try Randomize Again.'
      : 'This structure placement may need review before you confirm.',
    details,
  }
}

export async function validatePlacementCoordinates(context: PlacementContext, x: number, y: number, z: number) {
  if (context.kind === 'entity') {
    return scoreEntityPlacement(context, x, y, z)
  }
  return scoreStructurePlacement(context, x, y, z)
}

export async function randomizePlacementCoordinates(context: PlacementContext): Promise<PlacementCheckResult> {
  const anchorX = context.anchorX ?? 0
  const anchorY = context.anchorY ?? 64
  const anchorZ = context.anchorZ ?? 0
  let fallback: PlacementCheckResult | null = null

  for (let attempt = 0; attempt < RANDOM_ATTEMPTS; attempt += 1) {
    const candidate = candidateCoords(anchorX, anchorZ)
    const y = await surfaceY(context.host, context.port, context.password, context.world, candidate.x, candidate.z)
    if (y === null) {
      fallback = fallback ?? fallbackCandidate(
        candidate.x,
        anchorY,
        candidate.z,
        'Mcraftr found a nearby candidate but could not confirm the ground height quickly. Review the coordinates before placing.',
        ['Surface probing was inconclusive for this location.'],
      )
      continue
    }
    const scored = await validatePlacementCoordinates(context, candidate.x, y, candidate.z)
    if (scored.status === 'good') return scored
    if (!fallback) {
      fallback = scored
      continue
    }
    if (fallback.status === 'bad' && scored.status !== 'bad') {
      fallback = scored
      continue
    }
    if (fallback.status === scored.status) {
      const fallbackDistance = Math.abs(fallback.x - anchorX) + Math.abs(fallback.z - anchorZ)
      const scoredDistance = Math.abs(scored.x - anchorX) + Math.abs(scored.z - anchorZ)
      if (scoredDistance < fallbackDistance) {
        fallback = scored
      }
    }
  }

  if (fallback) return fallback

  const emergency = candidateCoords(anchorX, anchorZ)
  return fallbackCandidate(
    emergency.x,
    anchorY,
    emergency.z,
    'Mcraftr could not find a clearly safer randomized spot quickly. It picked a nearby best-effort location you should review before placing.',
    ['No candidate passed the fast placement checks.'],
  )
}
