import { NextRequest } from 'next/server'
import { getEntityIconPng } from '@/lib/minecraft-assets/entity-icons'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function sanitizeVersion(raw: string) {
  return /^[A-Za-z0-9._-]+$/.test(raw) ? raw : null
}

function sanitizeEntityId(raw: string) {
  if (!/^[a-z0-9_:./-]+$/.test(raw)) return null
  return raw.includes(':') ? raw : `minecraft:${raw}`
}

function labelFromEntityId(entityId: string) {
  return entityId
    .split('_')
    .filter(Boolean)
    .map(segment => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(' ')
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ version: string; id: string }> },
) {
  const { version, id } = await params
  const safeVersion = sanitizeVersion(version)
  const safeEntityId = sanitizeEntityId(id)

  if (!safeVersion || !safeEntityId) {
    return new Response('Invalid entity art request', { status: 400 })
  }

  const sprite = await getEntityIconPng(safeEntityId)
  if (sprite) {
    return new Response(new Uint8Array(sprite), {
      headers: {
        'Content-Type': 'image/png',
        'Cache-Control': 'public, max-age=604800, stale-while-revalidate=86400',
      },
    })
  }

  return new Response(`Real entity art is not available yet for ${labelFromEntityId(safeEntityId)}.`, { status: 404 })
}
