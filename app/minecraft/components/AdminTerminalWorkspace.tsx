'use client'

import { startTransition, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react'
import { ArrowUpRight, BookOpen, Command, ExternalLink, GripVertical, LayoutPanelLeft, LayoutPanelTop, Maximize2, Minimize2, Play, Plus, Search, Star, Trash2, X } from 'lucide-react'
import ConfirmModal from './ConfirmModal'
import CapabilityLockCard from './CapabilityLockCard'
import IntegrationDependencyPrompt from './IntegrationDependencyPrompt'
import IntegrationRecommendationModal from './IntegrationRecommendationModal'
import { useIntegrationManager } from './useIntegrationManager'
import type { FeatureKey } from '@/lib/features'
import type {
  TerminalCatalogEntry,
  TerminalFavorite,
  TerminalHistoryEntry,
  TerminalMode,
  TerminalState,
} from '@/lib/terminal-shared'
import {
  LOCAL_TERMINAL_COMMANDS,
  classifyCommandRisk,
  getDefaultTerminalState,
  normalizeServerCommand,
  normalizeTerminalCommand,
  wizardIdForCommand,
} from '@/lib/terminal-shared'

type LocalTranscriptEntry = {
  id: string
  command: string
  output: string
  ok: boolean
  createdAt: number
  local: true
}

type WorkspaceEntry =
  | (TerminalHistoryEntry & { local?: false })
  | LocalTranscriptEntry

type WorkspaceProps = {
  initialMode?: TerminalMode
  standalone?: boolean
  fullPage?: boolean
  readOnly?: boolean
  relayEnabled?: boolean
}

type WorldEditSchematic = {
  name: string
  path: string
  sizeBytes: number | null
  updatedAt: number | null
}

type FeatureFlags = Record<FeatureKey, boolean>

type WizardTabId = NonNullable<TerminalState['activeInspectorTab']>

const RIGHT_TABS: WizardTabId[] = ['docs', 'wizard', 'favorites']

function cn(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(' ')
}

function groupCatalog(entries: TerminalCatalogEntry[]) {
  const groups = new Map<string, TerminalCatalogEntry[]>()
  for (const entry of entries) {
    const key = (entry.source?.trim() || 'minecraft').toUpperCase()
    const bucket = groups.get(key) ?? []
    bucket.push(entry)
    groups.set(key, bucket)
  }
  return Array.from(groups.entries()).sort(([a], [b]) => a.localeCompare(b))
}

function formatTimestamp(unixSeconds: number) {
  return new Date(unixSeconds * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

function prettyDuration(ms: number) {
  if (ms < 1000) return `${ms}ms`
  return `${(ms / 1000).toFixed(2)}s`
}

function structuredPreview(value: unknown) {
  if (!value) return null
  try {
    return JSON.stringify(value, null, 2)
  } catch {
    return null
  }
}

function initialWizardDraft(commandName: string | null) {
  switch (commandName) {
    case 'teleport':
      return { mode: 'player', target: '', destination: '', x: '', y: '', z: '' }
    case 'whitelist':
      return { action: 'add', player: '' }
    case 'kick':
      return { player: '', reason: '' }
    case 'ban':
      return { mode: 'ban', player: '', reason: '' }
    case 'operator':
      return { action: 'op', player: '' }
    case 'give':
      return { player: '', item: 'minecraft:stone', amount: '1' }
    case 'gamerule':
      return { rule: 'keepInventory', value: 'true' }
    case 'broadcast':
      return { message: '' }
    case 'msg':
      return { player: '', message: '' }
    case 'worldedit-basic':
      return { player: '', action: 'info', source: '', target: '', amount: '1', schematic: '' }
    case 'relay-root':
    case 'mcraftr-root':
      return { subcommand: 'stack status', args: '' }
    default:
      return {}
  }
}

function commandBaseName(command: string) {
  const normalized = normalizeServerCommand(command).replace(/^\/+/, '')
  return normalized.split(/\s+/)[0]?.toLowerCase() || null
}

function wizardLabel(wizardId: string | null) {
  switch (wizardId) {
    case 'relay-root':
      return 'Relay wizard available'
    case 'teleport':
      return 'Teleport wizard available'
    case 'whitelist':
      return 'Whitelist wizard available'
    case 'kick':
      return 'Kick wizard available'
    case 'ban':
      return 'Ban wizard available'
    case 'operator':
      return 'Operator wizard available'
    case 'give':
      return 'Give wizard available'
    case 'gamerule':
      return 'Gamerule wizard available'
    case 'broadcast':
      return 'Broadcast wizard available'
    case 'msg':
      return 'Message wizard available'
    case 'worldedit-basic':
      return 'WorldEdit wizard available'
    default:
      return 'Docs only'
  }
}

function applyCompletion(current: string, completion: string) {
  const line = current
  if (!line.trim()) return completion
  if (line.startsWith(':')) return completion
  if (completion.startsWith('/')) return completion

  const endsWithSpace = /\s$/.test(line)
  if (endsWithSpace) return `${line}${completion} `
  const match = line.match(/^(.*\s)(\S+)$/)
  if (!match) return completion.startsWith('/') ? completion : `/${completion}`
  return `${match[1]}${completion} `
}

export default function AdminTerminalWorkspace({
  initialMode = 'embedded',
  standalone = false,
  fullPage = false,
  readOnly = false,
  relayEnabled = true,
}: WorkspaceProps) {
  const transcriptRef = useRef<HTMLDivElement | null>(null)
  const commandInputRef = useRef<HTMLInputElement | null>(null)
  const explorerSearchRef = useRef<HTMLInputElement | null>(null)
  const [state, setState] = useState<TerminalState>(() => ({ ...getDefaultTerminalState(), mode: initialMode }))
  const [hydrated, setHydrated] = useState(false)
  const [loading, setLoading] = useState(true)
  const [catalog, setCatalog] = useState<TerminalCatalogEntry[]>([])
  const [history, setHistory] = useState<TerminalHistoryEntry[]>([])
  const [favorites, setFavorites] = useState<TerminalFavorite[]>([])
  const [localEntries, setLocalEntries] = useState<LocalTranscriptEntry[]>([])
  const [clearedAfter, setClearedAfter] = useState(0)
  const [explorerQuery, setExplorerQuery] = useState('')
  const deferredExplorerQuery = useDeferredValue(explorerQuery)
  const [loadingError, setLoadingError] = useState<string | null>(null)
  const [catalogWarning, setCatalogWarning] = useState<string | null>(null)
  const [catalogWarningCode, setCatalogWarningCode] = useState<string | null>(null)
  const [executing, setExecuting] = useState(false)
  const [completionLoading, setCompletionLoading] = useState(false)
  const [suggestions, setSuggestions] = useState<string[]>([])
  const [suggestionIndex, setSuggestionIndex] = useState(0)
  const [historyIndex, setHistoryIndex] = useState(-1)
  const [confirmCommand, setConfirmCommand] = useState<string | null>(null)
  const [confirmIntegrationInstall, setConfirmIntegrationInstall] = useState<string | null>(null)
  const [favoriteId, setFavoriteId] = useState<string | null>(null)
  const [favoriteLabel, setFavoriteLabel] = useState('')
  const [favoriteDescription, setFavoriteDescription] = useState('')
  const [favoriteBusy, setFavoriteBusy] = useState(false)
  const [worldeditSchematics, setWorldeditSchematics] = useState<WorldEditSchematic[]>([])
  const [worldeditLoading, setWorldeditLoading] = useState(false)
  const [worldeditHint, setWorldeditHint] = useState<string | null>(null)
  const [integrationRecommendationOpen, setIntegrationRecommendationOpen] = useState(false)
  const [features, setFeatures] = useState<FeatureFlags | null>(null)

  const {
    data: integrationsData,
    busyKey: integrationsBusy,
    status: integrationsStatus,
    refresh: loadIntegrations,
    runAction: executeIntegrationAction,
    savePreference: persistStructureEditorPreference,
    structureProviderStatuses,
    structureProviderPreference,
    structureProviderRecommendation,
  } = useIntegrationManager({ autoLoad: false })

  const effectiveMode = standalone ? state.mode : (state.mode === 'popout' ? 'embedded' : state.mode)
  const selectedCommand = state.selectedCommand
  const commandDraft = state.commandDraft
  const selectedBase = useMemo(() => commandBaseName(selectedCommand ?? commandDraft), [selectedCommand, commandDraft])
  const canCatalog = features ? features.enable_rcon && features.enable_terminal_catalog : true
  const canDocs = features ? features.enable_rcon && features.enable_terminal_docs : true
  const canWizards = features ? features.enable_rcon && features.enable_terminal_wizards : true
  const canAutocomplete = features ? features.enable_rcon && features.enable_terminal_autocomplete : true
  const canHistory = features ? features.enable_rcon && features.enable_terminal_history : true
  const canFavorites = features ? features.enable_rcon && features.enable_terminal_favorites : true
  const visibleInspectorTabs = RIGHT_TABS.filter(tab => {
    if (tab === 'docs') return canDocs
    if (tab === 'wizard') return canWizards
    if (tab === 'favorites') return canFavorites
    return true
  })

  useEffect(() => {
    let mounted = true
    const load = async () => {
      setLoading(true)
      setLoadingError(null)
      setCatalogWarning(null)
      setCatalogWarningCode(null)
      try {
        const [prefsRes, catalogRes, historyRes, favoritesRes, stateRes] = await Promise.all([
          fetch('/api/account/preferences', { cache: 'no-store' }),
          relayEnabled && canCatalog
            ? fetch('/api/minecraft/terminal/catalog', { cache: 'no-store' })
            : Promise.resolve(new Response(JSON.stringify({ ok: false, error: 'This feature requires Mcraftr Relay.', code: 'requires_relay' }), { status: 409, headers: { 'Content-Type': 'application/json' } })),
          canHistory
            ? fetch('/api/minecraft/terminal/history?limit=100', { cache: 'no-store' })
            : Promise.resolve(new Response(JSON.stringify({ ok: true, entries: [] }), { headers: { 'Content-Type': 'application/json' } })),
          canFavorites
            ? fetch('/api/minecraft/terminal/favorites', { cache: 'no-store' })
            : Promise.resolve(new Response(JSON.stringify({ ok: true, favorites: [] }), { headers: { 'Content-Type': 'application/json' } })),
          fetch('/api/minecraft/terminal/state', { cache: 'no-store' }),
        ])
        const [prefsData, catalogData, historyData, favoritesData, stateData] = await Promise.all([
          prefsRes.json(),
          catalogRes.json(),
          historyRes.json(),
          favoritesRes.json(),
          stateRes.json(),
        ])
        if (!mounted) return

        if (prefsData.ok && prefsData.features) {
          setFeatures(prefsData.features)
        }

        if (!historyData.ok) throw new Error(historyData.error || 'Failed to load terminal history')
        if (!favoritesData.ok) throw new Error(favoritesData.error || 'Failed to load favorites')
        if (!stateData.ok) throw new Error(stateData.error || 'Failed to load terminal state')

        setCatalog(canCatalog && Array.isArray(catalogData.commands) ? catalogData.commands : [])
        setCatalogWarning(
          !canCatalog
            ? 'The command catalog is disabled by your feature policy. Manual execution still works.'
            : typeof catalogData.warning === 'string' && catalogData.warning.trim()
            ? catalogData.warning.trim()
            : typeof catalogData.error === 'string' && catalogData.error.trim()
              ? catalogData.error.trim()
              : null,
        )
        setCatalogWarningCode(
          !canCatalog
            ? 'feature_disabled'
            : typeof catalogData.warningCode === 'string'
            ? catalogData.warningCode
            : typeof catalogData.code === 'string'
              ? catalogData.code
              : null,
        )
        setHistory(canHistory && Array.isArray(historyData.entries) ? historyData.entries : [])
        setFavorites(canFavorites && Array.isArray(favoritesData.favorites) ? favoritesData.favorites : [])
        setState(prev => ({
          ...prev,
          ...stateData.state,
          mode: standalone ? (stateData.state?.mode ?? initialMode) : (stateData.state?.mode === 'popout' ? initialMode : (stateData.state?.mode ?? initialMode)),
        }))
      } catch (error) {
        if (!mounted) return
        setLoadingError(error instanceof Error ? error.message : 'Failed to load terminal workspace')
      } finally {
        if (mounted) {
          setLoading(false)
          setHydrated(true)
        }
      }
    }
    void load()
    return () => { mounted = false }
  }, [canCatalog, canFavorites, canHistory, initialMode, relayEnabled, standalone])

  useEffect(() => {
    if (readOnly) return
    if (!hydrated) return
    const timer = window.setTimeout(async () => {
      try {
        await fetch('/api/minecraft/terminal/state', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(state),
        })
      } catch {}
    }, 250)
    return () => window.clearTimeout(timer)
  }, [hydrated, readOnly, state])

  useEffect(() => {
    if (!commandDraft.trim()) {
      setSuggestions([])
      setSuggestionIndex(0)
      return
    }

    if (commandDraft.startsWith(':')) {
      const needle = commandDraft.toLowerCase()
      const matches = LOCAL_TERMINAL_COMMANDS
        .map(item => item.id)
        .filter(item => item.startsWith(needle))
      setSuggestions(matches)
      setSuggestionIndex(0)
      return
    }

    if (!relayEnabled || !canAutocomplete) {
      setSuggestions([])
      setSuggestionIndex(0)
      setCompletionLoading(false)
      return
    }

    const controller = new AbortController()
    const timer = window.setTimeout(async () => {
      setCompletionLoading(true)
      try {
        const response = await fetch('/api/minecraft/terminal/complete', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ line: commandDraft }),
          signal: controller.signal,
        })
        const data = await response.json()
        if (!response.ok || data.ok === false) {
          throw new Error(data.error || 'Failed to load completions')
        }
        setSuggestions(Array.isArray(data.matches) ? data.matches : [])
        setSuggestionIndex(0)
      } catch {
        if (!controller.signal.aborted) {
          setSuggestions([])
          setSuggestionIndex(0)
        }
      } finally {
        if (!controller.signal.aborted) setCompletionLoading(false)
      }
    }, 180)

    return () => {
      controller.abort()
      window.clearTimeout(timer)
    }
  }, [canAutocomplete, commandDraft, relayEnabled])

  useEffect(() => {
    if (!transcriptRef.current) return
    transcriptRef.current.scrollTop = transcriptRef.current.scrollHeight
  }, [history, localEntries, clearedAfter])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        explorerSearchRef.current?.focus()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  const catalogMap = useMemo(() => {
    const map = new Map<string, TerminalCatalogEntry>()
    for (const entry of catalog) {
      map.set(entry.name.toLowerCase(), entry)
      if (entry.namespacedName) map.set(entry.namespacedName.toLowerCase(), entry)
      for (const alias of entry.aliases) {
        map.set(alias.toLowerCase(), entry)
      }
    }
    return map
  }, [catalog])

  const selectedCatalogEntry = selectedCommand
    ? catalogMap.get(selectedCommand.replace(/^\/+/, '').split(/\s+/)[0]?.toLowerCase() ?? '')
    : (selectedBase ? catalogMap.get(selectedBase) ?? null : null)

  const selectedLocalCommand = selectedCommand?.startsWith(':')
    ? LOCAL_TERMINAL_COMMANDS.find(item => item.id === selectedCommand) ?? null
    : null

  const currentWizardId = state.wizardId
    ?? selectedCatalogEntry?.wizardId
    ?? (selectedBase ? wizardIdForCommand(selectedBase) : null)

  const openWizard = (command: string | null, wizardId = currentWizardId) => {
    if (!wizardId) return
    updateState({
      inspectorOpen: true,
      activeInspectorTab: 'wizard',
      selectedCommand: command,
      wizardId,
      wizardDraft: initialWizardDraft(wizardId),
    })
  }

  useEffect(() => {
    if (!relayEnabled || currentWizardId !== 'worldedit-basic') return
    let cancelled = false
    const loadWorldEditContext = async () => {
      setWorldeditLoading(true)
      setWorldeditHint(null)
      try {
        const response = await fetch('/api/minecraft/worldedit', { cache: 'no-store' })
        const data = await response.json()
        if (cancelled) return
        if (!response.ok || data.ok === false) {
          setWorldeditSchematics([])
          setWorldeditHint(typeof data.error === 'string' ? data.error : 'WorldEdit context unavailable')
          return
        }
        setWorldeditSchematics(Array.isArray(data.schematics) ? data.schematics : [])
        setWorldeditHint(typeof data.bridge?.note === 'string' ? data.bridge.note : null)
      } catch {
        if (!cancelled) {
          setWorldeditSchematics([])
          setWorldeditHint('WorldEdit context unavailable')
        }
      } finally {
        if (!cancelled) setWorldeditLoading(false)
      }
    }
    void loadWorldEditContext()
    void loadIntegrations()
    return () => { cancelled = true }
  }, [currentWizardId, loadIntegrations, relayEnabled])

  const setupHint = useMemo(() => {
    if (!catalogWarning) return null
    if (catalogWarningCode === 'bridge_invalid_prefix' || /prefix .* is not valid/i.test(catalogWarning)) {
      return 'The saved relay prefix does not match this server. Update the active server in Connect before using live catalog, autocomplete, or wizards.'
    }
    if (/bridge integration is not configured|no active server selected/i.test(catalogWarning)) {
      return 'Install or configure a Mcraftr Relay API integration to unlock live command discovery, docs, and guided wizards. Raw RCON commands still run here.'
    }
    return 'Live command discovery is currently unavailable. Raw RCON commands still run here.'
  }, [catalogWarning, catalogWarningCode])

  const requestStructureProviderInstall = (integrationId: string) => {
    const selected = structureProviderStatuses.find(entry => entry.id === integrationId)
    const conflicting = structureProviderStatuses.filter(entry => entry.id !== integrationId && ['ready', 'outdated', 'drifted', 'user-managed'].includes(entry.installState))
    if (!selected) return
    if (conflicting.length === 0) {
      void executeIntegrationAction('install', integrationId)
      return
    }
    setConfirmIntegrationInstall(integrationId)
  }

  const filteredGroups = useMemo(() => {
    const needle = deferredExplorerQuery.trim().toLowerCase()
    const nextCatalog = !needle
      ? catalog
      : catalog.filter(entry =>
        entry.name.toLowerCase().includes(needle)
        || (entry.namespacedName?.toLowerCase().includes(needle) ?? false)
        || entry.aliases.some(alias => alias.toLowerCase().includes(needle))
        || (entry.description?.toLowerCase().includes(needle) ?? false)
        || (entry.source?.toLowerCase().includes(needle) ?? false))
    return groupCatalog(nextCatalog)
  }, [catalog, deferredExplorerQuery])

  const visibleEntries = useMemo<WorkspaceEntry[]>(() => {
    const locals = localEntries.filter(entry => entry.createdAt >= clearedAfter)
    const remote = history.filter(entry => entry.createdAt >= clearedAfter)
    return [...locals, ...remote].sort((a, b) => a.createdAt - b.createdAt)
  }, [localEntries, history, clearedAfter])

  const commandHistory = useMemo(
    () => history
      .map(entry => entry.normalizedCommand)
      .filter((value, index, all) => !!value && all.indexOf(value) === index),
    [history],
  )

  const updateState = (patch: Partial<TerminalState>) => {
    startTransition(() => {
      setState(prev => ({ ...prev, ...patch }))
    })
  }

  const appendLocalEntry = (command: string, output: string, ok = true) => {
    const entry: LocalTranscriptEntry = {
      id: `local-${crypto.randomUUID()}`,
      command,
      output,
      ok,
      createdAt: Math.floor(Date.now() / 1000),
      local: true,
    }
    setLocalEntries(prev => [...prev, entry])
  }

  const runLocalCommand = (command: string) => {
    switch (command) {
      case ':help':
        appendLocalEntry(command, 'Shortcuts: Enter run, Tab autocomplete, tap a suggestion or COMPLETE to chain mobile completions, Shift+Tab previous completion, Up/Down command history, Ctrl/Cmd+K command search.')
        return
      case ':clear':
        setClearedAfter(Math.floor(Date.now() / 1000))
        appendLocalEntry(command, 'Transcript cleared for this session.')
        return
      case ':history':
        appendLocalEntry(command, 'Command history stays in the center transcript. Use Up/Down from the prompt to recall past commands.')
        return
      case ':favorites':
        updateState({ inspectorOpen: true, activeInspectorTab: 'favorites' })
        appendLocalEntry(command, 'Favorites inspector opened.')
        return
      case ':layout':
        updateState({ ...getDefaultTerminalState(), mode: standalone ? 'popout' : 'embedded' })
        appendLocalEntry(command, 'Terminal layout reset.')
        return
      case ':maximize':
        updateState({ mode: effectiveMode === 'maximized' ? initialMode : 'maximized' })
        return
      case ':popout':
        window.open('/minecraft/terminal', '_blank', 'noopener,noreferrer')
        updateState({ mode: 'popout' })
        appendLocalEntry(command, 'Pop-out window requested.')
        return
      default:
        appendLocalEntry(command, 'Unknown local terminal command.', false)
    }
  }

  const persistFavorite = async () => {
    if (readOnly) {
      appendLocalEntry(':favorites', 'Terminal access is read-only.', false)
      return
    }
    if (!commandDraft.trim()) return
    setFavoriteBusy(true)
    try {
      const response = await fetch('/api/minecraft/terminal/favorites', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: favoriteId,
          label: favoriteLabel.trim(),
          command: commandDraft,
          description: favoriteDescription.trim(),
        }),
      })
      const data = await response.json()
      if (!response.ok || data.ok === false) {
        throw new Error(data.error || 'Failed to save favorite')
      }
      const next = data.favorite as TerminalFavorite
      setFavorites(prev => {
        const filtered = prev.filter(entry => entry.id !== next.id)
        return [next, ...filtered]
      })
      setFavoriteId(next.id)
      setFavoriteLabel(next.label)
      setFavoriteDescription(next.description ?? '')
      updateState({ inspectorOpen: true, activeInspectorTab: 'favorites' })
    } catch (error) {
      appendLocalEntry(':favorites', error instanceof Error ? error.message : 'Failed to save favorite', false)
    } finally {
      setFavoriteBusy(false)
    }
  }

  const deleteFavorite = async (id: string) => {
    if (readOnly) {
      appendLocalEntry(':favorites', 'Terminal access is read-only.', false)
      return
    }
    try {
      const response = await fetch(`/api/minecraft/terminal/favorites/${id}`, { method: 'DELETE' })
      const data = await response.json()
      if (!response.ok || data.ok === false) {
        throw new Error(data.error || 'Failed to delete favorite')
      }
      setFavorites(prev => prev.filter(entry => entry.id !== id))
      if (favoriteId === id) {
        setFavoriteId(null)
        setFavoriteLabel('')
        setFavoriteDescription('')
      }
    } catch (error) {
      appendLocalEntry(':favorites', error instanceof Error ? error.message : 'Failed to delete favorite', false)
    }
  }

  const runServerCommand = async (command: string, meta?: { source?: 'manual' | 'wizard' | 'favorite'; wizardId?: string | null; favoriteId?: string | null }) => {
    if (readOnly) {
      appendLocalEntry(command, 'Terminal access is read-only.', false)
      return
    }
    setExecuting(true)
    setSuggestions([])
    setSuggestionIndex(0)
    setHistoryIndex(-1)
    try {
      const response = await fetch('/api/minecraft/terminal/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          command,
          source: meta?.source ?? 'manual',
          wizardId: meta?.wizardId ?? null,
          favoriteId: meta?.favoriteId ?? null,
        }),
      })
      const data = await response.json()
      if (!response.ok && data.ok === false) {
        throw new Error(data.error || 'Failed to execute command')
      }
      if (data.entry) {
        setHistory(prev => [...prev, data.entry].slice(-120))
      }
      if (!data.ok && data.error) {
        appendLocalEntry(command, data.error, false)
      }
    } catch (error) {
      appendLocalEntry(command, error instanceof Error ? error.message : 'Failed to execute command', false)
    } finally {
      setExecuting(false)
      commandInputRef.current?.focus()
    }
  }

  const submitCommand = async (nextCommand = commandDraft, meta?: { source?: 'manual' | 'wizard' | 'favorite'; wizardId?: string | null; favoriteId?: string | null }) => {
    const normalized = nextCommand.startsWith(':') ? normalizeTerminalCommand(nextCommand) : normalizeServerCommand(nextCommand)
    if (!normalized) return

    if (normalized.startsWith(':')) {
      runLocalCommand(normalized)
      updateState({ commandDraft: '' })
      return
    }

    if (classifyCommandRisk(normalized) === 'high' && confirmCommand !== normalized) {
      setConfirmCommand(normalized)
      return
    }

    setConfirmCommand(null)
    updateState({ commandDraft: '' })
    await runServerCommand(normalized, meta)
  }

  const activeSuggestion = suggestions[suggestionIndex] ?? null
  const onCommandKeyDown = async (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      event.preventDefault()
      await submitCommand()
      return
    }
    if (event.key === 'Tab') {
      event.preventDefault()
      if (suggestions.length === 0) return
      const delta = event.shiftKey ? -1 : 1
      if (event.shiftKey) {
        const nextIndex = suggestionIndex <= 0 ? suggestions.length - 1 : suggestionIndex - 1
        setSuggestionIndex(nextIndex)
        setState(prev => ({ ...prev, commandDraft: applyCompletion(prev.commandDraft, suggestions[nextIndex] ?? prev.commandDraft) }))
        return
      }
      const nextIndex = delta > 0 && activeSuggestion ? suggestionIndex : 0
      const nextSuggestion = suggestions[nextIndex] ?? suggestions[0]
      setSuggestionIndex((nextIndex + 1) % suggestions.length)
      setState(prev => ({ ...prev, commandDraft: applyCompletion(prev.commandDraft, nextSuggestion) }))
      return
    }
    if (event.key === 'ArrowUp' && !commandDraft.trim()) {
      event.preventDefault()
      const nextIndex = Math.min(historyIndex + 1, commandHistory.length - 1)
      setHistoryIndex(nextIndex)
      setState(prev => ({ ...prev, commandDraft: commandHistory[nextIndex] ?? prev.commandDraft }))
      return
    }
    if (event.key === 'ArrowDown' && historyIndex >= 0) {
      event.preventDefault()
      const nextIndex = historyIndex - 1
      setHistoryIndex(nextIndex)
      setState(prev => ({ ...prev, commandDraft: nextIndex >= 0 ? (commandHistory[nextIndex] ?? '') : '' }))
    }
  }

  const wizardCommand = useMemo(() => {
    const draft = state.wizardDraft ?? initialWizardDraft(currentWizardId)
    switch (currentWizardId) {
      case 'relay-root': {
        const prefix = selectedBase || 'relay'
        return normalizeServerCommand(`/${prefix} ${String(draft.subcommand ?? '').trim()} ${String(draft.args ?? '').trim()}`.trim())
      }
      case 'mcraftr-root':
        return normalizeServerCommand(`/mcraftr ${String(draft.subcommand ?? '').trim()} ${String(draft.args ?? '').trim()}`.trim())
      case 'teleport':
        if (draft.mode === 'coords') {
          return normalizeServerCommand(`/tp ${String(draft.target ?? '').trim()} ${String(draft.x ?? '').trim()} ${String(draft.y ?? '').trim()} ${String(draft.z ?? '').trim()}`.trim())
        }
        return normalizeServerCommand(`/tp ${String(draft.target ?? '').trim()} ${String(draft.destination ?? '').trim()}`.trim())
      case 'whitelist':
        return normalizeServerCommand(`/whitelist ${String(draft.action ?? 'add').trim()} ${String(draft.player ?? '').trim()}`.trim())
      case 'kick':
        return normalizeServerCommand(`/kick ${String(draft.player ?? '').trim()} ${String(draft.reason ?? '').trim()}`.trim())
      case 'ban':
        return normalizeServerCommand(`/${draft.mode === 'ban-ip' ? 'ban-ip' : 'ban'} ${String(draft.player ?? '').trim()} ${String(draft.reason ?? '').trim()}`.trim())
      case 'operator':
        return normalizeServerCommand(`/${draft.action === 'deop' ? 'deop' : 'op'} ${String(draft.player ?? '').trim()}`.trim())
      case 'give':
        return normalizeServerCommand(`/give ${String(draft.player ?? '').trim()} ${String(draft.item ?? '').trim()} ${String(draft.amount ?? '1').trim()}`.trim())
      case 'gamerule':
        return normalizeServerCommand(`/gamerule ${String(draft.rule ?? '').trim()} ${String(draft.value ?? '').trim()}`.trim())
      case 'broadcast':
        return normalizeServerCommand(`/say ${String(draft.message ?? '').trim()}`.trim())
      case 'msg':
        return normalizeServerCommand(`/msg ${String(draft.player ?? '').trim()} ${String(draft.message ?? '').trim()}`.trim())
      case 'worldedit-basic': {
        const prefix = selectedBase || 'relay'
        const player = String(draft.player ?? '').trim()
        const action = String(draft.action ?? 'info').trim()
        if (!player) return ''
        const parts = [`/${prefix}`, 'worldedit', 'run', player, action]
        if (String(draft.source ?? '').trim()) parts.push(String(draft.source ?? '').trim())
        if (String(draft.target ?? '').trim()) parts.push(String(draft.target ?? '').trim())
        if (String(draft.amount ?? '').trim()) parts.push(String(draft.amount ?? '').trim())
        if (String(draft.schematic ?? '').trim()) parts.push(String(draft.schematic ?? '').trim())
        return normalizeServerCommand(parts.join(' ').trim())
      }
      default:
        return ''
    }
  }, [currentWizardId, selectedBase, state.wizardDraft])

  const setWizardValue = (key: string, value: string) => {
    updateState({
      wizardDraft: {
        ...(state.wizardDraft ?? initialWizardDraft(currentWizardId)),
        [key]: value,
      },
    })
  }

  const rootClassName = cn(
    'flex min-h-0 flex-col overflow-visible rounded-[24px] border border-[var(--border)] md:overflow-hidden',
    standalone
      ? 'min-h-[calc(100dvh-8.5rem)] md:min-h-[calc(100dvh-8.5rem)]'
      : fullPage
        ? 'min-h-[calc(100dvh-10.5rem)] md:min-h-[calc(100dvh-10.5rem)]'
        : 'min-h-[70vh] md:h-[min(78vh,860px)]',
    effectiveMode === 'maximized' && !standalone && 'fixed inset-2 z-50 h-auto min-h-0 md:inset-4',
  )

  const renderExplorerPane = (searchRef?: typeof explorerSearchRef) => (
    <>
      <div className="border-b border-[var(--border)] p-3">
        <label className="flex items-center gap-2 rounded-2xl border border-[var(--border)] bg-black/10 px-3 py-2">
          <Search size={14} strokeWidth={1.8} className="text-[var(--text-dim)]" />
          <input
            ref={searchRef}
            type="text"
            value={explorerQuery}
            onChange={event => setExplorerQuery(event.target.value)}
            placeholder="Search commands"
            className="w-full bg-transparent font-mono text-[13px] text-[var(--text)] outline-none placeholder:text-[var(--text-dim)]"
          />
        </label>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3">
        <div className="space-y-4">
          <section className="space-y-2">
            <div className="font-mono text-[11px] tracking-[0.18em] text-[var(--text-dim)]">LOCAL</div>
            {LOCAL_TERMINAL_COMMANDS.map(item => (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  setState(prev => ({ ...prev, selectedCommand: item.id, activeInspectorTab: 'docs', commandDraft: item.id }))
                  commandInputRef.current?.focus()
                }}
                className="w-full rounded-2xl border border-[var(--border)] px-3 py-2 text-left transition-all hover:border-[var(--accent-mid)] hover:bg-[var(--panel)]/60"
              >
                <div className="font-mono text-[12px] tracking-[0.14em] text-[var(--accent)]">{item.id}</div>
                <div className="mt-1 text-[12px] text-[var(--text-dim)]">{item.description}</div>
              </button>
            ))}
          </section>

          {!relayEnabled && (
            <section className="space-y-3">
              <CapabilityLockCard requirement="relay" feature="Live command discovery, docs, and wizards" compact />
              <div className="rounded-2xl border border-[var(--border)] bg-black/10 px-3 py-3 text-[12px] text-[var(--text-dim)]">
                Raw RCON commands still work here. Relay unlocks the command catalog, autocomplete, docs, and guided wizard flows.
              </div>
            </section>
          )}

          {relayEnabled && catalog.length === 0 && catalogWarning && (
            <section className="rounded-2xl border border-[var(--border)] bg-black/10 px-3 py-3">
              <div className="font-mono text-[11px] tracking-[0.18em] text-[var(--text-dim)]">COMMAND DISCOVERY</div>
              <div className="mt-2 text-[12px] text-[var(--text-dim)]">{setupHint ?? catalogWarning}</div>
            </section>
          )}

          {relayEnabled && filteredGroups.map(([group, entries]) => (
            <section key={group} className="space-y-2">
              <div className="font-mono text-[11px] tracking-[0.18em] text-[var(--text-dim)]">{group}</div>
              <div className="space-y-1.5">
                {entries.map(entry => (
                  <button
                    key={`${group}:${entry.name}`}
                    type="button"
                    onClick={() => {
                      setState(prev => ({
                        ...prev,
                        selectedCommand: `/${entry.name}`,
                        activeInspectorTab: entry.wizardId ? 'wizard' : 'docs',
                        wizardId: entry.wizardId,
                        wizardDraft: entry.wizardId ? initialWizardDraft(entry.wizardId) : null,
                        commandDraft: `/${entry.name} `,
                      }))
                      commandInputRef.current?.focus()
                    }}
                    className="w-full rounded-2xl border border-[var(--border)] px-3 py-2 text-left transition-all hover:border-[var(--accent-mid)] hover:bg-[var(--panel)]/60"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span className="font-mono text-[12px] tracking-[0.14em] text-[var(--text)]">/{entry.name}</span>
                      <div className="flex items-center gap-2">
                        <span className={cn(
                          'rounded-full px-2 py-0.5 font-mono text-[10px] tracking-[0.16em]',
                          entry.wizardId
                            ? 'bg-[var(--accent-dim)] text-[var(--accent)]'
                            : 'border border-[var(--border)] text-[var(--text-dim)]',
                        )}>
                          {entry.wizardId ? 'WIZARD' : 'DOCS'}
                        </span>
                        <span className={cn(
                          'rounded-full px-2 py-0.5 font-mono text-[10px] tracking-[0.16em]',
                          entry.riskLevel === 'high' && 'bg-red-500/15 text-red-300',
                          entry.riskLevel === 'medium' && 'bg-amber-500/15 text-amber-200',
                          entry.riskLevel === 'low' && 'bg-emerald-500/15 text-emerald-200',
                        )}>
                          {entry.riskLevel.toUpperCase()}
                        </span>
                      </div>
                    </div>
                    {entry.description && (
                      <div className="mt-1 line-clamp-2 text-[12px] text-[var(--text-dim)]">{entry.description}</div>
                    )}
                  </button>
                ))}
              </div>
            </section>
          ))}
        </div>
      </div>
    </>
  )

  const inspectorTabs = (
    <div className="grid grid-cols-3 gap-2">
      {visibleInspectorTabs.map(tab => (
        <button
          key={tab}
          type="button"
          onClick={() => updateState({ activeInspectorTab: tab })}
          className={cn(
            'rounded-2xl border px-3 py-2 font-mono text-[11px] tracking-[0.14em] transition-all',
            state.activeInspectorTab === tab
              ? 'border-[var(--accent-mid)] bg-[var(--accent-dim)] text-[var(--accent)]'
              : 'border-[var(--border)] text-[var(--text-dim)] hover:text-[var(--text)]',
          )}
        >
          {tab.toUpperCase()}
        </button>
      ))}
    </div>
  )

  const docsPane = (
    <div className="space-y-4">
      <section className="rounded-[22px] border border-[var(--border)] bg-black/10 p-4">
        <div className="flex items-center gap-2">
          <BookOpen size={16} strokeWidth={1.8} className="text-[var(--accent)]" />
          <div className="font-mono text-[11px] tracking-[0.16em] text-[var(--text-dim)]">COMMAND DOCS</div>
        </div>
        {!canDocs ? (
          <div className="mt-3 space-y-3">
            <CapabilityLockCard requirement="relay" feature="Structured command docs" compact />
            <div className="text-[13px] text-[var(--text-dim)]">Command docs are disabled by your feature policy.</div>
          </div>
        ) : !relayEnabled && !selectedLocalCommand ? (
          <div className="mt-3 space-y-3">
            <CapabilityLockCard requirement="relay" feature="Structured command docs" compact />
            <div className="text-[13px] text-[var(--text-dim)]">Relay unlocks the command docs pane for server-provided commands. Local terminal shortcuts still work without it.</div>
          </div>
        ) : selectedLocalCommand ? (
          <div className="mt-3 space-y-2">
            <div className="font-mono text-[14px] text-[var(--text)]">{selectedLocalCommand.id}</div>
            <div className="text-[13px] text-[var(--text-dim)]">{selectedLocalCommand.description}</div>
          </div>
        ) : selectedCatalogEntry ? (
          <div className="mt-3 space-y-3">
            <div>
              <div className="font-mono text-[14px] text-[var(--text)]">/{selectedCatalogEntry.name}</div>
              {selectedCatalogEntry.namespacedName && (
                <div className="font-mono text-[11px] tracking-[0.14em] text-[var(--text-dim)]">{selectedCatalogEntry.namespacedName}</div>
              )}
            </div>
            {selectedCatalogEntry.description && <div className="text-[13px] text-[var(--text-dim)]">{selectedCatalogEntry.description}</div>}
            {selectedCatalogEntry.usage && (
              <div className="rounded-2xl border border-[var(--border)] px-3 py-2 font-mono text-[12px] text-[var(--text)]">
                {selectedCatalogEntry.usage}
              </div>
            )}
            <div className="grid grid-cols-1 gap-2 text-[12px] text-[var(--text-dim)]">
              <div>Source: <span className="font-mono text-[var(--text)]">{selectedCatalogEntry.source ?? 'minecraft'}</span></div>
              <div>Permission: <span className="font-mono text-[var(--text)]">{selectedCatalogEntry.permission ?? 'none'}</span></div>
              <div>Risk: <span className="font-mono text-[var(--text)]">{selectedCatalogEntry.riskLevel}</span></div>
              <div>Status: <span className="font-mono text-[var(--text)]">{wizardLabel(currentWizardId)}</span></div>
              {selectedCatalogEntry.aliases.length > 0 && (
                <div>Aliases: <span className="font-mono text-[var(--text)]">{selectedCatalogEntry.aliases.join(', ')}</span></div>
              )}
            </div>
            <div className="rounded-2xl border border-[var(--border)] bg-black/10 px-3 py-3 text-[12px] text-[var(--text-dim)]">
              {currentWizardId
                ? 'This command has a guided wizard. You can still insert it into the prompt or run it manually if you prefer.'
                : 'This command is documented here, but still uses manual execution today. Use the prompt directly until a wizard is added.'}
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setState(prev => ({ ...prev, commandDraft: `/${selectedCatalogEntry.name} ` }))}
                className="flex-1 rounded-2xl border border-[var(--border)] px-3 py-2 font-mono text-[11px] tracking-[0.14em] text-[var(--text-dim)] transition-all hover:border-[var(--accent-mid)] hover:text-[var(--text)]"
              >
                INSERT
              </button>
              {currentWizardId && (
                <button
                  type="button"
                  onClick={() => openWizard(`/${selectedCatalogEntry.name}`, currentWizardId)}
                  className="flex-1 rounded-2xl border border-[var(--border)] px-3 py-2 font-mono text-[11px] tracking-[0.14em] text-[var(--text-dim)] transition-all hover:border-[var(--accent-mid)] hover:text-[var(--text)]"
                >
                  OPEN WIZARD
                </button>
              )}
              <button
                type="button"
                onClick={() => void submitCommand(`/${selectedCatalogEntry.name}`)}
                disabled={readOnly}
                className="flex-1 rounded-2xl border border-[var(--accent-mid)] bg-[var(--accent-dim)] px-3 py-2 font-mono text-[11px] tracking-[0.14em] text-[var(--accent)] transition-all disabled:cursor-not-allowed disabled:opacity-40"
              >
                RUN
              </button>
            </div>
          </div>
        ) : (
          <div className="mt-3 text-[13px] text-[var(--text-dim)]">Pick a command from the explorer or start typing in the prompt.</div>
        )}
      </section>
    </div>
  )

  const wizardPane = (
    <div className="space-y-4">
      <section className="rounded-[22px] border border-[var(--border)] bg-black/10 p-4">
        <div className="flex items-center gap-2">
          <LayoutPanelTop size={16} strokeWidth={1.8} className="text-[var(--accent)]" />
          <div className="font-mono text-[11px] tracking-[0.16em] text-[var(--text-dim)]">COMMAND WIZARD</div>
        </div>
        {!canWizards ? (
          <div className="mt-3 space-y-3">
            <CapabilityLockCard requirement="relay" feature="Guided command wizards" compact />
            <div className="text-[13px] text-[var(--text-dim)]">Command wizards are disabled by your feature policy.</div>
          </div>
        ) : !relayEnabled ? (
          <div className="mt-3 space-y-3">
            <CapabilityLockCard requirement="relay" feature="Guided command wizards" compact />
            <div className="text-[13px] text-[var(--text-dim)]">Wizards are powered by Relay-backed command metadata. Raw commands and saved favorites still work without it.</div>
          </div>
        ) : !currentWizardId ? (
          <div className="mt-3 space-y-2 text-[13px] text-[var(--text-dim)]">
            <div>No wizard yet for this command.</div>
            <div>You can still use the docs pane and run the command manually from the prompt.</div>
          </div>
        ) : (
          <div className="mt-3 space-y-3">
            <div className="rounded-2xl border border-[var(--border)] bg-black/10 px-3 py-3 text-[12px] text-[var(--text-dim)]">
              Wizards are best for high-risk or multi-field commands. Mcraftr still shows the generated command so you can review exactly what will run.
            </div>
            {(currentWizardId === 'mcraftr-root' || currentWizardId === 'relay-root') && (
              <>
                <input value={String(state.wizardDraft?.subcommand ?? 'stack status')} onChange={event => setWizardValue('subcommand', event.target.value)} placeholder="stack status"
                  className="w-full rounded-2xl border border-[var(--border)] bg-black/15 px-3 py-2 font-mono text-[13px] text-[var(--text)] outline-none" />
                <input value={String(state.wizardDraft?.args ?? '')} onChange={event => setWizardValue('args', event.target.value)} placeholder="Extra args"
                  className="w-full rounded-2xl border border-[var(--border)] bg-black/15 px-3 py-2 font-mono text-[13px] text-[var(--text)] outline-none" />
              </>
            )}
            {currentWizardId === 'teleport' && (
              <>
                <select value={String(state.wizardDraft?.mode ?? 'player')} onChange={event => setWizardValue('mode', event.target.value)}
                  className="w-full rounded-2xl border border-[var(--border)] bg-black/15 px-3 py-2 font-mono text-[13px] text-[var(--text)] outline-none">
                  <option value="player">Teleport to player</option>
                  <option value="coords">Teleport to coordinates</option>
                </select>
                <input value={String(state.wizardDraft?.target ?? '')} onChange={event => setWizardValue('target', event.target.value)} placeholder="Target player"
                  className="w-full rounded-2xl border border-[var(--border)] bg-black/15 px-3 py-2 font-mono text-[13px] text-[var(--text)] outline-none" />
                {String(state.wizardDraft?.mode ?? 'player') === 'coords' ? (
                  <div className="grid grid-cols-3 gap-2">
                    <input value={String(state.wizardDraft?.x ?? '')} onChange={event => setWizardValue('x', event.target.value)} placeholder="X" className="rounded-2xl border border-[var(--border)] bg-black/15 px-3 py-2 font-mono text-[13px] text-[var(--text)] outline-none" />
                    <input value={String(state.wizardDraft?.y ?? '')} onChange={event => setWizardValue('y', event.target.value)} placeholder="Y" className="rounded-2xl border border-[var(--border)] bg-black/15 px-3 py-2 font-mono text-[13px] text-[var(--text)] outline-none" />
                    <input value={String(state.wizardDraft?.z ?? '')} onChange={event => setWizardValue('z', event.target.value)} placeholder="Z" className="rounded-2xl border border-[var(--border)] bg-black/15 px-3 py-2 font-mono text-[13px] text-[var(--text)] outline-none" />
                  </div>
                ) : (
                  <input value={String(state.wizardDraft?.destination ?? '')} onChange={event => setWizardValue('destination', event.target.value)} placeholder="Destination player"
                    className="w-full rounded-2xl border border-[var(--border)] bg-black/15 px-3 py-2 font-mono text-[13px] text-[var(--text)] outline-none" />
                )}
              </>
            )}
            {currentWizardId === 'whitelist' && (
              <>
                <select value={String(state.wizardDraft?.action ?? 'add')} onChange={event => setWizardValue('action', event.target.value)}
                  className="w-full rounded-2xl border border-[var(--border)] bg-black/15 px-3 py-2 font-mono text-[13px] text-[var(--text)] outline-none">
                  <option value="add">Add</option>
                  <option value="remove">Remove</option>
                  <option value="list">List</option>
                  <option value="reload">Reload</option>
                </select>
                {String(state.wizardDraft?.action ?? 'add') !== 'list' && String(state.wizardDraft?.action ?? 'add') !== 'reload' && (
                  <input value={String(state.wizardDraft?.player ?? '')} onChange={event => setWizardValue('player', event.target.value)} placeholder="Player"
                    className="w-full rounded-2xl border border-[var(--border)] bg-black/15 px-3 py-2 font-mono text-[13px] text-[var(--text)] outline-none" />
                )}
              </>
            )}
            {currentWizardId === 'kick' && (
              <>
                <input value={String(state.wizardDraft?.player ?? '')} onChange={event => setWizardValue('player', event.target.value)} placeholder="Player"
                  className="w-full rounded-2xl border border-[var(--border)] bg-black/15 px-3 py-2 font-mono text-[13px] text-[var(--text)] outline-none" />
                <input value={String(state.wizardDraft?.reason ?? '')} onChange={event => setWizardValue('reason', event.target.value)} placeholder="Reason"
                  className="w-full rounded-2xl border border-[var(--border)] bg-black/15 px-3 py-2 font-mono text-[13px] text-[var(--text)] outline-none" />
              </>
            )}
            {currentWizardId === 'ban' && (
              <>
                <select value={String(state.wizardDraft?.mode ?? 'ban')} onChange={event => setWizardValue('mode', event.target.value)}
                  className="w-full rounded-2xl border border-[var(--border)] bg-black/15 px-3 py-2 font-mono text-[13px] text-[var(--text)] outline-none">
                  <option value="ban">Ban player</option>
                  <option value="ban-ip">Ban IP</option>
                </select>
                <input value={String(state.wizardDraft?.player ?? '')} onChange={event => setWizardValue('player', event.target.value)} placeholder={String(state.wizardDraft?.mode ?? 'ban') === 'ban-ip' ? 'IP or player' : 'Player'}
                  className="w-full rounded-2xl border border-[var(--border)] bg-black/15 px-3 py-2 font-mono text-[13px] text-[var(--text)] outline-none" />
                <input value={String(state.wizardDraft?.reason ?? '')} onChange={event => setWizardValue('reason', event.target.value)} placeholder="Reason"
                  className="w-full rounded-2xl border border-[var(--border)] bg-black/15 px-3 py-2 font-mono text-[13px] text-[var(--text)] outline-none" />
              </>
            )}
            {currentWizardId === 'operator' && (
              <>
                <select value={String(state.wizardDraft?.action ?? 'op')} onChange={event => setWizardValue('action', event.target.value)}
                  className="w-full rounded-2xl border border-[var(--border)] bg-black/15 px-3 py-2 font-mono text-[13px] text-[var(--text)] outline-none">
                  <option value="op">Grant operator</option>
                  <option value="deop">Remove operator</option>
                </select>
                <input value={String(state.wizardDraft?.player ?? '')} onChange={event => setWizardValue('player', event.target.value)} placeholder="Player"
                  className="w-full rounded-2xl border border-[var(--border)] bg-black/15 px-3 py-2 font-mono text-[13px] text-[var(--text)] outline-none" />
              </>
            )}
            {currentWizardId === 'give' && (
              <>
                <input value={String(state.wizardDraft?.player ?? '')} onChange={event => setWizardValue('player', event.target.value)} placeholder="Player"
                  className="w-full rounded-2xl border border-[var(--border)] bg-black/15 px-3 py-2 font-mono text-[13px] text-[var(--text)] outline-none" />
                <input value={String(state.wizardDraft?.item ?? 'minecraft:stone')} onChange={event => setWizardValue('item', event.target.value)} placeholder="minecraft:stone"
                  className="w-full rounded-2xl border border-[var(--border)] bg-black/15 px-3 py-2 font-mono text-[13px] text-[var(--text)] outline-none" />
                <input value={String(state.wizardDraft?.amount ?? '1')} onChange={event => setWizardValue('amount', event.target.value)} placeholder="1"
                  className="w-full rounded-2xl border border-[var(--border)] bg-black/15 px-3 py-2 font-mono text-[13px] text-[var(--text)] outline-none" />
              </>
            )}
            {currentWizardId === 'gamerule' && (
              <>
                <input value={String(state.wizardDraft?.rule ?? 'keepInventory')} onChange={event => setWizardValue('rule', event.target.value)} placeholder="keepInventory"
                  className="w-full rounded-2xl border border-[var(--border)] bg-black/15 px-3 py-2 font-mono text-[13px] text-[var(--text)] outline-none" />
                <select value={String(state.wizardDraft?.value ?? 'true')} onChange={event => setWizardValue('value', event.target.value)}
                  className="w-full rounded-2xl border border-[var(--border)] bg-black/15 px-3 py-2 font-mono text-[13px] text-[var(--text)] outline-none">
                  <option value="true">true</option>
                  <option value="false">false</option>
                </select>
              </>
            )}
            {currentWizardId === 'broadcast' && (
              <textarea value={String(state.wizardDraft?.message ?? '')} onChange={event => setWizardValue('message', event.target.value)} placeholder="Message to send to the whole server"
                className="h-24 w-full resize-none rounded-2xl border border-[var(--border)] bg-black/15 px-3 py-2 font-mono text-[13px] text-[var(--text)] outline-none" />
            )}
            {currentWizardId === 'msg' && (
              <>
                <input value={String(state.wizardDraft?.player ?? '')} onChange={event => setWizardValue('player', event.target.value)} placeholder="Player"
                  className="w-full rounded-2xl border border-[var(--border)] bg-black/15 px-3 py-2 font-mono text-[13px] text-[var(--text)] outline-none" />
                <textarea value={String(state.wizardDraft?.message ?? '')} onChange={event => setWizardValue('message', event.target.value)} placeholder="Private message"
                  className="h-24 w-full resize-none rounded-2xl border border-[var(--border)] bg-black/15 px-3 py-2 font-mono text-[13px] text-[var(--text)] outline-none" />
              </>
            )}
            {currentWizardId === 'worldedit-basic' && (
              <>
                <IntegrationDependencyPrompt
                  eyebrow="BUILD PROVIDERS"
                  title="WorldEdit wizard provider"
                  description="Use a curated provider for the stronger structure-editing flow, then keep a per-server preference so this wizard knows which editor path to favor."
                  selectedIntegrationId={structureProviderPreference?.integrationId ?? null}
                  statuses={structureProviderStatuses}
                  busyKey={integrationsBusy}
                  statusMessage={integrationsStatus}
                  errorMessage={integrationsData?.ok === false ? integrationsData.error ?? null : null}
                  onInstall={requestStructureProviderInstall}
                  onRepair={(integrationId) => void executeIntegrationAction('repair', integrationId)}
                  onSelect={(integrationId) => void persistStructureEditorPreference(integrationId, `Terminal wizard selected ${integrationId} as the structure editor provider.`)}
                  onRecommend={() => setIntegrationRecommendationOpen(true)}
                  compact
                />

                <select value={String(state.wizardDraft?.action ?? 'info')} onChange={event => setWizardValue('action', event.target.value)}
                  className="w-full rounded-2xl border border-[var(--border)] bg-black/15 px-3 py-2 font-mono text-[13px] text-[var(--text)] outline-none">
                  <option value="info">worldedit info</option>
                  <option value="undo">worldedit undo</option>
                  <option value="redo">worldedit redo</option>
                  <option value="paste">worldedit paste</option>
                  <option value="set">worldedit set</option>
                  <option value="replace">worldedit replace</option>
                </select>
                <input value={String(state.wizardDraft?.player ?? '')} onChange={event => setWizardValue('player', event.target.value)} placeholder="Player"
                  className="w-full rounded-2xl border border-[var(--border)] bg-black/15 px-3 py-2 font-mono text-[13px] text-[var(--text)] outline-none" />
                {String(state.wizardDraft?.action ?? 'info') !== 'info' && (
                  <input value={String(state.wizardDraft?.source ?? '')} onChange={event => setWizardValue('source', event.target.value)} placeholder="Source (optional)"
                    className="w-full rounded-2xl border border-[var(--border)] bg-black/15 px-3 py-2 font-mono text-[13px] text-[var(--text)] outline-none" />
                )}
                {(String(state.wizardDraft?.action ?? 'info') === 'set' || String(state.wizardDraft?.action ?? 'info') === 'replace') && (
                  <input value={String(state.wizardDraft?.target ?? '')} onChange={event => setWizardValue('target', event.target.value)} placeholder={String(state.wizardDraft?.action ?? 'info') === 'replace' ? 'Replacement block or pattern' : 'Target block or pattern'}
                    className="w-full rounded-2xl border border-[var(--border)] bg-black/15 px-3 py-2 font-mono text-[13px] text-[var(--text)] outline-none" />
                )}
                {(String(state.wizardDraft?.action ?? 'info') === 'undo' || String(state.wizardDraft?.action ?? 'info') === 'redo') && (
                  <input value={String(state.wizardDraft?.amount ?? '1')} onChange={event => setWizardValue('amount', event.target.value)} placeholder="1"
                    className="w-full rounded-2xl border border-[var(--border)] bg-black/15 px-3 py-2 font-mono text-[13px] text-[var(--text)] outline-none" />
                )}
                {String(state.wizardDraft?.action ?? 'info') === 'paste' && (
                  <>
                    <input value={String(state.wizardDraft?.schematic ?? '')} onChange={event => setWizardValue('schematic', event.target.value)} placeholder="Schematic name (optional)"
                      className="w-full rounded-2xl border border-[var(--border)] bg-black/15 px-3 py-2 font-mono text-[13px] text-[var(--text)] outline-none" />
                    {worldeditSchematics.length > 0 && (
                      <select value={String(state.wizardDraft?.schematic ?? '')} onChange={event => setWizardValue('schematic', event.target.value)}
                        className="w-full rounded-2xl border border-[var(--border)] bg-black/15 px-3 py-2 font-mono text-[13px] text-[var(--text)] outline-none">
                        <option value="">Clipboard / no schematic override</option>
                        {worldeditSchematics.map(schematic => (
                          <option key={schematic.path} value={schematic.name}>{schematic.name}</option>
                        ))}
                      </select>
                    )}
                  </>
                )}
                <div className="rounded-2xl border border-[var(--border)] bg-black/10 px-3 py-3 text-[12px] text-[var(--text-dim)]">
                  {worldeditLoading
                    ? 'Loading WorldEdit context…'
                    : worldeditHint || 'Use this wizard for a small, safe set of WorldEdit-style Relay flows. Paste can optionally use a Beacon-discovered schematic, while the other actions stay narrow on purpose for release.'}
                </div>
              </>
            )}

            <div className="rounded-2xl border border-[var(--border)] bg-black/20 px-3 py-3 font-mono text-[12px] text-[var(--text)]">
              {wizardCommand || 'Fill the wizard to generate a command.'}
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setState(prev => ({ ...prev, commandDraft: wizardCommand }))}
                disabled={!wizardCommand}
                className="flex-1 rounded-2xl border border-[var(--border)] px-3 py-2 font-mono text-[11px] tracking-[0.14em] text-[var(--text-dim)] transition-all hover:border-[var(--accent-mid)] hover:text-[var(--text)] disabled:cursor-not-allowed disabled:opacity-40"
              >
                LOAD
              </button>
              <button
                type="button"
                onClick={() => void submitCommand(wizardCommand, { source: 'wizard', wizardId: currentWizardId })}
                disabled={readOnly || !wizardCommand}
                className="flex-1 rounded-2xl border border-[var(--accent-mid)] bg-[var(--accent-dim)] px-3 py-2 font-mono text-[11px] tracking-[0.14em] text-[var(--accent)] transition-all disabled:cursor-not-allowed disabled:opacity-40"
              >
                RUN
              </button>
            </div>
          </div>
        )}
      </section>
    </div>
  )

  const favoritesPane = (
    <div className="space-y-4">
      <section className="rounded-[22px] border border-[var(--border)] bg-black/10 p-4">
        <div className="flex items-center gap-2">
          <Star size={16} strokeWidth={1.8} className="text-[var(--accent)]" />
          <div className="font-mono text-[11px] tracking-[0.16em] text-[var(--text-dim)]">SAVE CURRENT COMMAND</div>
        </div>
        <div className="mt-3 space-y-2">
          <input value={favoriteLabel} onChange={event => setFavoriteLabel(event.target.value)} placeholder="Favorite label"
            className="w-full rounded-2xl border border-[var(--border)] bg-black/15 px-3 py-2 font-mono text-[13px] text-[var(--text)] outline-none" />
          <textarea value={favoriteDescription} onChange={event => setFavoriteDescription(event.target.value)} placeholder="Optional note"
            className="h-20 w-full resize-none rounded-2xl border border-[var(--border)] bg-black/15 px-3 py-2 font-mono text-[13px] text-[var(--text)] outline-none" />
          <div className="rounded-2xl border border-[var(--border)] bg-black/20 px-3 py-3 font-mono text-[12px] text-[var(--text)]">
            {commandDraft || 'Use the prompt or wizard to compose a command.'}
          </div>
          <button
            type="button"
            onClick={() => void persistFavorite()}
            disabled={readOnly || !commandDraft.trim() || favoriteBusy}
            className="w-full rounded-2xl border border-[var(--accent-mid)] bg-[var(--accent-dim)] px-3 py-2 font-mono text-[11px] tracking-[0.14em] text-[var(--accent)] transition-all disabled:cursor-not-allowed disabled:opacity-40"
          >
            {favoriteBusy ? 'SAVING…' : favoriteId ? 'UPDATE FAVORITE' : 'SAVE FAVORITE'}
          </button>
        </div>
      </section>

      <section className="rounded-[22px] border border-[var(--border)] bg-black/10 p-4">
        <div className="flex items-center gap-2">
          <Plus size={16} strokeWidth={1.8} className="text-[var(--accent)]" />
          <div className="font-mono text-[11px] tracking-[0.16em] text-[var(--text-dim)]">SAVED COMMANDS</div>
        </div>
        <div className="mt-3 space-y-2">
          {!canFavorites && (
            <div className="text-[13px] text-[var(--text-dim)]">Favorites are disabled by your feature policy.</div>
          )}
          {canFavorites && favorites.length === 0 && (
            <div className="text-[13px] text-[var(--text-dim)]">No favorites yet.</div>
          )}
          {canFavorites && favorites.map(favorite => (
            <div key={favorite.id} className="rounded-2xl border border-[var(--border)] px-3 py-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="truncate font-mono text-[12px] tracking-[0.14em] text-[var(--text)]">{favorite.label}</div>
                  <div className="mt-1 whitespace-pre-wrap break-words font-mono text-[11px] text-[var(--text-dim)]">{favorite.command}</div>
                  {favorite.description && <div className="mt-1 text-[12px] text-[var(--text-dim)]">{favorite.description}</div>}
                </div>
                <button
                  type="button"
                  onClick={() => void deleteFavorite(favorite.id)}
                  disabled={readOnly}
                  className="rounded-2xl border border-[var(--border)] p-2 text-[var(--text-dim)] transition-all hover:border-red-500/50 hover:text-red-300 disabled:cursor-not-allowed disabled:opacity-40"
                  aria-label={`Delete favorite ${favorite.label}`}
                >
                  <Trash2 size={14} strokeWidth={1.8} />
                </button>
              </div>
              <div className="mt-3 flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setFavoriteId(favorite.id)
                    setFavoriteLabel(favorite.label)
                    setFavoriteDescription(favorite.description ?? '')
                    setState(prev => ({ ...prev, commandDraft: favorite.command }))
                  }}
                  className="flex-1 rounded-2xl border border-[var(--border)] px-3 py-2 font-mono text-[11px] tracking-[0.14em] text-[var(--text-dim)] transition-all hover:border-[var(--accent-mid)] hover:text-[var(--text)]"
                >
                  LOAD
                </button>
                <button
                  type="button"
                  onClick={() => void submitCommand(favorite.command, { source: 'favorite', favoriteId: favorite.id })}
                  disabled={readOnly}
                  className="flex-1 rounded-2xl border border-[var(--accent-mid)] bg-[var(--accent-dim)] px-3 py-2 font-mono text-[11px] tracking-[0.14em] text-[var(--accent)] transition-all disabled:cursor-not-allowed disabled:opacity-40"
                >
                  RUN
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  )

  const inspectorPane = (
    <>
      <div className="border-b border-[var(--border)] p-3">
        {inspectorTabs}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        {state.activeInspectorTab === 'docs' && docsPane}
        {state.activeInspectorTab === 'wizard' && wizardPane}
        {state.activeInspectorTab === 'favorites' && favoritesPane}
      </div>
    </>
  )

  return (
    <>
      <div
        className={rootClassName}
        style={{
          background: effectiveMode === 'maximized'
            ? 'linear-gradient(180deg, rgba(8,12,18,0.96), rgba(10,12,20,0.98))'
            : 'linear-gradient(180deg, color-mix(in srgb, var(--panel) 88%, transparent), rgba(6,8,14,0.92))',
          boxShadow: effectiveMode === 'maximized' ? '0 30px 80px rgba(0,0,0,0.5)' : '0 18px 46px rgba(0,0,0,0.18)',
          backdropFilter: 'blur(18px)',
        }}
      >
        <div className="flex flex-wrap items-center gap-2 border-b border-[var(--border)] px-4 py-3">
          <div className="grid h-9 w-9 place-items-center rounded-2xl border border-[var(--accent-mid)] bg-[var(--accent-dim)] text-[var(--accent)]">
            <Command size={18} strokeWidth={1.8} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="font-mono text-[12px] tracking-[0.2em] text-[var(--text-dim)]">SERVER TERMINAL</div>
              <div className="truncate font-mono text-[13px] text-[var(--text)]">
              {loading ? 'Connecting to server command surface…' : loadingError ? loadingError : !relayEnabled ? 'Raw RCON terminal active. Relay unlocks discovery, docs, and wizards.' : catalogWarning ? catalogWarning : 'Live command catalog, transcript, docs, and favorites.'}
              </div>
          </div>
          {readOnly && (
            <div className="rounded-full border border-[var(--accent-mid)] bg-[var(--accent-dim)] px-3 py-1 font-mono text-[10px] tracking-[0.16em] text-[var(--accent)]">
              READ ONLY
            </div>
          )}
          <div className="flex w-full flex-wrap gap-2 sm:w-auto sm:justify-end">
            <button
              type="button"
              onClick={() => updateState({ explorerOpen: !state.explorerOpen })}
              className="tap-target flex-1 rounded-2xl border px-3 py-2 font-mono text-[11px] tracking-[0.14em] text-[var(--text-dim)] transition-all hover:border-[var(--accent-mid)] hover:text-[var(--text)] sm:flex-none"
            >
              <span className="sm:hidden">{state.explorerOpen ? 'LIST ON' : 'LIST'}</span>
              <span className="hidden sm:inline">{state.explorerOpen ? 'HIDE LIST' : 'SHOW LIST'}</span>
            </button>
            <button
              type="button"
              onClick={() => updateState({ inspectorOpen: !state.inspectorOpen })}
              className="tap-target flex-1 rounded-2xl border px-3 py-2 font-mono text-[11px] tracking-[0.14em] text-[var(--text-dim)] transition-all hover:border-[var(--accent-mid)] hover:text-[var(--text)] sm:flex-none"
            >
              <span className="sm:hidden">{state.inspectorOpen ? 'INFO ON' : 'INFO'}</span>
              <span className="hidden sm:inline">{state.inspectorOpen ? 'HIDE INFO' : 'SHOW INFO'}</span>
            </button>
            {!standalone && !fullPage && (
              <button
                type="button"
                onClick={() => updateState({ mode: effectiveMode === 'maximized' ? initialMode : 'maximized' })}
                className="tap-target rounded-2xl border px-3 py-2 text-[var(--text-dim)] transition-all hover:border-[var(--accent-mid)] hover:text-[var(--text)]"
                aria-label={effectiveMode === 'maximized' ? 'Restore terminal' : 'Maximize terminal'}
              >
                {effectiveMode === 'maximized' ? <Minimize2 size={16} strokeWidth={1.8} /> : <Maximize2 size={16} strokeWidth={1.8} />}
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                window.open('/minecraft/terminal', '_blank', 'noopener,noreferrer')
                updateState({ mode: 'popout' })
              }}
              className="tap-target rounded-2xl border px-3 py-2 text-[var(--text-dim)] transition-all hover:border-[var(--accent-mid)] hover:text-[var(--text)]"
              aria-label="Open terminal in a new tab"
            >
              <ExternalLink size={16} strokeWidth={1.8} />
            </button>
            {effectiveMode === 'maximized' && !standalone && (
              <button
                type="button"
                onClick={() => updateState({ mode: initialMode })}
                className="tap-target rounded-2xl border px-3 py-2 text-[var(--text-dim)] transition-all hover:border-[var(--accent-mid)] hover:text-[var(--text)]"
                aria-label="Close maximized terminal"
              >
                <X size={16} strokeWidth={1.8} />
              </button>
            )}
          </div>
        </div>

        <div className="flex min-h-0 flex-1">
          {state.explorerOpen && (
            <aside
              className="hidden h-full shrink-0 flex-col border-r border-[var(--border)] xl:flex"
              style={{ width: state.leftPaneWidth }}
            >
              {renderExplorerPane(explorerSearchRef)}
            </aside>
          )}

          <main className="flex min-w-0 flex-1 flex-col">
            <div className="border-b border-[var(--border)] px-4 py-3">
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                    onClick={() => openWizard(selectedCommand ?? (selectedBase ? `/${selectedBase}` : null))}
                    disabled={!relayEnabled || !currentWizardId}
                    className="tap-target rounded-2xl border px-3 py-2 font-mono text-[11px] tracking-[0.14em] text-[var(--text-dim)] transition-all hover:border-[var(--accent-mid)] hover:text-[var(--text)] disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    OPEN WIZARD
                  </button>
                <button
                  type="button"
                  onClick={() => void persistFavorite()}
                   disabled={readOnly || !commandDraft.trim() || favoriteBusy}
                  className="tap-target rounded-2xl border px-3 py-2 font-mono text-[11px] tracking-[0.14em] text-[var(--accent)] transition-all hover:border-[var(--accent-mid)] disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {favoriteBusy ? 'SAVING…' : favoriteId ? 'UPDATE FAVORITE' : 'SAVE FAVORITE'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setFavoriteId(null)
                    setFavoriteLabel('')
                    setFavoriteDescription('')
                    updateState({ activeInspectorTab: 'favorites', inspectorOpen: true })
                  }}
                  disabled={readOnly}
                  className="tap-target rounded-2xl border px-3 py-2 font-mono text-[11px] tracking-[0.14em] text-[var(--text-dim)] transition-all hover:border-[var(--accent-mid)] hover:text-[var(--text)] disabled:cursor-not-allowed disabled:opacity-40"
                >
                  NEW FAVORITE
                </button>
                <div className="ml-auto flex items-center gap-2 font-mono text-[11px] tracking-[0.16em] text-[var(--text-dim)]">
                  <LayoutPanelLeft size={14} strokeWidth={1.8} />
                  <span>{catalog.length} COMMANDS</span>
                  <GripVertical size={14} strokeWidth={1.6} />
                  <span>{favorites.length} SAVED</span>
                </div>
              </div>
            </div>

            <div
              ref={transcriptRef}
              className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-4"
              style={{ minHeight: state.transcriptHeight }}
            >
              {loading && (
                <div className="rounded-[22px] border border-dashed border-[var(--border)] px-4 py-6 font-mono text-[13px] text-[var(--text-dim)]">
                  Building terminal workspace…
                </div>
              )}
              {!loading && !loadingError && catalogWarning && (
                <div className="rounded-[22px] border border-[var(--border)] bg-black/10 px-4 py-4 font-mono text-[13px] text-[var(--text-dim)]">
                  {setupHint ?? catalogWarning}
                </div>
              )}
              {readOnly && (
                <div className="rounded-[22px] border border-[var(--accent-mid)] bg-[var(--accent-dim)] px-4 py-4 font-mono text-[13px] text-[var(--accent)]">
                  Terminal access is read-only. You can inspect the catalog, transcript, docs, wizards, and favorites, but command execution and edits are disabled.
                </div>
              )}
              {!loading && visibleEntries.length === 0 && (
                <div className="rounded-[22px] border border-dashed border-[var(--border)] px-4 py-6 font-mono text-[13px] text-[var(--text-dim)]">
                  No transcript yet. Start with `/list`, `/help`, or a local helper like `:help`.
                </div>
              )}
              {visibleEntries.map(entry => {
                const preview = 'structuredOutput' in entry ? structuredPreview(entry.structuredOutput) : null
                return (
                  <article
                    key={entry.id}
                    className="rounded-[22px] border border-[var(--border)] bg-black/10 px-4 py-3"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-[11px] tracking-[0.16em] text-[var(--text-dim)]">{formatTimestamp(entry.createdAt)}</span>
                      <span className={cn(
                        'rounded-full px-2 py-0.5 font-mono text-[10px] tracking-[0.16em]',
                        entry.ok ? 'bg-emerald-500/15 text-emerald-200' : 'bg-red-500/15 text-red-300',
                      )}>
                        {entry.ok ? 'OK' : 'ERR'}
                      </span>
                      {'riskLevel' in entry && (
                        <span className={cn(
                          'rounded-full px-2 py-0.5 font-mono text-[10px] tracking-[0.16em]',
                          entry.riskLevel === 'high' && 'bg-red-500/15 text-red-300',
                          entry.riskLevel === 'medium' && 'bg-amber-500/15 text-amber-200',
                          entry.riskLevel === 'low' && 'bg-sky-500/15 text-sky-200',
                        )}>
                          {entry.riskLevel.toUpperCase()}
                        </span>
                      )}
                      {'durationMs' in entry && (
                        <span className="font-mono text-[10px] tracking-[0.16em] text-[var(--text-dim)]">{prettyDuration(entry.durationMs)}</span>
                      )}
                    </div>
                    <div className="mt-2 font-mono text-[13px] text-[var(--accent)]">{entry.command}</div>
                    <pre className={cn(
                      'mt-2 whitespace-pre-wrap break-words rounded-2xl border border-[var(--border)] bg-black/20 px-3 py-3 font-mono text-[12px]',
                      entry.ok ? 'text-[var(--text-dim)]' : 'text-red-200',
                    )}>
                      {entry.output}
                    </pre>
                    {preview && (
                      <details className="mt-2 rounded-2xl border border-[var(--border)] bg-[var(--panel)]/20 px-3 py-2">
                        <summary className="cursor-pointer font-mono text-[11px] tracking-[0.16em] text-[var(--text-dim)]">STRUCTURED OUTPUT</summary>
                        <pre className="mt-2 whitespace-pre-wrap break-words font-mono text-[11px] text-[var(--text)]">{preview}</pre>
                      </details>
                    )}
                  </article>
                )
              })}
            </div>

            <div className="border-t border-[var(--border)] p-4">
              <div className="relative">
                <label className="flex items-center gap-3 rounded-[22px] border border-[var(--border)] bg-black/15 px-4 py-3">
                  <ArrowUpRight size={16} strokeWidth={1.8} className="text-[var(--accent)]" />
                  <input
                    ref={commandInputRef}
                    type="text"
                    value={state.commandDraft}
                    disabled={readOnly}
                    onChange={event => {
                      setHistoryIndex(-1)
                      setState(prev => ({ ...prev, commandDraft: event.target.value }))
                    }}
                    onKeyDown={event => { void onCommandKeyDown(event) }}
                    placeholder="Type /commands or :local helpers"
                    className="w-full bg-transparent font-mono text-[15px] text-[var(--text)] outline-none placeholder:text-[var(--text-dim)]"
                    style={{ fontSize: '16px' }}
                  />
                  <button
                    type="button"
                    onClick={() => void submitCommand()}
                    disabled={readOnly || !state.commandDraft.trim() || executing}
                    className="tap-target rounded-2xl border border-[var(--accent-mid)] bg-[var(--accent-dim)] px-4 py-2 font-mono text-[11px] tracking-[0.16em] text-[var(--accent)] transition-all disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {executing ? 'RUNNING…' : 'RUN'}
                  </button>
                </label>

                {(suggestions.length > 0 || completionLoading) && (
                  <div className="absolute inset-x-0 bottom-[calc(100%+0.6rem)] rounded-[24px] border border-[var(--border)] bg-[rgba(8,12,18,0.96)] p-2 shadow-[0_18px_46px_rgba(0,0,0,0.34)]">
                    <div className="mb-2 flex items-center justify-between px-2 font-mono text-[10px] tracking-[0.16em] text-[var(--text-dim)]">
                      <span>{completionLoading ? 'LOADING COMPLETIONS' : 'SUGGESTIONS'}</span>
                      <span>Tab to accept</span>
                    </div>
                    <div className="max-h-56 overflow-y-auto">
                      {suggestions.map((item, index) => (
                        <button
                          key={`${item}-${index}`}
                          type="button"
                          onClick={() => setState(prev => ({ ...prev, commandDraft: applyCompletion(prev.commandDraft, item) }))}
                          className={cn(
                            'flex w-full items-center justify-between rounded-2xl px-3 py-2 text-left transition-all',
                            index === suggestionIndex ? 'bg-[var(--accent-dim)] text-[var(--accent)]' : 'text-[var(--text-dim)] hover:bg-[var(--panel)]/50 hover:text-[var(--text)]',
                          )}
                        >
                          <span className="font-mono text-[12px]">{item}</span>
                          {index === suggestionIndex && <Play size={12} strokeWidth={1.8} />}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="mt-2 flex flex-wrap items-center gap-2 font-mono text-[11px] tracking-[0.14em] text-[var(--text-dim)]">
                <span>Enter run</span>
                <GripVertical size={12} strokeWidth={1.8} />
                <span>Tab autocomplete</span>
                <GripVertical size={12} strokeWidth={1.8} />
                <span>Up/Down recall</span>
                <GripVertical size={12} strokeWidth={1.8} />
                <span>Ctrl/Cmd+K search</span>
              </div>
            </div>

            {state.explorerOpen && (
              <section className="border-t border-[var(--border)] xl:hidden">
                <div className="border-b border-[var(--border)] px-4 py-3">
                  <div className="font-mono text-[11px] tracking-[0.16em] text-[var(--text-dim)]">COMMAND EXPLORER</div>
                </div>
                <div className="max-h-[38rem] min-h-[18rem]">
                  {renderExplorerPane()}
                </div>
              </section>
            )}

            {state.inspectorOpen && (
              <section className="border-t border-[var(--border)] lg:hidden">
                <div className="border-b border-[var(--border)] px-4 py-3">
                  <div className="font-mono text-[11px] tracking-[0.16em] text-[var(--text-dim)]">COMMAND INSPECTOR</div>
                </div>
                <div className="min-h-[16rem]">
                  {inspectorPane}
                </div>
              </section>
            )}
          </main>

          {state.inspectorOpen && (
            <aside
              className="hidden h-full shrink-0 flex-col border-l border-[var(--border)] lg:flex"
              style={{ width: state.rightPaneWidth }}
            >
              {inspectorPane}
            </aside>
          )}
        </div>
      </div>

      {effectiveMode === 'maximized' && !standalone && (
        <div className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm" onClick={() => updateState({ mode: initialMode })} />
      )}

      <IntegrationRecommendationModal
        open={integrationRecommendationOpen}
        recommendation={structureProviderRecommendation ?? null}
        onClose={() => setIntegrationRecommendationOpen(false)}
        onChoose={(integrationId) => {
          const selected = structureProviderStatuses.find(entry => entry.id === integrationId)
          if (selected && ['ready', 'outdated', 'drifted', 'user-managed'].includes(selected.installState)) {
            void persistStructureEditorPreference(integrationId, `Terminal recommendation flow selected ${integrationId} as the structure editor provider.`).then(result => {
              if (result) setIntegrationRecommendationOpen(false)
            })
            return
          }
          requestStructureProviderInstall(integrationId)
        }}
      />

      {confirmIntegrationInstall && (() => {
        const selected = structureProviderStatuses.find(entry => entry.id === confirmIntegrationInstall)
        const conflicting = structureProviderStatuses.filter(entry => entry.id !== confirmIntegrationInstall && ['ready', 'outdated', 'drifted', 'user-managed'].includes(entry.installState))
        if (!selected) return null
        return (
          <ConfirmModal
            title={`Install ${selected.label}?`}
            body={`${conflicting.map(entry => entry.label).join(', ')} ${conflicting.length === 1 ? 'is' : 'are'} already present on this server. Mcraftr can install ${selected.label} too, but it will not remove the existing provider automatically.`}
            confirmLabel={`Install ${selected.label}`}
            onConfirm={() => {
              const next = confirmIntegrationInstall
              setConfirmIntegrationInstall(null)
              if (next) void executeIntegrationAction('install', next)
            }}
            onCancel={() => setConfirmIntegrationInstall(null)}
          />
        )
      })()}

      {confirmCommand && (
        <ConfirmModal
          title="Run high-risk command?"
          body={confirmCommand}
          confirmLabel="Run"
          destructive
          onConfirm={() => { const next = confirmCommand; setConfirmCommand(null); void submitCommand(next) }}
          onCancel={() => setConfirmCommand(null)}
        />
      )}
    </>
  )
}
