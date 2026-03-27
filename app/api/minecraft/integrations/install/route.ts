import { NextRequest } from 'next/server'
import { parseIntegrationMutationBody, runIntegrationMutation } from '@/lib/integration-management'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const { integrationId } = parseIntegrationMutationBody(body)
  if (!integrationId) {
    return Response.json({ ok: false, error: 'integrationId is required' }, { status: 400 })
  }
  const result = await runIntegrationMutation(req, 'install', integrationId)
  return result.response
}
