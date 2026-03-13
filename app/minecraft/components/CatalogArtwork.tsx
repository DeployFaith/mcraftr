'use client'

import { useEffect, useState } from 'react'
import type { CatalogArtPayload } from '@/lib/catalog-art/types'

type Props = {
  kind: 'structure' | 'entity' | 'item'
  label: string
  category?: string | null
  sourceKind?: string | null
  imageUrl?: string | null
  art?: CatalogArtPayload | null
  className?: string
}

function encodeSvg(svg: string) {
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`
}

function hashValue(value: string) {
  let hash = 0
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0
  }
  return hash
}

function toneSet(kind: 'structure' | 'entity' | 'item', seed: number) {
  const structureSets = [
    ['#10263b', '#2a4f72', '#9ed8ff', '#ffdd8a'],
    ['#22152d', '#5b3f7a', '#f1b0ff', '#ffd0a8'],
    ['#1c252f', '#50677f', '#b9ffdd', '#ffe39b'],
  ]
  const entitySets = [
    ['#112417', '#2f6a37', '#8effb5', '#ffe391'],
    ['#2b1414', '#7f3030', '#ff9d8d', '#ffd86b'],
    ['#122229', '#2b6c7b', '#97f0ff', '#baf79b'],
  ]
  const itemSets = [
    ['#171d31', '#384567', '#99c8ff', '#ffe091'],
    ['#1d182d', '#4f3e75', '#dcb6ff', '#ffd6a5'],
    ['#18261f', '#3a6e52', '#abffd1', '#fff0a8'],
  ]
  const sets = kind === 'structure' ? structureSets : kind === 'entity' ? entitySets : itemSets
  return sets[seed % sets.length]
}

function buildEntityScene(seed: number, accent: string) {
  const width = 92 + (seed % 38)
  const height = 108 + (seed % 42)
  const x = 240 - width / 2
  const y = 132 - height / 2
  const eye = 14 + (seed % 8)
  const hornHeight = 10 + (seed % 16)
  return `
    <ellipse cx="240" cy="146" rx="126" ry="84" fill="rgba(255,255,255,0.08)" />
    <ellipse cx="240" cy="162" rx="88" ry="22" fill="rgba(0,0,0,0.18)" />
    <rect x="${x}" y="${y}" width="${width}" height="${height}" rx="30" fill="rgba(14,20,25,0.68)" stroke="rgba(255,255,255,0.16)" />
    <rect x="${x + 18}" y="${y + 24}" width="${eye}" height="${eye}" rx="4" fill="${accent}" />
    <rect x="${x + width - 18 - eye}" y="${y + 24}" width="${eye}" height="${eye}" rx="4" fill="${accent}" />
    <rect x="${x + 20}" y="${y + height - 16}" width="18" height="30" rx="7" fill="rgba(14,20,25,0.78)" />
    <rect x="${x + width - 38}" y="${y + height - 16}" width="18" height="30" rx="7" fill="rgba(14,20,25,0.78)" />
    <path d="M${x + 18},${y + 10} L${x + 34},${y - hornHeight} L${x + 46},${y + 10}" fill="rgba(14,20,25,0.68)" />
    <path d="M${x + width - 18},${y + 10} L${x + width - 34},${y - hornHeight} L${x + width - 46},${y + 10}" fill="rgba(14,20,25,0.68)" />
  `
}

function buildStructureScene(seed: number, accent: string, badge: string) {
  const towerA = 54 + (seed % 32)
  const towerB = 68 + ((seed >> 3) % 38)
  const towerC = 44 + ((seed >> 5) % 26)
  return `
    <rect x="96" y="70" width="288" height="122" rx="26" fill="rgba(255,255,255,0.05)" stroke="rgba(255,255,255,0.12)" />
    <path d="M120 184 L170 ${184 - towerA} L220 184 Z" fill="rgba(10,16,22,0.66)" />
    <path d="M190 184 L258 ${184 - towerB} L328 184 Z" fill="rgba(10,16,22,0.78)" />
    <path d="M288 184 L334 ${184 - towerC} L372 184 Z" fill="rgba(10,16,22,0.58)" />
    <rect x="128" y="190" width="224" height="14" rx="7" fill="${accent}" opacity="0.72" />
    <path d="M114 86 H366" stroke="rgba(255,255,255,0.12)" stroke-dasharray="6 8" />
    <path d="M114 118 H366" stroke="rgba(255,255,255,0.09)" stroke-dasharray="6 8" />
    <path d="M114 150 H366" stroke="rgba(255,255,255,0.08)" stroke-dasharray="6 8" />
    <text x="240" y="132" text-anchor="middle" font-size="74" fill="${badge}" font-family="monospace">▧</text>
  `
}

function buildItemScene(seed: number, accent: string, badge: string) {
  const gem = 40 + (seed % 20)
  return `
    <ellipse cx="240" cy="170" rx="74" ry="18" fill="rgba(0,0,0,0.18)" />
    <path d="M240 78 L${240 + gem} 126 L240 174 L${240 - gem} 126 Z" fill="${accent}" opacity="0.9" />
    <path d="M240 92 L${240 + gem - 10} 128 L240 164 L${240 - gem + 10} 128 Z" fill="rgba(255,255,255,0.2)" />
    <path d="M240 96 L260 126 L240 144 L220 126 Z" fill="${badge}" opacity="0.86" />
    <rect x="202" y="178" width="76" height="14" rx="7" fill="rgba(255,255,255,0.12)" />
  `
}

function fallbackUrl(kind: 'structure' | 'entity' | 'item', label: string, category?: string | null, sourceKind?: string | null) {
  const seed = hashValue(`${kind}:${label}:${category || ''}:${sourceKind || ''}`)
  const [top, bottom, accent, badge] = toneSet(kind, seed)
  const name = label.slice(0, 22)
  const meta = [category, sourceKind].filter(Boolean).join(' · ').slice(0, 28)
  const index = String((seed % 151) + 1).padStart(3, '0')
  const scene = kind === 'entity'
    ? buildEntityScene(seed, accent)
    : kind === 'structure'
      ? buildStructureScene(seed, accent, badge)
      : buildItemScene(seed, accent, badge)
  return encodeSvg(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 480 270">
      <defs>
        <linearGradient id="g" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0%" stop-color="${top}"/>
          <stop offset="100%" stop-color="${bottom}"/>
        </linearGradient>
        <linearGradient id="frame" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0%" stop-color="rgba(255,255,255,0.34)"/>
          <stop offset="100%" stop-color="rgba(255,255,255,0.08)"/>
        </linearGradient>
      </defs>
      <rect width="480" height="270" rx="30" fill="url(#g)"/>
      <rect x="14" y="14" width="452" height="242" rx="28" fill="rgba(6,10,16,0.24)" stroke="url(#frame)" stroke-width="2"/>
      <rect x="28" y="28" width="424" height="34" rx="16" fill="rgba(10,14,18,0.4)" stroke="rgba(255,255,255,0.12)"/>
      <text x="48" y="50" font-size="14" fill="#f4f7ff" font-family="monospace">${name}</text>
      <text x="420" y="50" text-anchor="end" font-size="12" fill="${badge}" font-family="monospace">#${index}</text>
      <rect x="28" y="72" width="424" height="148" rx="24" fill="rgba(9,14,20,0.24)" stroke="rgba(255,255,255,0.12)"/>
      ${scene}
      <rect x="28" y="228" width="424" height="20" rx="10" fill="rgba(10,14,18,0.44)" stroke="rgba(255,255,255,0.1)"/>
      <text x="44" y="242" font-size="12" fill="${accent}" font-family="monospace">${kind === 'structure' ? 'BUILD CARD' : kind === 'entity' ? 'FIELD CARD' : 'ITEM CARD'}</text>
      <text x="436" y="242" text-anchor="end" font-size="11" fill="rgba(245,247,255,0.74)" font-family="monospace">${meta || (kind === 'structure' ? 'structure catalog' : kind === 'entity' ? 'entity catalog' : 'item catalog')}</text>
    </svg>
  `)
}

export default function CatalogArtwork({
  kind,
  label,
  category,
  sourceKind,
  imageUrl,
  art,
  className = '',
}: Props) {
  const fallback = fallbackUrl(
    kind,
    label,
    [category, art?.class, art?.strategy].filter(Boolean).join(' · ') || category,
    sourceKind,
  )
  const primaryUrl = art?.url ?? imageUrl ?? null
  const [src, setSrc] = useState(primaryUrl || fallback)

  useEffect(() => {
    setSrc(primaryUrl || fallback)
  }, [primaryUrl, fallback])

  return (
    <img
      src={src}
      alt={`${label} preview`}
      className={className}
      data-art-class={art?.class ?? kind}
      data-art-strategy={art?.strategy ?? 'fallback-card'}
      loading="lazy"
      onError={() => {
        if (src !== fallback) setSrc(fallback)
      }}
    />
  )
}
