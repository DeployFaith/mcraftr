import { NextRequest } from 'next/server'
import { getSessionActiveServerId, getSessionUserId } from '@/lib/rcon'
import { getActiveServer } from '@/lib/users'
import { recommendIntegration, type IntegrationStatusInput } from '@/lib/integration-recommendations'
import { getIntegrationDependency } from '@/lib/integration-dependencies'
import { getIntegrationById, type IntegrationId } from '@/lib/integrations'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const userId = await getSessionUserId(req)
  const serverId = await getSessionActiveServerId(req)
  if (!userId) return Response.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
  if (!serverId) return Response.json({ ok: false, error: 'No active server selected' }, { status: 400 })

  const activeServer = getActiveServer(userId)
  if (!activeServer) return Response.json({ ok: false, error: 'No active server configured' }, { status: 400 })

  const body = await req.json().catch(() => ({})) as {
    dependencyKey?: string
    candidates?: IntegrationId[]
    statuses?: IntegrationStatusInput[]
  }

  const dependency = body.dependencyKey ? getIntegrationDependency(body.dependencyKey) : null
  const candidates = Array.isArray(body.candidates) && body.candidates.length > 0
    ? body.candidates.filter(candidate => !!getIntegrationById(candidate))
    : dependency?.integrationIds ?? []

  if (candidates.length === 0) {
    return Response.json({ ok: false, error: 'No valid integration candidates were provided' }, { status: 400 })
  }

  const statuses = Array.isArray(body.statuses) ? body.statuses.filter(status => !!getIntegrationById(status.id)) : []
  const recommendation = recommendIntegration({
    minecraftVersion: activeServer.minecraftVersion.resolved,
    candidates,
    statuses,
  })

  return Response.json({
    ok: true,
    dependency,
    recommendation,
  })
}
