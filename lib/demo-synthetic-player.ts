import { getDb } from '@/lib/db'
import { CATALOG } from '@/app/minecraft/items'
import type { InvItem } from '@/app/api/minecraft/inventory/route'
import { getUserByEmail, getUserById } from '@/lib/users'

const PLAYER_RE = /^\.?[a-zA-Z0-9_]{1,16}$/
const DEFAULT_PLAYER_NAME = 'demo_player'
const PRIVATE_PREFIX = ['f', 'g', 'm', 'c'].join('')
const PRIVATE_PROVIDER = ['family', 'guard'].join('')
const MAX_STACK_BY_ITEM = new Map(
  CATALOG.flatMap(category => category.items.map(item => [item.id, item.maxStack] as const)),
)

type DemoInventoryRow = {
  slot: number
  item_id: string
  count: number
  enchants: string | null
}

function itemLabel(id: string): string {
  return id.replace('minecraft:', '').split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}

function getConfiguredPlayerName() {
  const candidate = (process.env.MCRAFTR_DEMO_SYNTHETIC_PLAYER_NAME || DEFAULT_PLAYER_NAME).trim()
  return PLAYER_RE.test(candidate) ? candidate : DEFAULT_PLAYER_NAME
}

export function isDemoSyntheticEnabledForUser(userId: string | null | undefined) {
  if (!userId) return false
  const user = getUserById(userId)
  if (!user) return false
  if (process.env.MCRAFTR_ENABLE_DEMO_SYNTHETIC_PLAYER === '1') return true
  const templateEmail = (process.env.MCRAFTR_DEMO_TEMPLATE_EMAIL || 'demo@mcraftr.local').trim().toLowerCase()
  return user.isTemporary || user.email === templateEmail
}

export function getDemoSyntheticPlayerName(userId: string | null | undefined) {
  return isDemoSyntheticEnabledForUser(userId) ? getConfiguredPlayerName() : null
}

export function isDemoSyntheticPlayer(userId: string | null | undefined, player: string) {
  const configured = getDemoSyntheticPlayerName(userId)
  return Boolean(configured && player.trim() === configured)
}

function ensureSyntheticPlayer(serverId: string, playerName: string) {
  const db = getDb()
  db.prepare(`
    INSERT INTO demo_synthetic_players (server_id, player_name, joined_at, updated_at)
    VALUES (?, ?, unixepoch(), unixepoch())
    ON CONFLICT(server_id, player_name) DO UPDATE SET updated_at = unixepoch()
  `).run(serverId, playerName)
}

export function appendDemoSyntheticPlayer(userId: string, serverId: string, players: string[]) {
  const playerName = getDemoSyntheticPlayerName(userId)
  if (!playerName) return { players, playerName: null as string | null, joinedAt: null as number | null }
  ensureSyntheticPlayer(serverId, playerName)
  const db = getDb()
  const row = db.prepare(
    'SELECT joined_at FROM demo_synthetic_players WHERE server_id = ? AND player_name = ?'
  ).get(serverId, playerName) as { joined_at: number } | undefined
  const nextPlayers = players.includes(playerName) ? players : [...players, playerName]
  return { players: nextPlayers, playerName, joinedAt: row?.joined_at ? row.joined_at * 1000 : Date.now() }
}

export function getDemoSyntheticPlayerStats(userId: string, player: string) {
  if (!isDemoSyntheticPlayer(userId, player)) return null
  return {
    ok: true,
    player,
    uuid: 'f7c3a4f1-62f1-4d5d-8c1c-7f7ecf5f32a1',
    ping: 42,
    dimension: 'Overworld',
    health: 20,
    food: 20,
    xpLevel: 12,
    xpP: 0.35,
    gamemode: 'survival',
    pos: { x: 128, y: 64, z: -32 },
    spawnPos: { x: 120, y: 64, z: -40 },
  }
}

export function getDemoSyntheticEffects(userId: string, player: string) {
  if (!isDemoSyntheticPlayer(userId, player)) return null
  return { ok: true, active: [] as string[] }
}

export function getDemoSyntheticLocationError(userId: string, player: string) {
  if (!isDemoSyntheticPlayer(userId, player)) return null
  return `${player} is a shared demo player and has no live in-game location`
}

export function getDemoSyntheticCommandError(userId: string, player: string, action: string) {
  if (!isDemoSyntheticPlayer(userId, player)) return null
  return `${action} is unavailable for ${player} because it is a shared demo-only synthetic player`
}

export function getDemoSyntheticInventory(userId: string, serverId: string, player: string): InvItem[] | null {
  if (!isDemoSyntheticPlayer(userId, player)) return null
  ensureSyntheticPlayer(serverId, player)
  const db = getDb()
  const rows = db.prepare(`
    SELECT slot, item_id, count, enchants
    FROM demo_synthetic_inventory
    WHERE server_id = ? AND player_name = ?
    ORDER BY slot ASC
  `).all(serverId, player) as DemoInventoryRow[]

  return rows.map(row => ({
    slot: row.slot,
    id: row.item_id,
    label: itemLabel(row.item_id),
    count: row.count,
    enchants: row.enchants ?? undefined,
  }))
}

function persistInventory(serverId: string, player: string, items: InvItem[]) {
  const db = getDb()
  const tx = db.transaction(() => {
    db.prepare('DELETE FROM demo_synthetic_inventory WHERE server_id = ? AND player_name = ?').run(serverId, player)
    const insert = db.prepare(`
      INSERT INTO demo_synthetic_inventory (server_id, player_name, slot, item_id, count, enchants, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, unixepoch())
    `)
    for (const item of items) {
      if (item.count < 1) continue
      insert.run(serverId, player, item.slot, item.id, item.count, item.enchants ?? null)
    }
    db.prepare(`
      INSERT INTO demo_synthetic_players (server_id, player_name, joined_at, updated_at)
      VALUES (?, ?, unixepoch(), unixepoch())
      ON CONFLICT(server_id, player_name) DO UPDATE SET updated_at = unixepoch()
    `).run(serverId, player)
  })
  tx()
}

export function giveDemoSyntheticItem(userId: string, serverId: string, player: string, item: string, qty: number) {
  if (!isDemoSyntheticPlayer(userId, player)) return null
  const current = getDemoSyntheticInventory(userId, serverId, player) ?? []
  const maxStack = MAX_STACK_BY_ITEM.get(item) ?? 64
  let remaining = Math.max(1, Math.floor(qty) || 1)
  const next = [...current]

  for (const entry of next) {
    if (entry.id !== `minecraft:${item}` && entry.id !== item) continue
    if (entry.count >= maxStack) continue
    const added = Math.min(maxStack - entry.count, remaining)
    entry.count += added
    remaining -= added
    if (remaining === 0) break
  }

  const normalizedId = item.startsWith('minecraft:') ? item : `minecraft:${item}`
  for (let slot = 0; slot <= 35 && remaining > 0; slot += 1) {
    if (next.some(entry => entry.slot === slot)) continue
    const added = Math.min(maxStack, remaining)
    next.push({ slot, id: normalizedId, label: itemLabel(normalizedId), count: added })
    remaining -= added
  }

  persistInventory(serverId, player, next.sort((a, b) => a.slot - b.slot))
  return { ok: remaining === 0, given: qty - remaining, remaining }
}

export function moveDemoSyntheticInventoryItem(userId: string, serverId: string, player: string, fromSlot: number, toSlot: number) {
  if (!isDemoSyntheticPlayer(userId, player)) return null
  const items = getDemoSyntheticInventory(userId, serverId, player) ?? []
  const fromIndex = items.findIndex(item => item.slot === fromSlot)
  if (fromIndex === -1) return { ok: false as const, error: 'Source slot is empty' }
  const toIndex = items.findIndex(item => item.slot === toSlot)
  const source = { ...items[fromIndex] }

  if (toIndex === -1) {
    items[fromIndex] = { ...source, slot: toSlot }
  } else {
    const target = { ...items[toIndex] }
    const maxStack = MAX_STACK_BY_ITEM.get(source.id.replace(/^minecraft:/, '')) ?? 64
    if (target.id === source.id && target.count < maxStack) {
      const moved = Math.min(maxStack - target.count, source.count)
      items[toIndex] = { ...target, count: target.count + moved }
      const remaining = source.count - moved
      if (remaining > 0) {
        items[fromIndex] = { ...source, count: remaining }
      } else {
        items.splice(fromIndex, 1)
      }
    } else {
      items[fromIndex] = { ...target, slot: fromSlot }
      items[toIndex] = { ...source, slot: toSlot }
    }
  }

  persistInventory(serverId, player, items.sort((a, b) => a.slot - b.slot))
  return { ok: true as const }
}

export function clearDemoSyntheticInventory(
  userId: string,
  serverId: string,
  player: string,
  options: { item?: string | null; count?: number | null; slot?: number | null } = {},
) {
  if (!isDemoSyntheticPlayer(userId, player)) return null
  const items = getDemoSyntheticInventory(userId, serverId, player) ?? []

  if (options.slot != null) {
    persistInventory(serverId, player, items.filter(item => item.slot !== options.slot))
    return { ok: true as const }
  }

  if (!options.item) {
    persistInventory(serverId, player, [])
    return { ok: true as const }
  }

  const normalizedItem = options.item.startsWith('minecraft:') ? options.item : `minecraft:${options.item}`
  let remaining = options.count == null ? Number.POSITIVE_INFINITY : Math.max(1, Number(options.count) || 1)
  const next: InvItem[] = []

  for (const entry of items.sort((a, b) => a.slot - b.slot)) {
    if (entry.id !== normalizedItem || remaining <= 0) {
      next.push(entry)
      continue
    }
    if (entry.count > remaining) {
      next.push({ ...entry, count: entry.count - remaining })
      remaining = 0
      continue
    }
    remaining -= entry.count
  }

  persistInventory(serverId, player, next)
  return { ok: true as const }
}

export function adjustDemoSyntheticInventorySlot(
  userId: string,
  serverId: string,
  player: string,
  slot: number,
  mode: 'increment' | 'fill' | 'duplicate',
  amount = 1,
) {
  if (!isDemoSyntheticPlayer(userId, player)) return null
  const items = getDemoSyntheticInventory(userId, serverId, player) ?? []
  const index = items.findIndex(item => item.slot === slot)
  if (index === -1) return { ok: false as const, error: 'Selected slot is empty' }

  const target = { ...items[index] }
  const itemKey = target.id.replace(/^minecraft:/, '')
  const maxStack = MAX_STACK_BY_ITEM.get(itemKey) ?? 64

  if (mode === 'fill') {
    if (maxStack <= 1) return { ok: false as const, error: 'This item cannot be stacked' }
    items[index] = { ...target, count: maxStack }
    persistInventory(serverId, player, items)
    return { ok: true as const, message: `Filled ${target.label} to ${maxStack}` }
  }

  if (mode === 'increment') {
    if (maxStack <= 1) return { ok: false as const, error: 'This item cannot be stacked further' }
    const nextCount = Math.min(maxStack, target.count + Math.max(1, amount))
    if (nextCount === target.count) return { ok: false as const, error: `${target.label} is already at the stack limit` }
    items[index] = { ...target, count: nextCount }
    persistInventory(serverId, player, items)
    return { ok: true as const, message: `Increased ${target.label} to ${nextCount}` }
  }

  const emptySlot = Array.from({ length: 36 }, (_, current) => current).find(current => !items.some(item => item.slot === current))
  if (emptySlot == null) return { ok: false as const, error: 'No empty inventory slot is available for duplication' }
  items.push({ ...target, slot: emptySlot })
  persistInventory(serverId, player, items.sort((a, b) => a.slot - b.slot))
  return { ok: true as const, message: `Duplicated ${target.label} into slot ${emptySlot}` }
}

export function purgeDemoSyntheticDataForServer(serverId: string) {
  const db = getDb()
  const tx = db.transaction(() => {
    db.prepare('DELETE FROM demo_synthetic_inventory WHERE server_id = ?').run(serverId)
    db.prepare('DELETE FROM demo_synthetic_players WHERE server_id = ?').run(serverId)
  })
  tx()
}

export function scrubPrivateBridgeStrings() {
  const db = getDb()
  const demoTemplate = getUserByEmail((process.env.MCRAFTR_DEMO_TEMPLATE_EMAIL || 'demo@mcraftr.local').trim().toLowerCase())
  const neutralLabel = process.env.MCRAFTR_PUBLIC_BRIDGE_LABEL?.trim() || 'Server Bridge'

  const prefixLike = `%${PRIVATE_PREFIX}%`
  const providerLike = `%${PRIVATE_PROVIDER}%`

  db.prepare(`
    UPDATE saved_servers
    SET bridge_provider_label = ?
    WHERE lower(COALESCE(bridge_provider_label, '')) IN (?, ?)
  `).run(neutralLabel, PRIVATE_PROVIDER, PRIVATE_PREFIX)

  if (demoTemplate?.id) {
    db.prepare(`DELETE FROM terminal_history WHERE user_id = ? AND (
      lower(command) LIKE ? OR lower(normalized_command) LIKE ? OR lower(output_text) LIKE ? OR lower(COALESCE(output_json, '')) LIKE ? OR lower(output_text) LIKE ? OR lower(COALESCE(output_json, '')) LIKE ?
    )`).run(demoTemplate.id, prefixLike, prefixLike, prefixLike, prefixLike, providerLike, providerLike)
    db.prepare(`DELETE FROM audit_log WHERE user_id = ? AND (lower(COALESCE(target, '')) LIKE ? OR lower(COALESCE(detail, '')) LIKE ? OR lower(COALESCE(target, '')) LIKE ? OR lower(COALESCE(detail, '')) LIKE ?)`).run(demoTemplate.id, prefixLike, prefixLike, providerLike, providerLike)
  }
}
