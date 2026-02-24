export const FEATURE_CATEGORIES = [
  { id: 'tabs', label: 'Navigation Tabs', desc: 'Show or hide top-level tabs' },
  { id: 'actions', label: 'Actions', desc: 'Control actions and utility tools' },
  { id: 'players', label: 'Players', desc: 'Control player panel detail sections' },
  { id: 'chat', label: 'Chat', desc: 'Control chat visibility and messaging' },
  { id: 'admin', label: 'Admin', desc: 'Control admin tools and sections' },
] as const

export type FeatureCategory = typeof FEATURE_CATEGORIES[number]['id']

export const FEATURE_DEFS = [
  { key: 'enable_chat', label: 'Chat Tab', desc: 'Show/hide the Chat tab in navigation', category: 'tabs' },
  { key: 'enable_admin', label: 'Admin Tab', desc: 'Show/hide the Admin tab in navigation', category: 'tabs' },

  { key: 'enable_world', label: 'World Commands', desc: 'Allow weather and time world controls', category: 'actions' },
  { key: 'enable_player_commands', label: 'Player Commands', desc: 'Allow gamemode and ability actions', category: 'actions' },
  { key: 'enable_teleport', label: 'Teleport', desc: 'Allow player and coordinate teleport', category: 'actions' },
  { key: 'enable_kits', label: 'Kit Assignment', desc: 'Allow giving predefined kits', category: 'actions' },
  { key: 'enable_item_catalog', label: 'Item Catalog', desc: 'Allow item give catalog', category: 'actions' },
  { key: 'enable_inventory', label: 'Inventory', desc: 'Allow inventory viewer and item movement', category: 'actions' },

  { key: 'enable_player_session', label: 'Player Session', desc: 'Show online time, ping, dimension and gamemode', category: 'players' },
  { key: 'enable_player_vitals', label: 'Player Vitals', desc: 'Show health, hunger and experience', category: 'players' },
  { key: 'enable_player_location', label: 'Player Location', desc: 'Show current and spawn coordinates', category: 'players' },
  { key: 'enable_player_effects', label: 'Player Effects', desc: 'Show active effects in player panel', category: 'players' },

  { key: 'enable_chat_read', label: 'View Chat Logs', desc: 'Allow reading chat history', category: 'chat' },
  { key: 'enable_chat_write', label: 'Send Chat Messages', desc: 'Allow broadcast and private messages', category: 'chat' },

  { key: 'enable_admin_server_info', label: 'Server Info', desc: 'Show live server status and TPS', category: 'admin' },
  { key: 'enable_admin_rules', label: 'Rules & Difficulty', desc: 'Manage difficulty and gamerules', category: 'admin' },
  { key: 'enable_admin_server_controls', label: 'Server Controls', desc: 'Save world and stop server', category: 'admin' },
  { key: 'enable_admin_moderation', label: 'Moderation', desc: 'Kick, ban, pardon and view ban list', category: 'admin' },
  { key: 'enable_admin_whitelist', label: 'Whitelist', desc: 'Manage whitelist entries', category: 'admin' },
  { key: 'enable_admin_operator', label: 'Operator', desc: 'Grant or revoke operator status', category: 'admin' },
  { key: 'enable_rcon', label: 'RCON Console', desc: 'Allow raw RCON console commands', category: 'admin' },
  { key: 'enable_admin_audit', label: 'Audit Log', desc: 'View admin action audit history', category: 'admin' },
  { key: 'enable_admin_user_management', label: 'User Management', desc: 'Create users and change roles', category: 'admin' },
  { key: 'enable_admin_feature_policies', label: 'Feature Policies', desc: 'Manage feature restrictions for users', category: 'admin' },
] as const

export type FeatureKey = typeof FEATURE_DEFS[number]['key']

export const FEATURE_KEYS: FeatureKey[] = FEATURE_DEFS.map(f => f.key)

export const DEFAULT_FEATURES: Record<FeatureKey, boolean> = Object.fromEntries(
  FEATURE_KEYS.map(k => [k, true])
) as Record<FeatureKey, boolean>
