import { FALLBACK_ENTITY_CATALOG } from '@/lib/entity-catalog'

const WEIRD_EDGE_CASES = [
  'evoker_fangs',
  'lightning_bolt',
  'marker',
  'ominous_item_spawner',
  'falling_block',
  'item',
  'experience_orb',
  'eye_of_ender',
] as const

const UTILITY_DISPLAY = [
  'armor_stand',
  'item_frame',
  'glow_item_frame',
  'painting',
  'end_crystal',
  'area_effect_cloud',
  'interaction',
  'block_display',
  'item_display',
  'text_display',
] as const

const PROJECTILES = [
  'egg',
  'ender_pearl',
  'splash_potion',
  'lingering_potion',
  'fireball',
  'small_fireball',
  'dragon_fireball',
  'wind_charge',
  'breeze_wind_charge',
  'wither_skull',
  'llama_spit',
  'fishing_bobber',
  'trident',
  'arrow',
  'spectral_arrow',
] as const

const HIGH_VARIANCE_LIVING = [
  'ravager',
  'warden',
  'ghast',
  'elder_guardian',
  'ender_dragon',
  'villager',
  'witch',
  'camel',
  'sniffer',
  'panda',
  'wolf',
  'frog',
  'allay',
] as const

const VEHICLES = [
  'minecart',
  'chest_minecart',
  'furnace_minecart',
  'hopper_minecart',
  'tnt_minecart',
  'oak_boat',
  'oak_chest_boat',
  'bamboo_raft',
  'bamboo_chest_raft',
] as const

const KNOWN = new Set<string>([
  ...WEIRD_EDGE_CASES,
  ...UTILITY_DISPLAY,
  ...PROJECTILES,
  ...HIGH_VARIANCE_LIVING,
  ...VEHICLES,
])

export const ENTITY_AUDIT_BUCKETS = {
  weirdEdgeCases: [...WEIRD_EDGE_CASES],
  utilityDisplay: [...UTILITY_DISPLAY],
  projectiles: [...PROJECTILES],
  highVarianceLiving: [...HIGH_VARIANCE_LIVING],
  vehicles: [...VEHICLES],
  remainingLiving: FALLBACK_ENTITY_CATALOG
    .filter(entry => ['hostile', 'passive', 'neutral'].includes(entry.category))
    .map(entry => entry.id)
    .filter(id => !KNOWN.has(id)),
} as const

export function buildEntityReviewTemplate(version: string | '*' = '*') {
  return Object.entries(ENTITY_AUDIT_BUCKETS).flatMap(([bucket, ids]) =>
    ids.map(id => ({
      subject: 'entity' as const,
      subjectId: id,
      version,
      reviewState: 'warned' as const,
      notes: `Review ${bucket} presentation`,
    })),
  )
}
