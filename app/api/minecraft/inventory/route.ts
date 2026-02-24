import { NextRequest } from 'next/server'
import { getSessionUserId, rconForRequest, getUserFeatureFlags, checkFeatureAccess } from '@/lib/rcon'
import { VALID_ITEM_IDS } from '@/lib/items'
import { Rcon } from 'rcon-client'
import { getUserById } from '@/lib/users'
import { getToken } from 'next-auth/jwt'
import { checkRateLimit } from '@/lib/ratelimit'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export type InvItem = {
  slot: number
  id: string
  label: string
  count: number
  enchants?: string
}

function itemLabel(id: string): string {
  return id.replace('minecraft:', '').split('_')
    .map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
}

const STANDARD_SLOTS = Array.from({ length: 36 }, (_, i) => i)  // 0–35
const SPECIAL_SLOTS  = [100, 101, 102, 103, 150]

function slotQuery(slot: number, player: string, field: 'id' | 'count' | 'ench'): string {
  const base = slot < 36
    ? `data get entity ${player} Inventory[${slot}]`
    : `data get entity ${player} Inventory[{Slot:${slot}b}]`
  if (field === 'id')    return `${base}.id`
  if (field === 'count') return `${base}.count`
  return `${base}.components."minecraft:enchantments".levels`
}

function parseId(stdout: string): string | null {
  const m = stdout.match(/"(minecraft:[^"]+)"/)
  return m ? m[1] : null
}

function parseCount(stdout: string): number {
  const m = stdout.match(/entity data:\s*(\d+)/)
  return m ? parseInt(m[1], 10) : 1
}

function parseEnchants(stdout: string): string | undefined {
  const m = stdout.match(/\{([^}]+)\}/)
  if (!m) return undefined
  const result = m[1]
    .split(',')
    .map(e => {
      const em = e.match(/"minecraft:(\w+)":\s*(\d+)/)
      if (!em) return null
      return `${em[1].split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')} ${em[2]}`
    })
    .filter(Boolean)
    .join(' · ')
  return result || undefined
}

// ── RCON helper scoped to inventory (uses 'inventory' rate-limit bucket) ──────

async function rconInventory(req: NextRequest, cmds: string[]): Promise<{ ok: boolean; results: string[]; error?: string }> {
  const token = await getToken({
    req,
    secret: process.env.NEXTAUTH_SECRET,
    cookieName: 'authjs.session-token',
  })
  const userId = token?.id as string | undefined
  if (!userId) return { ok: false, results: [], error: 'Not authenticated' }

  const rl = await checkRateLimit(req, 'inventory', userId)
  if (rl.limited) return { ok: false, results: [], error: 'Too many requests. Please try again later.' }

  const user = getUserById(userId)
  if (!user?.server) return { ok: false, results: [], error: 'No server configured' }

  const { host, port, password } = user.server

  // Open one RCON connection and send all commands sequentially
  const client = new Rcon({ host, port, password, timeout: 10000 })
  try {
    await client.connect()
    const results: string[] = []
    for (const cmd of cmds) {
      const raw = await client.send(cmd)
      results.push(raw.replace(/§./g, '').trim())
    }
    return { ok: true, results }
  } catch (e) {
    return { ok: false, results: [], error: e instanceof Error ? e.message : 'RCON error' }
  } finally {
    try { await client.end() } catch { /* ignore */ }
  }
}

export async function GET(req: NextRequest) {
  const userId = await getSessionUserId(req)
  if (!userId) return Response.json({ ok: false, error: 'Unauthorized' }, { status: 401 })

  const features = await getUserFeatureFlags(req)
  if (!checkFeatureAccess(features, 'enable_inventory')) {
    return Response.json({ ok: false, error: 'Feature disabled by admin' }, { status: 403 })
  }

  const player = req.nextUrl.searchParams.get('player')
  if (!player) return Response.json({ ok: false, error: 'Missing player' }, { status: 400 })
  if (!/^\.?[a-zA-Z0-9_]{1,16}$/.test(player)) {
    return Response.json({ ok: false, error: 'Invalid player name' }, { status: 400 })
  }

  try {
    const allSlots = [...STANDARD_SLOTS, ...SPECIAL_SLOTS]

    // Phase 1: fetch id + count for every slot via a single RCON connection
    const phase1Cmds = allSlots.flatMap(slot => [
      slotQuery(slot, player, 'id'),
      slotQuery(slot, player, 'count'),
    ])
    const phase1 = await rconInventory(req, phase1Cmds)
    if (!phase1.ok) {
      return Response.json({ ok: false, error: phase1.error || 'RCON error' })
    }

    type SlotData = { slot: number; id: string; count: number }
    const occupied: SlotData[] = []
    for (let i = 0; i < allSlots.length; i++) {
      const idOut    = phase1.results[i * 2]    ?? ''
      const countOut = phase1.results[i * 2 + 1] ?? ''
      if (idOut.includes('Found no elements')) continue
      const id = parseId(idOut)
      if (!id) continue
      occupied.push({ slot: allSlots[i], id, count: parseCount(countOut) })
    }

    if (occupied.length === 0) {
      return Response.json({ ok: true, items: [] })
    }

    // Phase 2: fetch enchantments for occupied slots via a single RCON connection
    const phase2Cmds = occupied.map(({ slot }) => slotQuery(slot, player, 'ench'))
    const phase2 = await rconInventory(req, phase2Cmds)
    // Enchant fetch is best-effort — don't fail the whole request if it errors

    const items: InvItem[] = occupied.map(({ slot, id, count }, i) => ({
      slot,
      id,
      label:    itemLabel(id),
      count,
      enchants: phase2.ok ? parseEnchants(phase2.results[i] ?? '') : undefined,
    }))

    return Response.json({ ok: true, items: items.sort((a, b) => a.slot - b.slot) })
  } catch (e: unknown) {
    return Response.json({ ok: false, error: e instanceof Error ? e.message : 'Server error' }, { status: 500 })
  }
}

function nbtSlotToCommandSlot(slot: number): string | null {
  if (slot >= 0 && slot <= 8)   return `hotbar.${slot}`
  if (slot >= 9 && slot <= 35)  return `inventory.${slot - 9}`
  if (slot === 100) return 'armor.feet'
  if (slot === 101) return 'armor.legs'
  if (slot === 102) return 'armor.chest'
  if (slot === 103) return 'armor.head'
  if (slot === 150) return 'weapon.offhand'
  return null
}

export async function POST(req: NextRequest) {
  const userId = await getSessionUserId(req)
  if (!userId) return Response.json({ ok: false, error: 'Unauthorized' }, { status: 401 })

  const features = await getUserFeatureFlags(req)
  if (!checkFeatureAccess(features, 'enable_inventory')) {
    return Response.json({ ok: false, error: 'Feature disabled by admin' }, { status: 403 })
  }

  try {
    const { player, fromSlot, toSlot } = await req.json()
    if (!player || fromSlot == null || toSlot == null) {
      return Response.json({ ok: false, error: 'Missing player, fromSlot, or toSlot' }, { status: 400 })
    }
    if (!/^\.?[a-zA-Z0-9_]{1,16}$/.test(player)) {
      return Response.json({ ok: false, error: 'Invalid player name' }, { status: 400 })
    }
    const src  = nbtSlotToCommandSlot(Number(fromSlot))
    const dest = nbtSlotToCommandSlot(Number(toSlot))
    if (!src || !dest) {
      return Response.json({ ok: false, error: 'Invalid slot number' }, { status: 400 })
    }
    const cmd = `item entity @a[name=${player},limit=1] ${dest} from entity @a[name=${player},limit=1] ${src}`
    const result = await rconForRequest(req, cmd)
    if (!result.ok) return Response.json({ ok: false, error: result.error || 'RCON error' })
    return Response.json({ ok: true })
  } catch (e: unknown) {
    return Response.json({ ok: false, error: e instanceof Error ? e.message : 'Server error' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  const userId = await getSessionUserId(req)
  if (!userId) return Response.json({ ok: false, error: 'Unauthorized' }, { status: 401 })

  const features = await getUserFeatureFlags(req)
  if (!checkFeatureAccess(features, 'enable_inventory')) {
    return Response.json({ ok: false, error: 'Feature disabled by admin' }, { status: 403 })
  }

  try {
    const { player, item, count } = await req.json()
    if (!player || !item) return Response.json({ ok: false, error: 'Missing player or item' }, { status: 400 })
    if (!/^\.?[a-zA-Z0-9_]{1,16}$/.test(player)) {
      return Response.json({ ok: false, error: 'Invalid player name' }, { status: 400 })
    }
    if (typeof item !== 'string' || item.length > 128) {
      return Response.json({ ok: false, error: 'Invalid item ID' }, { status: 400 })
    }
    const bareItem = item.replace(/[\[{].*$/, '')
    if (!/^(minecraft:)?[a-z][a-z0-9_]*$/.test(bareItem)) {
      return Response.json({ ok: false, error: 'Invalid item ID format' }, { status: 400 })
    }
    const clearCount = count != null ? Number(count) : undefined
    if (clearCount !== undefined && (!Number.isInteger(clearCount) || clearCount < 1 || clearCount > 64)) {
      return Response.json({ ok: false, error: 'Count must be an integer between 1 and 64' }, { status: 400 })
    }

    const cmd = clearCount !== undefined ? `clear ${player} ${bareItem} ${clearCount}` : `clear ${player} ${bareItem}`
    const result = await rconForRequest(req, cmd)

    if (!result.ok) return Response.json({ ok: false, error: result.error || 'RCON error' })
    return Response.json({ ok: true, message: `Cleared ${bareItem} from ${player}` })
  } catch (e: unknown) {
    return Response.json({ ok: false, error: e instanceof Error ? e.message : 'Server error' }, { status: 500 })
  }
}
