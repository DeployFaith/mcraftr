import { NextRequest } from 'next/server'
import { rconForRequest } from '@/lib/rcon'
import { getToken } from 'next-auth/jwt'
import { getUserById } from '@/lib/users'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const ALLOWED_COMMANDS = new Set(['save-all', 'stop'])

export async function POST(req: NextRequest) {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET, cookieName: 'authjs.session-token' })
  const userId = token?.id as string | undefined
  if (!userId) return Response.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
  const user = getUserById(userId)
  if (!user || user.role !== 'admin') return Response.json({ ok: false, error: 'Admin only' }, { status: 403 })

  try {
    const { command } = await req.json()
    if (!ALLOWED_COMMANDS.has(command)) {
      return Response.json({ ok: false, error: 'Unknown server command' }, { status: 400 })
    }
    const result = await rconForRequest(req, command)
    if (!result.ok) return Response.json({ ok: false, error: result.error })
    return Response.json({ ok: true, message: result.stdout || `Executed: ${command}` })
  } catch (e: unknown) {
    return Response.json({ ok: false, error: e instanceof Error ? e.message : 'Server error' }, { status: 500 })
  }
}
