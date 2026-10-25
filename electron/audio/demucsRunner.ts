import { spawn } from 'child_process'
import fs from 'fs/promises'
import path from 'path'
import { parseDemucsProgress } from './progress'
import { Job } from './types'

export interface ProcessCommand {
  file: string
  baseArgs: string[]
  env?: NodeJS.ProcessEnv
}

export interface DemucsCommand extends ProcessCommand {
  /** When set, non-WAV inputs are decoded to WAV first: the engine's ffmpeg has no ffprobe, so Demucs can't read m4a itself. */
  ffmpeg?: ProcessCommand
}

export function buildDemucsArgs(input: string, outRoot: string): string[] {
  return ['--two-stems=vocals', '-n', 'htdemucs', '-o', outRoot, input]
}

const cancelled = () => new Error('Trabajo cancelado')

function run(
  cmd: ProcessCommand, args: string[], signal: AbortSignal,
  onStderr: (chunk: string) => void, describeFailure: (code: number | null, lastLines: string) => string
): Promise<void> {
  // The signal may have fired while the caller awaited fs work; a listener added now would never run.
  if (signal.aborted) return Promise.reject(cancelled())
  return new Promise<void>((resolve, reject) => {
    const child = spawn(cmd.file, [...cmd.baseArgs, ...args], { env: { ...process.env, ...cmd.env }, windowsHide: true })
    let tail = ''
    child.stderr.on('data', (d: Buffer) => {
      const s = d.toString()
      tail = (tail + s).slice(-4000)
      onStderr(s)
    })
    const onAbort = () => child.kill()
    signal.addEventListener('abort', onAbort, { once: true })
    child.on('error', reject)
    child.on('close', code => {
      signal.removeEventListener('abort', onAbort)
      if (code === 0) return resolve()
      if (signal.aborted) return reject(cancelled())
      const lastLines = tail.split(/[\r\n]+/).map(l => l.trim()).filter(Boolean).slice(-3).join(' | ')
      reject(new Error(describeFailure(code, lastLines)))
    })
  })
}

export async function runDemucs(
  cmd: DemucsCommand,
  job: Job,
  onProgress: (pct: number) => void,
  signal: AbortSignal
): Promise<void> {
  if (signal.aborted) throw cancelled()
  const outRoot = path.join(job.outDir, '.tmp-demucs')
  try {
    await fs.rm(outRoot, { recursive: true, force: true })
    await fs.mkdir(outRoot, { recursive: true })

    let input = job.inputPath
    if (cmd.ffmpeg && path.extname(input).toLowerCase() !== '.wav') {
      const wav = path.join(outRoot, 'input.wav')
      await run(cmd.ffmpeg, ['-y', '-loglevel', 'error', '-i', input, '-vn', '-ac', '2', '-ar', '44100', wav], signal, () => {},
        (_code, lastLines) => `No se pudo leer el audio (¿archivo dañado o formato no soportado?): ${lastLines}`)
      input = wav
    }

    await run(cmd, buildDemucsArgs(input, outRoot), signal, s => {
      const pct = parseDemucsProgress(s)
      if (pct !== null) onProgress(pct)
    }, (code, lastLines) => `Demucs terminó con código ${code}: ${lastLines}`)

    const produced = path.join(outRoot, 'htdemucs', path.parse(input).name)
    await fs.rename(path.join(produced, 'no_vocals.wav'), path.join(job.outDir, 'instrumental.wav'))
    await fs.rename(path.join(produced, 'vocals.wav'), path.join(job.outDir, 'vocals.wav'))
  } finally {
    await fs.rm(outRoot, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 })
  }
}
