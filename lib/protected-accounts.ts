const DEFAULT_PROTECTED_ACCOUNTS = ['demo@mcraftr.local']

export function getProtectedAccountEmails(): string[] {
  const configured = (process.env.MCRAFTR_PROTECTED_ACCOUNTS ?? '')
    .split(',')
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean)

  return [...new Set([...DEFAULT_PROTECTED_ACCOUNTS, ...configured])]
}

export function isProtectedAccountEmail(email: string | null | undefined): boolean {
  if (!email) return false
  return getProtectedAccountEmails().includes(email.trim().toLowerCase())
}
