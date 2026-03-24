import fs from 'node:fs'
import path from 'node:path'
import { chromium } from 'playwright'
import sharp from 'sharp'

const ROOT = path.resolve(process.cwd(), 'docs/screenshots/highlights')
const OUT_DIR = path.join(ROOT, 'sections')
const VIEWPORT = { width: 1920, height: 1080 }
const OUTPUT = { width: 1600, height: 1000 }
const CROP = { left: 160, top: 40, width: 1600, height: 1000 }

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

async function settle(page, ms = 250) {
  await page.waitForLoadState('domcontentloaded')
  await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {})
  await page.waitForTimeout(ms)
}

async function cleanUi(page) {
  await page.evaluate(() => {
    const selectors = [
      '[data-nextjs-toast]',
      '.nextjs-toast-errors',
      '#__next-build-watcher',
      '#webpack-dev-server-client-overlay',
      '#nextjs__container_errors_label',
      '[data-nextjs-dialog-overlay]',
      '[data-nextjs-dialog]',
      '[role="alert"]',
      '.toast-error',
      '.alert-error',
      '.banner-error',
    ]
    for (const selector of selectors) {
      for (const node of document.querySelectorAll(selector)) node.remove()
    }
  })
}

async function sanitizeText(page) {
  await page.evaluate(() => {
    const replacements = [
      { pattern: /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, value: 'user@example.com' },
      { pattern: /\b\d{1,3}(?:\.\d{1,3}){3}\b/g, value: '203.0.113.10' },
      { pattern: /\b(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}\b/gi, value: 'mcraftr.example.local' },
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
  const preferred = process.env.PLAYWRIGHT_ACTIVE_PLAYER?.trim()
  if (preferred) return preferred
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
      await page.waitForTimeout(120)
    }
  }

  const chip = card.getByRole('button', { name: new RegExp(`^${escapeRegExp(playerName)}$`, 'i') }).first()
  if (await chip.isVisible().catch(() => false)) {
    await chip.click().catch(() => {})
    await page.waitForTimeout(120)
    return
  }

  const input = card.locator('input[placeholder*="player" i]').first()
  if (await input.isVisible().catch(() => false)) {
    await input.fill(playerName)
    await input.press('Enter').catch(() => {})
    await page.waitForTimeout(120)
  }
}

async function expandVisibleCollapsibles(page, limit = 12) {
  const collapsed = page.locator('main button[aria-expanded="false"]')
  const count = await collapsed.count()
  const max = Math.min(count, limit)
  for (let i = 0; i < max; i++) {
    const button = collapsed.nth(i)
    if (!(await button.isVisible().catch(() => false))) continue
    await button.scrollIntoViewIfNeeded().catch(() => {})
    await button.click().catch(() => {})
    await page.waitForTimeout(90)
  }
}

async function buildScrollStops(page) {
  const metrics = await page.evaluate(() => ({
    docHeight: Math.max(document.documentElement.scrollHeight, document.body.scrollHeight),
    viewportHeight: window.innerHeight,
  }))
  const maxY = Math.max(0, metrics.docHeight - metrics.viewportHeight)
  const step = 780
  const stops = []
  let y = 0
  while (y < maxY) {
    stops.push(y)
    y += step
  }
  stops.push(maxY)
  return [...new Set(stops)]
}

async function captureSection(page, outPath) {
  const tmp = `${outPath}.tmp.png`
  await page.screenshot({ path: tmp, animations: 'disabled' })
  await sharp(tmp)
    .extract(CROP)
    .resize(OUTPUT.width, OUTPUT.height, { fit: 'cover', position: 'centre' })
    .png({ compressionLevel: 9, adaptiveFiltering: true })
    .toFile(outPath)
  fs.unlinkSync(tmp)
}

async function captureLongPageSections(page, { tab, prefix, expandLimit }) {
  await page.goto(`/minecraft?tab=${tab}`, { waitUntil: 'domcontentloaded' })
  await settle(page, 350)

  const playerName = await getOnlinePlayer(page)
  await selectActivePlayer(page, playerName)
  await expandVisibleCollapsibles(page, expandLimit)
  await settle(page, 250)

  const stops = await buildScrollStops(page)
  let index = 1
  for (const y of stops) {
    await page.evaluate((scrollY) => window.scrollTo(0, scrollY), y)
    await page.waitForTimeout(220)
    await cleanUi(page)
    await sanitizeText(page)
    const out = path.join(OUT_DIR, `${prefix}-s${String(index).padStart(2, '0')}.png`)
    await captureSection(page, out)
    index++
  }

  const first = path.join(OUT_DIR, `${prefix}-s01.png`)
  const primary = path.join(ROOT, `${prefix}.png`)
  if (fs.existsSync(first)) fs.copyFileSync(first, primary)
}

async function main() {
  loadEnvFiles()
  fs.mkdirSync(OUT_DIR, { recursive: true })

  for (const file of fs.readdirSync(OUT_DIR)) {
    if (file.startsWith('05-actions-s') || file.startsWith('06-worlds-s')) {
      fs.unlinkSync(path.join(OUT_DIR, file))
    }
  }

  const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://127.0.0.1:3054'
  const adminEmail = process.env.PLAYWRIGHT_ADMIN_EMAIL ?? process.env.MCRAFTR_ADMIN_USER
  const adminPassword = process.env.PLAYWRIGHT_ADMIN_PASSWORD ?? process.env.MCRAFTR_ADMIN_PASS
  if (!adminEmail || !adminPassword) throw new Error('Missing screenshot credentials')

  const browser = await chromium.launch({ headless: true })
  const context = await browser.newContext({
    baseURL,
    viewport: VIEWPORT,
    deviceScaleFactor: 1,
  })
  const page = await context.newPage()

  await page.goto('/login', { waitUntil: 'domcontentloaded' })
  await settle(page)
  await page.locator('input[autocomplete="username"]').fill(adminEmail)
  await page.locator('input[autocomplete="current-password"]').fill(adminPassword)
  await page.getByRole('button', { name: /sign in/i }).click()
  await page.waitForURL(/\/(minecraft|connect)(\?|$)/, { timeout: 30000 })
  await settle(page)

  await captureLongPageSections(page, { tab: 'actions', prefix: '05-actions', expandLimit: 10 })
  await captureLongPageSections(page, { tab: 'worlds', prefix: '06-worlds', expandLimit: 14 })

  await context.close()
  await browser.close()
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
