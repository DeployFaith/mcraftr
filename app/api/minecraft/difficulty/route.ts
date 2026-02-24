import { NextRequest } from 'next/server'
import { rconForRequest, getSessionUserId } from '@/lib/rcon'
import { getToken } from 'next-auth/jwt'
import { getUserById, getUserFeatures } from '@/lib/users'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const DIFFICULTIES = ['peaceful', 'easy', 'normal', 'hard']

export async function GET(req: NextRequest) {
  const userId = await getSessionUserId(req)
  if (!userId) return Response.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
  if (!getUserFeatures(userId).enable_admin_rules) {
    return Response.json({ ok: false, error: 'Feature disabled by admin' }, { status: 403 })
  }
  try {
    const result = await rconForRequest(req, 'difficulty')
    if (!result.ok) return Response.json({ ok: false, error: result.error })
    // "The difficulty is Easy (1)"
    const m = result.stdout.toLowerCase().match(/difficulty is\s+(\w+)/)
    const current = m ? m[1] : null
    return Response.json({ ok: true, current })
  } catch (e: unknown) {
    return Response.json({ ok: false, error: e instanceof Error ? e.message : 'Server error' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET, cookieName: 'authjs.session-token' })
  const userId = token?.id as string | undefined
  if (!userId) return Response.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
  const user = getUserById(userId)
  if (!user || user.role !== 'admin') return Response.json({ ok: false, error: 'Admin only' }, { status: 403 })
  if (!getUserFeatures(userId).enable_admin_rules) return Response.json({ ok: false, error: 'Feature disabled by admin' }, { status: 403 })

  try {
    const { difficulty } = await req.json()
    if (!DIFFICULTIES.includes(difficulty)) {
      return Response.json({ ok: false, error: 'Invalid difficulty' }, { status: 400 })
    }
    const result = await rconForRequest(req, `difficulty ${difficulty}`)
    if (!result.ok) return Response.json({ ok: false, error: result.error })
    return Response.json({ ok: true, message: `Difficulty set to ${difficulty}` })
  } catch (e: unknown) {
    return Response.json({ ok: false, error: e instanceof Error ? e.message : 'Server error' }, { status: 500 })
  }
}
