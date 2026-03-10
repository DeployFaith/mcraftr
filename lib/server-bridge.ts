import { NextRequest } from 'next/server'
import { getSessionActiveServerId, getSessionUserId, rconForRequest } from './rcon'
import { getActiveServer, getUserById, updateServerBridgeHealth, updateServerSidecarHealth } from './users'
import { rconDirect, type RconResult } from './rcon-client'

export type BridgeErrorCode =
  | 'unauthorized'
  | 'bridge_no_active_server'
  | 'bridge_not_configured'
  | 'bridge_transport_failed'
  | 'bridge_invalid_prefix'
  | 'bridge_command_rejected'
  | 'bridge_non_json_response'
  | 'bridge_json_parse_failed'

export type BridgeResult<T> =
  | { ok: true; data: T; raw: string }
  | { ok: false; error: string; raw?: string; code: BridgeErrorCode }

export type BridgeCommandResult =
  | { ok: true; stdout: string; raw: string }
  | { ok: false; stdout: string; error: string; raw?: string; code: BridgeErrorCode }

export type BridgeProbeResult = {
  ok: boolean
  error?: string
  code?: BridgeErrorCode
  raw?: string
  providerId?: string | null
  providerLabel?: string | null
  protocolVersion?: string | null
  capabilities?: string[]
}

export type SidecarResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; status?: number }

export type ActiveBridgeContext = {
  userId: string
  serverId: string
  commandPrefix: string
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function extractCapabilityList(payload: unknown): string[] {
  if (!payload || typeof payload !== 'object') return []
  const commands = Array.isArray((payload as { commands?: unknown[] }).commands)
    ? (payload as { commands: unknown[] }).commands
    : []
  return Array.from(new Set(commands
    .map(entry => (entry && typeof entry === 'object' && typeof (entry as { name?: unknown }).name === 'string')
      ? (entry as { name: string }).name.trim()
      : '')
    .filter(Boolean)))
}

function detectBridgeRejection(raw: string, commandPrefix: string): { code: BridgeErrorCode; error: string } | null {
  const trimmed = raw.trim()
  if (!trimmed) return null
  const normalized = trimmed.toLowerCase()
  const looksLikeUnknownCommand = normalized.includes('unknown or incomplete command')
    || normalized.includes('unknown command')
    || normalized.includes('unknown or incomplete')
  const looksLikeSyntaxPointer = normalized.includes('<--[here]')
  const looksLikeUsageOnly = /^usage:\s*\//im.test(trimmed)
  if (!looksLikeUnknownCommand && !looksLikeSyntaxPointer && !looksLikeUsageOnly) {
    return null
  }

  const prefixPattern = new RegExp(`(^|\\n)\\/?${escapeRegExp(commandPrefix)}(?:\\s|$)`, 'i')
  if (prefixPattern.test(trimmed)) {
    return {
      code: 'bridge_invalid_prefix',
      error: `Bridge prefix "${commandPrefix}" is not valid for the active server`,
    }
  }

  return {
    code: 'bridge_command_rejected',
    error: 'Bridge command was rejected by the server',
  }
}

function bridgeFailure(code: BridgeErrorCode, error: string, raw?: string): BridgeCommandResult {
  return { ok: false, stdout: raw ?? '', raw, error, code }
}

function extractJson(raw: string): string | null {
  const trimmed = raw.trim()
  if (!trimmed) return null
  const lines = trimmed.split('\n').map(line => line.trim()).filter(Boolean)
  for (let i = lines.length - 1; i >= 0; i -= 1) {
    const line = lines[i]
    if ((line.startsWith('{') && line.endsWith('}')) || (line.startsWith('[') && line.endsWith(']'))) {
      return line
    }
  }
  const objectStart = trimmed.indexOf('{')
  if (objectStart >= 0) {
    return trimmed.slice(objectStart)
  }
  const arrayStart = trimmed.indexOf('[')
  if (arrayStart >= 0) {
    return trimmed.slice(arrayStart)
  }
  return null
}

async function resolveBridgeContext(req: NextRequest): Promise<
  | { ok: true; context: ActiveBridgeContext }
  | { ok: false; error: string; code: BridgeErrorCode }
> {
  const userId = await getSessionUserId(req)
  if (!userId) {
    return { ok: false, error: 'Unauthorized', code: 'unauthorized' }
  }
  const serverId = await getSessionActiveServerId(req)
  if (!serverId) {
    return { ok: false, error: 'No active server selected', code: 'bridge_no_active_server' }
  }

  const server = getActiveServer(userId)
  if (!server?.bridge.enabled) {
    return { ok: false, error: 'Bridge integration is not configured for the active server', code: 'bridge_not_configured' }
  }

  return {
    ok: true,
    context: {
      userId,
      serverId,
      commandPrefix: server.bridge.commandPrefix.trim().replace(/^\/+/, '') || 'mcraftr',
    },
  }
}

async function performBridgeCommand(
  commandPrefix: string,
  command: string,
  execute: (fullCommand: string) => Promise<RconResult>,
): Promise<BridgeCommandResult> {
  const response = await execute(`${commandPrefix} ${command}`)
  if (!response.ok) {
    return bridgeFailure('bridge_transport_failed', response.error || 'RCON request failed', response.stdout)
  }
  const rejection = detectBridgeRejection(response.stdout, commandPrefix)
  if (rejection) {
    return bridgeFailure(rejection.code, rejection.error, response.stdout)
  }
  return { ok: true, stdout: response.stdout, raw: response.stdout }
}

export async function runBridgeCommand(req: NextRequest, command: string): Promise<BridgeCommandResult> {
  const bridge = await resolveBridgeContext(req)
  if (!bridge.ok) {
    return bridgeFailure(bridge.code, bridge.error)
  }

  const result = await performBridgeCommand(
    bridge.context.commandPrefix,
    command,
    fullCommand => rconForRequest(req, fullCommand),
  )
  updateServerBridgeHealth(bridge.context.userId, bridge.context.serverId, {
    lastSeen: result.ok ? Math.floor(Date.now() / 1000) : undefined,
    lastError: result.ok ? null : result.error,
  })
  return result
}

export async function runBridgeJson<T>(req: NextRequest, command: string): Promise<BridgeResult<T>> {
  const bridge = await resolveBridgeContext(req)
  if (!bridge.ok) {
    return { ok: false, error: bridge.error, code: bridge.code }
  }

  const response = await runBridgeCommand(req, command)
  if (!response.ok) {
    return { ok: false, error: response.error || 'RCON request failed', raw: response.raw ?? response.stdout, code: response.code }
  }
  const json = extractJson(response.stdout)
  if (!json) {
    updateServerBridgeHealth(bridge.context.userId, bridge.context.serverId, { lastError: 'Bridge did not return JSON' })
    return { ok: false, error: 'Bridge did not return JSON', raw: response.stdout, code: 'bridge_non_json_response' }
  }
  try {
    const data = JSON.parse(json) as T
    const hasCommandsProperty = !!data && typeof data === 'object' && Object.prototype.hasOwnProperty.call(data, 'commands')
    updateServerBridgeHealth(bridge.context.userId, bridge.context.serverId, {
      lastSeen: Math.floor(Date.now() / 1000),
      lastError: null,
      capabilities: hasCommandsProperty ? extractCapabilityList(data) : undefined,
      providerId: typeof (data as { providerId?: unknown }).providerId === 'string' ? (data as { providerId: string }).providerId : undefined,
      providerLabel: typeof (data as { providerLabel?: unknown }).providerLabel === 'string' ? (data as { providerLabel: string }).providerLabel : undefined,
      protocolVersion: typeof (data as { protocolVersion?: unknown }).protocolVersion === 'string' ? (data as { protocolVersion: string }).protocolVersion : undefined,
    })
    return { ok: true, data, raw: response.stdout }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to parse bridge JSON'
    updateServerBridgeHealth(bridge.context.userId, bridge.context.serverId, { lastError: message })
    return {
      ok: false,
      error: message,
      raw: response.stdout,
      code: 'bridge_json_parse_failed',
    }
  }
}

export async function testBridgeConnection(
  host: string,
  port: number,
  password: string,
  commandPrefix: string,
): Promise<BridgeProbeResult> {
  const normalizedPrefix = commandPrefix.trim().replace(/^\/+/, '') || 'mcraftr'
  const result = await performBridgeCommand(
    normalizedPrefix,
    'stack status',
    fullCommand => rconDirect(host, port, password, fullCommand),
  )
  if (!result.ok) {
    return { ok: false, error: result.error, code: result.code, raw: result.raw ?? result.stdout }
  }

  const json = extractJson(result.stdout)
  if (!json) {
    return { ok: false, error: 'Bridge did not return JSON', code: 'bridge_non_json_response', raw: result.stdout }
  }

  try {
    const payload = JSON.parse(json) as {
      providerId?: unknown
      providerLabel?: unknown
      protocolVersion?: unknown
      serverVersion?: unknown
    }
    return {
      ok: true,
      raw: result.stdout,
      providerId: typeof payload.providerId === 'string' ? payload.providerId : null,
      providerLabel: typeof payload.providerLabel === 'string' ? payload.providerLabel : null,
      protocolVersion: typeof payload.protocolVersion === 'string'
        ? payload.protocolVersion
        : (typeof payload.serverVersion === 'string' ? payload.serverVersion : null),
      capabilities: [],
    }
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'Failed to parse bridge JSON',
      code: 'bridge_json_parse_failed',
      raw: result.stdout,
    }
  }
}

export async function callSidecarForRequest<T>(
  req: NextRequest,
  endpoint: string,
  init?: RequestInit,
): Promise<SidecarResult<T>> {
  const userId = await getSessionUserId(req)
  const serverId = await getSessionActiveServerId(req)
  if (!userId || !serverId) {
    return { ok: false, error: 'No active server selected', status: 400 }
  }

  const server = getActiveServer(userId)
  if (!server?.sidecar.enabled || !server.sidecar.url) {
    return { ok: false, error: 'Sidecar is not configured for the active server', status: 400 }
  }

  try {
    const url = new URL(endpoint.replace(/^\//, ''), server.sidecar.url.endsWith('/') ? server.sidecar.url : `${server.sidecar.url}/`)
    const headers = new Headers(init?.headers ?? {})
    headers.set('Accept', 'application/json')
    if (server.sidecar.token) {
      headers.set('Authorization', `Bearer ${server.sidecar.token}`)
    }
    if (server.sidecar.structureRoots.length > 0) {
      headers.set('X-Mcraftr-Structure-Roots', JSON.stringify(server.sidecar.structureRoots))
    }
    if (server.sidecar.entityPresetRoots.length > 0) {
      headers.set('X-Mcraftr-Entity-Roots', JSON.stringify(server.sidecar.entityPresetRoots))
    }
    if (init?.body && !headers.has('Content-Type')) {
      headers.set('Content-Type', 'application/json')
    }

    const response = await fetch(url, {
      ...init,
      headers,
      cache: 'no-store',
    })
    const json = await response.json().catch(() => ({ ok: false, error: 'Invalid sidecar response' }))
    if (!response.ok || json?.ok === false) {
      return {
        ok: false,
        error: typeof json?.error === 'string' ? json.error : `Sidecar request failed (${response.status})`,
        status: response.status,
      }
    }

    const capabilities = Array.isArray(json?.capabilities)
      ? json.capabilities.filter((entry: unknown): entry is string => typeof entry === 'string')
      : server.sidecar.capabilities
    updateServerSidecarHealth(userId, serverId, { lastSeen: Math.floor(Date.now() / 1000), capabilities })
    return { ok: true, data: json as T }
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'Sidecar request failed',
      status: 502,
    }
  }
}

export async function getServerBridgeContext(req: NextRequest): Promise<{
  userId: string | null
  serverId: string | null
  serverLabel: string | null
  featuresOwnerRole: 'admin' | 'user' | null
}> {
  const userId = await getSessionUserId(req)
  const serverId = await getSessionActiveServerId(req)
  const user = userId ? getUserById(userId) : null
  return {
    userId,
    serverId,
    serverLabel: user?.serverLabel ?? null,
    featuresOwnerRole: user?.role ?? null,
  }
}
