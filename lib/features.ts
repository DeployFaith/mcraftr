export const FEATURE_DEFS = [
  { key: 'enable_chat', label: 'Chat Tab', desc: 'Show/hide the Chat tab in navigation', category: 'tabs' },
  { key: 'enable_chat_read', label: 'View Chat Logs', desc: 'Allow reading chat history', category: 'chat' },
  { key: 'enable_chat_write', label: 'Send Chat Messages', desc: 'Allow broadcast and private messages', category: 'chat' },
  { key: 'enable_teleport', label: 'Teleport', desc: 'Allow player and coordinate teleport', category: 'actions' },
  { key: 'enable_inventory', label: 'Inventory', desc: 'Allow inventory viewer and item movement', category: 'actions' },
  { key: 'enable_rcon', label: 'RCON Console', desc: 'Allow raw RCON console commands', category: 'admin' },
  { key: 'enable_admin', label: 'Admin Panel', desc: 'Allow access to admin tab and tools', category: 'tabs' },
  { key: 'enable_world', label: 'World Commands', desc: 'Allow weather and time world controls', category: 'actions' },
  { key: 'enable_player_commands', label: 'Player Commands', desc: 'Allow gamemode and ability actions', category: 'actions' },
  { key: 'enable_kits', label: 'Kit Assignment', desc: 'Allow giving predefined kits', category: 'actions' },
  { key: 'enable_item_catalog', label: 'Item Catalog', desc: 'Allow item give catalog', category: 'actions' },
] as const

export type FeatureKey = typeof FEATURE_DEFS[number]['key']

export const FEATURE_KEYS: FeatureKey[] = FEATURE_DEFS.map(f => f.key)

export const DEFAULT_FEATURES: Record<FeatureKey, boolean> = Object.fromEntries(
  FEATURE_KEYS.map(k => [k, true])
) as Record<FeatureKey, boolean>
