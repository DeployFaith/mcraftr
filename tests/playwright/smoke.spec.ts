import { expect, test, type Page, type TestInfo } from '@playwright/test'

const adminEmail = process.env.PLAYWRIGHT_ADMIN_EMAIL ?? process.env.MCRAFTR_ADMIN_USER
const adminPassword = process.env.PLAYWRIGHT_ADMIN_PASSWORD ?? process.env.MCRAFTR_ADMIN_PASS

const DESKTOP_TABS = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'players', label: 'Players' },
  { id: 'actions', label: 'Actions' },
  { id: 'worlds', label: 'Worlds' },
  { id: 'terminal', label: 'Terminal' },
  { id: 'admin', label: 'Admin' },
  { id: 'chat', label: 'Chat' },
  { id: 'settings', label: 'Settings' },
] as const

const DANGEROUS_TEXT = /\b(save|delete|remove|destroy|run|execute|start|stop|restart|broadcast|send|kick|ban|pardon|whitelist|op|deop|teleport|give|clear|spawn|apply|assign)\b/i

type Diagnostics = {
  consoleErrors: string[]
  pageErrors: string[]
  requestFailures: string[]
  responseFailures: string[]
  coverageNotes: string[]
}

test.describe('deployed mcraftr smoke audit', () => {
  test.skip(!adminEmail || !adminPassword, 'Set PLAYWRIGHT_ADMIN_EMAIL and PLAYWRIGHT_ADMIN_PASSWORD, or provide MCRAFTR_ADMIN_USER and MCRAFTR_ADMIN_PASS in a local env file.')

  test('desktop auth and full tab walkthrough', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop-chromium', 'Desktop-only smoke flow.')
    const diagnostics = attachDiagnostics(page)

    await verifyLoginGate(page)
    await login(page)
    await ensureAuthenticatedShell(page)
    await inspectHeaderMenu(page)
    await inspectConnectPage(page)
    await walkDesktopTabs(page, diagnostics)

    await attachDiagnosticsArtifact(testInfo, diagnostics)
    assertNoCriticalDiagnostics(diagnostics)
  })

  test('mobile rail navigation walkthrough', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'mobile-chromium', 'Mobile-only smoke flow.')
    const diagnostics = attachDiagnostics(page)

    await login(page)
    await ensureAuthenticatedShell(page)
    await walkMobileRail(page, diagnostics)

    await attachDiagnosticsArtifact(testInfo, diagnostics)
    assertNoCriticalDiagnostics(diagnostics)
  })
})

function attachDiagnostics(page: Page): Diagnostics {
  const diagnostics: Diagnostics = {
    consoleErrors: [],
    pageErrors: [],
    requestFailures: [],
    responseFailures: [],
    coverageNotes: [],
  }

  page.on('console', message => {
    if (message.type() !== 'error') return
    diagnostics.consoleErrors.push(trimMessage(message.text()))
  })

  page.on('pageerror', error => {
    diagnostics.pageErrors.push(trimMessage(error.message))
  })

  page.on('requestfailed', request => {
    diagnostics.requestFailures.push(trimMessage(`${request.method()} ${stripOrigin(request.url())} :: ${request.failure()?.errorText ?? 'request failed'}`))
  })

  page.on('response', response => {
    const status = response.status()
    const url = response.url()
    if (status < 400 || shouldIgnoreHttpFailure(url, status)) return
    diagnostics.responseFailures.push(trimMessage(`${status} ${stripOrigin(url)}`))
  })

  return diagnostics
}

async function verifyLoginGate(page: Page) {
  await page.goto('/')
  await page.waitForLoadState('domcontentloaded')
  await expect(page).toHaveURL(/\/login$/)
}

async function login(page: Page) {
  await page.goto('/login')
  await page.waitForLoadState('domcontentloaded')
  await expect(page.getByRole('button', { name: /sign in/i })).toBeVisible()
  await page.locator('input[autocomplete="username"]').fill(adminEmail!)
  await page.locator('input[autocomplete="current-password"]').fill(adminPassword!)
  await page.getByRole('button', { name: /sign in/i }).click()
  await page.waitForURL(/\/(minecraft|connect)(\?|$)/, { timeout: 30_000 })
}

async function ensureAuthenticatedShell(page: Page) {
  if (page.url().includes('/connect')) {
    throw new Error('Login succeeded but no active server is selected, so the Minecraft shell is unreachable for audit.')
  }

  await expect(page).toHaveURL(/\/minecraft(\?|$)/)
  await expect(page.getByRole('button', { name: /dashboard/i })).toBeVisible()
  await expect(page.getByRole('button', { name: /open account menu/i })).toBeVisible()
  await waitForSettledUi(page)
}

async function inspectHeaderMenu(page: Page) {
  await page.getByRole('button', { name: /open account menu/i }).click()
  const accountLabel = page.getByText(/^Account$/)
  const serverLabel = page.getByText(/^Server$/)
  await expect(accountLabel).toBeVisible()
  await expect(serverLabel).toBeVisible()
  await expect(page.locator('select').first()).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(accountLabel).toBeHidden()
}

async function inspectConnectPage(page: Page) {
  await page.goto('/connect')
  await page.waitForLoadState('domcontentloaded')
  await expect(page.getByText(/manage your minecraft servers|connect your minecraft server/i)).toBeVisible()
  await expect(page.getByText(/saved servers/i)).toBeVisible()
  await waitForSettledUi(page)
  await page.goto('/minecraft?tab=dashboard')
  await waitForSettledUi(page)
}

async function walkDesktopTabs(page: Page, diagnostics: Diagnostics) {
  for (const tab of DESKTOP_TABS) {
    const tabButton = page.getByRole('button', { name: new RegExp(tab.label, 'i') })
    const isVisible = await tabButton.isVisible().catch(() => false)
    if (!isVisible) {
      diagnostics.coverageNotes.push(`Desktop tab hidden: ${tab.label}`)
      continue
    }

    await tabButton.click()
    await expect(page).toHaveURL(new RegExp(`/minecraft\\?tab=${tab.id}(?:$|&)`))
    await waitForSettledUi(page)
    await expandSafePanels(page)
  }
}

async function walkMobileRail(page: Page, diagnostics: Diagnostics) {
  await page.goto('/minecraft?tab=dashboard')
  await waitForSettledUi(page)

  const openRailButton = page.getByRole('button', { name: /expand section navigation/i })
  const collapseRailButton = page.getByRole('button', { name: /collapse section navigation/i })

  if (!(await openRailButton.isVisible().catch(() => false))) {
    diagnostics.coverageNotes.push('Mobile rail toggle not visible for this viewport.')
    return
  }

  await openRailButton.click()
  await expect(collapseRailButton).toBeVisible()

  for (const tab of DESKTOP_TABS) {
    const railButton = page.getByRole('button', { name: new RegExp(tab.label, 'i') })
    const isVisible = await railButton.isVisible().catch(() => false)
    if (!isVisible) {
      diagnostics.coverageNotes.push(`Mobile tab hidden: ${tab.label}`)
      continue
    }

    await railButton.click()
    await expect(page).toHaveURL(new RegExp(`/minecraft\\?tab=${tab.id}(?:$|&)`))
    await waitForSettledUi(page)
  }
}

async function expandSafePanels(page: Page) {
  const toggles = page.locator('main button[aria-expanded]')
  const count = await toggles.count()

  for (let index = 0; index < count; index++) {
    const toggle = toggles.nth(index)
    const isVisible = await toggle.isVisible().catch(() => false)
    if (!isVisible) continue
    const expanded = await toggle.getAttribute('aria-expanded')
    if (expanded !== 'false') continue

    const label = trimMessage(await toggle.innerText().catch(() => ''))
    if (DANGEROUS_TEXT.test(label)) continue

    await toggle.scrollIntoViewIfNeeded().catch(() => {})
    await toggle.click().catch(() => {})
    await page.waitForTimeout(150)
  }
}

async function waitForSettledUi(page: Page) {
  await page.waitForLoadState('domcontentloaded')
  await page.waitForLoadState('networkidle', { timeout: 7_500 }).catch(() => {})
  await page.waitForTimeout(400)
}

async function attachDiagnosticsArtifact(testInfo: TestInfo, diagnostics: Diagnostics) {
  await testInfo.attach('diagnostics.json', {
    body: JSON.stringify(diagnostics, null, 2),
    contentType: 'application/json',
  })
}

function assertNoCriticalDiagnostics(diagnostics: Diagnostics) {
  const problems = [
    ...diagnostics.consoleErrors.map(message => `console: ${message}`),
    ...diagnostics.pageErrors.map(message => `pageerror: ${message}`),
    ...diagnostics.requestFailures.map(message => `requestfailed: ${message}`),
    ...diagnostics.responseFailures.map(message => `response: ${message}`),
  ]

  expect(problems, [
    'Unexpected browser or network failures detected during the audit.',
    diagnostics.coverageNotes.length > 0 ? `Coverage notes: ${diagnostics.coverageNotes.join(' | ')}` : '',
  ].filter(Boolean).join('\n')).toEqual([])
}

function shouldIgnoreHttpFailure(url: string, status: number) {
  const stripped = stripOrigin(url)
  if (/\/api\/auth\/session$/.test(stripped) && (status === 401 || status === 403)) return true
  return false
}

function stripOrigin(url: string) {
  try {
    const parsed = new URL(url)
    return `${parsed.pathname}${parsed.search}`
  } catch {
    return url
  }
}

function trimMessage(message: string) {
  return message.replace(/\s+/g, ' ').trim().slice(0, 500)
}
