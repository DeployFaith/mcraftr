import { NextRequest } from 'next/server'
import { getSessionActiveServerId, getSessionUserId } from '@/lib/rcon'
import { clearServerIntegrationPreference, getServerIntegrationPreference, setServerIntegrationPreference, type IntegrationPreferenceKey } from '@/lib/integration-preferences'
import { getIntegrationById } from '@/lib/integrations'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const userId = await getSessionUserId(req)
  const serverId = await getSessionActiveServerId(req)
  if (!userId) return Response.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
  if (!serverId) return Response.json({ ok: false, error: 'No active server selected' }, { status: 400 })

  const body = await req.json().catch(() => ({})) as {
    preferenceKey?: IntegrationPreferenceKey
    integrationId?: string
    reason?: string
    clear?: boolean
  }

  if (body.preferenceKey !== 'structure_editor_provider') {
    return Response.json({ ok: false, error: 'Unsupported preference key' }, { status: 400 })
  }

  if (body.clear === true) {
    clearServerIntegrationPreference(userId, serverId, body.preferenceKey)
    return Response.json({ ok: true, preference: null })
  }

  const integration = getIntegrationById(body.integrationId)
  if (!integration) {
    return Response.json({ ok: false, error: 'Unknown integration id' }, { status: 400 })
  }

  setServerIntegrationPreference({
    userId,
    serverId,
    preferenceKey: body.preferenceKey,
    integrationId: integration.id,
    reason: body.reason ?? null,
  })

  return Response.json({
    ok: true,
    preference: getServerIntegrationPreference(userId, serverId, body.preferenceKey),
  })
}
