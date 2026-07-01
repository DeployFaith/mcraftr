import { NextRequest } from 'next/server'
import { getUserFeatures, getUserById, updateUserAvatar } from '@/lib/users'
import { getSessionUserId } from '@/lib/rcon'
import { FEATURE_KEYS, type FeatureKey } from '@/lib/features'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const userId = await getSessionUserId(req)
  if (!userId) {
    return Response.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
  }

  const user = getUserById(userId)
  if (!user) {
    return Response.json({ ok: false, error: 'User not found' }, { status: 404 })
  }
  const features = getUserFeatures(userId)
  return Response.json({ ok: true, features, avatar: user.avatar })
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

  const attemptedFeatureUpdates = FEATURE_KEYS.filter((field: FeatureKey) => body[field] !== undefined)
  if (attemptedFeatureUpdates.length > 0) {
    return Response.json({ ok: false, error: 'Feature policies are admin-managed' }, { status: 403 })
  }

  let avatarUpdated = false
  if (body.avatar !== undefined) {
    const avatar = body.avatar
    if (!avatar || avatar.type === 'none') {
      updateUserAvatar(userId, { type: 'none', value: null })
      avatarUpdated = true
    } else if (avatar.type === 'builtin' && typeof avatar.value === 'string' && /^[a-z0-9-]{1,64}$/i.test(avatar.value)) {
      updateUserAvatar(userId, { type: 'builtin', value: avatar.value })
      avatarUpdated = true
    } else if (avatar.type === 'upload' && typeof avatar.value === 'string' && avatar.value.startsWith('data:image/')) {
      if (avatar.value.length > 900_000) {
        return Response.json({ ok: false, error: 'Uploaded profile picture is too large' }, { status: 400 })
      }
      updateUserAvatar(userId, { type: 'upload', value: avatar.value })
      avatarUpdated = true
    } else {
      return Response.json({ ok: false, error: 'Invalid avatar payload' }, { status: 400 })
    }
  }

  if (!avatarUpdated) {
    return Response.json({ ok: false, error: 'No valid fields to update' }, { status: 400 })
  }

  return Response.json({ ok: true, features: getUserFeatures(userId), avatar: getUserById(userId)?.avatar ?? { type: 'none', value: null } })
}
