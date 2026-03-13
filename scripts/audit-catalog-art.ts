import { getCatalogArtAuditEntries, getCatalogArtOverrides, getCatalogArtAuditSummary, getEntityReviewCoverage } from '../lib/catalog-art/audit'

async function main() {
  const summary = await getCatalogArtAuditSummary()
  const entries = await getCatalogArtAuditEntries()
  const overrides = await getCatalogArtOverrides()
  const entityCoverage = await getEntityReviewCoverage()

  const flagged = entries.filter(entry => entry.placeholder || entry.reviewState !== 'auto' || entry.fallbackReason)

  console.log(JSON.stringify({
    summary,
    flaggedEntries: flagged,
    overrides,
    entityCoverage,
  }, null, 2))
}

main().catch(error => {
  console.error(error instanceof Error ? error.stack || error.message : String(error))
  process.exit(1)
})
