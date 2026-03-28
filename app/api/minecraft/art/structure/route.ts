import { NextRequest } from 'next/server'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import { resolveStructureArtDescriptor } from '@/lib/catalog-art/resolvers/structure'
import { getCatalogArtArtifact } from '@/lib/catalog-art/service'
import { callSidecarForRequest } from '@/lib/server-bridge'
import type { StructurePreviewDescriptor } from '@/lib/minecraft-assets/structure-art'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type PreviewResponse = {
  ok: boolean
  preview?: StructurePreviewDescriptor
}

function sanitizeVersion(raw: string | null) {
  return raw && /^[A-Za-z0-9._-]+$/.test(raw) ? raw : null
}

function normalizeStructureId(value: string) {
  const lower = value.trim().toLowerCase()
  return lower.includes(':') ? lower : `minecraft:${lower}`
}

async function getRealStructureIcon(structureId: string) {
  const id = normalizeStructureId(structureId)
  const realDir = path.join(process.cwd(), 'beacon/catalog-art/structures/real')
  const filename = id === 'minecraft:woodland_mansion'
    ? 'woodland_mansion.png'
    : id === 'minecraft:ocean_monument'
      ? 'ocean_monument.png'
      : 'generic_structure.png'
  const filePath = path.join(realDir, filename)
  try {
    return await fs.readFile(filePath)
  } catch {
    return null
  }
}

export async function GET(req: NextRequest) {
  const version = sanitizeVersion(req.nextUrl.searchParams.get('version'))
  const placementKind = req.nextUrl.searchParams.get('placementKind')?.trim() || ''
  const resourceKey = req.nextUrl.searchParams.get('resourceKey')?.trim() || ''
  const relativePath = req.nextUrl.searchParams.get('relativePath')?.trim() || ''
  const label = req.nextUrl.searchParams.get('label')?.trim() || 'Structure'
  const format = req.nextUrl.searchParams.get('format')?.trim() || ''
  const iconId = req.nextUrl.searchParams.get('iconId')?.trim() || ''

  if (!version || !placementKind) {
    return new Response('Invalid structure art request', { status: 400 })
  }

  const realIcon = await getRealStructureIcon(iconId || resourceKey || label)
  if (realIcon) {
    return new Response(new Uint8Array(realIcon), {
      headers: {
        'Content-Type': 'image/png',
        'Cache-Control': 'public, max-age=604800, stale-while-revalidate=86400',
      },
    })
  }

  const preview = await callSidecarForRequest<PreviewResponse>(
    req,
    `/structures/preview?${new URLSearchParams({
      placementKind,
      ...(resourceKey ? { resourceKey } : {}),
      ...(relativePath ? { relativePath } : {}),
      ...(format ? { format } : {}),
    }).toString()}`,
  )

  if (!preview.ok) {
    return new Response('Structure art unavailable', { status: preview.status ?? 404 })
  }

  if (!preview.data.preview) {
    return new Response('Structure art unavailable', { status: 404 })
  }

  try {
    const descriptor = await resolveStructureArtDescriptor({
      version,
      label,
      placementKind,
      resourceKey: resourceKey || null,
      relativePath: relativePath || null,
      format: format || null,
      preview: preview.data.preview,
    })
    const artifact = await getCatalogArtArtifact(descriptor)
    return new Response(new Uint8Array(artifact.content), {
      headers: {
        'Content-Type': artifact.mimeType,
        'Cache-Control': 'public, max-age=604800, stale-while-revalidate=86400',
      },
    })
  } catch {
    return new Response('Structure art unavailable', { status: 404 })
  }
}
