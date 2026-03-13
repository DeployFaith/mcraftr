import { buildEntityReviewTemplate, ENTITY_AUDIT_BUCKETS } from '../lib/catalog-art/entity-audit-plan'

const version = process.env.MCRAFTR_ENTITY_AUDIT_VERSION || '*'

console.log(JSON.stringify({
  version,
  buckets: ENTITY_AUDIT_BUCKETS,
  reviewTemplate: buildEntityReviewTemplate(version),
}, null, 2))
