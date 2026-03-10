import type { NextRequest } from 'next/server'
import { requireTerminalAccess } from '@/lib/terminal-access'
import { LOCAL_TERMINAL_COMMANDS, normalizeServerCommand, normalizeTerminalCommand } from '@/lib/terminal-shared'
import { runBridgeJson } from '@/lib/server-bridge'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type BridgeCompleteResponse = {
  ok: boolean
  line?: string
  matches?: string[]
  error?: string
}

export async function POST(req: NextRequest) {
  const access = await requireTerminalAccess(req)
  if (!access.ok) return access.response

  const body = await req.json().catch(() => ({}))
  const line = typeof body.line === 'string' ? normalizeTerminalCommand(body.line) : ''
  if (!line) {
    return Response.json({ ok: true, line: '', matches: [] })
  }

  if (line.startsWith(':')) {
    const needle = line.toLowerCase()
    const matches = LOCAL_TERMINAL_COMMANDS
      .map(item => item.id)
      .filter(item => item.startsWith(needle))
    return Response.json({ ok: true, line, matches })
  }

  const normalized = normalizeServerCommand(line)
  const encoded = Buffer.from(normalized, 'utf8').toString('base64url')
  const bridge = await runBridgeJson<BridgeCompleteResponse>(req, `commands complete64 ${encoded}`)
  if (!bridge.ok || bridge.data.ok === false) {
    return Response.json({
      ok: true,
      warning: bridge.ok ? bridge.data.error || 'Bridge completions unavailable' : bridge.error,
      warningCode: bridge.ok ? null : bridge.code,
      line: normalized,
      matches: [],
    })
  }

  const matches = Array.isArray(bridge.data.matches)
    ? bridge.data.matches.filter((entry): entry is string => typeof entry === 'string')
    : []

  return Response.json({
    ok: true,
    line: typeof bridge.data.line === 'string' ? bridge.data.line : normalized,
    matches,
    warning: null,
    warningCode: null,
  })
}
