import type { NextRequest } from 'next/server'
import { logAudit } from '@/lib/audit'
import { rconForRequest } from '@/lib/rcon'
import { requireTerminalAccess } from '@/lib/terminal-access'
import { appendTerminalHistory, touchTerminalFavorite } from '@/lib/terminal'
import { classifyCommandRisk, normalizeServerCommand } from '@/lib/terminal-shared'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const access = await requireTerminalAccess(req)
  if (!access.ok) return access.response

  try {
    const body = await req.json().catch(() => ({}))
    const source = body.source === 'wizard' || body.source === 'favorite' || body.source === 'compat' ? body.source : 'manual'
    const wizardId = typeof body.wizardId === 'string' && body.wizardId.trim() ? body.wizardId.trim() : null
    const favoriteId = typeof body.favoriteId === 'string' && body.favoriteId.trim() ? body.favoriteId.trim() : null
    const command = typeof body.command === 'string' ? body.command : ''
    const normalized = normalizeServerCommand(command)

    if (!normalized) {
      return Response.json({ ok: false, error: 'Command cannot be empty' }, { status: 400 })
    }
    if (normalized.startsWith('/:') || normalized === '/:') {
      return Response.json({ ok: false, error: 'Local terminal commands cannot be executed through RCON' }, { status: 400 })
    }
    if (normalized.length > 512) {
      return Response.json({ ok: false, error: 'Command too long (max 512 chars)' }, { status: 400 })
    }

    const startedAt = Date.now()
    const result = await rconForRequest(req, normalized.replace(/^\/+/, ''))
    const durationMs = Date.now() - startedAt
    const output = result.ok
      ? (result.stdout || '(no output)')
      : (result.error || result.stdout || 'RCON error')
    const riskLevel = classifyCommandRisk(normalized)
    const entry = appendTerminalHistory({
      userId: access.context.userId,
      serverId: access.context.serverId,
      command,
      normalizedCommand: normalized,
      output,
      ok: result.ok,
      durationMs,
      riskLevel,
      source,
      wizardId,
    })

    if (favoriteId) {
      touchTerminalFavorite(access.context.userId, access.context.serverId, favoriteId)
    }
    logAudit(access.context.userId, 'terminal_cmd', normalized.replace(/^\/+/, '').split(/\s+/)[0] || 'command', normalized, access.context.serverId)

    return Response.json({
      ok: result.ok,
      entry,
      output,
      error: result.ok ? null : output,
      durationMs,
      riskLevel,
    })
  } catch (error) {
    return Response.json({ ok: false, error: error instanceof Error ? error.message : 'Server error' }, { status: 500 })
  }
}
