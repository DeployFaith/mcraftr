import { readFileSync } from 'node:fs'
import path from 'node:path'

const rootDir = path.resolve(new URL('..', import.meta.url).pathname)

const required = (name) => {
  const value = process.env[name]
  if (!value) throw new Error(`${name} is required`)
  return value
}

const optional = (name, fallback = null) => process.env[name] ?? fallback

const dokployBaseUrl = required('DOKPLOY_BASE_URL').replace(/\/+$/, '')
const dokployApiKey = required('DOKPLOY_API_KEY')
const projectName = optional('DOKPLOY_PROJECT_NAME', 'mcraftr')
const environmentName = optional('DOKPLOY_ENVIRONMENT_NAME', 'production')
const composeName = optional('DOKPLOY_COMPOSE_NAME', 'mcraftr-p9t6c')
const publicHost = optional('DOKPLOY_DOMAIN', 'mcraftr.mesh')
const deployMode = optional('DOKPLOY_DEPLOY_MODE', 'image')

const nextAuthSecret = required('NEXTAUTH_SECRET')
const nextAuthUrl = required('NEXTAUTH_URL')
const adminUser = required('MCRAFTR_ADMIN_USER')
const adminPass = required('MCRAFTR_ADMIN_PASS')
const encKey = required('MCRAFTR_ENC_KEY')
const redisPassword = required('REDIS_PASSWORD')
const dataDir = optional('DATA_DIR', '/app/data')
const allowRegistration = optional('ALLOW_REGISTRATION', 'false')
const bridgePrefix = optional('MCRAFTR_LEGACY_BRIDGE_PREFIX', 'mcraftr')
const hostPort = optional('MCRAFTR_HOST_PORT', '3054')

const redisUrl = optional(
  'REDIS_URL',
  `redis://:${encodeURIComponent(redisPassword)}@mcraftr-redis:6379`,
)

const composeFilePath = deployMode === 'build-context'
  ? path.join(rootDir, 'deploy/dokploy/mcraftr.build-context.compose.yaml')
  : path.join(rootDir, 'deploy/dokploy/mcraftr.compose.yaml')

const composeFile = readFileSync(composeFilePath, 'utf8')

const headers = {
  'content-type': 'application/json',
  'x-api-key': dokployApiKey,
}

const parsePayload = async (response, procedure) => {
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw new Error(`${procedure} failed with HTTP ${response.status}: ${JSON.stringify(payload)}`)
  }
  if (payload.error) {
    throw new Error(`${procedure} failed: ${JSON.stringify(payload.error)}`)
  }
  return payload.result?.data?.json ?? payload.result?.data ?? payload
}

const apiQuery = async (procedure, input) => {
  const search = input == null ? 'input=%7B%22json%22%3Anull%7D' : `input=${encodeURIComponent(JSON.stringify({ json: input }))}`
  const response = await fetch(`${dokployBaseUrl}/api/trpc/${procedure}?${search}`, {
    method: 'GET',
    headers: { 'x-api-key': dokployApiKey },
  })
  return parsePayload(response, procedure)
}

const apiMutation = async (procedure, input) => {
  const response = await fetch(`${dokployBaseUrl}/api/trpc/${procedure}`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ json: input }),
  })
  return parsePayload(response, procedure)
}

const getProjectByName = async (name) => {
  const projects = await apiQuery('project.all', null)
  return Array.isArray(projects) ? projects.find(project => project.name === name) ?? null : null
}

const getEnvironmentByName = async (projectId, name) => {
  const environments = await apiQuery('environment.byProjectId', { projectId })
  return Array.isArray(environments) ? environments.find(environment => environment.name === name) ?? null : null
}

const getComposeByName = (project, environmentNameToMatch, nameToMatch) => {
  const environment = Array.isArray(project?.environments)
    ? project.environments.find(item => item.name === environmentNameToMatch) ?? null
    : null
  const compose = Array.isArray(environment?.compose)
    ? environment.compose.find(item => item.name === nameToMatch) ?? null
    : null
  return { environment, compose }
}

const getComposeDomains = async (composeId) => {
  const domains = await apiQuery('domain.byComposeId', { composeId })
  return Array.isArray(domains) ? domains : []
}

const ensureProject = async () => {
  const existing = await getProjectByName(projectName)
  if (existing) return existing
  return apiMutation('project.create', {
    name: projectName,
    description: 'Mcraftr deployment',
  })
}

const ensureEnvironment = async (projectId) => {
  const existing = await getEnvironmentByName(projectId, environmentName)
  if (existing) return existing
  return apiMutation('environment.create', {
    projectId,
    name: environmentName,
    description: 'Mcraftr runtime environment',
  })
}

const createComposeStack = async (environmentId) =>
  apiMutation('compose.create', {
    environmentId,
    name: composeName,
    description: 'Mcraftr app and Redis',
    composeType: 'docker-compose',
  })

const buildEnvironmentBlock = () => {
  const lines = [
    `NEXTAUTH_SECRET=${nextAuthSecret}`,
    `NEXTAUTH_URL=${nextAuthUrl}`,
    `MCRAFTR_ADMIN_USER=${adminUser}`,
    `MCRAFTR_ADMIN_PASS=${adminPass}`,
    `MCRAFTR_ENC_KEY=${encKey}`,
    `REDIS_PASSWORD=${redisPassword}`,
    `REDIS_URL=${redisUrl}`,
    `DATA_DIR=${dataDir}`,
    `ALLOW_REGISTRATION=${allowRegistration}`,
    `MCRAFTR_LEGACY_BRIDGE_PREFIX=${bridgePrefix}`,
    `MCRAFTR_HOST_PORT=${hostPort}`,
  ]

  const passthrough = [
    'MCRAFTR_BEACON_URL',
    'MCRAFTR_BEACON_TOKEN',
    'MCRAFTR_BRIDGE_COMMAND_PREFIX',
    'MCRAFTR_BEACON_PORT',
    'MCRAFTR_BEACON_HOST',
    'MCRAFTR_PLUGINS_DIR',
    'MCRAFTR_WORLDS_DIR',
    'MCRAFTR_SCHEMATICS_DIR',
    'MCRAFTR_ENTITY_PRESET_DIR',
    'MCRAFTR_BLUEMAP_URL',
    'MCRAFTR_DYNMAP_URL',
  ]

  for (const key of passthrough) {
    if (process.env[key]) lines.push(`${key}=${process.env[key]}`)
  }

  const legacyBeaconAliases = [
    ['MCRAFTR_BEACON_URL', 'MCRAFTR_SIDECAR_URL'],
    ['MCRAFTR_BEACON_TOKEN', 'MCRAFTR_SIDECAR_TOKEN'],
    ['MCRAFTR_BEACON_PORT', 'MCRAFTR_SIDECAR_PORT'],
    ['MCRAFTR_BEACON_HOST', 'MCRAFTR_SIDECAR_HOST'],
  ]

  for (const [modernKey, legacyKey] of legacyBeaconAliases) {
    if (!process.env[modernKey] && process.env[legacyKey]) lines.push(`${modernKey}=${process.env[legacyKey]}`)
  }

  if (deployMode === 'build-context') {
    lines.push(`MCRAFTR_BUILD_CONTEXT_URL=${required('MCRAFTR_BUILD_CONTEXT_URL')}`)
  } else {
    lines.push(`MCRAFTR_IMAGE=${required('MCRAFTR_IMAGE')}`)
  }

  return lines
}

const ensureComposeConfig = async (composeId) => {
  await apiMutation('compose.update', {
    composeId,
    sourceType: 'raw',
    composeType: 'docker-compose',
    composeFile,
    env: buildEnvironmentBlock().join('\n'),
  })
}

const ensureDomain = async (composeId) => {
  const existingDomains = await getComposeDomains(composeId)
  const existing = existingDomains.find(
    domain =>
      domain.host === publicHost &&
      (domain.path ?? '/') === '/' &&
      (domain.serviceName ?? null) === 'mcraftr',
  )

  if (existing) return existing

  return apiMutation('domain.create', {
    composeId,
    domainType: 'compose',
    serviceName: 'mcraftr',
    port: 3050,
    host: publicHost,
    path: '/',
    https: false,
    certificateType: 'none',
  })
}

const main = async () => {
  const project = await ensureProject()
  const projectId = project.projectId ?? project.id
  if (!projectId) throw new Error('Dokploy project response did not include a project identifier')

  const existingComposeLookup = getComposeByName(project, environmentName, composeName)
  const environment = existingComposeLookup.environment ?? await ensureEnvironment(projectId)
  const environmentId = environment.environmentId ?? environment.id
  if (!environmentId) throw new Error('Dokploy environment response did not include an environment identifier')

  const explicitComposeId = optional('DOKPLOY_COMPOSE_ID')
  const compose = explicitComposeId
    ? { composeId: explicitComposeId }
    : existingComposeLookup.compose ?? await createComposeStack(environmentId)
  const composeId = compose.composeId ?? compose.id
  if (!composeId) throw new Error('Dokploy compose response did not include a compose identifier')

  await ensureComposeConfig(composeId)
  await ensureDomain(composeId)
  await apiMutation('compose.deploy', { composeId })

  console.log(`Mcraftr deployed to ${dokployBaseUrl} in project ${project.name}.`)
  console.log(`Expected public host: http://${publicHost}`)
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exit(1)
})
