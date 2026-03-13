export const DEFAULT_MINECRAFT_VERSION = '1.21.11'

export type MinecraftVersionSource = 'manual' | 'bridge' | 'fallback'

export type MinecraftVersionState = {
  override: string | null
  resolved: string | null
  source: MinecraftVersionSource
  detectedAt: number | null
}

export function normalizeMinecraftVersion(raw: unknown): string | null {
  if (typeof raw !== 'string') return null
  const trimmed = raw.trim()
  return trimmed || null
}

export function normalizeMinecraftVersionSource(raw: unknown): MinecraftVersionSource | null {
  if (raw === 'manual' || raw === 'bridge' || raw === 'fallback') return raw
  return null
}

export function buildStoredMinecraftVersion(next: {
  override?: unknown
  resolved?: unknown
  source?: unknown
  detectedAt?: number | null
}): {
  override: string | null
  resolved: string | null
  source: MinecraftVersionSource | null
  detectedAt: number | null
} {
  const override = normalizeMinecraftVersion(next.override)
  const resolved = normalizeMinecraftVersion(next.resolved)
  const source = normalizeMinecraftVersionSource(next.source)
  const detectedAt = typeof next.detectedAt === 'number' ? next.detectedAt : null

  if (override) {
    return {
      override,
      resolved: override,
      source: 'manual',
      detectedAt,
    }
  }

  if (!resolved) {
    return {
      override: null,
      resolved: null,
      source: null,
      detectedAt: null,
    }
  }

  return {
    override: null,
    resolved,
    source: source ?? 'bridge',
    detectedAt,
  }
}

export function resolveMinecraftVersion(next: {
  override?: unknown
  resolved?: unknown
  source?: unknown
  detectedAt?: number | null
}): MinecraftVersionState {
  const stored = buildStoredMinecraftVersion(next)

  if (stored.override) {
    return {
      override: stored.override,
      resolved: stored.resolved,
      source: 'manual',
      detectedAt: stored.detectedAt,
    }
  }

  if (stored.resolved) {
    return {
      override: null,
      resolved: stored.resolved,
      source: stored.source ?? 'bridge',
      detectedAt: stored.detectedAt,
    }
  }

  return {
    override: null,
    resolved: DEFAULT_MINECRAFT_VERSION,
    source: 'fallback',
    detectedAt: null,
  }
}
