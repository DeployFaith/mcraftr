import fs from 'node:fs'
import path from 'node:path'
import { chromium } from 'playwright'

const OUT_DIR = path.resolve(process.cwd(), 'docs/screenshots/highlights')

function loadEnvFiles() {
  for (const file of ['.env.local', '.env', '.env.runtime']) {
    const full = path.resolve(process.cwd(), file)
    if (!fs.existsSync(full)) continue
    for (const line of fs.readFileSync(full, 'utf8').split(/\r?\n/)) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#')) continue
      const idx = trimmed.indexOf('=')
      if (idx < 1) continue
      const key = trimmed.slice(0, idx).trim()
      if (process.env[key] !== undefined) continue
      process.env[key] = trimmed.slice(idx + 1)
    }
  }
}

async function settle(page) {
  await page.waitForLoadState('domcontentloaded')
  await page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => {})
  await page.waitForTimeout(450)
}

async function removeNoisyUi(page) {
  await page.evaluate(() => {
    for (const selector of [
      '[data-nextjs-toast]',
      '.nextjs-toast-errors',
      '#__next-build-watcher',
      '#webpack-dev-server-client-overlay',
      '#nextjs__container_errors_label',
      '[data-nextjs-dialog-overlay]',
      '[data-nextjs-dialog]',
    ]) {
      for (const node of document.querySelectorAll(selector)) node.remove()
    }
  })
}

async function removeErrorBanners(page) {
  await page.evaluate(() => {
    const directSelectors = [
      '[role="alert"]',
      '[aria-live="assertive"]',
      '.toast-error',
      '.alert-error',
      '.banner-error',
      '.nextjs-toast-errors-parent',
    ]
    for (const selector of directSelectors) {
      for (const node of document.querySelectorAll(selector)) node.remove()
    }

    const errorPattern = /(error|failed|unavailable|invalid|could not|cannot connect|connection refused)/i
    const nodes = Array.from(document.querySelectorAll('div, section, aside'))
    for (const node of nodes) {
      const text = (node.textContent ?? '').trim()
      if (!text || !errorPattern.test(text)) continue

      const style = window.getComputedStyle(node)
      const isOverlay = style.position === 'fixed' || style.position === 'sticky' || style.zIndex !== 'auto'
      const isBanner = node.className.toString().toLowerCase().includes('toast')
        || node.className.toString().toLowerCase().includes('alert')
        || node.className.toString().toLowerCase().includes('banner')

      if (isOverlay || isBanner) node.remove()
    }
  })
}

async function ensureRenderableContent(page) {
  await page.waitForSelector('body', { state: 'visible', timeout: 20000 })
  for (let attempt = 0; attempt < 4; attempt++) {
    const length = await page.evaluate(() => {
      const main = document.querySelector('main')
      const text = (main?.textContent ?? document.body.textContent ?? '').trim()
      return text.length
    })
    if (length >= 120) return
    await settle(page)
  }
}

async function sanitizeSensitiveText(page) {
  await page.evaluate(() => {
    const replacements = [
      { pattern: /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, value: 'demo-user@example.com' },
      { pattern: /\b\d{1,3}(?:\.\d{1,3}){3}\b/g, value: '203.0.113.10' },
      { pattern: /\b(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}\b/gi, value: 'demo.mcraftr.local' },
    ]

    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT)
    const nodes = []
    for (let node = walker.nextNode(); node; node = walker.nextNode()) nodes.push(node)

    for (const node of nodes) {
      let text = node.textContent ?? ''
      if (!text.trim()) continue
      for (const replacement of replacements) text = text.replace(replacement.pattern, replacement.value)
      node.textContent = text
    }
  })
}

async function getOnlinePlayer(page) {
  const response = await page.request.get('/api/players', { timeout: 20000 })
  if (!response.ok()) return null
  const payload = await response.json()
  const players = (typeof payload.players === 'string' ? payload.players : '')
    .split(',')
    .map((name) => name.trim())
    .filter(Boolean)
  return players[0] ?? null
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

async function selectActivePlayer(page, playerName) {
  if (!playerName) return

  const card = page.locator('main .glass-card').filter({ has: page.getByText(/^ACTIVE PLAYER$/i) }).first()
  if (!(await card.isVisible().catch(() => false))) return

  const toggle = card.locator('button[aria-expanded]').first()
  if (await toggle.isVisible().catch(() => false)) {
    const expanded = await toggle.getAttribute('aria-expanded').catch(() => 'true')
    if (expanded === 'false') {
      await toggle.click().catch(() => {})
      await page.waitForTimeout(150)
    }
  }

  const chip = card.getByRole('button', { name: new RegExp(`^${escapeRegExp(playerName)}$`, 'i') }).first()
  if (await chip.isVisible().catch(() => false)) {
    await chip.click().catch(() => {})
    await page.waitForTimeout(150)
    return
  }

  const input = card.locator('input[placeholder*="player" i]').first()
  if (await input.isVisible().catch(() => false)) {
    await input.fill(playerName)
    await input.press('Enter').catch(() => {})
    await page.waitForTimeout(150)
  }
}

async function captureFullPage(page, fileName) {
  await page.addStyleTag({
    content: [
      '* { scroll-behavior: auto !important; }',
      '* { caret-color: transparent !important; }',
    ].join('\n'),
  }).catch(() => {})
  await page.evaluate(() => window.scrollTo(0, 0))
  await page.waitForTimeout(200)
  await page.screenshot({
    fullPage: true,
    animations: 'disabled',
    path: path.join(OUT_DIR, fileName),
  })
}

async function main() {
  loadEnvFiles()
  fs.mkdirSync(OUT_DIR, { recursive: true })

  const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? 'https://demo.mcraftr.deployfaith.xyz'
  const adminEmail = process.env.PLAYWRIGHT_ADMIN_EMAIL ?? process.env.MCRAFTR_ADMIN_USER
  const adminPassword = process.env.PLAYWRIGHT_ADMIN_PASSWORD ?? process.env.MCRAFTR_ADMIN_PASS

  if (!adminEmail || !adminPassword) throw new Error('Missing screenshot credentials')

  const browser = await chromium.launch({ headless: true })
  const context = await browser.newContext({
    baseURL,
    viewport: { width: 1920, height: 1080 },
    deviceScaleFactor: 2,
  })
  const page = await context.newPage()

  await page.goto('/login', { waitUntil: 'domcontentloaded' })
  await settle(page)
  await ensureRenderableContent(page)
  await removeNoisyUi(page)
  await removeErrorBanners(page)
  await sanitizeSensitiveText(page)
  await captureFullPage(page, '01-login.png')

  await page.locator('input[autocomplete="username"]').fill(adminEmail)
  await page.locator('input[autocomplete="current-password"]').fill(adminPassword)
  await page.getByRole('button', { name: /sign in/i }).click()
  await page.waitForURL(/\/(minecraft|connect)(\?|$)/, { timeout: 30000 })
  await settle(page)

  const onlinePlayer = await getOnlinePlayer(page)

  const views = [
    { route: '/connect', file: '02-connect.png' },
    { route: '/minecraft?tab=dashboard', file: '03-dashboard.png' },
    { route: '/minecraft?tab=players', file: '04-players.png' },
    { route: '/minecraft?tab=actions', file: '05-actions.png' },
    { route: '/minecraft?tab=worlds', file: '06-worlds.png' },
    { route: '/minecraft?tab=terminal', file: '07-terminal.png' },
    { route: '/minecraft?tab=admin', file: '08-admin.png' },
    { route: '/minecraft?tab=chat', file: '09-chat.png' },
    { route: '/minecraft?tab=settings', file: '10-settings.png' },
  ]

  for (const view of views) {
    await page.goto(view.route, { waitUntil: 'domcontentloaded' })
    await settle(page)
    await ensureRenderableContent(page)
    await selectActivePlayer(page, onlinePlayer)
    await removeNoisyUi(page)
    await removeErrorBanners(page)
    await selectActivePlayer(page, onlinePlayer)
    await sanitizeSensitiveText(page)
    await captureFullPage(page, view.file)
  }

  await context.close()
  await browser.close()
}

main().catch(error => {
  console.error(error)
  process.exit(1)
})
