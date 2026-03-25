const PRIVATE_PREFIX = ['f', 'g', 'm', 'c'].join('')
const PRIVATE_PROVIDER = ['family', 'guard'].join('')

const PRIVATE_PATTERNS = [
  { pattern: new RegExp(`\\b${PRIVATE_PREFIX}\\b`, 'gi'), replacement: 'relay' },
  { pattern: new RegExp(`\\b${PRIVATE_PROVIDER}\\b`, 'gi'), replacement: 'Relay API integration' },
  { pattern: /\bmcrafter bridge\b/gi, replacement: 'relay integration' },
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
  return next || 'relay'
}

export function sanitizeBridgeProviderLabel(value: string | null | undefined) {
  return sanitizePublicText(value)?.trim() || 'Relay API integration'
}
