'use client'

type Props = {
  kind: 'structure' | 'entity'
  label: string
  category?: string | null
  sourceKind?: string | null
  imageUrl?: string | null
  className?: string
}

function encodeSvg(svg: string) {
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`
}

function fallbackUrl(kind: 'structure' | 'entity', label: string, category?: string | null, sourceKind?: string | null) {
  const top = kind === 'structure' ? '#1e2a3a' : '#1f3321'
  const bottom = kind === 'structure' ? '#355174' : '#2f6a37'
  const badge = kind === 'structure' ? '#ffd26a' : '#7df9a6'
  const name = label.slice(0, 22)
  const meta = [category, sourceKind].filter(Boolean).join(' · ').slice(0, 28)
  const glyph = kind === 'structure' ? '▧' : '◉'
  return encodeSvg(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 480 270">
      <defs>
        <linearGradient id="g" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0%" stop-color="${top}"/>
          <stop offset="100%" stop-color="${bottom}"/>
        </linearGradient>
      </defs>
      <rect width="480" height="270" rx="28" fill="url(#g)"/>
      <rect x="24" y="24" width="432" height="222" rx="22" fill="rgba(255,255,255,0.06)" stroke="rgba(255,255,255,0.14)"/>
      <text x="240" y="120" text-anchor="middle" font-size="88" fill="${badge}" font-family="monospace">${glyph}</text>
      <text x="240" y="176" text-anchor="middle" font-size="28" fill="#f5f7ff" font-family="monospace">${name}</text>
      <text x="240" y="208" text-anchor="middle" font-size="16" fill="rgba(245,247,255,0.74)" font-family="monospace">${meta || (kind === 'structure' ? 'structure catalog' : 'entity catalog')}</text>
    </svg>
  `)
}

export default function CatalogArtwork({
  kind,
  label,
  category,
  sourceKind,
  imageUrl,
  className = '',
}: Props) {
  const src = imageUrl || fallbackUrl(kind, label, category, sourceKind)
  return (
    <img
      src={src}
      alt={`${label} preview`}
      className={className}
      loading="lazy"
    />
  )
}
