import type { NextRequest } from 'next/server'
import { FULL_STACK_DOCS_URL } from './docs-links'
import { getSessionActiveServerId, getSessionUserId } from './rcon'
import { meetsCapabilityRequirement, type ServerCapabilityRequirement } from './server-stack'
import { getActiveServer } from './users'

export function capabilityErrorPayload(requirement: Exclude<ServerCapabilityRequirement, 'none'>) {
  const title = requirement === 'relay'
    ? 'This feature requires Mcraftr Relay.'
    : requirement === 'beacon'
      ? 'This feature requires Mcraftr Beacon.'
      : 'This feature requires the Full Mcraftr Stack.'

  return {
    ok: false,
    error: title,
    code: requirement === 'relay' ? 'requires_relay' : requirement === 'beacon' ? 'requires_beacon' : 'requires_full_stack',
    requirement,
    docsUrl: FULL_STACK_DOCS_URL,
    connectUrl: '/connect?edit=1',
  }
}

export function capabilityErrorResponse(requirement: Exclude<ServerCapabilityRequirement, 'none'>, status = 409) {
  return Response.json(capabilityErrorPayload(requirement), { status })
}

export async function requireServerCapability(req: NextRequest, requirement: Exclude<ServerCapabilityRequirement, 'none'>) {
  const userId = await getSessionUserId(req)
  const serverId = await getSessionActiveServerId(req)

  if (!userId) {
    return {
      ok: false as const,
      response: Response.json({ ok: false, error: 'Unauthorized' }, { status: 401 }),
    }
  }

  if (!serverId) {
    return {
      ok: false as const,
      response: Response.json({ ok: false, error: 'No active server selected' }, { status: 400 }),
    }
  }

  const activeServer = getActiveServer(userId)
  if (!activeServer) {
    return {
      ok: false as const,
      response: Response.json({ ok: false, error: 'No active server configured' }, { status: 400 }),
    }
  }

  if (!meetsCapabilityRequirement(activeServer, requirement)) {
    return {
      ok: false as const,
      response: capabilityErrorResponse(requirement),
    }
  }

  return {
    ok: true as const,
    userId,
    serverId,
    activeServer,
  }
}
