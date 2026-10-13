import { spawn } from 'child_process'
import fs from 'fs/promises'
import path from 'path'
import { parseDemucsProgress } from './progress'
import { Job } from './types'

export interface DemucsCommand {
  file: string
  baseArgs: string[]
  env?: NodeJS.ProcessEnv
}

export function buildDemucsArgs(input: string, outRoot: string): string[] {
  return ['--two-stems=vocals', '-n', 'htdemucs', '-o', outRoot, input]
}

export async function runDemucs(
  cmd: DemucsCommand,
  job: Job,
  onProgress: (pct: number) => void,
  signal: AbortSignal
): Promise<void> {
  if (signal.aborted) throw new Error('Trabajo cancelado')
  const outRoot = path.join(job.outDir, '.tmp-demucs')
  await fs.rm(outRoot, { recursive: true, force: true })
  await fs.mkdir(outRoot, { recursive: true })

  try {
    await new Promise<void>((resolve, reject) => {
      const child = spawn(cmd.file, [...cmd.baseArgs, ...buildDemucsArgs(job.inputPath, outRoot)], {
        env: { ...process.env, ...cmd.env },
        windowsHide: true
      })
      let tail = ''
      child.stderr.on('data', (d: Buffer) => {
        const s = d.toString()
        tail = (tail + s).slice(-4000)
        const pct = parseDemucsProgress(s)
        if (pct !== null) onProgress(pct)
      })
      const onAbort = () => child.kill()
      signal.addEventListener('abort', onAbort, { once: true })
      child.on('error', reject)
      child.on('close', code => {
        signal.removeEventListener('abort', onAbort)
        if (code === 0) return resolve()
        const lastLines = tail.split(/[\r\n]+/).map(l => l.trim()).filter(Boolean).slice(-3).join(' | ')
        reject(new Error(`Demucs terminó con código ${code}: ${lastLines}`))
      })
    })

    const produced = path.join(outRoot, 'htdemucs', path.parse(job.inputPath).name)
    await fs.rename(path.join(produced, 'no_vocals.wav'), path.join(job.outDir, 'instrumental.wav'))
    await fs.rename(path.join(produced, 'vocals.wav'), path.join(job.outDir, 'vocals.wav'))
  } finally {
    await fs.rm(outRoot, { recursive: true, force: true })
  }
}
