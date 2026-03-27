import type { IntegrationId } from './integrations'
import { getIntegrationById, supportsMinecraftVersion } from './integrations'

export type IntegrationInstallState = 'ready' | 'missing' | 'unsupported' | 'unknown' | 'outdated' | 'drifted' | 'user-managed'

export type IntegrationStatusInput = {
  id: IntegrationId
  installed: boolean
  installState: IntegrationInstallState
  detectedVersion: string | null
}

export type IntegrationRecommendation = {
  recommendedId: IntegrationId | null
  confidence: 'high' | 'medium' | 'low'
  summary: string
  reasons: string[]
  alternatives: Array<{
    id: IntegrationId
    acceptable: boolean
    reason: string
  }>
  restartRequired: boolean
  pinnedVersion: string | null
}

type RecommendationInput = {
  minecraftVersion: string | null
  candidates: IntegrationId[]
  statuses: IntegrationStatusInput[]
}

function scoreCandidate(status: IntegrationStatusInput, minecraftVersion: string | null) {
  const integration = getIntegrationById(status.id)
  if (!integration) {
    return {
      score: -100,
      reasons: ['This integration is not present in the curated Mcraftr registry.'],
      acceptable: false,
    }
  }

  const reasons: string[] = []
  let score = 0
  let acceptable = true

  if (supportsMinecraftVersion(integration, minecraftVersion)) {
    score += 4
    reasons.push(`Pinned ${integration.label} support matches ${minecraftVersion || 'this server version'}.`)
  } else {
    score -= 6
    acceptable = false
    reasons.push(`${integration.label} is outside Mcraftr's curated version support for ${minecraftVersion || 'this server'}.`)
  }

  if (status.installState === 'ready') {
    score += 3
    reasons.push(`${integration.label} already looks ready on this server.`)
  } else if (status.installState === 'user-managed') {
    score += 2
    reasons.push(`${integration.label} is already installed, but Mcraftr is not managing that jar yet.`)
  } else if (status.installState === 'outdated') {
    score += 1
    reasons.push(`${integration.label} is installed, but it does not match the current curated pin.`)
  } else if (status.installState === 'drifted') {
    score -= 2
    reasons.push(`${integration.label} has drifted away from the curated pinned state and may need repair.`)
  } else if (status.installState === 'missing') {
    score += 1
    reasons.push(`${integration.label} is not installed yet, but remains a valid curated option.`)
  } else if (status.installState === 'unknown') {
    score -= 1
    reasons.push(`Mcraftr cannot fully verify ${integration.label} yet, so this is a lower-confidence path.`)
  } else {
    score -= 4
    acceptable = false
    reasons.push(`${integration.label} currently looks unsupported for this server state.`)
  }

  if (status.id === 'worldedit') {
    score += 2
    reasons.push('WorldEdit is the safer default when Mcraftr is optimizing for stability and compatibility.')
  }

  if (status.id === 'fawe') {
    reasons.push('FAWE stays available as an explicit option, but Mcraftr does not auto-prefer it unless support looks equally safe.')
  }

  return { score, reasons, acceptable }
}

export function recommendIntegration(input: RecommendationInput): IntegrationRecommendation {
  const candidates = input.candidates
    .map(id => input.statuses.find(status => status.id === id) ?? ({
      id,
      installed: false,
      installState: 'missing' as IntegrationInstallState,
      detectedVersion: null,
    }))
    .map(status => ({ status, assessment: scoreCandidate(status, input.minecraftVersion) }))
    .sort((a, b) => b.assessment.score - a.assessment.score)

  const best = candidates[0]
  if (!best || !best.assessment.acceptable) {
    return {
      recommendedId: null,
      confidence: 'low',
      summary: 'Mcraftr cannot safely recommend one of these integrations yet.',
      reasons: ['No curated candidate currently meets the stability-first recommendation policy.'],
      alternatives: candidates.map(candidate => ({
        id: candidate.status.id,
        acceptable: candidate.assessment.acceptable,
        reason: candidate.assessment.reasons[0] ?? 'No recommendation data available.',
      })),
      restartRequired: true,
      pinnedVersion: null,
    }
  }

  const integration = getIntegrationById(best.status.id)
  const summary = integration
    ? `Mcraftr recommends ${integration.label} because it is the safest curated fit for this server right now.`
    : 'Mcraftr found a preferred integration.'

  return {
    recommendedId: best.status.id,
    confidence: best.assessment.score >= 8 ? 'high' : best.assessment.score >= 4 ? 'medium' : 'low',
    summary,
    reasons: best.assessment.reasons,
    alternatives: candidates
      .filter(candidate => candidate.status.id !== best.status.id)
      .map(candidate => ({
        id: candidate.status.id,
        acceptable: candidate.assessment.acceptable,
        reason: candidate.assessment.reasons[0] ?? 'No additional recommendation notes.',
      })),
    restartRequired: integration?.restartRequired ?? true,
    pinnedVersion: integration?.pinnedVersion ?? null,
  }
}
