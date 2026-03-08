'use client'

import {
  Apple,
  Axe,
  Backpack,
  BrickWall,
  Compass,
  Crown,
  Gem,
  Hammer,
  Map,
  Pickaxe,
  Package,
  Shield,
  Sparkles,
  Swords,
  Flame,
  Fish,
} from 'lucide-react'
import type { CustomKitIconId, CustomKitIconType } from '@/lib/custom-kits'

const ICONS: Record<CustomKitIconId, React.ComponentType<{ size?: number; color?: string; strokeWidth?: number }>> = {
  axe: Axe,
  'brick-wall': BrickWall,
  compass: Compass,
  swords: Swords,
  crown: Crown,
  pickaxe: Pickaxe,
  backpack: Backpack,
  shield: Shield,
  gem: Gem,
  apple: Apple,
  fish: Fish,
  sparkles: Sparkles,
  hammer: Hammer,
  map: Map,
  torch: Flame,
  chest: Package,
}

export function renderPresetKitIcon(
  iconId: CustomKitIconId,
  props: { size?: number; color?: string; strokeWidth?: number } = {},
) {
  const Icon = ICONS[iconId]
  return <Icon size={props.size ?? 18} color={props.color} strokeWidth={props.strokeWidth ?? 1.5} />
}

export default function KitIcon({
  iconType,
  iconValue,
  size = 18,
  color = 'currentColor',
}: {
  iconType: CustomKitIconType
  iconValue: string
  size?: number
  color?: string
}) {
  if (iconType === 'custom') {
    return (
      <span
        className="inline-block shrink-0"
        style={{
          width: size,
          height: size,
          backgroundColor: color,
          WebkitMaskImage: `url(${iconValue})`,
          WebkitMaskRepeat: 'no-repeat',
          WebkitMaskPosition: 'center',
          WebkitMaskSize: 'contain',
          maskImage: `url(${iconValue})`,
          maskRepeat: 'no-repeat',
          maskPosition: 'center',
          maskSize: 'contain',
        }}
      />
    )
  }

  return renderPresetKitIcon(iconValue as CustomKitIconId, { size, color, strokeWidth: 1.5 })
}
