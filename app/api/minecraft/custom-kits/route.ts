import crypto from 'crypto'
import { NextRequest } from 'next/server'
import { getSessionUserId, getUserFeatureFlags, checkFeatureAccess } from '@/lib/rcon'
import { getDb } from '@/lib/db'
import { VALID_ITEM_IDS } from '@/lib/items'
import {
  CUSTOM_KIT_CUSTOM_ICON_MAX_BYTES,
  CUSTOM_KIT_ITEM_MAX,
  estimateDataUrlBytes,
  isCustomIconDataUrl,
  isCustomKitIconId,
  normalizeCustomKitLabel,
  type CustomKitIconType,
  type CustomKitItem,
  type CustomKitRecord,
} from '@/lib/custom-kits'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type KitRow = {
  id: string
  label: string
  icon_type: string
  icon_value: string
  items_json: string
  created_at: number
  updated_at: number
}

function parseItems(raw: unknown): CustomKitItem[] | null {
  if (!Array.isArray(raw) || raw.length === 0 || raw.length > CUSTOM_KIT_ITEM_MAX) return null
  const items: CustomKitItem[] = []
  for (const entry of raw) {
    if (!entry || typeof entry !== 'object') return null
    const itemId = typeof entry.itemId === 'string' ? entry.itemId : ''
    const qty = Number((entry as { qty?: unknown }).qty)
    if (!VALID_ITEM_IDS.has(itemId)) return null
    if (!Number.isFinite(qty) || qty < 1 || qty > 2304) return null
    items.push({ itemId, qty: Math.floor(qty) })
  }
  return items
}

function parseRow(row: KitRow): CustomKitRecord {
  return {
    id: row.id,
    label: row.label,
    iconType: row.icon_type as CustomKitIconType,
    iconValue: row.icon_value,
    items: JSON.parse(row.items_json) as CustomKitItem[],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function validateIcon(iconType: unknown, iconValue: unknown) {
  if (iconType !== 'preset' && iconType !== 'custom') return 'Invalid icon type'
  if (typeof iconValue !== 'string' || !iconValue.trim()) return 'Icon is required'
  if (iconType === 'preset' && !isCustomKitIconId(iconValue)) return 'Unknown preset icon'
  if (iconType === 'custom') {
    if (!isCustomIconDataUrl(iconValue)) return 'Custom icon must be a processed PNG'
    if (estimateDataUrlBytes(iconValue) > CUSTOM_KIT_CUSTOM_ICON_MAX_BYTES) return 'Custom icon is too large'
  }
  return null
}

async function requireAccess(req: NextRequest) {
  const userId = await getSessionUserId(req)
  if (!userId) return { error: Response.json({ ok: false, error: 'Unauthorized' }, { status: 401 }) }
  const features = await getUserFeatureFlags(req)
  if (!checkFeatureAccess(features, 'enable_kits') || !checkFeatureAccess(features, 'enable_custom_kits')) {
    return { error: Response.json({ ok: false, error: 'Feature disabled by admin' }, { status: 403 }) }
  }
  return { userId }
}

export async function GET(req: NextRequest) {
  const access = await requireAccess(req)
  if (access.error) return access.error

  const rows = getDb().prepare(`
    SELECT id, label, icon_type, icon_value, items_json, created_at, updated_at
    FROM custom_kits
    WHERE user_id = ?
    ORDER BY updated_at DESC, created_at DESC
  `).all(access.userId) as KitRow[]

  return Response.json({ ok: true, kits: rows.map(parseRow) })
}

export async function POST(req: NextRequest) {
  const access = await requireAccess(req)
  if (access.error) return access.error

  try {
    const body = await req.json()
    const label = normalizeCustomKitLabel(typeof body.label === 'string' ? body.label : '')
    if (!label) return Response.json({ ok: false, error: 'Kit name is required' }, { status: 400 })

    const iconError = validateIcon(body.iconType, body.iconValue)
    if (iconError) return Response.json({ ok: false, error: iconError }, { status: 400 })

    const items = parseItems(body.items)
    if (!items) return Response.json({ ok: false, error: 'Kit items are invalid' }, { status: 400 })

    const id = crypto.randomUUID()
    const db = getDb()
    db.prepare(`
      INSERT INTO custom_kits (id, user_id, label, icon_type, icon_value, items_json, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, unixepoch(), unixepoch())
    `).run(id, access.userId, label, body.iconType, body.iconValue, JSON.stringify(items))

    const row = db.prepare(`
      SELECT id, label, icon_type, icon_value, items_json, created_at, updated_at
      FROM custom_kits
      WHERE id = ? AND user_id = ?
    `).get(id, access.userId) as KitRow

    return Response.json({ ok: true, kit: parseRow(row) })
  } catch (e: unknown) {
    return Response.json({ ok: false, error: e instanceof Error ? e.message : 'Server error' }, { status: 500 })
  }
}
