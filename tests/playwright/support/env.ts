export const adminEmail = process.env.PLAYWRIGHT_ADMIN_EMAIL ?? process.env.MCRAFTR_ADMIN_USER ?? 'admin@mcraftr.test'
export const adminPassword = process.env.PLAYWRIGHT_ADMIN_PASSWORD ?? process.env.MCRAFTR_ADMIN_PASS ?? 'AdminPass123!'

export function uniqueEmail(prefix: string) {
  const token = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  return `${prefix}-${token}@mcraftr.test`
}

export function uniqueLabel(prefix: string) {
  const token = Math.random().toString(36).slice(2, 8)
  return `${prefix} ${token}`
}
