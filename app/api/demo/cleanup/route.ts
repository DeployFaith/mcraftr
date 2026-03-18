import { NextRequest } from 'next/server'
import { getUserByEmail, purgeTemporaryUsersOlderThan } from '@/lib/users'
import { purgeDemoSyntheticDataForServer } from '@/lib/demo-synthetic-player'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const configuredToken = process.env.MCRAFTR_DEMO_CLEANUP_TOKEN?.trim()
  if (!configuredToken) {
    return Response.json({ ok: false, error: 'Demo cleanup token is not configured' }, { status: 503 })
  }

  const authHeader = req.headers.get('authorization')
  const requestToken = authHeader?.startsWith('Bearer ') ? authHeader.slice('Bearer '.length).trim() : ''
  if (!requestToken || requestToken !== configuredToken) {
    return Response.json({ ok: false, error: 'Forbidden' }, { status: 403 })
  }

  const now = Math.floor(Date.now() / 1000)
  const ttlHours = Number.parseInt(process.env.MCRAFTR_TEMP_DEMO_TTL_HOURS ?? '12', 10)
  const ttlSeconds = Number.isFinite(ttlHours) && ttlHours > 0 ? ttlHours * 60 * 60 : 12 * 60 * 60
  const deletedUsers = purgeTemporaryUsersOlderThan(now - ttlSeconds)

  const demoTemplate = getUserByEmail((process.env.MCRAFTR_DEMO_TEMPLATE_EMAIL || 'demo@mcraftr.local').trim().toLowerCase())
  if (demoTemplate?.activeServerId) {
    purgeDemoSyntheticDataForServer(demoTemplate.activeServerId)
  }

  return Response.json({ ok: true, deletedUsers, cutoffUnix: now - ttlSeconds })
}
