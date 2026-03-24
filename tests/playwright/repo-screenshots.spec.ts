import fs from 'node:fs'
import path from 'node:path'
import { test, expect, type Page } from '@playwright/test'

const adminEmail = process.env.PLAYWRIGHT_ADMIN_EMAIL ?? process.env.MCRAFTR_ADMIN_USER
const adminPassword = process.env.PLAYWRIGHT_ADMIN_PASSWORD ?? process.env.MCRAFTR_ADMIN_PASS

const TAB_SHOTS = [
  { tab: 'dashboard', label: 'Dashboard', file: '03-dashboard.png' },
  { tab: 'players', label: 'Players', file: '04-players.png' },
  { tab: 'actions', label: 'Actions', file: '05-actions.png' },
  { tab: 'worlds', label: 'Worlds', file: '06-worlds.png' },
  { tab: 'terminal', label: 'Terminal', file: '07-terminal.png' },
  { tab: 'admin', label: 'Admin', file: '08-admin.png' },
  { tab: 'chat', label: 'Chat', file: '09-chat.png' },
  { tab: 'settings', label: 'Settings', file: '10-settings.png' },
] as const

const SCREENSHOT_DIR = path.resolve(process.cwd(), 'docs/screenshots')

test.describe('repository screenshot capture', () => {
  test.skip(!adminEmail || !adminPassword, 'Set PLAYWRIGHT_ADMIN_EMAIL and PLAYWRIGHT_ADMIN_PASSWORD, or provide MCRAFTR_ADMIN_USER and MCRAFTR_ADMIN_PASS in a local env file.')

  test('capture polished desktop screenshots', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop-chromium', 'Desktop-only screenshot flow.')

    fs.mkdirSync(SCREENSHOT_DIR, { recursive: true })
    await page.setViewportSize({ width: 1728, height: 1080 })

    await page.goto('/login', { waitUntil: 'domcontentloaded' })
    await settle(page)
    await capture(page, '01-login.png')

    await login(page)
    await ensureDemoServer(page)

    await page.goto('/connect', { waitUntil: 'domcontentloaded' })
    await settle(page)
    await capture(page, '02-connect.png')

    for (const shot of TAB_SHOTS) {
      await page.goto(`/minecraft?tab=${shot.tab}`, { waitUntil: 'domcontentloaded' })
      await settle(page)
      await sanitizeUi(page)
      await capture(page, shot.file)
    }
  })
})

async function login(page: Page) {
  await page.goto('/login', { waitUntil: 'domcontentloaded' })
  await page.locator('input[autocomplete="username"]').fill(adminEmail!)
  await page.locator('input[autocomplete="current-password"]').fill(adminPassword!)
  await page.getByRole('button', { name: /sign in/i }).click()
  await page.waitForURL(/\/(minecraft|connect)(\?|$)/, { timeout: 30_000 })
  await settle(page)
}

async function ensureDemoServer(page: Page) {
  const listRes = await page.request.get('/api/servers')
  if (!listRes.ok()) return
  const listPayload = await listRes.json() as {
    servers?: Array<{ id: string; stackMode?: string; label?: string | null }>
    activeServerId?: string | null
  }
  const existing = Array.isArray(listPayload.servers) ? listPayload.servers : []
  const fullCandidate = existing.find(server => server.stackMode === 'full' || (server.label ?? '').toLowerCase() === 'full stack test')

  if (fullCandidate) {
    if (listPayload.activeServerId !== fullCandidate.id) {
      await page.request.post('/api/servers/active', { data: { serverId: fullCandidate.id } })
    }
    return
  }

  const created = await page.request.post('/api/servers', {
    data: {
      label: 'Full Stack Test',
      host: 'mcraftr.test',
      port: 25575,
      password: 'test-password',
      bridgeEnabled: true,
      bridgeCommandPrefix: 'mcraftr',
      sidecarEnabled: true,
      sidecarUrl: 'http://beacon.mcraftr.test:7070',
      sidecarToken: 'beacon-test-token',
      sidecarStructureRoots: '/world/structures',
      sidecarEntityPresetRoots: '/world/entities',
      minecraftVersionOverride: '1.21.4',
    },
  })
  if (!created.ok()) {
    const body = await created.text()
      throw new Error(`Failed to create full stack server: ${created.status()} ${body}`)
  }
}

async function sanitizeUi(page: Page) {
  await page.evaluate(() => {
    for (const selector of ['[data-nextjs-toast]', '.nextjs-toast-errors', '#__next-build-watcher']) {
      for (const node of document.querySelectorAll(selector)) {
        node.remove()
      }
    }

    const masks = [
      { pattern: /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, value: 'user@mcraftr.local' },
      { pattern: /\b\d{1,3}(?:\.\d{1,3}){3}\b/g, value: '***.***.***.***' },
      { pattern: /\b([a-z0-9-]+\.)+[a-z]{2,}\b/gi, value: 'mcraftr.test' },
    ]

    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT)
    const textNodes: Text[] = []
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      textNodes.push(node as Text)
    }

    for (const node of textNodes) {
      let value = node.textContent ?? ''
      if (!value.trim()) continue
      for (const mask of masks) value = value.replace(mask.pattern, mask.value)
      if (value !== (node.textContent ?? '')) node.textContent = value
    }
  })
}

async function capture(page: Page, fileName: string) {
  await page.addStyleTag({
    content: [
      '* { scroll-behavior: auto !important; }',
      '* { caret-color: transparent !important; }',
    ].join('\n'),
  }).catch(() => {})
  await page.evaluate(() => window.scrollTo(0, 0))
  await page.waitForTimeout(250)
  await page.screenshot({
    path: path.join(SCREENSHOT_DIR, fileName),
    fullPage: false,
    animations: 'disabled',
  })
}

async function settle(page: Page) {
  await page.waitForLoadState('domcontentloaded')
  await page.waitForLoadState('networkidle', { timeout: 8_000 }).catch(() => {})
  await page.waitForTimeout(400)
}
