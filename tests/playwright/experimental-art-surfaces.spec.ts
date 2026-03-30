import { expect, test, type Page } from '@playwright/test'
import { ensureConnectedServer, expandCollapsibleCard, login, settle } from './support/app'
import { installExperimentalArtMocks } from './support/experimental-art-mocks'

const surfaceAuditEnabled = process.env.PLAYWRIGHT_LOCAL === 'true' && process.env.PLAYWRIGHT_SURFACE_MOCK_AUDIT === 'true'

test.describe('experimental art surfaces', () => {
  test.skip(!surfaceAuditEnabled, 'Set PLAYWRIGHT_LOCAL=true and PLAYWRIGHT_SURFACE_MOCK_AUDIT=true to run the local mocked surface audit.')

  for (const experimentalArtEnabled of [false, true]) {
    const modeLabel = experimentalArtEnabled ? 'enabled' : 'disabled'

    test(`worlds, actions, and players honor experimental art when ${modeLabel}`, async ({ page }, testInfo) => {
      test.skip(testInfo.project.name !== 'desktop-chromium', 'Surface audit is desktop-only.')

      await login(page)
      await ensureConnectedServer(page)
      await installExperimentalArtMocks(page, { experimentalArtEnabled })

      await assertActionsSurface(page, experimentalArtEnabled)
      await assertWorldsSurface(page, experimentalArtEnabled)
      await assertPlayersSurface(page, experimentalArtEnabled)
    })
  }
})

async function assertActionsSurface(page: Page, experimentalArtEnabled: boolean) {
  await page.goto('/minecraft?tab=actions', { waitUntil: 'domcontentloaded' })
  await settle(page)
  await expandCollapsibleCard(page, 'ITEM CATALOG')

  await page.getByText('Diamond Sword', { exact: true }).first().click()
  await settle(page)

  const artwork = page.getByAltText('Diamond Sword preview')
  if (experimentalArtEnabled) {
    await expect(artwork).toBeVisible()
  } else {
    await expect(artwork).toHaveCount(0)
  }
}

async function assertWorldsSurface(page: Page, experimentalArtEnabled: boolean) {
  await page.goto('/minecraft?tab=worlds', { waitUntil: 'domcontentloaded' })
  await settle(page)
  await expandCollapsibleCard(page, 'STRUCTURE CATALOG')
  await expandCollapsibleCard(page, 'ENTITY CATALOG')
  await settle(page)

  const structureArtwork = page.getByAltText('Castle Keep preview')
  const entityArtwork = page.getByAltText('Villager preview')

  if (experimentalArtEnabled) {
    await expect(structureArtwork).toBeVisible()
    await expect(entityArtwork).toBeVisible()
  } else {
    await expect(structureArtwork).toHaveCount(0)
    await expect(entityArtwork).toHaveCount(0)
  }
}

async function assertPlayersSurface(page: Page, experimentalArtEnabled: boolean) {
  await page.goto('/minecraft?tab=players', { waitUntil: 'domcontentloaded' })
  await settle(page)

  await page.getByRole('button', { name: /^Alex$/ }).first().click()
  await settle(page)

  const inventoryButton = page.getByRole('button', { name: /inventory/i }).first()
  if ((await inventoryButton.getAttribute('aria-expanded').catch(() => null)) === 'false') {
    await inventoryButton.click()
    await settle(page)
  }

  await page.getByText('Diamon').first().click()
  await settle(page)

  const artwork = page.getByAltText('Diamond Sword preview')
  if (experimentalArtEnabled) {
    await expect(artwork).toBeVisible()
  } else {
    await expect(artwork).toHaveCount(0)
  }
}
