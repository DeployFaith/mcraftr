import type { NextRequest } from 'next/server'
import { requireTerminalReadAccess } from '@/lib/terminal-access'
import { listTerminalHistory } from '@/lib/terminal'
import { checkFeatureAccess, getUserFeatureFlags } from '@/lib/rcon'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const access = await requireTerminalReadAccess(req)
  if (!access.ok) return access.response

  const features = await getUserFeatureFlags(req)
  if (!checkFeatureAccess(features, 'enable_rcon') || !checkFeatureAccess(features, 'enable_terminal_history')) {
    return Response.json({ ok: false, error: 'Feature disabled by admin' }, { status: 403 })
  }

  const { searchParams } = new URL(req.url)
  const limit = Number.parseInt(searchParams.get('limit') ?? '100', 10)
  const beforeRaw = searchParams.get('before')
  const before = beforeRaw ? Number.parseInt(beforeRaw, 10) : null

  return Response.json({
    ok: true,
    entries: listTerminalHistory(access.context.userId, access.context.serverId, limit, Number.isFinite(before ?? NaN) ? before : undefined),
  })
}
