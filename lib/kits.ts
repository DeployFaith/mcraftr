// Shared kit definitions — single source of truth for both the API route
// and the client-side preview. Import from here, not duplicated anywhere.

import { Axe, BrickWall, Compass, Swords, Crown, type LucideProps } from 'lucide-react'

export type LucideIcon = React.ComponentType<LucideProps>

export type KitItem = {
  name: string
  qty: number
  enchants?: string
}

export type KitDef = {
  id: string
  label: string
  Icon: LucideIcon
  items: KitItem[]
  // RCON give commands with {player} placeholder
  commands: string[]
  adminOnly?: boolean
}

export const KITS: KitDef[] = [
  {
    id: 'starter',
    label: 'Starter',
    Icon: Axe,
    items: [
      { name: 'Iron Sword',      qty: 1 },
      { name: 'Iron Pickaxe',    qty: 1 },
      { name: 'Iron Axe',        qty: 1 },
      { name: 'Iron Shovel',     qty: 1 },
      { name: 'Iron Helmet',     qty: 1 },
      { name: 'Iron Chestplate', qty: 1 },
      { name: 'Iron Leggings',   qty: 1 },
      { name: 'Iron Boots',      qty: 1 },
      { name: 'Shield',          qty: 1 },
      { name: 'Crafting Table',  qty: 1 },
      { name: 'Furnace',         qty: 1 },
      { name: 'Torch',           qty: 64 },
      { name: 'Cooked Beef',     qty: 64 },
    ],
    commands: [
      'give {player} minecraft:iron_sword 1',
      'give {player} minecraft:iron_pickaxe 1',
      'give {player} minecraft:iron_axe 1',
      'give {player} minecraft:iron_shovel 1',
      'give {player} minecraft:torch 64',
      'give {player} minecraft:cooked_beef 64',
      'give {player} minecraft:iron_helmet 1',
      'give {player} minecraft:iron_chestplate 1',
      'give {player} minecraft:iron_leggings 1',
      'give {player} minecraft:iron_boots 1',
      'give {player} minecraft:crafting_table 1',
      'give {player} minecraft:furnace 1',
      'give {player} minecraft:shield 1',
    ],
  },
  {
    id: 'builder',
    label: 'Builder',
    Icon: BrickWall,
    items: [
      { name: 'Oak Planks',   qty: 64 },
      { name: 'Stone Bricks', qty: 64 },
      { name: 'Glass',        qty: 64 },
      { name: 'Oak Log',      qty: 64 },
      { name: 'Cobblestone',  qty: 64 },
      { name: 'Scaffolding',  qty: 32 },
      { name: 'Lantern',      qty: 16 },
      { name: 'Shears',       qty: 1 },
      { name: 'Diamond Axe',  qty: 1, enchants: 'Efficiency V · Unbreaking III · Mending' },
    ],
    commands: [
      'give {player} minecraft:oak_planks 64',
      'give {player} minecraft:stone_bricks 64',
      'give {player} minecraft:glass 64',
      'give {player} minecraft:oak_log 64',
      'give {player} minecraft:cobblestone 64',
      'give {player} minecraft:shears 1',
      'give {player} minecraft:diamond_axe[minecraft:enchantments={efficiency:5,unbreaking:3,mending:1}] 1',
      'give {player} minecraft:scaffolding 32',
      'give {player} minecraft:lantern 16',
    ],
  },
  {
    id: 'explorer',
    label: 'Explorer',
    Icon: Compass,
    items: [
      { name: 'Diamond Sword',   qty: 1, enchants: 'Sharpness III · Unbreaking III' },
      { name: 'Bow',             qty: 1, enchants: 'Power III · Unbreaking III' },
      { name: 'Arrow',           qty: 64 },
      { name: 'Iron Helmet',     qty: 1 },
      { name: 'Iron Chestplate', qty: 1 },
      { name: 'Iron Leggings',   qty: 1 },
      { name: 'Iron Boots',      qty: 1 },
      { name: 'Elytra',          qty: 1 },
      { name: 'Firework Rocket', qty: 8 },
      { name: 'Ender Pearl',     qty: 16 },
      { name: 'Compass',         qty: 1 },
      { name: 'Clock',           qty: 1 },
    ],
    commands: [
      'give {player} minecraft:diamond_sword[minecraft:enchantments={sharpness:3,unbreaking:3}] 1',
      'give {player} minecraft:bow[minecraft:enchantments={power:3,unbreaking:3}] 1',
      'give {player} minecraft:arrow 64',
      'give {player} minecraft:iron_helmet 1',
      'give {player} minecraft:iron_chestplate 1',
      'give {player} minecraft:iron_leggings 1',
      'give {player} minecraft:iron_boots 1',
      'give {player} minecraft:compass 1',
      'give {player} minecraft:clock 1',
      'give {player} minecraft:ender_pearl 16',
      'give {player} minecraft:elytra 1',
      'give {player} minecraft:firework_rocket 8',
    ],
  },
  {
    id: 'combat',
    label: 'Combat',
    Icon: Swords,
    items: [
      { name: 'Diamond Sword',      qty: 1, enchants: 'Sharpness V · Fire Aspect II · Looting III · Unbreaking III' },
      { name: 'Bow',                qty: 1, enchants: 'Power V · Infinity · Flame · Unbreaking III' },
      { name: 'Arrow',              qty: 1 },
      { name: 'Diamond Helmet',     qty: 1, enchants: 'Protection IV · Unbreaking III' },
      { name: 'Diamond Chestplate', qty: 1, enchants: 'Protection IV · Unbreaking III' },
      { name: 'Diamond Leggings',   qty: 1, enchants: 'Protection IV · Unbreaking III' },
      { name: 'Diamond Boots',      qty: 1, enchants: 'Protection IV · Feather Falling IV · Unbreaking III' },
      { name: 'Golden Apple',       qty: 8 },
      { name: 'Totem of Undying',   qty: 1 },
    ],
    commands: [
      'give {player} minecraft:diamond_sword[minecraft:enchantments={sharpness:5,fire_aspect:2,looting:3,unbreaking:3}] 1',
      'give {player} minecraft:bow[minecraft:enchantments={power:5,infinity:1,unbreaking:3,flame:1}] 1',
      'give {player} minecraft:arrow 1',
      'give {player} minecraft:diamond_helmet[minecraft:enchantments={protection:4,unbreaking:3}] 1',
      'give {player} minecraft:diamond_chestplate[minecraft:enchantments={protection:4,unbreaking:3}] 1',
      'give {player} minecraft:diamond_leggings[minecraft:enchantments={protection:4,unbreaking:3}] 1',
      'give {player} minecraft:diamond_boots[minecraft:enchantments={protection:4,feather_falling:4,unbreaking:3}] 1',
      'give {player} minecraft:golden_apple 8',
      'give {player} minecraft:totem_of_undying 1',
    ],
  },
  {
    id: 'admin',
    label: 'Admin',
    Icon: Crown,
    adminOnly: true,
    items: [
      { name: 'Netherite Sword',      qty: 1, enchants: 'Sharpness V · Fire Aspect II · Looting III · Unbreaking III · Mending' },
      { name: 'Netherite Pickaxe',    qty: 1, enchants: 'Efficiency V · Fortune III · Unbreaking III · Mending' },
      { name: 'Netherite Helmet',     qty: 1, enchants: 'Protection IV · Unbreaking III · Mending' },
      { name: 'Netherite Chestplate', qty: 1, enchants: 'Protection IV · Unbreaking III · Mending' },
      { name: 'Netherite Leggings',   qty: 1, enchants: 'Protection IV · Unbreaking III · Mending' },
      { name: 'Netherite Boots',      qty: 1, enchants: 'Protection IV · Feather Falling IV · Unbreaking III · Mending' },
      { name: 'Elytra',              qty: 1 },
      { name: 'Golden Apple',        qty: 64 },
      { name: 'Totem of Undying',    qty: 3 },
      { name: 'Shulker Box',         qty: 1 },
      { name: 'Beacon',              qty: 1 },
    ],
    commands: [
      'give {player} minecraft:netherite_sword[minecraft:enchantments={sharpness:5,fire_aspect:2,looting:3,unbreaking:3,mending:1}] 1',
      'give {player} minecraft:netherite_pickaxe[minecraft:enchantments={efficiency:5,fortune:3,unbreaking:3,mending:1}] 1',
      'give {player} minecraft:netherite_helmet[minecraft:enchantments={protection:4,unbreaking:3,mending:1}] 1',
      'give {player} minecraft:netherite_chestplate[minecraft:enchantments={protection:4,unbreaking:3,mending:1}] 1',
      'give {player} minecraft:netherite_leggings[minecraft:enchantments={protection:4,unbreaking:3,mending:1}] 1',
      'give {player} minecraft:netherite_boots[minecraft:enchantments={protection:4,feather_falling:4,unbreaking:3,mending:1}] 1',
      'give {player} minecraft:elytra 1',
      'give {player} minecraft:golden_apple 64',
      'give {player} minecraft:totem_of_undying 3',
      'give {player} minecraft:shulker_box 1',
      'give {player} minecraft:beacon 1',
    ],
  },
]

export const KITS_BY_ID = Object.fromEntries(KITS.map(k => [k.id, k]))
