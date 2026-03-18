import { NextRequest } from 'next/server'
import { checkFeatureAccess, getSessionUserId, getUserFeatureFlags, rconForRequest } from '@/lib/rcon'
import { getUserById } from '@/lib/users'
import { getDemoPlayerActionError } from '@/lib/demo-policy'
import { getDemoSyntheticCommandError } from '@/lib/demo-synthetic-player'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const PLAYER_RE = /^\.?[a-zA-Z0-9_]{1,16}$/
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

type Actor =
  | { type: 'player'; value: string }
  | { type: 'entity'; value: string; label?: string | null }

function uuidToSelector(uuid: string) {
  const hex = uuid.replace(/-/g, '')
  const ints: number[] = []
  for (let index = 0; index < 4; index += 1) {
    const chunk = hex.slice(index * 8, (index + 1) * 8)
    let value = Number.parseInt(chunk, 16)
    if (value > 0x7fffffff) value -= 0x100000000
    ints.push(value)
  }
  return `@e[nbt={UUID:[I;${ints.join(',')}]}]`
}

function actorLabel(actor: Actor) {
  return actor.type === 'player' ? actor.value : (actor.label?.trim() || actor.value)
}

function actorSelector(actor: Actor) {
  return actor.type === 'player' ? actor.value : uuidToSelector(actor.value)
}

function parseActor(raw: unknown, field: string): Actor {
  if (!raw || typeof raw !== 'object') {
    throw new Error(`Missing ${field}`)
  }
  const type = (raw as { type?: unknown }).type
  const value = (raw as { value?: unknown }).value
  const label = (raw as { label?: unknown }).label
  if (type === 'player') {
    if (typeof value !== 'string' || !PLAYER_RE.test(value)) {
      throw new Error(`Invalid ${field} player`)
    }
    return { type: 'player', value }
  }
  if (type === 'entity') {
    if (typeof value !== 'string' || !UUID_RE.test(value)) {
      throw new Error(`Invalid ${field} entity`)
    }
    return { type: 'entity', value, label: typeof label === 'string' ? label : null }
  }
  throw new Error(`Invalid ${field}`)
}

export async function POST(req: NextRequest) {
  const userId = await getSessionUserId(req)
  if (!userId) return Response.json({ ok: false, error: 'Unauthorized' }, { status: 401 })

  const features = await getUserFeatureFlags(req)
  if (!checkFeatureAccess(features, 'enable_teleport')) {
    return Response.json({ ok: false, error: 'Feature disabled by admin' }, { status: 403 })
  }

  try {
    const user = getUserById(userId)
    const body = await req.json().catch(() => ({}))
    const mode = typeof body.mode === 'string' ? body.mode : ''
    const selfCookie = req.cookies.get('mcraftr.demo-self-player')?.value ?? null

    if (mode === 'actor-to-actor') {
      const from = parseActor(body.from, 'from')
      const to = parseActor(body.to, 'to')
      if (from.type === 'player') {
        const restrictedError = getDemoPlayerActionError(user, from.value, selfCookie)
        if (restrictedError) return Response.json({ ok: false, error: restrictedError }, { status: 403 })
        const syntheticError = getDemoSyntheticCommandError(userId, from.value, 'Teleport')
        if (syntheticError) return Response.json({ ok: false, error: syntheticError }, { status: 400 })
      }
      if (to.type === 'player') {
        const restrictedError = getDemoPlayerActionError(user, to.value, selfCookie)
        if (restrictedError) return Response.json({ ok: false, error: restrictedError }, { status: 403 })
        const syntheticError = getDemoSyntheticCommandError(userId, to.value, 'Teleport')
        if (syntheticError) return Response.json({ ok: false, error: syntheticError }, { status: 400 })
      }
      const result = await rconForRequest(req, `tp ${actorSelector(from)} ${actorSelector(to)}`)
      if (!result.ok) return Response.json({ ok: false, error: result.error || 'RCON error' })
      return Response.json({ ok: true, message: `Teleported ${actorLabel(from)} → ${actorLabel(to)}` })
    }

    if (mode === 'actor-to-coords') {
      const actor = parseActor(body.actor, 'actor')
      const x = Number(body.x)
      const y = Number(body.y)
      const z = Number(body.z)
      if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) {
        return Response.json({ ok: false, error: 'Coordinates must be numbers' }, { status: 400 })
      }
      if (actor.type === 'player') {
        const restrictedError = getDemoPlayerActionError(user, actor.value, selfCookie)
        if (restrictedError) return Response.json({ ok: false, error: restrictedError }, { status: 403 })
        const syntheticError = getDemoSyntheticCommandError(userId, actor.value, 'Teleport')
        if (syntheticError) return Response.json({ ok: false, error: syntheticError }, { status: 400 })
      }
      const result = await rconForRequest(req, `tp ${actorSelector(actor)} ${x} ${y} ${z}`)
      if (!result.ok) return Response.json({ ok: false, error: result.error || 'RCON error' })
      return Response.json({ ok: true, message: `Teleported ${actorLabel(actor)} → ${x}, ${y}, ${z}` })
    }

    return Response.json({ ok: false, error: 'Unsupported teleport mode' }, { status: 400 })
  } catch (error) {
    return Response.json({ ok: false, error: error instanceof Error ? error.message : 'Teleport failed' }, { status: 400 })
  }
}
