import type { NextRequest } from 'next/server'
import { rconForRequest } from '@/lib/rcon'
import { CATALOG } from '@/app/minecraft/items'

const MAX_STACK_BATCHES = 36
const MAX_STACK_BY_ITEM = new Map(
  CATALOG.flatMap(category => category.items.map(item => [item.id, item.maxStack] as const))
)

export async function giveItemViaRcon(req: NextRequest, player: string, item: string, qty: number) {
  const maxStack = MAX_STACK_BY_ITEM.get(item) ?? 64
  const maxTotal = Math.max(1, maxStack * MAX_STACK_BATCHES)
  let remaining = Math.max(1, Math.min(maxTotal, Math.floor(qty) || 1))
  let given = 0

  while (remaining > 0) {
    const chunk = Math.min(maxStack, remaining)
    const result = await rconForRequest(req, `give ${player} minecraft:${item} ${chunk}`)
    if (!result.ok) {
      const detail = result.error || 'RCON failed'
      const prefix = given > 0 ? `Only gave ${given}× ${item} before failure. ` : ''
      return { ok: false as const, error: prefix + detail, given }
    }
    given += chunk
    remaining -= chunk
  }

  return { ok: true as const, given }
}
