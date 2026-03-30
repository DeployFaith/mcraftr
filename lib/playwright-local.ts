export function isPlaywrightLocalHarness() {
  return process.env.PLAYWRIGHT_LOCAL === 'true'
}

export function isPlaywrightAuthBypassEnabled() {
  return isPlaywrightLocalHarness() && process.env.MCRAFTR_PLAYWRIGHT_BYPASS_AUTH === 'true'
}
