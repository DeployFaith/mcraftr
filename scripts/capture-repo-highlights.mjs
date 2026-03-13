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
  await page.waitForTimeout(350)
}

async function removeNoisyUi(page) {
  await page.evaluate(() => {
    for (const selector of ['[data-nextjs-toast]', '.nextjs-toast-errors', '#__next-build-watcher']) {
      for (const node of document.querySelectorAll(selector)) node.remove()
    }
  })
}

async function captureLocator(page, locator, fileName) {
  const visible = await locator.first().isVisible().catch(() => false)
  if (!visible) {
    const fallbackMain = page.locator('main').first()
    const fallback = (await fallbackMain.isVisible().catch(() => false)) ? fallbackMain : page.locator('body').first()
    await fallback.screenshot({ path: path.join(OUT_DIR, fileName), animations: 'disabled' })
    return
  }
  await locator.first().scrollIntoViewIfNeeded().catch(() => {})
  await page.waitForTimeout(180)
  await locator.first().screenshot({ path: path.join(OUT_DIR, fileName), animations: 'disabled' })
}

async function pickActivePlayer(page) {
  const list = await page.request.get('/api/players', { timeout: 20000 })
  if (!list.ok()) return null
  const payload = await list.json()
  const players = (typeof payload.players === 'string' ? payload.players : '')
    .split(',')
    .map(part => part.trim())
    .filter(Boolean)
  return players[0] ?? null
}

async function ensurePlayerSelected(page, playerName) {
  if (!playerName) return
  const activeCard = page.locator('main .glass-card').filter({ has: page.getByText(/^ACTIVE PLAYER$/) }).first()
  if (!(await activeCard.isVisible().catch(() => false))) return

  const expanded = await activeCard.locator('button[aria-expanded]').first().getAttribute('aria-expanded').catch(() => 'true')
  if (expanded === 'false') {
    await activeCard.locator('button[aria-expanded]').first().click().catch(() => {})
    await page.waitForTimeout(180)
  }

  const candidate = activeCard.getByRole('button', { name: new RegExp(`^${playerName}$`, 'i') }).first()
  if (await candidate.isVisible().catch(() => false)) {
    await candidate.click().catch(() => {})
    await page.waitForTimeout(150)
    return
  }

  const input = activeCard.locator('input[placeholder*="player name" i]').first()
  if (await input.isVisible().catch(() => false)) {
    await input.fill(playerName)
    await input.press('Enter').catch(() => {})
    await page.waitForTimeout(150)
  }
}

async function main() {
  loadEnvFiles()
  fs.mkdirSync(OUT_DIR, { recursive: true })

  const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? 'https://demo.mcraftr.deployfaith.xyz'
  const adminEmail = process.env.PLAYWRIGHT_ADMIN_EMAIL ?? process.env.MCRAFTR_ADMIN_USER
  const adminPassword = process.env.PLAYWRIGHT_ADMIN_PASSWORD ?? process.env.MCRAFTR_ADMIN_PASS

  if (!adminEmail || !adminPassword) throw new Error('Missing screenshot credentials')

  const browser = await chromium.launch({ headless: true })
  const page = await browser.newPage({ baseURL, viewport: { width: 1500, height: 1000 } })

  await page.goto('/login', { waitUntil: 'domcontentloaded' })
  await settle(page)
  await removeNoisyUi(page)
  await captureLocator(page, page.locator('form').first(), '01-login.png')

  await page.locator('input[autocomplete="username"]').fill(adminEmail)
  await page.locator('input[autocomplete="current-password"]').fill(adminPassword)
  await page.getByRole('button', { name: /sign in/i }).click()
  await page.waitForURL(/\/(minecraft|connect)(\?|$)/, { timeout: 30000 })
  await settle(page)

  const playerName = await pickActivePlayer(page)

  const views = [
    { route: '/connect', file: '02-connect.png', selector: page.locator('main .glass-card').first() },
    { route: '/minecraft?tab=dashboard', file: '03-dashboard.png', selector: page.locator('main').first() },
    { route: '/minecraft?tab=players', file: '04-players.png', selector: page.locator('main').first() },
    { route: '/minecraft?tab=actions', file: '05-actions.png', selector: page.locator('main .glass-card').filter({ has: page.getByText(/^PLAYER COMMANDS$/i) }).first() },
    { route: '/minecraft?tab=worlds', file: '06-worlds.png', selector: page.locator('main .glass-card').filter({ has: page.getByText(/^STRUCTURE CATALOG$/i) }).first() },
    { route: '/minecraft?tab=terminal', file: '07-terminal.png', selector: page.locator('main').first() },
    { route: '/minecraft?tab=admin', file: '08-admin.png', selector: page.locator('main').first() },
  ]

  for (const view of views) {
    await page.goto(view.route, { waitUntil: 'domcontentloaded' })
    await settle(page)
    await removeNoisyUi(page)
    await ensurePlayerSelected(page, playerName)
    await captureLocator(page, view.selector, view.file)
  }

  await browser.close()
}

main().catch(error => {
  console.error(error)
  process.exit(1)
})
