import { NextRequest } from 'next/server'
import { resolveItemArtDescriptor } from '@/lib/catalog-art/resolvers/item'
import { getCatalogArtArtifact } from '@/lib/catalog-art/service'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function sanitizeVersion(raw: string) {
  return /^[A-Za-z0-9._-]+$/.test(raw) ? raw : null
}

function sanitizeItemId(raw: string) {
  return /^[a-z0-9_./-]+$/.test(raw) ? raw : null
}

function labelFromItemId(itemId: string) {
  return itemId
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
  const safeItemId = sanitizeItemId(id)

  if (!safeVersion || !safeItemId) {
    return new Response('Invalid item art request', { status: 400 })
  }

  try {
    const descriptor = await resolveItemArtDescriptor({
      version: safeVersion,
      itemId: safeItemId,
      label: labelFromItemId(safeItemId),
    })
    const artifact = await getCatalogArtArtifact(descriptor)
    return new Response(new Uint8Array(artifact.content), {
      headers: {
        'Content-Type': artifact.mimeType,
        'Cache-Control': 'public, max-age=604800, stale-while-revalidate=86400',
      },
    })
  } catch {
    return new Response('Item art unavailable', { status: 404 })
  }
}
