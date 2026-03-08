import { NextRequest } from 'next/server'
import { getToken } from 'next-auth/jwt'
import { getUserById } from '@/lib/users'
import {
  listDeviceAccounts,
  removeDeviceAccount,
  switchDeviceAccount,
  syncCurrentDeviceAccount,
} from '@/lib/device-accounts'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

async function getRequestUser(req: NextRequest) {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET, cookieName: 'authjs.session-token' })
  const userId = token?.id as string | undefined
  if (!userId) return null
  const user = getUserById(userId)
  if (!user) return null
  return user
}

export async function GET(req: NextRequest) {
  const user = await getRequestUser(req)
  if (!user) return Response.json({ ok: false, error: 'Unauthorized' }, { status: 401 })

  const accounts = await listDeviceAccounts()
  return Response.json({
    ok: true,
    currentUserId: user.id,
    accounts,
  })
}

export async function POST(req: NextRequest) {
  const user = await getRequestUser(req)
  if (!user) return Response.json({ ok: false, error: 'Unauthorized' }, { status: 401 })

  const accounts = await syncCurrentDeviceAccount(user.id, user.email)
  return Response.json({ ok: true, currentUserId: user.id, accounts })
}

export async function PUT(req: NextRequest) {
  const user = await getRequestUser(req)
  if (!user) return Response.json({ ok: false, error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const targetUserId = typeof body?.userId === 'string' ? body.userId : ''
  if (!targetUserId) {
    return Response.json({ ok: false, error: 'Missing userId' }, { status: 400 })
  }

  const accounts = await switchDeviceAccount(targetUserId)
  return Response.json({ ok: true, accounts, switchedUserId: targetUserId })
}

export async function DELETE(req: NextRequest) {
  const user = await getRequestUser(req)
  if (!user) return Response.json({ ok: false, error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const targetUserId = typeof body?.userId === 'string' ? body.userId : ''
  if (!targetUserId) {
    return Response.json({ ok: false, error: 'Missing userId' }, { status: 400 })
  }

  const accounts = await removeDeviceAccount(targetUserId)
  return Response.json({ ok: true, currentUserId: user.id, accounts })
}
