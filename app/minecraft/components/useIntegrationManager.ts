'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'

export type IntegrationStatus = {
  id: string
  label: string
  description: string
  owner: 'mcraftr' | 'third-party'
  kind: 'plugin' | 'service'
  installed: boolean
  installState: 'ready' | 'missing' | 'unsupported' | 'unknown' | 'outdated' | 'drifted' | 'user-managed'
  detectedVersion: string | null
  pinnedVersion: string
  restartRequired: boolean
  featureSummaries: string[]
  supportedMinecraftVersions: string[]
  notes: string[]
  reasons: string[]
  source?: {
    downloadUrl?: string | null
    filename?: string | null
    pluginPath?: string | null
    backupPath?: string | null
    managed?: boolean
  }
}

export type IntegrationPreference = {
  userId?: string
  serverId?: string
  preferenceKey?: 'structure_editor_provider'
  integrationId: string
  reason: string | null
  createdAt?: number
  updatedAt?: number
}

export type IntegrationRecommendation = {
  recommendedId: string | null
  confidence: 'high' | 'medium' | 'low'
  summary: string
  reasons: string[]
  alternatives: Array<{
    id: string
    acceptable: boolean
    reason: string
  }>
  restartRequired: boolean
  pinnedVersion: string | null
}

export type IntegrationsData = {
  ok: boolean
  error?: string
  server?: {
    id: string
    label: string | null
    minecraftVersion: string | null
    bridgeEnabled: boolean
    sidecarEnabled: boolean
  }
  integrations?: IntegrationStatus[]
  preferences?: {
    all?: IntegrationPreference[]
    structureEditorProvider: IntegrationPreference | null
    shouldPromptForStructureEditor: boolean
  }
  recommendations?: {
    structureEditor: IntegrationRecommendation
  }
}

export function useIntegrationManager(options?: { autoLoad?: boolean }) {
  const autoLoad = options?.autoLoad ?? true
  const [data, setData] = useState<IntegrationsData | null>(null)
  const [loading, setLoading] = useState(autoLoad)
  const [busyKey, setBusyKey] = useState<string | null>(null)
  const [status, setStatus] = useState<{ ok: boolean; msg: string } | null>(null)

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/minecraft/integrations', { cache: 'no-store' })
      const next = await res.json()
      setData(next)
    } catch {
      setData({ ok: false, error: 'Failed to load integration status' })
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!autoLoad) return
    void refresh()
  }, [autoLoad, refresh])

  const runAction = useCallback(async (action: 'install' | 'remove' | 'repair', integrationId: string) => {
    setBusyKey(`${action}:${integrationId}`)
    setStatus(null)
    try {
      const res = await fetch(`/api/minecraft/integrations/${action}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ integrationId }),
      })
      const result = await res.json()
      if (!result.ok) throw new Error(result.error || `Failed to ${action} integration`)
      setStatus({ ok: true, msg: result.message || `${integrationId} ${action} complete.` })
      await refresh()
      return result
    } catch (error) {
      setStatus({ ok: false, msg: error instanceof Error ? error.message : `Failed to ${action} integration.` })
      return null
    } finally {
      setBusyKey(null)
    }
  }, [refresh])

  const savePreference = useCallback(async (integrationId: string, reason: string) => {
    setBusyKey(`preference:${integrationId}`)
    setStatus(null)
    try {
      const res = await fetch('/api/minecraft/integrations/preference', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ preferenceKey: 'structure_editor_provider', integrationId, reason }),
      })
      const result = await res.json()
      if (!result.ok) throw new Error(result.error || 'Failed to save structure editor preference')
      setStatus({ ok: true, msg: `Structure editor provider set to ${integrationId}.` })
      await refresh()
      return result
    } catch (error) {
      setStatus({ ok: false, msg: error instanceof Error ? error.message : 'Failed to save structure editor preference.' })
      return null
    } finally {
      setBusyKey(null)
    }
  }, [refresh])

  const clearPreference = useCallback(async () => {
    setBusyKey('preference:clear')
    setStatus(null)
    try {
      const res = await fetch('/api/minecraft/integrations/preference', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ preferenceKey: 'structure_editor_provider', clear: true }),
      })
      const result = await res.json()
      if (!result.ok) throw new Error(result.error || 'Failed to clear structure editor preference')
      setStatus({ ok: true, msg: 'Structure editor provider preference reset.' })
      await refresh()
      return result
    } catch (error) {
      setStatus({ ok: false, msg: error instanceof Error ? error.message : 'Failed to clear structure editor preference.' })
      return null
    } finally {
      setBusyKey(null)
    }
  }, [refresh])

  const structureProviderStatuses = useMemo(
    () => (data?.integrations ?? []).filter(integration => integration.id === 'worldedit' || integration.id === 'fawe'),
    [data],
  )

  return {
    data,
    loading,
    busyKey,
    status,
    setStatus,
    refresh,
    runAction,
    savePreference,
    clearPreference,
    integrations: data?.integrations ?? [],
    structureProviderStatuses,
    structureProviderPreference: data?.preferences?.structureEditorProvider ?? null,
    structureProviderRecommendation: data?.recommendations?.structureEditor ?? null,
  }
}
