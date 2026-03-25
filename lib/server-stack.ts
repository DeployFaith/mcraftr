export type ServerStackMode = 'quick' | 'full'
export type ServerCapabilityRequirement = 'none' | 'relay' | 'beacon' | 'full'

type StackFlags = {
  bridge?: { enabled?: boolean | null } | null
  sidecar?: { enabled?: boolean | null } | null
  bridgeEnabled?: boolean | null
  sidecarEnabled?: boolean | null
}

function readFlag(value: StackFlags, key: 'bridge' | 'sidecar') {
  if (key === 'bridge') {
    if ('bridge' in value) return value.bridge?.enabled === true
    return value.bridgeEnabled === true
  }
  if ('sidecar' in value) return value.sidecar?.enabled === true
  return value.sidecarEnabled === true
}

export function hasFullMcraftrStack(value: StackFlags) {
  return readFlag(value, 'bridge') && readFlag(value, 'sidecar')
}

export function getServerStackMode(value: StackFlags): ServerStackMode {
  return hasFullMcraftrStack(value) ? 'full' : 'quick'
}

export function getServerStackLabel(mode: ServerStackMode) {
  return mode === 'full' ? 'Full Mcraftr Stack' : 'Quick Connect'
}

export function getServerStackDescription(mode: ServerStackMode) {
  return mode === 'full'
    ? 'RCON + Relay + Beacon for the full Mcraftr experience.'
    : 'RCON-only compatibility mode for basic Minecraft operations.'
}

export function hasRelay(value: StackFlags) {
  return readFlag(value, 'bridge')
}

export function hasBeacon(value: StackFlags) {
  return readFlag(value, 'sidecar')
}

export function meetsCapabilityRequirement(value: StackFlags, requirement: ServerCapabilityRequirement) {
  if (requirement === 'none') return true
  if (requirement === 'relay') return hasRelay(value)
  if (requirement === 'beacon') return hasBeacon(value)
  return hasFullMcraftrStack(value)
}
