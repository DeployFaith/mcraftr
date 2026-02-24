import { NextRequest } from 'next/server'
import { getUserFeatures, updateUserFeatures, getUserById, listUsers } from '@/lib/users'
import { getToken } from 'next-auth/jwt'
import { FEATURE_KEYS, type FeatureKey } from '@/lib/features'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET, cookieName: 'authjs.session-token' })
  const userId = token?.id as string | undefined
  if (!userId) {
    return Response.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
  }
  const user = getUserById(userId)
  if (!user || user.role !== 'admin') {
    return Response.json({ ok: false, error: 'Admin only' }, { status: 403 })
  }

  const url = new URL(req.url)
  const targetId = url.searchParams.get('user_id')
  if (!targetId) {
    const users = listUsers()
    const allFeatures = users.map(u => ({
      user_id: u.id,
      email: u.email,
      role: u.role,
      features: getUserFeatures(u.id),
    }))
    return Response.json({ ok: true, users: allFeatures })
  }

  const target = getUserById(targetId)
  if (!target) {
    return Response.json({ ok: false, error: 'User not found' }, { status: 404 })
  }

  return Response.json({ ok: true, user: { user_id: target.id, email: target.email, role: target.role, features: getUserFeatures(target.id) } })
}

export async function PUT(req: NextRequest) {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET, cookieName: 'authjs.session-token' })
  const adminId = token?.id as string | undefined
  if (!adminId) {
    return Response.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
  }
  const admin = getUserById(adminId)
  if (!admin || admin.role !== 'admin') {
    return Response.json({ ok: false, error: 'Admin only' }, { status: 403 })
  }

  const { user_id, ...features } = await req.json()
  if (!user_id) {
    return Response.json({ ok: false, error: 'user_id is required' }, { status: 400 })
  }

  const target = getUserById(user_id)
  if (!target) {
    return Response.json({ ok: false, error: 'User not found' }, { status: 404 })
  }

  const updates: Partial<Record<FeatureKey, boolean>> = {}
  for (const field of FEATURE_KEYS) {
    if (features[field] !== undefined) {
      updates[field] = !!features[field]
    }
  }

  if (Object.keys(updates).length === 0) {
    return Response.json({ ok: false, error: 'No valid fields to update' }, { status: 400 })
  }

  updateUserFeatures(user_id, updates)
  return Response.json({ ok: true, features: getUserFeatures(user_id) })
}
