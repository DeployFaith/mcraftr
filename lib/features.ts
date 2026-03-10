export const FEATURE_CATEGORIES = [
  { id: 'tabs', label: 'Navigation Tabs', desc: 'Show or hide top-level tabs' },
  { id: 'actions', label: 'Actions', desc: 'Control actions and utility tools' },
  { id: 'players', label: 'Players', desc: 'Control player panel detail sections' },
  { id: 'chat', label: 'Chat', desc: 'Control chat visibility and messaging' },
  { id: 'admin', label: 'Admin', desc: 'Control admin tools and sections' },
] as const

export type FeatureCategory = typeof FEATURE_CATEGORIES[number]['id']

export const FEATURE_DEFS = [
  { key: 'enable_dashboard_tab', label: 'Dashboard Tab', desc: 'Show/hide the Dashboard tab in navigation', category: 'tabs' },
  { key: 'enable_players_tab', label: 'Players Tab', desc: 'Show/hide the Players tab in navigation', category: 'tabs' },
  { key: 'enable_actions_tab', label: 'Actions Tab', desc: 'Show/hide the Actions tab in navigation', category: 'tabs' },
  { key: 'enable_worlds_tab', label: 'Worlds Tab', desc: 'Show/hide the Worlds tab in navigation', category: 'tabs' },
  { key: 'enable_chat', label: 'Chat Tab', desc: 'Show/hide the Chat tab in navigation', category: 'tabs' },
  { key: 'enable_admin', label: 'Admin Tab', desc: 'Show/hide the Admin tab in navigation', category: 'tabs' },

  { key: 'enable_world', label: 'World Commands', desc: 'Allow weather and time world controls', category: 'actions' },
  { key: 'enable_player_commands', label: 'Player Commands', desc: 'Allow gamemode and ability actions', category: 'actions' },
  { key: 'enable_teleport', label: 'Teleport', desc: 'Allow player and coordinate teleport', category: 'actions' },
  { key: 'enable_kits', label: 'Kit Assignment', desc: 'Allow giving built-in kits and managing custom saved kits', category: 'actions' },
  { key: 'enable_custom_kits', label: 'Custom Kit Builder', desc: 'Allow building, saving, editing, and using custom kits', category: 'actions' },
  { key: 'enable_item_catalog', label: 'Item Catalog', desc: 'Allow item give catalog', category: 'actions' },
  { key: 'enable_inventory', label: 'Inventory', desc: 'Allow inventory viewer and item movement', category: 'actions' },
  { key: 'enable_world_inventory', label: 'World Inventory', desc: 'Allow browsing world and integration inventory', category: 'actions' },
  { key: 'enable_world_build_tools', label: 'World Build Tools', desc: 'Allow curated WorldEdit and world actions', category: 'actions' },
  { key: 'enable_world_maps', label: 'World Maps', desc: 'Allow viewing linked map surfaces and map URLs', category: 'actions' },
  { key: 'enable_plugin_stack_status', label: 'Integration Status', desc: 'Allow viewing bridge and sidecar health and versions', category: 'actions' },
  { key: 'enable_world_spawn_tools', label: 'World Spawn Tools', desc: 'Allow resetting world spawn from coords or player location', category: 'actions' },
  { key: 'enable_structure_catalog', label: 'Structure Catalog', desc: 'Allow browsing, placing, and removing structures', category: 'actions' },
  { key: 'enable_entity_catalog', label: 'Entity Catalog', desc: 'Allow browsing and spawning entities', category: 'actions' },

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
  { key: 'enable_admin_schedules', label: 'Schedules', desc: 'Create and manage recurring server actions', category: 'admin' },
  { key: 'enable_rcon', label: 'Server Terminal', desc: 'Allow the advanced server terminal and raw command execution', category: 'admin' },
  { key: 'enable_admin_audit', label: 'Audit Log', desc: 'View admin action audit history', category: 'admin' },
  { key: 'enable_admin_user_management', label: 'User Management', desc: 'Create users and change roles', category: 'admin' },
  { key: 'enable_admin_feature_policies', label: 'Feature Policies', desc: 'Manage feature restrictions for users', category: 'admin' },
] as const

export type FeatureKey = typeof FEATURE_DEFS[number]['key']

export const FEATURE_KEYS: FeatureKey[] = FEATURE_DEFS.map(f => f.key)

export const DEFAULT_FEATURES: Record<FeatureKey, boolean> = Object.fromEntries(
  FEATURE_KEYS.map(k => [k, true])
) as Record<FeatureKey, boolean>
