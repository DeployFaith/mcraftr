import { expect, test, type Page, type TestInfo } from '@playwright/test'
import { ENTITY_AUDIT_BUCKETS } from '../../lib/catalog-art/entity-audit-plan'

const adminEmail = process.env.PLAYWRIGHT_ADMIN_EMAIL ?? process.env.MCRAFTR_ADMIN_USER
const adminPassword = process.env.PLAYWRIGHT_ADMIN_PASSWORD ?? process.env.MCRAFTR_ADMIN_PASS

type BucketName = keyof typeof ENTITY_AUDIT_BUCKETS

const AUDIT_TARGETS: Array<{ bucket: BucketName; ids: string[] }> = [
  { bucket: 'weirdEdgeCases', ids: ENTITY_AUDIT_BUCKETS.weirdEdgeCases.slice(0, 6) },
  { bucket: 'utilityDisplay', ids: ENTITY_AUDIT_BUCKETS.utilityDisplay.slice(0, 6) },
  { bucket: 'projectiles', ids: ENTITY_AUDIT_BUCKETS.projectiles.slice(0, 8) },
  { bucket: 'highVarianceLiving', ids: ENTITY_AUDIT_BUCKETS.highVarianceLiving.slice(0, 8) },
  { bucket: 'vehicles', ids: ENTITY_AUDIT_BUCKETS.vehicles.slice(0, 6) },
]

test.describe('entity art audit walkthrough', () => {
  test.skip(!adminEmail || !adminPassword, 'Set PLAYWRIGHT_ADMIN_EMAIL and PLAYWRIGHT_ADMIN_PASSWORD, or provide MCRAFTR_ADMIN_USER and MCRAFTR_ADMIN_PASS in a local env file.')

  test('desktop entity art review pass', async ({ page }, testInfo) => {
    await login(page)
    await page.goto('/minecraft?tab=worlds', { waitUntil: 'networkidle' })
    await page.waitForTimeout(1200)

    const entityCatalog = await page.evaluate(async () => {
      const response = await fetch('/api/minecraft/entities', { cache: 'no-store' })
      const payload = await response.json()
      return Array.isArray(payload.entities) ? payload.entities : []
    })

    const report: Array<Record<string, unknown>> = []
    const [structureSearch, entitySearch] = await resolveSearchInputs(page)

    for (const target of AUDIT_TARGETS) {
      for (const entityId of target.ids) {
        await entitySearch.fill(entityId)
        await page.waitForTimeout(600)
        const targetButton = page.getByRole('button', { name: new RegExp(entityId.replace(/_/g, ' '), 'i') }).first()
        const visible = await targetButton.isVisible().catch(() => false)
        if (!visible) {
          report.push({ bucket: target.bucket, entityId, found: false })
          continue
        }

        await targetButton.click()
        await page.waitForTimeout(700)

        const apiEntry = entityCatalog.find((entry: { entityId?: string; id?: string; art?: { class?: string; strategy?: string; reviewState?: string } }) => entry.entityId === entityId || entry.id === entityId) ?? null
        const card = await page.evaluate((id) => {
          const img = Array.from(document.querySelectorAll('img')).find(el => (el.getAttribute('src') || '').includes(`/api/minecraft/art/entity/`) && (el.getAttribute('alt') || '').toLowerCase().includes(id.replace(/_/g, ' ')))
          if (!img) return null
          const rect = img.getBoundingClientRect()
          return {
            found: true,
            src: img.getAttribute('src'),
            artClass: img.getAttribute('data-art-class'),
            artStrategy: img.getAttribute('data-art-strategy'),
            width: rect.width,
            height: rect.height,
          }
        }, entityId)

        report.push({
          bucket: target.bucket,
          entityId,
          apiArtClass: apiEntry?.art?.class ?? null,
          apiArtStrategy: apiEntry?.art?.strategy ?? null,
          apiReviewState: apiEntry?.art?.reviewState ?? null,
          ...card,
        })

        const screenshot = await page.screenshot({ fullPage: false })
        await testInfo.attach(`entity-${target.bucket}-${entityId}.png`, {
          body: screenshot,
          contentType: 'image/png',
        })
      }
    }

    await testInfo.attach('entity-art-audit.json', {
      body: JSON.stringify(report, null, 2),
      contentType: 'application/json',
    })

    expect(report.some(entry => entry.found === false)).toBe(false)

    await structureSearch.fill('')
    await entitySearch.fill('')
  })
})

async function login(page: Page) {
  await page.goto('/login', { waitUntil: 'networkidle' })
  await page.locator('input[autocomplete="username"]').fill(adminEmail!)
  await page.locator('input[autocomplete="current-password"]').fill(adminPassword!)
  await page.getByRole('button', { name: /sign in/i }).click()
  await page.waitForURL(/\/minecraft/, { timeout: 30_000 })
}

async function resolveSearchInputs(page: Page) {
  const inputs = page.getByPlaceholder('Search')
  await expect(inputs).toHaveCount(2)
  return [inputs.nth(0), inputs.nth(1)] as const
}
