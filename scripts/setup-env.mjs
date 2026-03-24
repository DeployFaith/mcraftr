import { randomBytes } from 'node:crypto'
import { existsSync } from 'node:fs'
import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { createInterface } from 'node:readline/promises'
import { stdin as input, stdout as output } from 'node:process'

const root = process.cwd()
const envPath = path.join(root, '.env')
const examplePath = path.join(root, '.env.example')

if (!existsSync(examplePath)) {
  console.error('.env.example is missing. Cannot generate .env.')
  process.exit(1)
}

const rl = createInterface({ input, output })

const ask = async (prompt, defaultValue = '') => {
  const suffix = defaultValue ? ` [${defaultValue}]` : ''
  const answer = (await rl.question(`${prompt}${suffix}: `)).trim()
  return answer || defaultValue
}

const askYesNo = async (prompt, defaultYes = true) => {
  const defaultLabel = defaultYes ? 'Y/n' : 'y/N'
  while (true) {
    const answer = (await rl.question(`${prompt} [${defaultLabel}]: `)).trim().toLowerCase()
    if (!answer) return defaultYes
    if (['y', 'yes'].includes(answer)) return true
    if (['n', 'no'].includes(answer)) return false
  }
}

const askChoice = async (prompt, options, defaultIndex = 0) => {
  console.log(`\n${prompt}`)
  options.forEach((option, index) => {
    const marker = index === defaultIndex ? '*' : ' '
    console.log(` ${marker} ${index + 1}. ${option}`)
  })
  while (true) {
    const answer = (await rl.question(`Choose 1-${options.length} [${defaultIndex + 1}]: `)).trim()
    if (!answer) return defaultIndex
    const selected = Number.parseInt(answer, 10)
    if (selected >= 1 && selected <= options.length) return selected - 1
  }
}

const randomSecret = (bytes) => randomBytes(bytes).toString('base64url')
const randomHex = (bytes) => randomBytes(bytes).toString('hex')

const normalizeUrl = (mode, rawHost, port) => {
  if (mode === 'local') return `http://localhost:${port}`
  if (mode === 'lan') return `http://${rawHost}:${port}`
  if (/^https?:\/\//i.test(rawHost)) return rawHost
  return `https://${rawHost}`
}

const updateKey = (content, key, value) => {
  const pattern = new RegExp(`^${key}=.*$`, 'm')
  if (pattern.test(content)) return content.replace(pattern, `${key}=${value}`)
  return `${content.trimEnd()}\n${key}=${value}\n`
}

const removeKeys = (content, keys) => {
  const lines = content.split('\n')
  return lines.filter((line) => !keys.some((key) => line.startsWith(`${key}=`) || line.startsWith(`# ${key}=`))).join('\n')
}

const main = async () => {
  try {
    if (existsSync(envPath)) {
      const overwrite = await askYesNo('.env already exists. Overwrite it?', false)
      if (!overwrite) {
        console.log('Aborted. Existing .env left unchanged.')
        return
      }
    }

    const example = await readFile(examplePath, 'utf8')

    console.log('\nMcraftr setup wizard\n')

    const accessModeIndex = await askChoice('How will you access Mcraftr?', [
      'Local only on this machine',
      'On my local network / home server',
      'On a public domain / reverse proxy',
    ])

    const mode = ['local', 'lan', 'domain'][accessModeIndex]
    const defaultPort = '3054'
    let hostInput = 'localhost'
    let port = defaultPort

    if (mode === 'lan') {
      hostInput = await ask('Server IP or hostname', '192.168.1.50')
      port = await ask('Mcraftr port', defaultPort)
    } else if (mode === 'domain') {
      hostInput = await ask('Public URL or domain', 'mcraftr.example.com')
    }

    const nextAuthUrl = normalizeUrl(mode, hostInput, port)
    const adminEmail = await ask('Admin email', 'admin@example.com')

    const passwordMode = await askChoice('Admin password', [
      'Generate one for me',
      'I want to enter one',
    ])

    let adminPassword = ''
    if (passwordMode === 0) {
      adminPassword = randomSecret(18)
    } else {
      while (true) {
        const first = await ask('Admin password')
        const second = await ask('Confirm admin password')
        if (first && first === second) {
          adminPassword = first
          break
        }
        console.log('Passwords did not match. Try again.')
      }
    }

    const setupModeIndex = await askChoice('Which setup do you want?', [
      'Quick Connect',
      'Full Mcraftr Stack',
    ])

    const useFullStack = setupModeIndex === 1
    let minecraftData = ''
    let beaconToken = ''
    let schematicsDir = ''
    let entityPresetDir = ''

    if (useFullStack) {
      minecraftData = await ask('Minecraft data path', '/srv/minecraft/data')
      const beaconMode = await askChoice('Beacon token', [
        'Generate one for me',
        'I want to enter one',
        'Leave it blank for now',
      ])
      if (beaconMode === 0) beaconToken = randomSecret(18)
      if (beaconMode === 1) beaconToken = await ask('Beacon token')
      schematicsDir = await ask('WorldEdit schematics dir (optional)', 'plugins/WorldEdit/schematics')
      entityPresetDir = await ask('Entity preset dir (optional)', 'mcraftr/entity-presets')
    }

    const localhostOnly = mode === 'local' ? true : await askYesNo('Bind only to localhost?', mode !== 'domain')
    const bindHost = localhostOnly ? '127.0.0.1' : '0.0.0.0'

    let outputEnv = example

    outputEnv = updateKey(outputEnv, 'NEXTAUTH_SECRET', randomHex(32))
    outputEnv = updateKey(outputEnv, 'NEXTAUTH_URL', nextAuthUrl)
    outputEnv = updateKey(outputEnv, 'MCRAFTR_ADMIN_USER', adminEmail)
    outputEnv = updateKey(outputEnv, 'MCRAFTR_ADMIN_PASS', adminPassword)
    outputEnv = updateKey(outputEnv, 'MCRAFTR_ENC_KEY', randomHex(32))
    const redisPassword = randomSecret(18)
    outputEnv = updateKey(outputEnv, 'REDIS_PASSWORD', redisPassword)
    outputEnv = updateKey(outputEnv, 'REDIS_URL', `redis://:${redisPassword}@mcraftr-redis:6379`)
    outputEnv = updateKey(outputEnv, 'DATA_DIR', '/app/data')
    outputEnv = updateKey(outputEnv, 'ALLOW_REGISTRATION', 'false')
    outputEnv = updateKey(outputEnv, 'MCRAFTR_BIND_HOST', bindHost)
    outputEnv = updateKey(outputEnv, 'MCRAFTR_BIND_PORT', port)

    outputEnv = outputEnv.replace('# MCRAFTR_IMAGE=registry.example.com/mcraftr:latest', '# MCRAFTR_IMAGE=ghcr.io/deployfaith/mcraftr:latest')
    outputEnv = outputEnv.replace('# MCRAFTR_SIDECAR_TOKEN=replace-me', '# MCRAFTR_BEACON_TOKEN=replace-me')

    if (useFullStack) {
      outputEnv = updateKey(outputEnv, 'MCRAFTR_MINECRAFT_DATA', minecraftData)
      if (beaconToken) outputEnv = updateKey(outputEnv, 'MCRAFTR_BEACON_TOKEN', beaconToken)
      if (schematicsDir) outputEnv = updateKey(outputEnv, 'MCRAFTR_SCHEMATICS_DIR', schematicsDir)
      if (entityPresetDir) outputEnv = updateKey(outputEnv, 'MCRAFTR_ENTITY_PRESET_DIR', entityPresetDir)
    }

    const header = [
      '# Generated by `npm run setup:env`',
      '# Review this file before your first deploy.',
      '',
    ].join('\n')

    console.log('\nSummary:')
    console.log(`- Access URL: ${nextAuthUrl}`)
    console.log(`- Admin email: ${adminEmail}`)
    console.log(`- Setup mode: ${useFullStack ? 'Full Mcraftr Stack' : 'Quick Connect'}`)
    console.log(`- Bind host: ${bindHost}`)
    if (useFullStack) console.log(`- Minecraft data: ${minecraftData}`)
    console.log(`- Admin password: ${passwordMode === 0 ? adminPassword : '[your custom password]'}`)

    const writeNow = await askYesNo('Write .env now?', true)
    if (!writeNow) {
      console.log('Aborted. No .env written.')
      return
    }

    await writeFile(envPath, `${header}${outputEnv.trimEnd()}\n`)

    console.log('\nCreated .env successfully.')
    console.log('Next steps:')
    console.log('1. Review .env')
    console.log('2. Run `docker compose up -d --build`')
    console.log(`3. Open ${nextAuthUrl}`)
  } finally {
    rl.close()
  }
}

await main()
