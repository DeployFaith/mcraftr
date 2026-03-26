import type { NextRequest } from 'next/server'
import { requireTerminalReadAccess } from '@/lib/terminal-access'
import { mapTerminalCatalogEntries } from '@/lib/terminal'
import { LOCAL_TERMINAL_COMMANDS } from '@/lib/terminal-shared'
import { requireServerCapability } from '@/lib/server-capability'
import { runBridgeJson } from '@/lib/server-bridge'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type BridgeCatalogResponse = {
  ok: boolean
  commands?: unknown[]
  error?: string
}

export async function GET(req: NextRequest) {
  const access = await requireTerminalReadAccess(req)
  if (!access.ok) return access.response

  const capability = await requireServerCapability(req, 'relay')
  if (!capability.ok) return capability.response

  const bridge = await runBridgeJson<BridgeCatalogResponse>(req, 'commands catalog')
  if (!bridge.ok || bridge.data.ok === false) {
    if (!bridge.ok && (bridge.code === 'bridge_json_parse_failed' || (bridge.code === 'bridge_transport_failed' && /too many requests/i.test(bridge.error)))) {
      return Response.json({
        ok: true,
        commands: [],
        localCommands: LOCAL_TERMINAL_COMMANDS,
        warning: bridge.code === 'bridge_json_parse_failed'
          ? 'Relay command catalog is too large to parse right now. Raw commands, docs-only commands, and manual terminal execution still work.'
          : 'Relay command catalog is busy right now. Raw commands, docs-only commands, and manual terminal execution still work while Mcraftr backs off.',
        warningCode: bridge.code,
      })
    }
    return Response.json({ ok: false, error: bridge.ok ? bridge.data.error || 'Relay command catalog unavailable' : bridge.error, code: bridge.ok ? null : bridge.code }, { status: 502 })
  }

  return Response.json({
    ok: true,
    commands: mapTerminalCatalogEntries(bridge.data.commands),
    localCommands: LOCAL_TERMINAL_COMMANDS,
    warning: null,
    warningCode: null,
  })
}
