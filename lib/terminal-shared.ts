export type TerminalRiskLevel = 'low' | 'medium' | 'high'
export type TerminalEntrySource = 'manual' | 'wizard' | 'favorite' | 'compat'
export type TerminalMode = 'embedded' | 'maximized' | 'popout'

export type TerminalCatalogEntry = {
  name: string
  namespacedName: string | null
  aliases: string[]
  description: string | null
  usage: string | null
  permission: string | null
  source: string | null
  riskLevel: TerminalRiskLevel
  wizardId: string | null
}

export type TerminalStructuredOutput = Record<string, unknown> | unknown[] | null

export type TerminalHistoryEntry = {
  id: string
  userId: string
  serverId: string
  command: string
  normalizedCommand: string
  output: string
  structuredOutput: TerminalStructuredOutput
  ok: boolean
  durationMs: number
  riskLevel: TerminalRiskLevel
  source: TerminalEntrySource
  wizardId: string | null
  truncated: boolean
  createdAt: number
}

export type TerminalFavorite = {
  id: string
  userId: string
  serverId: string
  label: string
  command: string
  description: string | null
  groupName: string | null
  icon: string | null
  createdAt: number
  updatedAt: number
  lastUsedAt: number | null
}

export type TerminalState = {
  mode: TerminalMode
  explorerOpen: boolean
  inspectorOpen: boolean
  activeInspectorTab: 'docs' | 'wizard' | 'favorites'
  selectedCommand: string | null
  commandDraft: string
  wizardId: string | null
  wizardDraft: Record<string, unknown> | null
  leftPaneWidth: number
  rightPaneWidth: number
  transcriptHeight: number
}

export const LOCAL_TERMINAL_COMMANDS = [
  { id: ':help', label: 'Help', description: 'Show terminal help and keyboard shortcuts.' },
  { id: ':clear', label: 'Clear', description: 'Clear the local transcript view.' },
  { id: ':history', label: 'History', description: 'Focus the command history pane.' },
  { id: ':favorites', label: 'Favorites', description: 'Open the saved commands pane.' },
  { id: ':layout', label: 'Layout', description: 'Reset pane layout to defaults.' },
  { id: ':maximize', label: 'Maximize', description: 'Toggle fullscreen terminal mode.' },
  { id: ':popout', label: 'Pop Out', description: 'Open the terminal in a new browser tab.' },
] as const

const DEFAULT_STATE: TerminalState = {
  mode: 'embedded',
  explorerOpen: true,
  inspectorOpen: true,
  activeInspectorTab: 'docs',
  selectedCommand: null,
  commandDraft: '',
  wizardId: null,
  wizardDraft: null,
  leftPaneWidth: 280,
  rightPaneWidth: 340,
  transcriptHeight: 320,
}

function classifyByPatterns(value: string) {
  const normalized = value.trim().replace(/^\/+/, '').toLowerCase()
  if (!normalized) return 'low' as const

  const highRiskPatterns = [
    /^stop\b/,
    /^restart\b/,
    /^reload\b/,
    /^op\b/,
    /^deop\b/,
    /^ban\b/,
    /^ban-ip\b/,
    /^pardon\b/,
    /^pardon-ip\b/,
    /^kill\s+@e\b/,
    /^fill\b/,
    /^clone\b/,
    /^setblock\b/,
    /^whitelist\s+(off|reload)\b/,
    /^difficulty\b/,
    /^gamerule\b/,
    /^mcraftr\s+worlds\s+delete\b/,
    /^mcraftr\s+worldedit\b/,
    /^mcraftr\s+structures\s+(place|remove|clear)\b/,
  ]
  if (highRiskPatterns.some(pattern => pattern.test(normalized))) {
    return 'high' as const
  }

  const mediumRiskPatterns = [
    /^tp\b/,
    /^teleport\b/,
    /^kick\b/,
    /^give\b/,
    /^clear\b/,
    /^whitelist\b/,
    /^mcraftr\s+entities\s+spawn\b/,
    /^mcraftr\s+worlds\s+set\b/,
    /^mcraftr\s+worlds\s+(load|unload|clone|create|teleport|setspawn)\b/,
    /^mcraftr\s+player\s+gamemode\b/,
  ]
  if (mediumRiskPatterns.some(pattern => pattern.test(normalized))) {
    return 'medium' as const
  }
  return 'low' as const
}

export function normalizeTerminalCommand(value: string) {
  return value.replace(/\r?\n+/g, ' ').trim()
}

export function normalizeServerCommand(value: string) {
  const normalized = normalizeTerminalCommand(value)
  if (!normalized) return ''
  return normalized.startsWith('/') ? normalized : `/${normalized}`
}

export function classifyCommandRisk(value: string): TerminalRiskLevel {
  return classifyByPatterns(value)
}

export function getDefaultTerminalState(): TerminalState {
  return { ...DEFAULT_STATE }
}

export function wizardIdForCommand(commandName: string): string | null {
  const normalized = commandName.trim().replace(/^\/+/, '').toLowerCase()
  const token = normalized.split(/\s+/)[0] ?? ''
  const bare = token.includes(':') ? token.split(':').pop() ?? token : token
  if (bare === 'mcraftr' || bare === 'relay') return 'relay-root'
  if (bare === 'tp' || bare === 'teleport') return 'teleport'
  if (bare === 'whitelist') return 'whitelist'
  if (bare === 'kick') return 'kick'
  if (bare === 'ban' || bare === 'ban-ip') return 'ban'
  if (bare === 'op' || bare === 'deop') return 'operator'
  if (bare === 'give') return 'give'
  if (bare === 'gamerule') return 'gamerule'
  if (bare === 'say' || bare === 'broadcast') return 'broadcast'
  if (bare === 'msg' || bare === 'tell' || bare === 'w') return 'msg'
  if (bare === 'worldedit') return 'worldedit-basic'
  return null
}
