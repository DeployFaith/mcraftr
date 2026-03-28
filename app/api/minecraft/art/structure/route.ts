import { NextRequest } from 'next/server'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import { getCatalogArtArtifact } from '@/lib/catalog-art/service'
import { resolveStructureArtContent, type StructureArtInput } from '@/lib/catalog-art/structure-route'
import { resolveStructureArtDescriptor } from '@/lib/catalog-art/resolvers/structure'
import { callSidecarForRequest } from '@/lib/server-bridge'
import type { StructurePreviewDescriptor } from '@/lib/minecraft-assets/structure-art'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type StructurePreviewResponse = {
  ok: boolean
  preview?: StructurePreviewDescriptor | null
}

function sanitizeVersion(raw: string | null) {
  return raw && /^[A-Za-z0-9._-]+$/.test(raw) ? raw : null
}

function normalizeStructureId(value: string) {
  const lower = decodeURIComponent(value).trim().toLowerCase()
  return lower.includes(':') ? lower : `minecraft:${lower}`
}

function extractStructureAliases(value: string) {
  const normalized = normalizeStructureId(value)
  const noNamespace = normalized.replace(/^minecraft:/, '')
  const noKindPrefix = noNamespace.replace(/^(native-worldgen|native-template|schematic):/, '')
  return [normalized, noNamespace, noKindPrefix]
}

function resolveStructureIconFilename(values: string[]) {
  const normalized = values
    .filter(Boolean)
    .flatMap(value => extractStructureAliases(value))

  const mansionAliases = new Set([
    'mansion',
    'minecraft:mansion',
    'woodland_mansion',
    'minecraft:woodland_mansion',
  ])
  const monumentAliases = new Set([
    'monument',
    'minecraft:monument',
    'ocean_monument',
    'minecraft:ocean_monument',
  ])

  for (const id of normalized) {
    if (mansionAliases.has(id) || id.includes('/mansion') || id.endsWith(':mansion')) {
      return 'woodland_mansion.png'
    }
    if (monumentAliases.has(id) || id.includes('/monument') || id.endsWith(':monument')) {
      return 'ocean_monument.png'
    }
  }

  return 'generic_structure.png'
}

async function getRealStructureIcon(values: string[]) {
  const realDir = path.join(process.cwd(), 'beacon/catalog-art/structures/real')
  const filename = resolveStructureIconFilename(values)
  const filePath = path.join(realDir, filename)
  try {
    return await fs.readFile(filePath)
  } catch {
    return null
  }
}

function buildPreviewEndpoint(input: StructureArtInput) {
  return `/structures/preview?${new URLSearchParams({
    placementKind: input.placementKind,
    ...(input.resourceKey ? { resourceKey: input.resourceKey } : {}),
    ...(input.relativePath ? { relativePath: input.relativePath } : {}),
    ...(input.format ? { format: input.format } : {}),
  }).toString()}`
}

export async function GET(req: NextRequest) {
  const version = sanitizeVersion(req.nextUrl.searchParams.get('version'))
  const placementKind = req.nextUrl.searchParams.get('placementKind')?.trim() || ''
  const resourceKey = req.nextUrl.searchParams.get('resourceKey')?.trim() || ''
  const relativePath = req.nextUrl.searchParams.get('relativePath')?.trim() || ''
  const format = req.nextUrl.searchParams.get('format')?.trim() || ''
  const artView = req.nextUrl.searchParams.get('artView')?.trim() || ''
  const label = req.nextUrl.searchParams.get('label')?.trim() || 'Structure'
  const iconId = req.nextUrl.searchParams.get('iconId')?.trim() || ''

  if (!version || !placementKind) {
    return new Response('Invalid structure art request', { status: 400 })
  }

  const input: StructureArtInput = {
    version,
    placementKind,
    resourceKey,
    relativePath,
    format,
    artView: artView === 'materials' ? 'materials' : artView === 'preview' ? 'preview' : null,
    label,
    iconId,
  }

  const result = await resolveStructureArtContent(input, {
    getPreview: async previewInput => {
      const sidecar = await callSidecarForRequest<StructurePreviewResponse>(req, buildPreviewEndpoint(previewInput))
      if (!sidecar.ok || sidecar.data.ok === false || !sidecar.data.preview) {
        return null
      }
      return sidecar.data.preview
    },
    getFallbackIcon: getRealStructureIcon,
    resolveDescriptor: resolveStructureArtDescriptor,
    getArtifact: getCatalogArtArtifact,
  })

  if (result.kind === 'artifact') {
    return new Response(new Uint8Array(result.artifact.content), {
      headers: {
        'Content-Type': result.artifact.mimeType,
        'Cache-Control': 'public, max-age=604800, stale-while-revalidate=86400',
      },
    })
  }

  if (result.kind === 'fallback') {
    return new Response(new Uint8Array(result.content), {
      headers: {
        'Content-Type': result.mimeType,
        'Cache-Control': 'public, max-age=604800, stale-while-revalidate=86400',
      },
    })
  }

  return new Response('Structure art unavailable', { status: 404 })
}
