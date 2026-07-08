import { NextRequest } from 'next/server'
import { handlers } from '@/auth.node'
import { checkRateLimit } from '@/lib/ratelimit'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export const GET = handlers.GET

export async function POST(req: NextRequest, ctx: { params: Promise<{ nextauth: string[] }> }) {
  const params = await ctx.params
  const action = params?.nextauth?.[0]
  const provider = params?.nextauth?.[1]

  // Rate-limit credentials login attempts (signin page + credentials callback)
  const isCredentialsLogin = action === 'signin' || (action === 'callback' && provider === 'credentials')
  if (isCredentialsLogin) {
    const rl = await checkRateLimit(req, 'login')
    if (rl.limited) return rl.response
  }

  // NextAuth v5 handlers.POST only accepts the request
  return handlers.POST(req)
}
