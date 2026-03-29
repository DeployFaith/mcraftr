import { NextRequest } from 'next/server'
import { VALID_ITEM_IDS } from '@/lib/items'
import { resolveItemCatalogArtEntry } from '@/lib/catalog-art/item-catalog'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const MAX_ITEM_IDS = 96

function sanitizeVersion(raw: string | null) {
  return raw && /^[A-Za-z0-9._-]+$/.test(raw) ? raw : null
}

function labelFromItemId(itemId: string) {
  return itemId
    .split('_')
    .filter(Boolean)
    .map(segment => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(' ')
}

function parseItemIds(raw: string | null) {
  if (!raw) return []
  return Array.from(new Set(raw
    .split(',')
    .map(value => value.trim())
    .filter(Boolean)
    .filter(value => VALID_ITEM_IDS.has(value))))
}

export async function GET(req: NextRequest) {
  const version = sanitizeVersion(req.nextUrl.searchParams.get('version'))
  const itemIds = parseItemIds(req.nextUrl.searchParams.get('ids')).slice(0, MAX_ITEM_IDS)

  if (!version) {
    return Response.json({ ok: false, error: 'version is required' }, { status: 400 })
  }
  if (itemIds.length === 0) {
    return Response.json({ ok: false, error: 'at least one valid item id is required' }, { status: 400 })
  }

  const items = await Promise.all(itemIds.map(itemId => resolveItemCatalogArtEntry({
    version,
    itemId,
    label: labelFromItemId(itemId),
  })))

  return Response.json({ ok: true, items })
}
