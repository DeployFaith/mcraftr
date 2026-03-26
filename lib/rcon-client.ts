import { Rcon } from 'rcon-client'

export type RconResult = {
  ok: boolean
  stdout: string
  error?: string
}

function sanitizeOutput(stdout: string): string {
  return stdout.replace(/§./g, '').trim()
}

function normalizeRconError(error: unknown) {
  const message = error instanceof Error ? error.message : 'RCON error'
  if (/outdated server/i.test(message) || /failed to connect to the server/i.test(message)) {
    return 'That looks like the Minecraft game port instead of the RCON port. Mcraftr needs your server\'s RCON port (usually 25575), not the gameplay port (usually 25565).'
  }
  if (/timed out/i.test(message)) {
    return 'RCON timed out. Check that the host, RCON port, password, and firewall rules are correct.'
  }
  return message
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
      error: normalizeRconError(error),
    }
  } finally {
    if (client) {
      try {
        await client.end()
      } catch {}
    }
  }
}
