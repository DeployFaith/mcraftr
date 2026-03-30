import fs from 'node:fs'
import path from 'node:path'

export default async function globalSetup() {
  if (process.env.PLAYWRIGHT_LOCAL !== 'true') return

  const playwrightDir = path.join(process.cwd(), '.playwright')
  fs.rmSync(path.join(playwrightDir, 'data'), { recursive: true, force: true })
  fs.rmSync(path.join(playwrightDir, 'auth'), { recursive: true, force: true })
  fs.mkdirSync(path.join(playwrightDir, 'data'), { recursive: true })
}
