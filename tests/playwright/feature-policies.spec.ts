import { expect, test, type Page } from '@playwright/test'

const adminEmail = process.env.PLAYWRIGHT_ADMIN_EMAIL ?? process.env.MCRAFTR_ADMIN_USER
const adminPassword = process.env.PLAYWRIGHT_ADMIN_PASSWORD ?? process.env.MCRAFTR_ADMIN_PASS

const experimentalFeatureLabels = ['Structure Art', 'Entity Art', 'Item Art'] as const

test.describe('feature policy experimental art coverage', () => {
  test.skip(!adminEmail || !adminPassword, 'Set PLAYWRIGHT_ADMIN_EMAIL and PLAYWRIGHT_ADMIN_PASSWORD, or provide MCRAFTR_ADMIN_USER and MCRAFTR_ADMIN_PASS in a local env file.')

  test('account preferences expose experimental art flags as booleans', async ({ page }) => {
    await login(page)

    const response = await page.request.get('/api/account/preferences')
    expect(response.ok()).toBe(true)

    const payload = await response.json() as {
      ok?: boolean
      features?: Record<string, unknown>
    }

    expect(payload.ok).toBe(true)
    expect(typeof payload.features?.enable_experimental_structure_art).toBe('boolean')
    expect(typeof payload.features?.enable_experimental_entity_art).toBe('boolean')
    expect(typeof payload.features?.enable_experimental_item_art).toBe('boolean')
  })

  test('admin feature policies surface the experimental art toggles', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop-chromium', 'Admin policy walkthrough is desktop-only.')

    await login(page)
    await page.goto('/minecraft?tab=admin', { waitUntil: 'domcontentloaded' })
    await settle(page)

    const featurePoliciesCard = page.getByRole('button', { name: /feature policies/i }).first()
    await expect(featurePoliciesCard).toBeVisible()
    if ((await featurePoliciesCard.getAttribute('aria-expanded')) === 'false') {
      await featurePoliciesCard.click()
    }

    const policyResponse = await page.request.get('/api/admin/preferences')
    expect(policyResponse.ok()).toBe(true)

    const policyPayload = await policyResponse.json() as {
      ok?: boolean
      users?: Array<{ email?: string | null }>
    }

    expect(policyPayload.ok).toBe(true)
    const targetEmail = policyPayload.users?.find(user => typeof user.email === 'string' && user.email.length > 0)?.email
    expect(targetEmail).toBeTruthy()
    if (!targetEmail) return

    await page.getByRole('button', { name: new RegExp(escapeRegExp(targetEmail), 'i') }).click()

    const experimentalCategoryButton = page.getByRole('button', { name: /experimental/i }).first()
    await expect(experimentalCategoryButton).toBeVisible()
    await experimentalCategoryButton.click()

    for (const label of experimentalFeatureLabels) {
      await expect(page.getByText(label, { exact: true })).toBeVisible()
    }
  })
})

async function login(page: Page) {
  await page.goto('/login', { waitUntil: 'domcontentloaded' })
  await settle(page)
  await page.locator('input[autocomplete="username"]').fill(adminEmail!)
  await page.locator('input[autocomplete="current-password"]').fill(adminPassword!)
  await page.getByRole('button', { name: /sign in/i }).click()
  await page.waitForURL(/\/(minecraft|connect)(\?|$)/, { timeout: 30_000 })
  await settle(page)
}

async function settle(page: Page) {
  await page.waitForLoadState('domcontentloaded')
  await page.waitForLoadState('networkidle', { timeout: 8_000 }).catch(() => {})
  await page.waitForTimeout(400)
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
