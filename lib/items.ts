/**
 * Server-side item validation.
 *
 * Derives a Set of valid item IDs from the CATALOG defined in
 * app/minecraft/items.ts so that API routes can enforce an allowlist
 * without duplicating the data.
 */
import { CATALOG } from '@/app/minecraft/items'

export const VALID_ITEM_IDS: ReadonlySet<string> = new Set(
  CATALOG.flatMap(cat => cat.items.map(i => i.id))
)
