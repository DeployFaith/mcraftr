const PRIVATE_PREFIX = ['f', 'g', 'm', 'c'].join('')
const PRIVATE_PROVIDER = ['family', 'guard'].join('')

const PRIVATE_PATTERNS = [
  { pattern: new RegExp(`\\b${PRIVATE_PREFIX}\\b`, 'gi'), replacement: 'bridge' },
  { pattern: new RegExp(`\\b${PRIVATE_PROVIDER}\\b`, 'gi'), replacement: 'Server Bridge' },
  { pattern: /\bmcrafter bridge\b/gi, replacement: 'server bridge' },
]

export function sanitizePublicText(value: string | null | undefined) {
  if (!value) return value ?? null
  let next = value
  for (const entry of PRIVATE_PATTERNS) {
    next = next.replace(entry.pattern, entry.replacement)
  }
  return next
}

export function sanitizeBridgePrefix(value: string | null | undefined) {
  const next = sanitizePublicText(value)?.trim().replace(/^\/+/, '')
  return next || 'bridge'
}

export function sanitizeBridgeProviderLabel(value: string | null | undefined) {
  return sanitizePublicText(value)?.trim() || 'Server Bridge'
}
