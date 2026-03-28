import { expect, test, type Page } from '@playwright/test'

const adminEmail = process.env.PLAYWRIGHT_ADMIN_EMAIL ?? process.env.MCRAFTR_ADMIN_USER
const adminPassword = process.env.PLAYWRIGHT_ADMIN_PASSWORD ?? process.env.MCRAFTR_ADMIN_PASS

test.describe('structure art modal walkthrough', () => {
  test.skip(!adminEmail || !adminPassword, 'Set PLAYWRIGHT_ADMIN_EMAIL and PLAYWRIGHT_ADMIN_PASSWORD, or provide MCRAFTR_ADMIN_USER and MCRAFTR_ADMIN_PASS in a local env file.')

  test('structure inspect modal switches between Preview, 3D, and Materials', async ({ page }, testInfo) => {
    await login(page)
    await page.goto('/minecraft?tab=worlds', { waitUntil: 'networkidle' })
    await page.waitForTimeout(1200)

    const candidate = await page.evaluate(async () => {
      const structuresResponse = await fetch('/api/minecraft/structures', { cache: 'no-store' })
      const structuresPayload = await structuresResponse.json()
      const structures = Array.isArray(structuresPayload.structures) ? structuresPayload.structures : []

      for (const structure of structures) {
        const previewUrl = `/api/minecraft/structures/preview?${new URLSearchParams({
          placementKind: typeof structure.placementKind === 'string' ? structure.placementKind : 'schematic',
          ...(typeof structure.resourceKey === 'string' && structure.resourceKey ? { resourceKey: structure.resourceKey } : {}),
          ...(typeof structure.relativePath === 'string' && structure.relativePath ? { relativePath: structure.relativePath } : {}),
          ...(typeof structure.format === 'string' && structure.format ? { format: structure.format } : {}),
        }).toString()}`
        const previewResponse = await fetch(previewUrl, { cache: 'no-store' })
        const previewPayload = await previewResponse.json().catch(() => null) as { ok?: boolean; preview?: { preview3d?: unknown } | null } | null
        if (previewResponse.ok && previewPayload?.ok !== false && previewPayload?.preview?.preview3d) {
          return {
            label: typeof structure.label === 'string' ? structure.label : null,
          }
        }
      }
      return null
    })

    test.skip(!candidate?.label, 'No structure with 3D preview payload is available in this environment.')
    const structureLabel = candidate?.label
    if (!structureLabel) return

    await page.getByPlaceholder('Search structures').fill(structureLabel)
    await page.waitForTimeout(700)
    await page.getByRole('button', { name: /Open Placement Target/i }).first().click()
    await expect(page.getByText(/PLACEMENT TARGET|REMOVE TARGET/)).toBeVisible()

    const previewButton = page.getByRole('button', { name: 'Preview' }).first()
    const threeDButton = page.getByRole('button', { name: '3D' }).first()
    const materialsButton = page.getByRole('button', { name: 'Materials' }).first()

    await expect(previewButton).toBeVisible()
    await expect(threeDButton).toBeVisible()
    await expect(materialsButton).toBeVisible()

    await materialsButton.click()
    await page.waitForTimeout(400)
    const materialsImage = page.locator('img[alt$="preview"]').first()
    await expect(materialsImage).toBeVisible()
    await expect(materialsImage).toHaveAttribute('src', /artView=materials/)

    await previewButton.click()
    await page.waitForTimeout(400)
    await expect(materialsImage).toHaveAttribute('src', /artView=preview/)

    await threeDButton.click()
    await page.waitForTimeout(900)
    const canvas = page.locator('canvas').first()
    await expect(canvas).toBeVisible()

    await testInfo.attach('structure-art-modal.png', {
      body: await page.screenshot({ fullPage: false }),
      contentType: 'image/png',
    })
  })
})

async function login(page: Page) {
  await page.goto('/login', { waitUntil: 'networkidle' })
  await page.locator('input[autocomplete="username"]').fill(adminEmail!)
  await page.locator('input[autocomplete="current-password"]').fill(adminPassword!)
  await page.getByRole('button', { name: /sign in/i }).click()
  await page.waitForURL(/\/minecraft/, { timeout: 30_000 })
}
