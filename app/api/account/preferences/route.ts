import { NextRequest } from 'next/server'
import { getUserFeatures, updateUserFeatures, getUserById } from '@/lib/users'
import { getSessionUserId } from '@/lib/rcon'
import { FEATURE_KEYS, type FeatureKey } from '@/lib/features'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const userId = await getSessionUserId(req)
  if (!userId) {
    return Response.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
  }

  const features = getUserFeatures(userId)
  return Response.json({ ok: true, features })
}

export async function PUT(req: NextRequest) {
  const userId = await getSessionUserId(req)
  if (!userId) {
    return Response.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
  }

  const user = getUserById(userId)
  if (!user) {
    return Response.json({ ok: false, error: 'User not found' }, { status: 404 })
  }

  const body = await req.json()

  const updates: Partial<Record<FeatureKey, boolean>> = {}
  for (const field of FEATURE_KEYS) {
    if (body[field] !== undefined) {
      updates[field] = !!body[field]
    }
  }

  if (Object.keys(updates).length === 0) {
    return Response.json({ ok: false, error: 'No valid fields to update' }, { status: 400 })
  }

  updateUserFeatures(userId, updates)
  return Response.json({ ok: true, features: getUserFeatures(userId) })
}
