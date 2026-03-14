import fs from 'node:fs'
import path from 'node:path'
import { chromium } from 'playwright'

const OUT_DIR = path.resolve(process.cwd(), 'docs/screenshots/teaser-frames')

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

async function settle(page, ms = 350) {
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
  }
}

async function collapseAll(page) {
  for (let round = 0; round < 8; round++) {
    const expanded = page.locator('main button[aria-expanded="true"]')
    const count = await expanded.count()
    if (count === 0) return
    let clicked = 0
    for (let i = count - 1; i >= 0; i--) {
      const button = expanded.nth(i)
      if (!(await button.isVisible().catch(() => false))) continue
      await button.click({ force: true }).catch(() => {})
      await page.waitForTimeout(50)
      clicked++
    }
    if (!clicked) return
    await page.waitForTimeout(120)
  }
}

async function setAccent(page, accentLabelPattern) {
  const appearance = page.locator('main button[aria-expanded]').filter({ hasText: /^Appearance$/i }).first()
  if (await appearance.isVisible().catch(() => false)) {
    const expanded = await appearance.getAttribute('aria-expanded').catch(() => 'false')
    if (expanded === 'false') {
      await appearance.click({ force: true }).catch(() => {})
      await page.waitForTimeout(180)
    }
  }

  const accentButton = page.getByRole('button', { name: accentLabelPattern }).first()
  if (await accentButton.isVisible().catch(() => false)) {
    await accentButton.click({ force: true }).catch(() => {})
    await page.waitForTimeout(250)
  }
}

async function saveFrame(page, name) {
  await cleanUi(page)
  await page.evaluate(() => window.scrollTo(0, 0))
  await page.waitForTimeout(100)
  await page.screenshot({
    path: path.join(OUT_DIR, name),
    animations: 'disabled',
  })
}

async function main() {
  fs.rmSync(OUT_DIR, { recursive: true, force: true })
  fs.mkdirSync(OUT_DIR, { recursive: true })

  const browser = await chromium.launch({ headless: true })
  const context = await browser.newContext({
    baseURL: 'https://demo.mcraftr.deployfaith.xyz',
    viewport: { width: 1600, height: 1000 },
    deviceScaleFactor: 1,
  })
  const page = await context.newPage()

  await page.goto('/login')
  await settle(page)
  await page.fill('input[autocomplete="username"]', 'admin@deployfaith.xyz')
  await page.fill('input[autocomplete="current-password"]', 'VaWX5pWFUmOj8ankPoQ')
  await page.click('button:has-text("Sign In")')
  await page.waitForURL(/\/(minecraft|connect)(\?|$)/, { timeout: 30000 })
  await settle(page)

  const playerName = '_Dadmin'
  const scenes = [
    { tab: 'dashboard', file: '01-dashboard.png' },
    { tab: 'players', file: '02-players.png', player: true },
    { tab: 'actions', file: '03-actions.png', player: true },
    { tab: 'worlds', file: '04-worlds.png', player: true },
    { tab: 'settings', file: '05-settings.png', collapse: true },
  ]

  for (const scene of scenes) {
    await page.goto(`/minecraft?tab=${scene.tab}`)
    await settle(page)
    if (scene.player) await selectActivePlayer(page, playerName)
    if (scene.collapse) await collapseAll(page)
    await settle(page, 250)
    await saveFrame(page, scene.file)
  }

  await page.goto('/minecraft?tab=settings')
  await settle(page)
  await collapseAll(page)
  await setAccent(page, /cyan|teal|blue|aqua/i)
  await settle(page, 250)
  await saveFrame(page, '06-settings-accent.png')

  await context.close()
  await browser.close()
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
