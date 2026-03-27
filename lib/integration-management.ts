import type { NextRequest } from 'next/server'
import { checkFeatureAccess, getUserFeatureFlags } from './rcon'
import { requireServerCapability } from './server-capability'
import { callSidecarForRequest } from './server-bridge'
import { getIntegrationById, supportsMinecraftVersion, type IntegrationId } from './integrations'
import { logAudit } from './audit'

export type IntegrationMutationAction = 'install' | 'remove' | 'repair'

type SidecarMutationResponse = {
  ok: boolean
  integrationId: string
  action: IntegrationMutationAction
  installedVersion?: string | null
  pinnedVersion?: string | null
  filename?: string | null
  pluginPath?: string | null
  backupPath?: string | null
  restartRequired?: boolean
  managed?: boolean
  warnings?: string[]
  error?: string
}

export async function runIntegrationMutation(req: NextRequest, action: IntegrationMutationAction, integrationId: string) {
  const features = await getUserFeatureFlags(req)
  if (!checkFeatureAccess(features, 'enable_plugin_stack_status')) {
    return { ok: false as const, response: Response.json({ ok: false, error: 'Feature disabled by admin' }, { status: 403 }) }
  }

  const capability = await requireServerCapability(req, 'beacon')
  if (!capability.ok) {
    return { ok: false as const, response: capability.response }
  }

  const integration = getIntegrationById(integrationId)
  if (!integration || integration.kind !== 'plugin' || integration.owner !== 'third-party') {
    return { ok: false as const, response: Response.json({ ok: false, error: 'Unsupported curated integration' }, { status: 400 }) }
  }

  if ((action === 'install' || action === 'repair') && !supportsMinecraftVersion(integration, capability.activeServer.minecraftVersion.resolved)) {
    return {
      ok: false as const,
      response: Response.json({
        ok: false,
        error: `${integration.label} is not marked as supported for Minecraft ${capability.activeServer.minecraftVersion.resolved || 'this server version'}.`,
      }, { status: 400 }),
    }
  }

  const sidecar = await callSidecarForRequest<SidecarMutationResponse>(req, `/integrations/${action}`, {
    method: 'POST',
    body: JSON.stringify({ integrationId: integration.id }),
  })

  if (!sidecar.ok) {
    return {
      ok: false as const,
      response: Response.json({ ok: false, error: sidecar.error }, { status: sidecar.status ?? 502 }),
    }
  }

  const result = sidecar.data
  const auditAction = action === 'install'
    ? 'integration_install'
    : action === 'remove'
      ? 'integration_remove'
      : 'integration_repair'
  logAudit(capability.userId, auditAction, integration.label, `${integration.id}:${result.pinnedVersion ?? integration.pinnedVersion}`, capability.serverId)

  return {
    ok: true as const,
    integration,
    result,
    response: Response.json({
      ok: true,
      integrationId: result.integrationId,
      action: result.action,
      message: action === 'install'
        ? `${integration.label} installed${result.restartRequired ? ' and marked for restart' : ''}.`
        : action === 'remove'
          ? `${integration.label} removed${result.restartRequired ? ' and marked for restart' : ''}.`
          : `${integration.label} repaired${result.restartRequired ? ' and marked for restart' : ''}.`,
      restartRequired: !!result.restartRequired,
      warnings: result.warnings ?? [],
      result: {
        installedVersion: result.installedVersion ?? null,
        pinnedVersion: result.pinnedVersion ?? integration.pinnedVersion,
        pluginPath: result.pluginPath ?? null,
        backupPath: result.backupPath ?? null,
        managed: result.managed ?? false,
      },
    }),
  }
}

export function parseIntegrationMutationBody(body: unknown): { integrationId: IntegrationId | null } {
  if (!body || typeof body !== 'object') return { integrationId: null }
  const integrationId = typeof (body as { integrationId?: unknown }).integrationId === 'string'
    ? (body as { integrationId: IntegrationId }).integrationId
    : null
  return { integrationId }
}
