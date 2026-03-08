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
  type CustomKitItem,
} from '@/lib/custom-kits'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

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

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const access = await requireAccess(req)
  if (access.error) return access.error

  try {
    const { id } = await params
    const body = await req.json()
    const label = normalizeCustomKitLabel(typeof body.label === 'string' ? body.label : '')
    if (!label) return Response.json({ ok: false, error: 'Kit name is required' }, { status: 400 })

    const iconError = validateIcon(body.iconType, body.iconValue)
    if (iconError) return Response.json({ ok: false, error: iconError }, { status: 400 })

    const items = parseItems(body.items)
    if (!items) return Response.json({ ok: false, error: 'Kit items are invalid' }, { status: 400 })

    const result = getDb().prepare(`
      UPDATE custom_kits
      SET label = ?, icon_type = ?, icon_value = ?, items_json = ?, updated_at = unixepoch()
      WHERE id = ? AND user_id = ?
    `).run(label, body.iconType, body.iconValue, JSON.stringify(items), id, access.userId)

    if (result.changes === 0) {
      return Response.json({ ok: false, error: 'Kit not found' }, { status: 404 })
    }

    return Response.json({ ok: true })
  } catch (e: unknown) {
    return Response.json({ ok: false, error: e instanceof Error ? e.message : 'Server error' }, { status: 500 })
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const access = await requireAccess(req)
  if (access.error) return access.error

  const { id } = await params
  const result = getDb().prepare('DELETE FROM custom_kits WHERE id = ? AND user_id = ?').run(id, access.userId)
  if (result.changes === 0) {
    return Response.json({ ok: false, error: 'Kit not found' }, { status: 404 })
  }
  return Response.json({ ok: true })
}
