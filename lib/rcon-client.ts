import { Rcon } from 'rcon-client'

export type RconResult = {
  ok: boolean
  stdout: string
  error?: string
}

export async function rconDirect(
  host: string,
  port: number,
  password: string,
  cmd: string
): Promise<RconResult> {
  const client = new Rcon({ host, port, password, timeout: 6000 })
  try {
    await client.connect()
    const stdout = await client.send(cmd)
    return { ok: true, stdout: stdout.replace(/§./g, '').trim() }
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'RCON error'
    return { ok: false, stdout: '', error: msg }
  } finally {
    try { await client.end() } catch { /* ignore */ }
  }
}
