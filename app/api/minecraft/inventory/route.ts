import { NextRequest } from 'next/server'
import { getSessionUserId, rconForRequest, getUserFeatureFlags, checkFeatureAccess } from '@/lib/rcon'
import { Rcon } from 'rcon-client'
import { CATALOG } from '@/app/minecraft/items'
import { getActiveServer, getUserById } from '@/lib/users'
import { checkRateLimit } from '@/lib/ratelimit'
import {
  adjustDemoSyntheticInventorySlot,
  clearDemoSyntheticInventory,
  getDemoSyntheticInventory,
  moveDemoSyntheticInventoryItem,
} from '@/lib/demo-synthetic-player'
import { getDemoPlayerActionError } from '@/lib/demo-policy'
import { getDemoSelfPlayerCookie } from '@/lib/demo-limits'

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
const MAX_STACK_BY_ID = new Map(
  CATALOG.flatMap(category => category.items.map(item => [`minecraft:${item.id}`, Math.max(1, item.maxStack)] as const)),
)

function nbtSlotByte(slot: number): number | null {
  if (slot >= 0 && slot <= 35) return slot
  if (slot >= 100 && slot <= 103) return slot
  if (slot === 150) return -106
  return null
}

function slotQuery(slot: number, player: string, field: 'id' | 'count' | 'ench'): string {
  const slotByte = nbtSlotByte(slot)
  if (slotByte == null) {
    throw new Error(`Unsupported slot ${slot}`)
  }
  const base = `minecraft:data get entity ${player} Inventory[{Slot:${slotByte}b}]`
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

function replaceItemCommand(player: string, slot: string, itemId: string, count: number): string {
  return `minecraft:item replace entity ${player} ${slot} with ${itemId} ${count}`
}

function getItemMaxStack(itemId: string): number {
  return MAX_STACK_BY_ID.get(itemId as `minecraft:${string}`) ?? 64
}

// ── RCON helper scoped to inventory (uses 'inventory' rate-limit bucket) ──────

async function rconInventory(req: NextRequest, cmds: string[]): Promise<{ ok: boolean; results: string[]; error?: string }> {
  const userId = await getSessionUserId(req)
  if (!userId) return { ok: false, results: [], error: 'Not authenticated' }

  const rl = await checkRateLimit(req, 'inventory', userId)
  if (rl.limited) return { ok: false, results: [], error: 'Too many requests. Please try again later.' }

  const server = getActiveServer(userId)
  if (!server) return { ok: false, results: [], error: 'No server configured' }

  const { host, port, password } = server

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
  const user = getUserById(userId)
  const restrictedError = getDemoPlayerActionError(user, player, getDemoSelfPlayerCookie(req))
  if (restrictedError) return Response.json({ ok: false, error: restrictedError }, { status: 403 })

  const server = getActiveServer(userId)
  if (!server) return Response.json({ ok: false, error: 'No server configured' }, { status: 400 })

  const synthetic = getDemoSyntheticInventory(userId, server.id, player)
  if (synthetic) {
    return Response.json({ ok: true, items: synthetic })
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
    const user = getUserById(userId)
    const restrictedError = getDemoPlayerActionError(user, player, getDemoSelfPlayerCookie(req))
    if (restrictedError) return Response.json({ ok: false, error: restrictedError }, { status: 403 })
    const src  = nbtSlotToCommandSlot(Number(fromSlot))
    const dest = nbtSlotToCommandSlot(Number(toSlot))
    if (!src || !dest) {
      return Response.json({ ok: false, error: 'Invalid slot number' }, { status: 400 })
    }

    const server = getActiveServer(userId)
    if (!server) return Response.json({ ok: false, error: 'No server configured' }, { status: 400 })
    const synthetic = moveDemoSyntheticInventoryItem(userId, server.id, player, Number(fromSlot), Number(toSlot))
    if (synthetic) {
      return synthetic.ok
        ? Response.json({ ok: true })
        : Response.json({ ok: false, error: synthetic.error }, { status: 400 })
    }

    const liveProbe = await rconInventory(req, [
      slotQuery(Number(fromSlot), player, 'id'),
      slotQuery(Number(fromSlot), player, 'count'),
      slotQuery(Number(fromSlot), player, 'ench'),
      slotQuery(Number(toSlot), player, 'id'),
      slotQuery(Number(toSlot), player, 'count'),
      slotQuery(Number(toSlot), player, 'ench'),
    ])
    if (!liveProbe.ok) {
      return Response.json({ ok: false, error: liveProbe.error || 'RCON error' }, { status: 502 })
    }

    const fromIdOut = liveProbe.results[0] ?? ''
    const fromCountOut = liveProbe.results[1] ?? ''
    const fromEnchantsOut = liveProbe.results[2] ?? ''
    const toIdOut = liveProbe.results[3] ?? ''
    const toCountOut = liveProbe.results[4] ?? ''
    const toEnchantsOut = liveProbe.results[5] ?? ''

    if (fromIdOut.includes('Found no elements')) {
      return Response.json({ ok: false, error: 'Source slot is empty' }, { status: 400 })
    }

    const fromId = parseId(fromIdOut)
    if (!fromId) {
      return Response.json({ ok: false, error: 'Could not read source slot' }, { status: 400 })
    }

    if ((toIdOut ?? '').includes('Found no elements')) {
      const copyResult = await rconForRequest(req, `minecraft:item replace entity ${player} ${dest} from entity ${player} ${src}`)
      if (!copyResult.ok) return Response.json({ ok: false, error: copyResult.error || 'RCON error' })
      const clearResult = await rconForRequest(req, `minecraft:item replace entity ${player} ${src} with air`)
      if (!clearResult.ok) return Response.json({ ok: false, error: clearResult.error || 'RCON error' })
      return Response.json({ ok: true })
    }

    const toId = parseId(toIdOut)
    if (!toId) {
      return Response.json({ ok: false, error: 'Could not read destination slot' }, { status: 400 })
    }

    const fromEnchants = parseEnchants(fromEnchantsOut)
    const toEnchants = parseEnchants(toEnchantsOut)
    if (fromId !== toId || fromEnchants || toEnchants) {
      return Response.json({ ok: false, error: 'Live inventory combining only works for matching plain items right now.' }, { status: 400 })
    }

    const maxStack = getItemMaxStack(fromId)
    const fromCount = parseCount(fromCountOut)
    const toCount = parseCount(toCountOut)
    const mergedCount = Math.min(maxStack, fromCount + toCount)
    const remainder = Math.max(0, (fromCount + toCount) - mergedCount)

    const mergeTargetResult = await rconForRequest(req, replaceItemCommand(player, dest, fromId, mergedCount))
    if (!mergeTargetResult.ok) return Response.json({ ok: false, error: mergeTargetResult.error || 'RCON error' })

    const sourceResult = remainder > 0
      ? await rconForRequest(req, replaceItemCommand(player, src, fromId, remainder))
      : await rconForRequest(req, `minecraft:item replace entity ${player} ${src} with air`)
    if (!sourceResult.ok) return Response.json({ ok: false, error: sourceResult.error || 'RCON error' })

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
    const { player, item, count, slot } = await req.json()
    if (!player) return Response.json({ ok: false, error: 'Missing player' }, { status: 400 })
    if (!/^\.?[a-zA-Z0-9_]{1,16}$/.test(player)) {
      return Response.json({ ok: false, error: 'Invalid player name' }, { status: 400 })
    }
    const user = getUserById(userId)
    const restrictedError = getDemoPlayerActionError(user, player, getDemoSelfPlayerCookie(req))
    if (restrictedError) return Response.json({ ok: false, error: restrictedError }, { status: 403 })
    const server = getActiveServer(userId)
    if (!server) return Response.json({ ok: false, error: 'No server configured' }, { status: 400 })
    const synthetic = clearDemoSyntheticInventory(userId, server.id, player, {
      item: typeof item === 'string' ? item : null,
      count: typeof count === 'number' ? count : null,
      slot: typeof slot === 'number' ? slot : null,
    })
    if (synthetic) {
      if (!item) return Response.json({ ok: true, message: `Cleared inventory for ${player}` })
      if (slot != null) return Response.json({ ok: true, message: `Cleared slot ${slot} for ${player}` })
      return Response.json({ ok: true, message: `Cleared ${item} from ${player}` })
    }

    if (!item) {
      const result = await rconForRequest(req, `minecraft:clear ${player}`)
      if (!result.ok) return Response.json({ ok: false, error: result.error || 'RCON error' })
      return Response.json({ ok: true, message: `Cleared inventory for ${player}` })
    }
    if (slot != null) {
      const commandSlot = nbtSlotToCommandSlot(Number(slot))
      if (!commandSlot) {
        return Response.json({ ok: false, error: 'Invalid slot number' }, { status: 400 })
      }
      const result = await rconForRequest(
        req,
        `minecraft:item replace entity ${player} ${commandSlot} with air`
      )
      if (!result.ok) return Response.json({ ok: false, error: result.error || 'RCON error' })
      return Response.json({ ok: true, message: `Cleared slot ${slot} for ${player}` })
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

    const cmd = clearCount !== undefined
      ? `minecraft:clear ${player} ${bareItem} ${clearCount}`
      : `minecraft:clear ${player} ${bareItem}`
    const result = await rconForRequest(req, cmd)

    if (!result.ok) return Response.json({ ok: false, error: result.error || 'RCON error' })
    return Response.json({ ok: true, message: `Cleared ${bareItem} from ${player}` })
  } catch (e: unknown) {
    return Response.json({ ok: false, error: e instanceof Error ? e.message : 'Server error' }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  const userId = await getSessionUserId(req)
  if (!userId) return Response.json({ ok: false, error: 'Unauthorized' }, { status: 401 })

  const features = await getUserFeatureFlags(req)
  if (!checkFeatureAccess(features, 'enable_inventory')) {
    return Response.json({ ok: false, error: 'Feature disabled by admin' }, { status: 403 })
  }

  try {
    const { player, slot, mode, amount } = await req.json()
    if (!player || typeof player !== 'string') return Response.json({ ok: false, error: 'Missing player' }, { status: 400 })
    if (!/^\.?[a-zA-Z0-9_]{1,16}$/.test(player)) return Response.json({ ok: false, error: 'Invalid player name' }, { status: 400 })
    if (typeof slot !== 'number') return Response.json({ ok: false, error: 'Missing slot' }, { status: 400 })
    if (!['increment', 'fill', 'duplicate'].includes(mode)) return Response.json({ ok: false, error: 'Invalid inventory action' }, { status: 400 })

    const user = getUserById(userId)
    const restrictedError = getDemoPlayerActionError(user, player, getDemoSelfPlayerCookie(req))
    if (restrictedError) return Response.json({ ok: false, error: restrictedError }, { status: 403 })

    const server = getActiveServer(userId)
    if (!server) return Response.json({ ok: false, error: 'No server configured' }, { status: 400 })

    const synthetic = adjustDemoSyntheticInventorySlot(userId, server.id, player, slot, mode, typeof amount === 'number' ? amount : 1)
    if (synthetic) {
      return synthetic.ok
        ? Response.json({ ok: true, message: synthetic.message })
        : Response.json({ ok: false, error: synthetic.error }, { status: 400 })
    }

    const probe = await rconInventory(req, [
      slotQuery(slot, player, 'id'),
      slotQuery(slot, player, 'count'),
      slotQuery(slot, player, 'ench'),
    ])
    if (!probe.ok) return Response.json({ ok: false, error: probe.error || 'RCON error' }, { status: 502 })
    const slotIdOut = probe.results[0] ?? ''
    if (slotIdOut.includes('Found no elements')) return Response.json({ ok: false, error: 'Selected slot is empty' }, { status: 400 })
    const slotId = parseId(slotIdOut)
    if (!slotId) return Response.json({ ok: false, error: 'Could not read selected slot' }, { status: 400 })
    const slotCount = parseCount(probe.results[1] ?? '')
    const slotEnchants = parseEnchants(probe.results[2] ?? '')
    const maxStack = getItemMaxStack(slotId)
    const commandSlot = nbtSlotToCommandSlot(slot)
    if (!commandSlot) return Response.json({ ok: false, error: 'Unsupported slot' }, { status: 400 })

    if (mode === 'duplicate') {
      const allSlots = [...STANDARD_SLOTS, ...SPECIAL_SLOTS]
      const idCmds = allSlots.map(current => slotQuery(current, player, 'id'))
      const occupied = await rconInventory(req, idCmds)
      if (!occupied.ok) return Response.json({ ok: false, error: occupied.error || 'RCON error' }, { status: 502 })
      const emptySlot = allSlots.find((current, index) => (occupied.results[index] ?? '').includes('Found no elements'))
      if (emptySlot == null) return Response.json({ ok: false, error: 'No empty inventory slot is available for duplication' }, { status: 400 })
      const emptyCommandSlot = nbtSlotToCommandSlot(emptySlot)
      if (!emptyCommandSlot) return Response.json({ ok: false, error: 'No compatible slot is available for duplication' }, { status: 400 })
      const result = await rconForRequest(req, `minecraft:item replace entity ${player} ${emptyCommandSlot} from entity ${player} ${commandSlot}`)
      if (!result.ok) return Response.json({ ok: false, error: result.error || 'RCON error' }, { status: 502 })
      return Response.json({ ok: true, message: `Duplicated ${itemLabel(slotId)} into slot ${emptySlot}` })
    }

    if (maxStack <= 1) {
      return Response.json({ ok: false, error: 'This item cannot be stacked further' }, { status: 400 })
    }
    if (slotEnchants) {
      return Response.json({ ok: false, error: 'Stack size adjustments are only supported for plain items right now.' }, { status: 400 })
    }

    const nextCount = mode === 'fill'
      ? maxStack
      : Math.min(maxStack, slotCount + Math.max(1, Number(amount) || 1))
    if (nextCount === slotCount) {
      return Response.json({ ok: false, error: `${itemLabel(slotId)} is already at the stack limit` }, { status: 400 })
    }

    const result = await rconForRequest(req, replaceItemCommand(player, commandSlot, slotId, nextCount))
    if (!result.ok) return Response.json({ ok: false, error: result.error || 'RCON error' }, { status: 502 })
    return Response.json({ ok: true, message: `Updated ${itemLabel(slotId)} to ${nextCount}` })
  } catch (e: unknown) {
    return Response.json({ ok: false, error: e instanceof Error ? e.message : 'Server error' }, { status: 500 })
  }
}
