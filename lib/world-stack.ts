import { NextRequest } from 'next/server'
import { getSessionActiveServerId, getSessionUserId, rconForRequest } from './rcon'
import { getActiveServer, getUserById, updateServerSidecarHealth } from './users'

export type BridgeResult<T> =
  | { ok: true; data: T; raw: string }
  | { ok: false; error: string; raw?: string }

export type SidecarResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; status?: number }

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

export async function runFgmcJson<T>(req: NextRequest, command: string): Promise<BridgeResult<T>> {
  const response = await rconForRequest(req, `fgmc ${command}`)
  if (!response.ok) {
    return { ok: false, error: response.error || 'RCON request failed', raw: response.stdout }
  }
  const json = extractJson(response.stdout)
  if (!json) {
    return { ok: false, error: 'Bridge did not return JSON', raw: response.stdout }
  }
  try {
    return { ok: true, data: JSON.parse(json) as T, raw: response.stdout }
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'Failed to parse bridge JSON',
      raw: response.stdout,
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

export async function getWorldStackContext(req: NextRequest): Promise<{
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
