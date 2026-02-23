import { NextRequest } from 'next/server'
import { rconForRequest, getSessionUserId } from '@/lib/rcon'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Minecraft player names: letters, digits, underscores; optional leading dot for Bedrock/Geyser
const PLAYER_RE = /^\.?[a-zA-Z0-9_]{1,16}$/

const GAMEMODES: Record<number, string> = {
  0: 'survival',
  1: 'creative',
  2: 'adventure',
  3: 'spectator',
}

const DIMENSIONS: Record<string, string> = {
  'minecraft:overworld':  'Overworld',
  'minecraft:the_nether': 'Nether',
  'minecraft:the_end':    'The End',
}

// ── NBT parsers ───────────────────────────────────────────────────────────────

function parseFloat1(stdout: string): number | null {
  // e.g. "... has the following entity data: 18.0f"
  const m = stdout.match(/([\d.]+)f?\s*$/)
  return m ? parseFloat(m[1]) : null
}

function parseInt1(stdout: string): number | null {
  const m = stdout.match(/(-?\d+)\s*$/)
  return m ? parseInt(m[1]) : null
}

function parsePos(stdout: string): { x: number; y: number; z: number } | null {
  // e.g. "... [142.3d, 64.0d, -88.7d]"
  const m = stdout.match(/\[\s*([-\d.]+)d?,\s*([-\d.]+)d?,\s*([-\d.]+)d?\s*\]/)
  if (!m) return null
  const x = parseFloat(m[1])
  const y = parseFloat(m[2])
  const z = parseFloat(m[3])
  if (!isFinite(x) || !isFinite(y) || !isFinite(z)) return null
  return { x, y, z }
}

function parseGamemode(stdout: string): string | null {
  const m = stdout.match(/(-?\d+)\s*$/)
  if (!m) return null
  const n = parseInt(m[1])
  return GAMEMODES[n] ?? null
}

function parseDimension(stdout: string): string | null {
  // e.g. '... has the following entity data: "minecraft:overworld"'
  const m = stdout.match(/"(minecraft:[a-z_:]+)"/)
  if (!m) return null
  return DIMENSIONS[m[1]] ?? m[1].replace('minecraft:', '').replace(/_/g, ' ')
}

function parseSpawnPos(xOut: string, yOut: string, zOut: string): { x: number; y: number; z: number } | null {
  const x = parseInt1(xOut)
  const y = parseInt1(yOut)
  const z = parseInt1(zOut)
  if (x === null || y === null || z === null) return null
  return { x, y, z }
}

// UUID comes back as NBT int-array: "[I;-123456789, 987654321, -111, 222]"
// Each element is a signed 32-bit int; we convert to hex and concatenate.
function parseUuid(stdout: string): string | null {
  const m = stdout.match(/\[I;\s*([-\d]+),\s*([-\d]+),\s*([-\d]+),\s*([-\d]+)\s*\]/)
  if (!m) return null
  const parts = [m[1], m[2], m[3], m[4]].map(s => {
    const n = parseInt(s, 10)
    // convert signed int32 to unsigned 32-bit hex, zero-padded to 8 chars
    return (n >>> 0).toString(16).padStart(8, '0')
  })
  // Standard UUID format: 8-4-4-4-12
  const hex = parts.join('')
  return `${hex.slice(0,8)}-${hex.slice(8,12)}-${hex.slice(12,16)}-${hex.slice(16,20)}-${hex.slice(20,32)}`
}

// ── Route ─────────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  if (!await getSessionUserId(req)) return Response.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
  const player = req.nextUrl.searchParams.get('player')
  if (!player) {
    return Response.json({ ok: false, error: 'Missing player' }, { status: 400 })
  }
  if (!PLAYER_RE.test(player)) {
    return Response.json({ ok: false, error: 'Invalid player name' }, { status: 400 })
  }

  // Fire all queries in parallel — allSettled so each field degrades independently
  const [
    healthRes, foodRes, xpLevelRes, xpPRes, gamemodeRes, posRes,
    dimensionRes, pingRes, spawnXRes, spawnYRes, spawnZRes, uuidRes,
  ] = await Promise.allSettled([
    rconForRequest(req, `data get entity ${player} Health`),
    rconForRequest(req, `data get entity ${player} FoodLevel`),
    rconForRequest(req, `data get entity ${player} XpLevel`),
    rconForRequest(req, `data get entity ${player} XpP`),
    rconForRequest(req, `data get entity ${player} playerGameType`),
    rconForRequest(req, `data get entity ${player} Pos`),
    rconForRequest(req, `data get entity ${player} Dimension`),
    rconForRequest(req, `data get entity ${player} latency`),   // Paper/Spigot only; null on vanilla
    rconForRequest(req, `data get entity ${player} SpawnX`),
    rconForRequest(req, `data get entity ${player} SpawnY`),
    rconForRequest(req, `data get entity ${player} SpawnZ`),
    rconForRequest(req, `data get entity ${player} UUID`),
  ])

  const stdout = (r: PromiseSettledResult<{ ok: boolean; stdout: string }>) =>
    r.status === 'fulfilled' && r.value.ok ? r.value.stdout : ''

  const health    = parseFloat1(stdout(healthRes))
  const food      = parseInt1(stdout(foodRes))
  const xpLevel   = parseInt1(stdout(xpLevelRes))
  const xpP       = parseFloat1(stdout(xpPRes))
  const gamemode  = parseGamemode(stdout(gamemodeRes))
  const pos       = parsePos(stdout(posRes))
  const dimension = parseDimension(stdout(dimensionRes))
  const ping      = parseInt1(stdout(pingRes))   // null on vanilla servers
  const spawnPos  = parseSpawnPos(stdout(spawnXRes), stdout(spawnYRes), stdout(spawnZRes))
  const uuid      = parseUuid(stdout(uuidRes))   // null on parse failure

  // All null → player is offline or unreachable
  const allNull = [health, food, xpLevel, xpP, gamemode, pos, dimension].every(v => v === null)
  if (allNull) {
    return Response.json(
      { ok: false, error: `${player} is offline or data unavailable` },
      { status: 404 }
    )
  }

  return Response.json({
    ok: true,
    player,
    uuid,       // standard UUID string | null
    ping,       // ms | null (Paper/Spigot only)
    dimension,  // 'Overworld' | 'Nether' | 'The End' | null
    health,     // float 0–20
    food,       // int 0–20
    xpLevel,    // int
    xpP,        // float 0–1
    gamemode,   // string | null
    pos,        // { x, y, z } | null — current position
    spawnPos,   // { x, y, z } | null — bed/anchor spawn
  })
}
