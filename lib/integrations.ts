import type { FeatureKey } from './features'

export type IntegrationId = 'mcraftr-relay' | 'mcraftr-beacon' | 'luckperms' | 'worldedit' | 'fawe'

export type IntegrationKind = 'plugin' | 'service'
export type IntegrationOwner = 'mcraftr' | 'third-party'
export type SupportedServerType = 'paper' | 'spigot' | 'purpur'

export type IntegrationDefinition = {
  id: IntegrationId
  label: string
  description: string
  owner: IntegrationOwner
  kind: IntegrationKind
  pinnedVersion: string
  downloadUrl: string | null
  checksum: { algorithm: 'sha512' | 'sha256' | 'sha1'; value: string } | null
  filename: string | null
  supportedServerTypes: SupportedServerType[]
  supportedMinecraftVersions: string[]
  restartRequired: boolean
  detectPluginNames: string[]
  featureKeys: FeatureKey[]
  featureSummaries: string[]
  notes: string[]
}

export const INTEGRATION_DEFINITIONS: IntegrationDefinition[] = [
  {
    id: 'mcraftr-relay',
    label: 'Mcraftr Relay',
    description: 'Structured live workflow bridge for entities, worlds, terminal discovery, and advanced controls.',
    owner: 'mcraftr',
    kind: 'plugin',
    pinnedVersion: 'managed-by-mcraftr',
    downloadUrl: null,
    checksum: null,
    filename: null,
    supportedServerTypes: ['paper', 'spigot', 'purpur'],
    supportedMinecraftVersions: ['1.20', '1.21'],
    restartRequired: true,
    detectPluginNames: [],
    featureKeys: ['enable_terminal_autocomplete', 'enable_terminal_catalog', 'enable_world_management', 'enable_entity_live_tools'],
    featureSummaries: [
      'Relay-backed live entity targeting',
      'Terminal autocomplete and structured command discovery',
      'Richer world and entity workflows',
    ],
    notes: [
      'Detection currently comes from the saved Relay connection and provider metadata.',
      'Install management can be added later as a Mcraftr-owned distribution flow.',
    ],
  },
  {
    id: 'mcraftr-beacon',
    label: 'Mcraftr Beacon',
    description: 'Read-only filesystem-backed discovery layer for plugins, worlds, structures, maps, and entity presets.',
    owner: 'mcraftr',
    kind: 'service',
    pinnedVersion: 'managed-by-mcraftr',
    downloadUrl: null,
    checksum: null,
    filename: null,
    supportedServerTypes: ['paper', 'spigot', 'purpur'],
    supportedMinecraftVersions: ['1.20', '1.21'],
    restartRequired: false,
    detectPluginNames: [],
    featureKeys: ['enable_plugin_stack_status', 'enable_world_maps', 'enable_structure_catalog', 'enable_entity_catalog'],
    featureSummaries: [
      'Plugin inventory and stack visibility',
      'Filesystem-backed structure and entity catalog discovery',
      'Map and world metadata surfaces',
    ],
    notes: [
      'Detection comes from the configured Beacon sidecar connection.',
      'Write/install actions are intentionally out of scope for this milestone.',
    ],
  },
  {
    id: 'luckperms',
    label: 'LuckPerms',
    description: 'Permissions and groups platform for future Mcraftr roles, promotion flows, and policy-aware admin tooling.',
    owner: 'third-party',
    kind: 'plugin',
    pinnedVersion: '5.5.17',
    downloadUrl: 'https://cdn.modrinth.com/data/Vebnzrzj/versions/OrIs0S6b/LuckPerms-Bukkit-5.5.17.jar',
    checksum: { algorithm: 'sha512', value: '773895644260b338818bfeff0c78f8d4f590f56b0f711c378a4eec91be6e8b37354099b5db1ea5b2dce4c02486213297a6da09675c9bf6f014f9a400b5772cf3' },
    filename: 'LuckPerms-Bukkit-5.5.17.jar',
    supportedServerTypes: ['paper', 'spigot', 'purpur'],
    supportedMinecraftVersions: ['1.20', '1.21'],
    restartRequired: true,
    detectPluginNames: ['LuckPerms'],
    featureKeys: ['enable_admin_user_management', 'enable_admin_feature_policies'],
    featureSummaries: [
      'Future rank and group assignment surfaces',
      'Permission-aware user management tools',
      'Structured admin policy integrations',
    ],
    notes: [
      'Curated support is planned around pinned, reviewed builds only.',
    ],
  },
  {
    id: 'worldedit',
    label: 'WorldEdit',
    description: 'Baseline schematic and world editing plugin for build-oriented workflows.',
    owner: 'third-party',
    kind: 'plugin',
    pinnedVersion: '7.4.1',
    downloadUrl: 'https://cdn.modrinth.com/data/1u6JkXh5/versions/JUWRHdru/worldedit-bukkit-7.4.1.jar',
    checksum: { algorithm: 'sha512', value: '93407bede53159c7eb556547a448c42ed0bd2ab4564b1a4662839c76c359e13f284f6883756785c0a22df1cec526ef837d189a8af9204d2e99db75dc62b3a333' },
    filename: 'worldedit-bukkit-7.4.1.jar',
    supportedServerTypes: ['paper', 'spigot', 'purpur'],
    supportedMinecraftVersions: ['1.20', '1.21'],
    restartRequired: true,
    detectPluginNames: ['WorldEdit'],
    featureKeys: ['enable_world_build_tools', 'enable_structure_catalog', 'enable_structure_place'],
    featureSummaries: [
      'Baseline schematic and clipboard workflows',
      'Build-oriented structure operations',
      'Safer entry point for WorldEdit-backed tooling',
    ],
    notes: [
      'Mcraftr will keep WorldEdit and FAWE separate and let the user choose between them.',
    ],
  },
  {
    id: 'fawe',
    label: 'FAWE',
    description: 'FastAsyncWorldEdit for higher-performance editing workflows on supported Paper-family servers.',
    owner: 'third-party',
    kind: 'plugin',
    pinnedVersion: '2.15.0',
    downloadUrl: 'https://cdn.modrinth.com/data/z4HZZnLr/versions/MOe9fY3h/FastAsyncWorldEdit-Bukkit-2.15.0.jar',
    checksum: { algorithm: 'sha512', value: '862177cc1acbae3cb094af3416ac378a547318a47e1751b197e126465977e3177949b3eefd3fd5f3a54740f4d09248e4ae2a7f7d31c688d0eccf5455bca1c88a' },
    filename: 'FastAsyncWorldEdit-Bukkit-2.15.0.jar',
    supportedServerTypes: ['paper', 'spigot', 'purpur'],
    supportedMinecraftVersions: ['1.20', '1.21'],
    restartRequired: true,
    detectPluginNames: ['FastAsyncWorldEdit'],
    featureKeys: ['enable_world_build_tools', 'enable_structure_catalog', 'enable_structure_place'],
    featureSummaries: [
      'Alternative structure editing provider with stronger performance focus',
      'Advanced editing path for larger build workflows',
      'Separate selectable provider from WorldEdit',
    ],
    notes: [
      'Auto-recommendation should favor stability over capability when choosing between FAWE and WorldEdit.',
    ],
  },
]

export const INTEGRATIONS_BY_ID = Object.fromEntries(
  INTEGRATION_DEFINITIONS.map(integration => [integration.id, integration]),
) as Record<IntegrationId, IntegrationDefinition>

export function getIntegrationById(id: string | null | undefined): IntegrationDefinition | null {
  if (!id) return null
  return INTEGRATIONS_BY_ID[id as IntegrationId] ?? null
}

export function supportsMinecraftVersion(integration: IntegrationDefinition, version: string | null | undefined) {
  if (!version) return true
  return integration.supportedMinecraftVersions.some(prefix => version === prefix || version.startsWith(`${prefix}.`))
}
