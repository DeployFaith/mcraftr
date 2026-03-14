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

async function removeErrorUi(page) {
  await page.evaluate(() => {
    const patterns = [
      /bridge prefix .* not valid/i,
      /feature disabled by admin/i,
      /server unreachable/i,
      /failed/i,
      /error/i,
      /unavailable/i,
    ]

    for (const selector of ['[role="alert"]', '.text-red-500', '.text-red-400', '.text-destructive']) {
      for (const node of document.querySelectorAll(selector)) node.remove()
    }

    const candidates = Array.from(document.querySelectorAll('div, p, span, li'))
    for (const node of candidates) {
      const text = (node.textContent ?? '').trim()
      if (!text) continue
      if (!patterns.some(pattern => pattern.test(text))) continue

      let target = node
      for (let i = 0; i < 4; i++) {
        const parent = target.parentElement
        if (!parent) break
        if (parent.tagName === 'MAIN' || parent.tagName === 'BODY') break
        target = parent
      }
      target.remove()
    }
  })
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

async function captureFullPage(page, fileName) {
  await page.addStyleTag({
    content: [
      '* { scroll-behavior: auto !important; }',
      '* { caret-color: transparent !important; }',
      'html, body { background: #0b0b0b !important; }',
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
  await removeNoisyUi(page)
  await removeErrorUi(page)
  await sanitizeSensitiveText(page)
  await captureFullPage(page, '01-login.png')

  await page.locator('input[autocomplete="username"]').fill(adminEmail)
  await page.locator('input[autocomplete="current-password"]').fill(adminPassword)
  await page.getByRole('button', { name: /sign in/i }).click()
  await page.waitForURL(/\/(minecraft|connect)(\?|$)/, { timeout: 30000 })
  await settle(page)

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
    await removeNoisyUi(page)
    await removeErrorUi(page)
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
