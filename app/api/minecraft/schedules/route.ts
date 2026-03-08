import { NextRequest } from 'next/server'
import { getSessionActiveServerId, getSessionUserId } from '@/lib/rcon'
import { createSchedule, ensureScheduleRunnerStarted, listScheduleRuns, listSchedules } from '@/lib/schedules'
import { getUserById, getUserFeatures } from '@/lib/users'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function assertAdmin(userId: string) {
  const user = getUserById(userId)
  if (!user || user.role !== 'admin') throw new Error('Admin only')
  if (!getUserFeatures(userId).enable_admin_schedules) throw new Error('Feature disabled by admin')
}

export async function GET(req: NextRequest) {
  const userId = await getSessionUserId(req)
  const serverId = await getSessionActiveServerId(req)
  if (!userId) return Response.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
  if (!serverId) return Response.json({ ok: false, error: 'No active server selected' }, { status: 400 })
  try {
    ensureScheduleRunnerStarted()
    assertAdmin(userId)
    return Response.json({
      ok: true,
      schedules: listSchedules(userId, serverId),
      runs: listScheduleRuns(userId, serverId, 12),
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unauthorized'
    const status = message === 'Admin only' ? 403 : 400
    return Response.json({ ok: false, error: message }, { status })
  }
}

export async function POST(req: NextRequest) {
  const userId = await getSessionUserId(req)
  const serverId = await getSessionActiveServerId(req)
  if (!userId) return Response.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
  if (!serverId) return Response.json({ ok: false, error: 'No active server selected' }, { status: 400 })
  try {
    ensureScheduleRunnerStarted()
    assertAdmin(userId)
    const body = await req.json()
    const schedule = createSchedule(userId, serverId, {
      label: body.label,
      enabled: body.enabled ?? true,
      cadence: body.cadence,
      timezone: body.timezone,
      timeOfDay: body.timeOfDay,
      dayOfWeek: body.dayOfWeek ?? null,
      dayOfMonth: body.dayOfMonth ?? null,
      actionType: body.actionType,
      actionPayload: body.actionPayload ?? {},
    })
    return Response.json({ ok: true, schedule })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to create schedule'
    const status = message === 'Admin only' ? 403 : 400
    return Response.json({ ok: false, error: message }, { status })
  }
}
