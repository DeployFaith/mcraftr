import { Rcon } from 'rcon-client'

export type RconResult = {
  ok: boolean
  stdout: string
  error?: string
}

function sanitizeOutput(stdout: string): string {
  return stdout.replace(/§./g, '').trim()
}

export async function rconDirect(
  host: string,
  port: number,
  password: string,
  cmd: string,
): Promise<RconResult> {
  let client: Rcon | null = null
  try {
    client = await Rcon.connect({
      host,
      port,
      password,
      timeout: 6000,
    })
    const stdout = await client.send(cmd)
    return {
      ok: true,
      stdout: sanitizeOutput(stdout),
    }
  } catch (error) {
    return {
      ok: false,
      stdout: '',
      error: error instanceof Error ? error.message : 'RCON error',
    }
  } finally {
    if (client) {
      try {
        await client.end()
      } catch {}
    }
  }
}
