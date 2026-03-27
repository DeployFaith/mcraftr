import { getDb } from './db'
import { getIntegrationById, type IntegrationId } from './integrations'

export type IntegrationPreferenceKey = 'structure_editor_provider'

type IntegrationPreferenceRow = {
  user_id: string
  server_id: string
  preference_key: IntegrationPreferenceKey
  integration_id: IntegrationId
  reason: string | null
  created_at: number
  updated_at: number
}

export type IntegrationPreference = {
  userId: string
  serverId: string
  preferenceKey: IntegrationPreferenceKey
  integrationId: IntegrationId
  reason: string | null
  createdAt: number
  updatedAt: number
}

function rowToPreference(row: IntegrationPreferenceRow): IntegrationPreference {
  return {
    userId: row.user_id,
    serverId: row.server_id,
    preferenceKey: row.preference_key,
    integrationId: row.integration_id,
    reason: row.reason,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export function listServerIntegrationPreferences(userId: string, serverId: string): IntegrationPreference[] {
  const db = getDb()
  const rows = db.prepare(`
    SELECT *
    FROM server_integration_preferences
    WHERE user_id = ? AND server_id = ?
    ORDER BY updated_at DESC, created_at DESC
  `).all(userId, serverId) as IntegrationPreferenceRow[]
  return rows.map(rowToPreference)
}

export function getServerIntegrationPreference(userId: string, serverId: string, preferenceKey: IntegrationPreferenceKey): IntegrationPreference | null {
  const db = getDb()
  const row = db.prepare(`
    SELECT *
    FROM server_integration_preferences
    WHERE user_id = ? AND server_id = ? AND preference_key = ?
  `).get(userId, serverId, preferenceKey) as IntegrationPreferenceRow | undefined
  return row ? rowToPreference(row) : null
}

export function setServerIntegrationPreference(input: {
  userId: string
  serverId: string
  preferenceKey: IntegrationPreferenceKey
  integrationId: IntegrationId
  reason?: string | null
}) {
  if (!getIntegrationById(input.integrationId)) {
    throw new Error(`Unknown integration: ${input.integrationId}`)
  }

  const db = getDb()
  db.prepare(`
    INSERT INTO server_integration_preferences (
      user_id,
      server_id,
      preference_key,
      integration_id,
      reason,
      created_at,
      updated_at
    ) VALUES (?, ?, ?, ?, ?, unixepoch(), unixepoch())
    ON CONFLICT(user_id, server_id, preference_key)
    DO UPDATE SET
      integration_id = excluded.integration_id,
      reason = excluded.reason,
      updated_at = unixepoch()
  `).run(
    input.userId,
    input.serverId,
    input.preferenceKey,
    input.integrationId,
    input.reason?.trim() || null,
  )
}

export function clearServerIntegrationPreference(userId: string, serverId: string, preferenceKey: IntegrationPreferenceKey) {
  const db = getDb()
  db.prepare(`
    DELETE FROM server_integration_preferences
    WHERE user_id = ? AND server_id = ? AND preference_key = ?
  `).run(userId, serverId, preferenceKey)
}
