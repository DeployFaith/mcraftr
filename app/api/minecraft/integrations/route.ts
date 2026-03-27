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

type SidecarStackResponse = {
  ok: boolean
  capabilities?: string[]
  plugins?: Array<{
    name: string
    version: string | null
    filename: string
    detectedFrom: string
  }>
}

function normalizePluginName(value: string) {
  return value.trim().toLowerCase()
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
      ? callSidecarForRequest<SidecarStackResponse>(req, '/plugin-stack')
      : Promise.resolve({ ok: false as const, error: 'Beacon not configured', status: 400 }),
  ])

  const minecraftVersion = activeServer.minecraftVersion.resolved
  const sidecarPlugins = sidecar.ok ? (sidecar.data.plugins ?? []) : []
  const bridgePlugins = bridge.ok ? (bridge.data.plugins ?? []) : []
  const installedPluginNames = new Set([
    ...sidecarPlugins.map(plugin => normalizePluginName(plugin.name)),
    ...bridgePlugins.filter(plugin => plugin.installed).map(plugin => normalizePluginName(plugin.name)),
  ])

  const statuses = INTEGRATION_DEFINITIONS.map(definition => {
    const bySidecar = sidecarPlugins.find(plugin => definition.detectPluginNames.some(name => normalizePluginName(name) === normalizePluginName(plugin.name)))
    const byBridge = bridgePlugins.find(plugin => definition.detectPluginNames.some(name => normalizePluginName(name) === normalizePluginName(plugin.name)))
    const detectedVersion = bySidecar?.version ?? byBridge?.version ?? null

    let installed = false
    let installState: IntegrationInstallState = 'missing'
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
    } else {
      installed = definition.detectPluginNames.some(name => installedPluginNames.has(normalizePluginName(name)))
      installState = installed ? 'ready' : 'missing'
      reasons.push(installed
        ? `${definition.label} was detected in the current plugin inventory.`
        : `${definition.label} was not found in the current plugin inventory.`)
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
      sidecar: sidecar.ok ? { ok: true, capabilities: sidecar.data.capabilities ?? activeServer.sidecar.capabilities } : { ok: false, error: sidecar.error },
    },
  })
}
