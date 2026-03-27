import { NextRequest } from 'next/server'
import { getSessionActiveServerId, getSessionUserId } from '@/lib/rcon'
import { getActiveServer } from '@/lib/users'
import { callSidecarForRequest, runBridgeJson } from '@/lib/server-bridge'
import { INTEGRATION_DEFINITIONS, supportsMinecraftVersion, type IntegrationId } from '@/lib/integrations'
import { getServerIntegrationPreference, listServerIntegrationPreferences } from '@/lib/integration-preferences'
import { recommendIntegration, type IntegrationInstallState, type IntegrationStatusInput } from '@/lib/integration-recommendations'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type BridgeStackResponse = {
  ok: boolean
  protocolVersion?: string | null
  serverVersion: string | null
  plugins: Array<{
    key: string
    name: string
    installed: boolean
    enabled: boolean
    version: string | null
    source: string
  }>
}

type SidecarIntegrationsResponse = {
  ok: boolean
  capabilities?: string[]
  pluginRoot?: string
  manifestPath?: string
  backupRoot?: string
  integrations?: Array<{
    integrationId: string
    installed: boolean
    detectedVersion: string | null
    pinnedVersion: string | null
    pluginPath: string | null
    managed: boolean
    backupPath: string | null
    restartRequired: boolean
    state: IntegrationInstallState
    warnings: string[]
  }>
}

export async function GET(req: NextRequest) {
  const userId = await getSessionUserId(req)
  const serverId = await getSessionActiveServerId(req)
  if (!userId) return Response.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
  if (!serverId) return Response.json({ ok: false, error: 'No active server selected' }, { status: 400 })

  const activeServer = getActiveServer(userId)
  if (!activeServer) return Response.json({ ok: false, error: 'No active server configured' }, { status: 400 })

  const [bridge, sidecar] = await Promise.all([
    activeServer.bridge.enabled
      ? runBridgeJson<BridgeStackResponse>(req, 'stack status')
      : Promise.resolve({ ok: false as const, error: 'Relay not configured' }),
    activeServer.sidecar.enabled
      ? callSidecarForRequest<SidecarIntegrationsResponse>(req, '/integrations')
      : Promise.resolve({ ok: false as const, error: 'Beacon not configured', status: 400 }),
  ])

  const minecraftVersion = activeServer.minecraftVersion.resolved
  const sidecarIntegrations = sidecar.ok ? (sidecar.data.integrations ?? []) : []

  const statuses = INTEGRATION_DEFINITIONS.map(definition => {
    const sidecarStatus = sidecarIntegrations.find(entry => entry.integrationId === definition.id)

    let installed = false
    let installState: IntegrationInstallState = 'missing'
    const detectedVersion: string | null = sidecarStatus?.detectedVersion ?? null
    const managed = sidecarStatus?.managed ?? false
    const pluginPath: string | null = sidecarStatus?.pluginPath ?? null
    const backupPath: string | null = sidecarStatus?.backupPath ?? null
    const reasons: string[] = []

    if (definition.id === 'mcraftr-relay') {
      installed = activeServer.bridge.enabled
      installState = activeServer.bridge.enabled ? 'ready' : 'missing'
      reasons.push(activeServer.bridge.enabled
        ? 'Relay is configured for the active server.'
        : 'Relay is not configured for the active server yet.')
    } else if (definition.id === 'mcraftr-beacon') {
      installed = activeServer.sidecar.enabled
      installState = activeServer.sidecar.enabled ? 'ready' : 'missing'
      reasons.push(activeServer.sidecar.enabled
        ? 'Beacon is configured for the active server.'
        : 'Beacon is not configured for the active server yet.')
    } else if (!activeServer.sidecar.enabled) {
      installState = 'unknown'
      reasons.push('Beacon is not configured, so Mcraftr cannot verify plugin jars on disk yet.')
    } else if (sidecarStatus) {
      installed = sidecarStatus.installed
      installState = sidecarStatus.state
      reasons.push(...sidecarStatus.warnings)
      reasons.push(sidecarStatus.installed
        ? `${definition.label} was detected through Beacon's managed integrations scan.`
        : `${definition.label} is not currently present in the Beacon-managed integrations scan.`)
    } else {
      installState = 'unknown'
      reasons.push('Beacon did not return an integration state for this curated plugin.')
    }

    if (!supportsMinecraftVersion(definition, minecraftVersion)) {
      installState = 'unsupported'
      reasons.push(`Mcraftr does not currently mark ${definition.label} as supported for Minecraft ${minecraftVersion || 'this version'}.`)
    }

    return {
      id: definition.id,
      label: definition.label,
      description: definition.description,
      owner: definition.owner,
      kind: definition.kind,
      installed,
      installState,
      detectedVersion,
      pinnedVersion: definition.pinnedVersion,
      restartRequired: definition.restartRequired,
      featureSummaries: definition.featureSummaries,
      supportedMinecraftVersions: definition.supportedMinecraftVersions,
      notes: definition.notes,
      source: {
        downloadUrl: definition.downloadUrl,
        filename: definition.filename,
        pluginPath,
        backupPath,
        managed,
      },
      reasons,
    }
  })

  const preference = getServerIntegrationPreference(userId, serverId, 'structure_editor_provider')
  const structureProviderCandidates: IntegrationStatusInput[] = statuses
    .filter(status => status.id === 'worldedit' || status.id === 'fawe')
    .map(status => ({
      id: status.id as IntegrationId,
      installed: status.installed,
      installState: status.installState,
      detectedVersion: status.detectedVersion,
    }))
  const recommendation = recommendIntegration({
    minecraftVersion,
    candidates: ['worldedit', 'fawe'],
    statuses: structureProviderCandidates,
  })

  return Response.json({
    ok: true,
    server: {
      id: activeServer.id,
      label: activeServer.label,
      minecraftVersion,
      bridgeEnabled: activeServer.bridge.enabled,
      sidecarEnabled: activeServer.sidecar.enabled,
    },
    integrations: statuses,
    preferences: {
      all: listServerIntegrationPreferences(userId, serverId),
      structureEditorProvider: preference,
      shouldPromptForStructureEditor: statuses.filter(status => (status.id === 'worldedit' || status.id === 'fawe') && status.installed).length > 1 && !preference,
    },
    recommendations: {
      structureEditor: recommendation,
    },
    inventorySources: {
      bridge: bridge.ok ? { ok: true, serverVersion: bridge.data.serverVersion } : { ok: false, error: bridge.error },
      sidecar: sidecar.ok ? {
        ok: true,
        capabilities: sidecar.data.capabilities ?? activeServer.sidecar.capabilities,
        pluginRoot: sidecar.data.pluginRoot ?? null,
        manifestPath: sidecar.data.manifestPath ?? null,
        backupRoot: sidecar.data.backupRoot ?? null,
      } : { ok: false, error: sidecar.error },
    },
  })
}
