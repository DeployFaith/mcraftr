import { NextRequest } from 'next/server'
import { getUserFeatures, updateUserFeatures, getUserById, listUsers } from '@/lib/users'
import { FEATURE_KEYS, type FeatureKey } from '@/lib/features'
import { getDemoReadonlyAccess, requireAdminReadable, rejectDemoReadonlyWrite } from '@/lib/demo-readonly'
import { getDemoAdminUserWithFeatures, getDemoAdminUsersWithFeatures } from '@/lib/demo-admin-seeds'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const auth = requireAdminReadable(await getDemoReadonlyAccess(req))
  if (!auth.ok) return auth.response
  const { access } = auth
  const userId = access.userId
  if (!access.demoReadOnly && !getUserFeatures(userId).enable_admin_feature_policies) {
    return Response.json({ ok: false, error: 'Feature disabled by admin' }, { status: 403 })
  }

  const url = new URL(req.url)
  const targetId = url.searchParams.get('user_id')
  const currentUser = getUserById(userId)
  if (!currentUser) {
    return Response.json({ ok: false, error: 'User not found' }, { status: 404 })
  }

  if (access.demoReadOnly) {
    if (!targetId) {
      return Response.json({ ok: true, users: getDemoAdminUsersWithFeatures(currentUser), readOnly: true })
    }
    const target = getDemoAdminUserWithFeatures(currentUser, targetId)
    if (!target) {
      return Response.json({ ok: false, error: 'User not found' }, { status: 404 })
    }
    return Response.json({ ok: true, user: target, readOnly: true })
  }

  if (!targetId) {
    const users = listUsers()
    const allFeatures = users.map(u => ({
      user_id: u.id,
      email: u.email,
      role: u.role,
      features: getUserFeatures(u.id),
    }))
      return Response.json({ ok: true, users: allFeatures, readOnly: access.demoReadOnly })
  }

  const target = getUserById(targetId)
  if (!target) {
    return Response.json({ ok: false, error: 'User not found' }, { status: 404 })
  }

  return Response.json({ ok: true, user: { user_id: target.id, email: target.email, role: target.role, features: getUserFeatures(target.id) }, readOnly: access.demoReadOnly })
}

export async function PUT(req: NextRequest) {
  const access = await getDemoReadonlyAccess(req)
  if (!access || !access.isAdmin) return Response.json({ ok: false, error: 'Admin only' }, { status: 403 })
  const readOnlyResponse = rejectDemoReadonlyWrite(access)
  if (readOnlyResponse) return readOnlyResponse
  const adminId = access.userId
  if (!getUserFeatures(adminId).enable_admin_feature_policies) {
    return Response.json({ ok: false, error: 'Feature disabled by admin' }, { status: 403 })
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
