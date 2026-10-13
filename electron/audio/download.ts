import fs from 'fs'
import crypto from 'crypto'
import { Readable } from 'stream'
import { pipeline } from 'stream/promises'

export function sha256File(file: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const h = crypto.createHash('sha256')
    fs.createReadStream(file).on('data', d => h.update(d)).on('error', reject).on('end', () => resolve(h.digest('hex')))
  })
}

/** Downloads to `<dest>.part`, resuming with a Range request, then verifies sha256 and renames. */
export async function downloadWithResume(
  url: string, dest: string, expectedSha256: string,
  onProgress: (pct: number) => void, signal: AbortSignal
): Promise<void> {
  const part = dest + '.part'
  const already = fs.existsSync(part) ? fs.statSync(part).size : 0
  const res = await fetch(url, { headers: already ? { Range: `bytes=${already}-` } : {}, signal })
  if (!res.ok || !res.body) throw new Error(`Descarga falló: HTTP ${res.status}`)

  const resumed = res.status === 206
  const start = resumed ? already : 0
  const total = start + Number(res.headers.get('content-length') ?? 0)
  let received = start
  const body = Readable.fromWeb(res.body as any)
  body.on('data', (chunk: Buffer) => {
    received += chunk.length
    if (total > 0) onProgress(Math.round((received / total) * 100))
  })
  await pipeline(body, fs.createWriteStream(part, { flags: resumed ? 'a' : 'w' }))

  const actual = await sha256File(part)
  if (actual !== expectedSha256) {
    fs.rmSync(part, { force: true })
    throw new Error(`Checksum inválido: se esperaba ${expectedSha256} y se obtuvo ${actual}`)
  }
  fs.renameSync(part, dest)
}
