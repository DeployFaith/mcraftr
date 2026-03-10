import type { NextRequest } from 'next/server'
import { requireTerminalAccess } from '@/lib/terminal-access'
import { mapTerminalCatalogEntries } from '@/lib/terminal'
import { LOCAL_TERMINAL_COMMANDS } from '@/lib/terminal-shared'
import { runBridgeJson } from '@/lib/server-bridge'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type BridgeCatalogResponse = {
  ok: boolean
  commands?: unknown[]
  error?: string
}

export async function GET(req: NextRequest) {
  const access = await requireTerminalAccess(req)
  if (!access.ok) return access.response

  const bridge = await runBridgeJson<BridgeCatalogResponse>(req, 'commands catalog')
  if (!bridge.ok || bridge.data.ok === false) {
    return Response.json({
      ok: true,
      warning: bridge.ok ? bridge.data.error || 'Bridge command catalog unavailable' : bridge.error,
      warningCode: bridge.ok ? null : bridge.code,
      commands: [],
      localCommands: LOCAL_TERMINAL_COMMANDS,
    })
  }

  return Response.json({
    ok: true,
    commands: mapTerminalCatalogEntries(bridge.data.commands),
    localCommands: LOCAL_TERMINAL_COMMANDS,
    warning: null,
    warningCode: null,
  })
}
