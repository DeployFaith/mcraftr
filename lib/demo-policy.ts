import type { User } from '@/lib/users'
import { getDemoSyntheticPlayerName } from '@/lib/demo-synthetic-player'
import { parseDemoSelfPlayerCookieValue } from './demo-access'

type DemoRestrictedUserLike = Pick<User, 'email' | 'isTemporary' | 'id'>

export function isDemoRestrictedUser(user: Pick<User, 'email' | 'isTemporary'> | null | undefined) {
  if (!user) return false
  if (user.isTemporary) return true
  const templateEmail = (process.env.MCRAFTR_DEMO_TEMPLATE_EMAIL || 'demo@mcraftr.local').trim().toLowerCase()
  return user.email.trim().toLowerCase() === templateEmail
}

export const DEMO_RESTRICTED_SERVER_MESSAGE = 'The public demo is locked to the shared demo server. To connect your own server, self-host Mcraftr.'

export function getDemoAllowedPlayerNames(user: DemoRestrictedUserLike | null | undefined, rawDemoSelfPlayerCookie?: string | null) {
  if (!user || !isDemoRestrictedUser(user)) return null
  const allowed = new Set<string>()
  const demoPlayer = getDemoSyntheticPlayerName(user.id)
  if (demoPlayer) allowed.add(demoPlayer)
  const selfPlayer = parseDemoSelfPlayerCookieValue(rawDemoSelfPlayerCookie)
  if (selfPlayer) allowed.add(selfPlayer)
  return allowed
}

export function getDemoPlayerActionError(user: DemoRestrictedUserLike | null | undefined, player: string, rawDemoSelfPlayerCookie?: string | null) {
  if (!user || !isDemoRestrictedUser(user)) return null
  const allowed = getDemoAllowedPlayerNames(user, rawDemoSelfPlayerCookie)
  if (allowed?.has(player.trim())) return null
  return 'Public demo accounts can only target demo_player or their own linked player.'
}
