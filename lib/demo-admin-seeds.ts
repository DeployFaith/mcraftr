import { FEATURE_DEFS, type FeatureKey } from '@/lib/features'
import { getUserFeatures } from '@/lib/users'

type AdminSeedUser = {
  id: string
  email: string
  role: 'admin' | 'user'
}

const SEEDED_USERS: AdminSeedUser[] = [
  { id: 'demo-seed-alex', email: 'alex@seed.mcraftr.local', role: 'admin' },
  { id: 'demo-seed-maya', email: 'maya@seed.mcraftr.local', role: 'user' },
  { id: 'demo-seed-rowan', email: 'rowan@seed.mcraftr.local', role: 'user' },
  { id: 'demo-seed-jules', email: 'jules@seed.mcraftr.local', role: 'user' },
]

function seededFeatures(seedId: string) {
  const features = Object.fromEntries(FEATURE_DEFS.map(def => [def.key, true])) as Record<FeatureKey, boolean>
  if (seedId === 'demo-seed-maya') {
    features.enable_admin = false
    features.enable_rcon = false
  }
  if (seedId === 'demo-seed-rowan') {
    features.enable_world_spawn_tools = false
    features.enable_entity_catalog = false
  }
  if (seedId === 'demo-seed-jules') {
    features.enable_chat_write = false
    features.enable_admin_operator = false
  }
  return features
}

export function getDemoAdminUsers(currentUser: { id: string; email: string; role: 'admin' | 'user' }) {
  return [
    { id: currentUser.id, email: currentUser.email, role: currentUser.role },
    ...SEEDED_USERS,
  ]
}

export function getDemoAdminUsersWithFeatures(currentUser: { id: string; email: string; role: 'admin' | 'user' }) {
  return [
    {
      user_id: currentUser.id,
      email: currentUser.email,
      role: currentUser.role,
      features: getUserFeatures(currentUser.id),
    },
    ...SEEDED_USERS.map(user => ({
      user_id: user.id,
      email: user.email,
      role: user.role,
      features: seededFeatures(user.id),
    })),
  ]
}

export function getDemoAdminUserWithFeatures(currentUser: { id: string; email: string; role: 'admin' | 'user' }, targetId: string) {
  if (targetId === currentUser.id) {
    return {
      user_id: currentUser.id,
      email: currentUser.email,
      role: currentUser.role,
      features: getUserFeatures(currentUser.id),
    }
  }
  const seeded = SEEDED_USERS.find(user => user.id === targetId)
  if (!seeded) return null
  return {
    user_id: seeded.id,
    email: seeded.email,
    role: seeded.role,
    features: seededFeatures(seeded.id),
  }
}
