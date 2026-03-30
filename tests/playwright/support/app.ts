import { expect, type Locator, type Page } from '@playwright/test'
import { adminEmail, adminPassword } from './env'

type ServerMode = 'quick' | 'full'

export async function settle(page: Page, timeout = 400) {
  await page.waitForLoadState('domcontentloaded')
  await page.waitForLoadState('networkidle', { timeout: 8_000 }).catch(() => {})
  await page.waitForTimeout(timeout)
}

export async function login(page: Page, email = adminEmail, password = adminPassword) {
  if (process.env.PLAYWRIGHT_LOCAL === 'true' && process.env.MCRAFTR_PLAYWRIGHT_BYPASS_AUTH === 'true') {
    await page.goto('/minecraft?tab=dashboard', { waitUntil: 'domcontentloaded' })
    await settle(page)
    return
  }

  if (process.env.PLAYWRIGHT_LOCAL === 'true' && email === adminEmail && password === adminPassword) {
    await ensureAdminAccount(page)
  }

  await page.goto('/login', { waitUntil: 'domcontentloaded' })
  await page.locator('input[autocomplete="username"]').fill(email)
  await page.locator('input[autocomplete="current-password"]').fill(password)
  await page.getByRole('button', { name: /sign in/i }).click()
  await page.waitForURL(/\/(minecraft|connect)(\?|$)/, { timeout: 30_000 })
  await settle(page)
}

export async function ensureAdminAccount(page: Page) {
  const response = await page.request.post('/api/auth/register', {
    data: { email: adminEmail, password: adminPassword },
  })
  const payload = await response.json().catch(() => null) as { ok?: boolean; error?: string } | null
  if (response.ok() && payload?.ok) return
  if (payload?.error?.includes('already exists')) return
  if (payload?.error?.includes('Registration is not enabled')) return
}

export async function ensureConnectedServer(page: Page, options?: { mode?: ServerMode; label?: string }) {
  if (process.env.PLAYWRIGHT_LOCAL === 'true' && process.env.MCRAFTR_PLAYWRIGHT_BYPASS_AUTH === 'true') return
  if (!page.url().includes('/connect')) return

  await createServerOnConnect(page, {
    mode: options?.mode ?? 'full',
    label: options?.label ?? 'Disposable Full Stack',
  })
  await page.waitForURL(/\/minecraft(\?|$)/, { timeout: 30_000 })
  await settle(page)
}

export async function createServerOnConnect(page: Page, { mode, label }: { mode: ServerMode; label: string }) {
  await expect(page.getByText(/connect your minecraft server|manage your minecraft servers/i)).toBeVisible()

  if (mode === 'quick') {
    await page.getByRole('button', { name: /quick connect/i }).first().click()
  } else {
    await page.getByRole('button', { name: /full mcraftr stack/i }).first().click()
  }

  await page.locator('input[placeholder*="Family SMP"]').fill(label)
  await page.locator('input[placeholder*="play.yourserver.com"]').fill(mode === 'quick' ? 'quick.mcraftr.test' : 'full.mcraftr.test')
  await page.locator('input[type="number"]').first().fill(mode === 'quick' ? '25575' : '25576')
  await page.locator('input[type="password"]').first().fill('testing-password')

  if (mode === 'full') {
    await page.locator('input[placeholder="mcraftr"]').fill('mcraftr')
    await page.locator('input[placeholder="http://mcraftr-beacon:9419/"]').fill('http://beacon.mcraftr.test:9419/')
    await page.locator('textarea[placeholder*="plugins/WorldEdit/schematics"]').fill('plugins/WorldEdit/schematics')
    await page.locator('textarea[placeholder*="mcraftr/entity-presets"]').fill('mcraftr/entity-presets')
  }

  await page.getByRole('button', {
    name: mode === 'quick'
      ? /save quick connect|add quick connect/i
      : /save full mcraftr stack|add full mcraftr stack/i,
  }).click()
}

export async function openTab(page: Page, label: string) {
  const button = page.getByRole('button', { name: new RegExp(label, 'i') }).first()
  await button.click()
  await settle(page)
}

export async function expandCollapsibleCard(page: Page, title: string) {
  const button = page.getByRole('button', { name: new RegExp(title, 'i') }).first()
  await expect(button).toBeVisible()
  await button.scrollIntoViewIfNeeded().catch(() => {})
  const expanded = await button.getAttribute('aria-expanded').catch(() => null)
  if (expanded !== 'true') {
    await button.click({ force: true })
    await settle(page)
  }
}

export function savedServerCard(page: Page, label: string): Locator {
  return page.getByText(label, { exact: true }).locator('xpath=ancestor::div[contains(@class,"rounded-lg")][1]')
}
