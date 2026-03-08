export type CustomKitIconType = 'preset' | 'custom'

export type CustomKitItem = {
  itemId: string
  qty: number
}

export type CustomKitRecord = {
  id: string
  label: string
  iconType: CustomKitIconType
  iconValue: string
  items: CustomKitItem[]
  createdAt: number
  updatedAt: number
}

export const CUSTOM_KIT_ICON_IDS = [
  'axe',
  'brick-wall',
  'compass',
  'swords',
  'crown',
  'pickaxe',
  'backpack',
  'shield',
  'gem',
  'apple',
  'fish',
  'sparkles',
  'hammer',
  'map',
  'torch',
  'chest',
] as const

export type CustomKitIconId = typeof CUSTOM_KIT_ICON_IDS[number]

export const CUSTOM_KIT_LABEL_MAX = 32
export const CUSTOM_KIT_ITEM_MAX = 27
export const CUSTOM_KIT_CUSTOM_ICON_MAX_BYTES = 180_000

export function isCustomKitIconId(value: string): value is CustomKitIconId {
  return CUSTOM_KIT_ICON_IDS.includes(value as CustomKitIconId)
}

export function normalizeCustomKitLabel(value: string): string {
  return value.trim().replace(/\s+/g, ' ').slice(0, CUSTOM_KIT_LABEL_MAX)
}

export function isCustomIconDataUrl(value: string): boolean {
  return /^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(value)
}

export function estimateDataUrlBytes(value: string): number {
  const comma = value.indexOf(',')
  if (comma < 0) return 0
  const base64 = value.slice(comma + 1)
  return Math.floor((base64.length * 3) / 4)
}
