import fs from 'node:fs'
import path from 'node:path'
import { chromium } from 'playwright'

const OUT_DIR = path.resolve(process.cwd(), 'docs/screenshots/sections-live')

function loadEnvFiles() {
  const files = ['.env.local', '.env', '.env.runtime']
  for (const file of files) {
    const full = path.resolve(process.cwd(), file)
    if (!fs.existsSync(full)) continue
    const content = fs.readFileSync(full, 'utf8')
    for (const line of content.split(/\r?\n/)) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#')) continue
      const idx = trimmed.indexOf('=')
      if (idx <= 0) continue
      const key = trimmed.slice(0, idx).trim()
      if (!key || process.env[key] !== undefined) continue
      process.env[key] = trimmed.slice(idx + 1)
    }
  }
}

function slug(input) {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64) || 'section'
}

function escapeRegex(input) {
  return input.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

async function settle(page) {
  await page.waitForLoadState('domcontentloaded')
  await page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => {})
  await page.waitForTimeout(400)
}

async function expandAllCollapsibles(page) {
  for (let round = 0; round < 6; round++) {
    const toggles = page.locator('main button[aria-expanded="false"]')
    const count = await toggles.count()
    if (count === 0) break
    let clicked = 0
    for (let i = 0; i < count; i++) {
      const toggle = toggles.nth(i)
      const visible = await toggle.isVisible().catch(() => false)
      if (!visible) continue
      await toggle.scrollIntoViewIfNeeded().catch(() => {})
      await toggle.click().catch(() => {})
      await page.waitForTimeout(120)
      clicked++
    }
    if (clicked === 0) break
  }
}

async function ensureActivePlayerOnTab(page, playerName) {
  const activeCard = page.locator('main .glass-card').filter({ has: page.getByText(/^ACTIVE PLAYER$/) }).first()
  const hasActiveCard = await activeCard.isVisible().catch(() => false)
  if (!hasActiveCard) return

  const toggle = activeCard.locator('button[aria-expanded]').first()
  const expanded = await toggle.getAttribute('aria-expanded').catch(() => 'true')
  if (expanded === 'false') {
    await toggle.click().catch(() => {})
    await page.waitForTimeout(200)
  }

  const chip = activeCard.getByRole('button', { name: new RegExp(`^${escapeRegex(playerName)}$`) }).first()
  const chipVisible = await chip.isVisible().catch(() => false)
  if (chipVisible) {
    await chip.click().catch(() => {})
    await page.waitForTimeout(200)
    return
  }

  const input = activeCard.locator('input[placeholder*="player name" i]').first()
  const inputVisible = await input.isVisible().catch(() => false)
  if (inputVisible) {
    await input.fill(playerName)
    await input.press('Enter').catch(() => {})
    await page.waitForTimeout(200)
  }
}

async function captureViewport(page, fileName) {
  await page.evaluate(() => window.scrollTo(0, 0))
  await page.waitForTimeout(250)
  await page.screenshot({
    path: path.join(OUT_DIR, fileName),
    fullPage: false,
    animations: 'disabled',
  })
}

async function captureAllCards(page, tabId) {
  const cards = page.locator('main .glass-card')
  const count = await cards.count()
  const usedNames = new Set()

  for (let i = 0; i < count; i++) {
    const card = cards.nth(i)
    const visible = await card.isVisible().catch(() => false)
    if (!visible) continue

    await card.scrollIntoViewIfNeeded().catch(() => {})
    await page.waitForTimeout(200)

    const rawTitle = await card.locator('button[aria-expanded] .text-\\[13px\\]').first().innerText().catch(() => '')
    let base = `${tabId}-${String(i + 1).padStart(2, '0')}-${slug(rawTitle || 'panel')}`
    while (usedNames.has(base)) base = `${base}-x`
    usedNames.add(base)

    await card.screenshot({
      path: path.join(OUT_DIR, `${base}.png`),
      animations: 'disabled',
    }).catch(async () => {
      await captureViewport(page, `${base}-viewport.png`)
    })
  }
}

async function resolveActivePlayer(page, baseURL) {
  const override = process.env.PLAYWRIGHT_ACTIVE_PLAYER?.trim()
  if (override) return override

  const response = await page.request.get(`${baseURL}/api/players`, { timeout: 20000 })
  if (!response.ok()) throw new Error(`Unable to fetch players: ${response.status()}`)
  const payload = await response.json()
  const raw = typeof payload.players === 'string' ? payload.players : ''
  const players = raw.split(',').map(entry => entry.trim()).filter(Boolean)
  if (players.length === 0) {
    throw new Error('No online players found. Keep at least one player online, or set PLAYWRIGHT_ACTIVE_PLAYER to a current player name, then re-run the capture.')
  }
  return players[0]
}

async function main() {
  loadEnvFiles()
  fs.mkdirSync(OUT_DIR, { recursive: true })

  const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? process.env.NEXTAUTH_URL ?? 'https://mcraftr.deployfaith.xyz'
  const adminEmail = process.env.PLAYWRIGHT_ADMIN_EMAIL ?? process.env.MCRAFTR_ADMIN_USER
  const adminPassword = process.env.PLAYWRIGHT_ADMIN_PASSWORD ?? process.env.MCRAFTR_ADMIN_PASS

  if (!adminEmail || !adminPassword) {
    throw new Error('Missing admin credentials in env vars.')
  }

  const browser = await chromium.launch({ headless: true })
  const page = await browser.newPage({ viewport: { width: 1728, height: 1080 }, baseURL })

  await page.goto('/login', { waitUntil: 'domcontentloaded' })
  await settle(page)
  await captureViewport(page, '00-login.png')

  await page.locator('input[autocomplete="username"]').fill(adminEmail)
  await page.locator('input[autocomplete="current-password"]').fill(adminPassword)
  await page.getByRole('button', { name: /sign in/i }).click()
  await page.waitForURL(/\/(minecraft|connect)(\?|$)/, { timeout: 30000 })
  await settle(page)

  const activePlayer = await resolveActivePlayer(page, baseURL)

  await page.goto('/connect', { waitUntil: 'domcontentloaded' })
  await settle(page)
  await captureViewport(page, '01-connect.png')

  const tabs = ['dashboard', 'players', 'actions', 'worlds', 'terminal', 'admin', 'chat', 'settings']

  for (const tab of tabs) {
    await page.goto(`/minecraft?tab=${tab}`, { waitUntil: 'domcontentloaded' })
    await settle(page)

    await ensureActivePlayerOnTab(page, activePlayer)
    await expandAllCollapsibles(page)
    await settle(page)

    await captureViewport(page, `${tab}-00-overview.png`)
    await captureAllCards(page, tab)
  }

  await browser.close()
  console.log(`Captured section screenshots to ${OUT_DIR}`)
  console.log(`Active player used: ${activePlayer}`)
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
