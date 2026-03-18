import type { NextRequest } from 'next/server'
import { getTerminalState, saveTerminalState } from '@/lib/terminal'
import { requireTerminalAccess } from '@/lib/terminal-access'
import { getDefaultTerminalState, type TerminalState } from '@/lib/terminal-shared'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function sanitizeStatePatch(input: unknown): Partial<TerminalState> {
  if (!input || typeof input !== 'object') return {}
  const row = input as Record<string, unknown>
  const defaults = getDefaultTerminalState()
  const patch: Partial<TerminalState> = {}

  if (row.mode === 'embedded' || row.mode === 'maximized' || row.mode === 'popout') patch.mode = row.mode
  if (typeof row.explorerOpen === 'boolean') patch.explorerOpen = row.explorerOpen
  if (typeof row.inspectorOpen === 'boolean') patch.inspectorOpen = row.inspectorOpen
  if (row.activeInspectorTab === 'docs' || row.activeInspectorTab === 'wizard' || row.activeInspectorTab === 'favorites') {
    patch.activeInspectorTab = row.activeInspectorTab
  }
  patch.selectedCommand = typeof row.selectedCommand === 'string' && row.selectedCommand.trim() ? row.selectedCommand.trim() : null
  if (typeof row.commandDraft === 'string') patch.commandDraft = row.commandDraft.slice(0, 512)
  patch.wizardId = typeof row.wizardId === 'string' && row.wizardId.trim() ? row.wizardId.trim() : null
  patch.wizardDraft = row.wizardDraft && typeof row.wizardDraft === 'object' ? row.wizardDraft as Record<string, unknown> : null
  if (typeof row.leftPaneWidth === 'number' && Number.isFinite(row.leftPaneWidth)) patch.leftPaneWidth = Math.max(220, Math.min(420, row.leftPaneWidth))
  if (typeof row.rightPaneWidth === 'number' && Number.isFinite(row.rightPaneWidth)) patch.rightPaneWidth = Math.max(260, Math.min(460, row.rightPaneWidth))
  if (typeof row.transcriptHeight === 'number' && Number.isFinite(row.transcriptHeight)) patch.transcriptHeight = Math.max(220, Math.min(640, row.transcriptHeight))

  return {
    ...defaults,
    ...patch,
  }
}

export async function GET(req: NextRequest) {
  const access = await requireTerminalAccess(req)
  if (!access.ok) return access.response

  return Response.json({
    ok: true,
    state: getTerminalState(access.context.userId, access.context.serverId),
  })
}

export async function PATCH(req: NextRequest) {
  const access = await requireTerminalAccess(req)
  if (!access.ok) return access.response
  if (access.context.readOnly) {
    return Response.json({ ok: false, error: 'Public demo terminal access is read-only.' }, { status: 403 })
  }

  const body = await req.json().catch(() => ({}))
  const state = saveTerminalState(access.context.userId, access.context.serverId, sanitizeStatePatch(body))
  return Response.json({ ok: true, state })
}
