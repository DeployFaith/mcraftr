import { NextRequest } from 'next/server'
import { checkRateLimit } from '@/lib/ratelimit'
import {
  clearDemoAccountCookie,
  createTemporaryDemoEmail,
  createTemporaryDemoPassword,
  getDemoTemplateEmail,
  normalizeDemoReturnTo,
  readDemoAccountCookie,
  writeDemoAccountCookie,
} from '@/lib/demo-access'
import {
  cloneActiveServerToUser,
  createUserWithOptions,
  getUserByEmail,
  getUserById,
  purgeTemporaryUsersOlderThan,
  touchTemporaryUser,
} from '@/lib/users'
import { scrubPrivateBridgeStrings } from '@/lib/demo-synthetic-player'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const rl = await checkRateLimit(req, 'login')
  if (rl.limited) return rl.response

  const body = await req.json().catch(() => ({}))
  const returnTo = normalizeDemoReturnTo(typeof body?.returnTo === 'string' ? body.returnTo : null)
  const now = Math.floor(Date.now() / 1000)
  const ttlHours = Number.parseInt(process.env.MCRAFTR_TEMP_DEMO_TTL_HOURS ?? '12', 10)
  const ttlSeconds = Number.isFinite(ttlHours) && ttlHours > 0 ? ttlHours * 60 * 60 : 12 * 60 * 60

  try {
    scrubPrivateBridgeStrings()
    purgeTemporaryUsersOlderThan(now - ttlSeconds)

    const templateUser = getUserByEmail(getDemoTemplateEmail())
    if (!templateUser?.activeServerId) {
      return Response.json({ ok: false, error: 'Demo server is not configured right now.' }, { status: 503 })
    }

    const existingCookie = await readDemoAccountCookie()
    if (existingCookie) {
      const existingUser = getUserById(existingCookie.userId)
      if (existingUser?.isTemporary && existingUser.email === existingCookie.email) {
        if (!existingUser.activeServerId) {
          cloneActiveServerToUser(templateUser.id, existingUser.id)
        }
        touchTemporaryUser(existingUser.id, now)
        return Response.json({
          ok: true,
          username: existingCookie.email,
          password: existingCookie.password,
          returnTo,
        })
      }
      await clearDemoAccountCookie()
    }

    const email = createTemporaryDemoEmail()
    const password = createTemporaryDemoPassword()
    const user = createUserWithOptions(email, password, {
      temporary: true,
      temporaryLastUsedAt: now,
    })
    cloneActiveServerToUser(templateUser.id, user.id)
    await writeDemoAccountCookie({ userId: user.id, email, password })

    return Response.json({ ok: true, username: email, password, returnTo })
  } catch (error: unknown) {
    return Response.json(
      { ok: false, error: error instanceof Error ? error.message : 'Unable to start the demo right now.' },
      { status: 500 },
    )
  }
}
