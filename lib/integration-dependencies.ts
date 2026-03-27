import type { IntegrationId } from './integrations'

export type IntegrationDependency = {
  key: string
  label: string
  description: string
  integrationIds: IntegrationId[]
  selectionPreferenceKey?: string
}

export const INTEGRATION_DEPENDENCIES: IntegrationDependency[] = [
  {
    key: 'structure_editor',
    label: 'Structure Editor Provider',
    description: 'Used for overlapping build and schematic workflows when WorldEdit or FAWE can satisfy the same feature surface.',
    integrationIds: ['worldedit', 'fawe'],
    selectionPreferenceKey: 'structure_editor_provider',
  },
  {
    key: 'permissions_platform',
    label: 'Permissions Platform',
    description: 'Reserved for future permissions and group workflows powered by LuckPerms.',
    integrationIds: ['luckperms'],
  },
  {
    key: 'relay_live_workflows',
    label: 'Relay Live Workflows',
    description: 'Mcraftr Relay powers structured live workflows and advanced command discovery.',
    integrationIds: ['mcraftr-relay'],
  },
  {
    key: 'beacon_filesystem_surfaces',
    label: 'Beacon Filesystem Surfaces',
    description: 'Mcraftr Beacon powers filesystem-backed discovery and metadata surfaces.',
    integrationIds: ['mcraftr-beacon'],
  },
]

export function getIntegrationDependency(key: string) {
  return INTEGRATION_DEPENDENCIES.find(dependency => dependency.key === key) ?? null
}
