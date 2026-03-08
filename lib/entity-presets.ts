export type EntityPresetData = {
  id: string
  label: string
  entityId: string
  category: string
  summary: string
  dangerous: boolean
  defaultCount: number
  customName: string | null
  health: number | null
  persistenceRequired: boolean
  noAi: boolean
  silent: boolean
  glowing: boolean
  invulnerable: boolean
  noGravity: boolean
  advancedNbt: string | null
}

function clampCount(value: unknown, fallback = 1): number {
  const count = Number(value)
  if (!Number.isFinite(count)) return fallback
  return Math.max(1, Math.min(64, Math.floor(count)))
}

function cleanString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

function cleanBool(value: unknown): boolean {
  return value === true
}

export function slugifyPresetId(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'entity-preset'
}

export function titleCase(value: string): string {
  return value
    .split(/[_\-/\s]+/)
    .filter(Boolean)
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

export function normalizeEntityPresetInput(raw: Record<string, unknown>): EntityPresetData {
  const entityId = cleanString(raw.entityId) || cleanString(raw.id) || 'pig'
  const label = cleanString(raw.label) || titleCase(entityId)
  const category = (cleanString(raw.category) || 'custom').toLowerCase()
  const summary = cleanString(raw.summary) || `${label} ready for spawning.`
  return {
    id: slugifyPresetId(cleanString(raw.id) || label),
    label,
    entityId,
    category,
    summary,
    dangerous: cleanBool(raw.dangerous),
    defaultCount: clampCount(raw.defaultCount),
    customName: cleanString(raw.customName),
    health: Number.isFinite(Number(raw.health)) ? Number(raw.health) : null,
    persistenceRequired: cleanBool(raw.persistenceRequired),
    noAi: cleanBool(raw.noAi),
    silent: cleanBool(raw.silent),
    glowing: cleanBool(raw.glowing),
    invulnerable: cleanBool(raw.invulnerable),
    noGravity: cleanBool(raw.noGravity),
    advancedNbt: cleanString(raw.advancedNbt),
  }
}

function escapeSnbtString(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
}

function advancedNbtBody(raw: string | null): string | null {
  if (!raw) return null
  const trimmed = raw.trim()
  if (!trimmed) return null
  if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
    return trimmed.slice(1, -1).trim() || null
  }
  return trimmed
}

export function buildPresetSnbt(preset: EntityPresetData): string | null {
  const parts: string[] = []
  if (preset.customName) {
    const jsonName = JSON.stringify({ text: preset.customName })
    parts.push(`CustomName:'${escapeSnbtString(jsonName)}'`)
    parts.push('CustomNameVisible:1b')
  }
  if (preset.health !== null) parts.push(`Health:${preset.health}f`)
  if (preset.persistenceRequired) parts.push('PersistenceRequired:1b')
  if (preset.noAi) parts.push('NoAI:1b')
  if (preset.silent) parts.push('Silent:1b')
  if (preset.glowing) parts.push('Glowing:1b')
  if (preset.invulnerable) parts.push('Invulnerable:1b')
  if (preset.noGravity) parts.push('NoGravity:1b')
  const advanced = advancedNbtBody(preset.advancedNbt)
  if (advanced) parts.push(advanced)
  if (parts.length === 0) return null
  return `{${parts.join(',')}}`
}
