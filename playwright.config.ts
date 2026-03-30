import fs from 'node:fs'
import path from 'node:path'
import { defineConfig, devices } from '@playwright/test'

const DEFAULT_DEPLOYED_BASE_URL = 'https://mcraftr.deployfaith.xyz'
const DEFAULT_LOCAL_BASE_URL = 'http://127.0.0.1:3054'
const PLAYWRIGHT_DIR = path.join(process.cwd(), '.playwright')
const PLAYWRIGHT_DATA_DIR = path.join(PLAYWRIGHT_DIR, 'data')
const PLAYWRIGHT_LIB_DIRS = [
  path.join(PLAYWRIGHT_DIR, 'system-libs', 'usr', 'lib', 'x86_64-linux-gnu'),
  path.join(PLAYWRIGHT_DIR, 'system-libs', 'lib', 'x86_64-linux-gnu'),
].join(':')
const PLAYWRIGHT_BROWSER_WRAPPER = path.join(process.cwd(), 'scripts', 'playwright-browser.sh')
const isLocalHarness = process.env.PLAYWRIGHT_LOCAL === 'true'
const disableWebServer = process.env.PLAYWRIGHT_DISABLE_WEBSERVER === 'true'

loadLocalEnvFiles()

const adminEmail = process.env.PLAYWRIGHT_ADMIN_EMAIL ?? process.env.MCRAFTR_ADMIN_USER ?? 'admin@mcraftr.test'
const adminPassword = process.env.PLAYWRIGHT_ADMIN_PASSWORD ?? process.env.MCRAFTR_ADMIN_PASS ?? 'AdminPass123!'
const baseURL = process.env.PLAYWRIGHT_BASE_URL
  ?? (isLocalHarness ? DEFAULT_LOCAL_BASE_URL : (process.env.NEXTAUTH_URL ?? DEFAULT_DEPLOYED_BASE_URL))

const hasBrowserWrapper = fs.existsSync(PLAYWRIGHT_BROWSER_WRAPPER)
const sharedEnv = buildSharedEnv({ baseURL, adminEmail, adminPassword })

if (hasBrowserWrapper) {
  process.env.LD_LIBRARY_PATH = [PLAYWRIGHT_LIB_DIRS, process.env.LD_LIBRARY_PATH].filter(Boolean).join(':')
  process.env.PLAYWRIGHT_SKIP_VALIDATE_HOST_REQUIREMENTS = '1'
}

Object.assign(process.env, sharedEnv)

export default defineConfig({
  testDir: './tests/playwright',
  globalSetup: './tests/playwright/global.setup.ts',
  fullyParallel: false,
  workers: 1,
  timeout: 90_000,
  expect: {
    timeout: 15_000,
  },
  reporter: [
    ['list'],
    ['html', { open: 'never' }],
  ],
  use: {
    baseURL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    launchOptions: hasBrowserWrapper
      ? { executablePath: PLAYWRIGHT_BROWSER_WRAPPER }
      : undefined,
  },
  projects: [
    {
      name: 'desktop-chromium',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1440, height: 1100 },
      },
    },
    {
      name: 'mobile-chromium',
      use: {
        ...devices['Pixel 7'],
      },
    },
  ],
  webServer: isLocalHarness && !disableWebServer
    ? {
        command: `cd ${process.cwd()} && PORT=3054 HOSTNAME=127.0.0.1 node .next/standalone/server.js`,
        url: `${baseURL}/api/health`,
        timeout: 240_000,
        reuseExistingServer: true,
        env: sharedEnv,
      }
    : undefined,
})

function buildSharedEnv({
  baseURL,
  adminEmail,
  adminPassword,
}: {
  baseURL: string
  adminEmail: string
  adminPassword: string
}) {
  return {
    ...process.env,
    PLAYWRIGHT_BASE_URL: baseURL,
    NEXTAUTH_URL: baseURL,
    PLAYWRIGHT_ADMIN_EMAIL: adminEmail,
    PLAYWRIGHT_ADMIN_PASSWORD: adminPassword,
    MCRAFTR_ADMIN_USER: adminEmail,
    MCRAFTR_ADMIN_PASS: adminPassword,
    ...(isLocalHarness
      ? {
          NEXTAUTH_SECRET: process.env.NEXTAUTH_SECRET ?? 'playwright-secret-key-0123456789',
          MCRAFTR_ENC_KEY: process.env.MCRAFTR_ENC_KEY ?? '0123456789abcdef0123456789abcdef',
          DATA_DIR: process.env.DATA_DIR ?? PLAYWRIGHT_DATA_DIR,
          ALLOW_REGISTRATION: process.env.ALLOW_REGISTRATION ?? 'true',
          MCRAFTR_ALLOW_PRIVATE_RCON_HOSTS: process.env.MCRAFTR_ALLOW_PRIVATE_RCON_HOSTS ?? 'true',
          REDIS_URL: process.env.REDIS_URL ?? 'redis://127.0.0.1:63999',
        }
      : {}),
  }
}

function loadLocalEnvFiles() {
  for (const fileName of ['.env.local', '.env', '.env.runtime']) {
    const fullPath = path.join(process.cwd(), fileName)
    if (!fs.existsSync(fullPath)) continue
    const content = fs.readFileSync(fullPath, 'utf8')
    for (const line of content.split(/\r?\n/)) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#')) continue
      const separatorIndex = trimmed.indexOf('=')
      if (separatorIndex <= 0) continue
      const key = trimmed.slice(0, separatorIndex).trim()
      if (!key || process.env[key] !== undefined) continue
      process.env[key] = trimmed.slice(separatorIndex + 1)
    }
  }
}
