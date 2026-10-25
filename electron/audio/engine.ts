import { app } from 'electron'
import { spawn } from 'child_process'
import fs from 'fs'
import path from 'path'
import * as tar from 'tar'
import manifest from './engine-manifest.json'
import { downloadWithResume } from './download'
import { DemucsCommand } from './demucsRunner'

export interface EngineStatus {
  installed: boolean
  version?: string
  platformSupported: boolean
  estimatedInstallBytes: number
}

export type EngineProgress = {
  step: 'download' | 'extract' | 'pip' | 'ffmpeg' | 'selftest'
  pct: number
  message?: string
}

type PlatformKey = keyof typeof manifest.python

const platformKey = (): PlatformKey | null => {
  const key = `${process.platform}-${process.arch}`
  return key in manifest.python ? (key as PlatformKey) : null
}

export const engineDir = (): string => path.join(app.getPath('userData'), 'audio-engine')
const markerFile = () => path.join(engineDir(), 'engine.json')
const pythonPath = () => process.platform === 'win32'
  ? path.join(engineDir(), 'python', 'python.exe')
  : path.join(engineDir(), 'python', 'bin', 'python3')
const binDir = () => path.join(engineDir(), 'bin')
const ffmpegBin = () => path.join(binDir(), process.platform === 'win32' ? 'ffmpeg.exe' : 'ffmpeg')

export async function getEngineStatus(): Promise<EngineStatus> {
  const base = { platformSupported: platformKey() !== null, estimatedInstallBytes: manifest.estimatedInstallBytes }
  try {
    const marker = JSON.parse(fs.readFileSync(markerFile(), 'utf8'))
    return { ...base, installed: marker.version === manifest.version, version: marker.version }
  } catch {
    return { ...base, installed: false }
  }
}

export function getFfmpegPath(): string | null {
  return fs.existsSync(ffmpegBin()) ? ffmpegBin() : null
}

export function getDemucsCommand(): DemucsCommand {
  return {
    file: pythonPath(),
    baseArgs: ['-m', 'demucs'],
    ffmpeg: { file: ffmpegBin(), baseArgs: [] },
    env: {
      // Without this, Python on Windows writes stdout/paths in the ANSI code page and breaks on users like "José".
      PYTHONUTF8: '1',
      // demucs 4.1 fetches weights through huggingface_hub; keep them inside the engine folder.
      HF_HOME: path.join(engineDir(), 'models', 'hf'),
      TORCH_HOME: path.join(engineDir(), 'models'),
      PIP_NO_CACHE_DIR: '1',
      PATH: `${binDir()}${path.delimiter}${process.env.PATH ?? ''}`
    }
  }
}

function runPython(args: string[], onLine: (line: string) => void, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(pythonPath(), args, { windowsHide: true, env: { ...process.env, ...getDemucsCommand().env } })
    let tail = ''
    const feed = (d: Buffer) => {
      const s = d.toString()
      tail = (tail + s).slice(-4000)
      s.split(/[\r\n]+/).filter(Boolean).forEach(onLine)
    }
    child.stdout.on('data', feed)
    child.stderr.on('data', feed)
    signal.addEventListener('abort', () => child.kill(), { once: true })
    child.on('error', reject)
    child.on('close', code => code === 0 ? resolve() : reject(new Error(`python ${args.join(' ')} → código ${code}: ${tail.slice(-500)}`)))
  })
}

export async function installEngine(onProgress: (p: EngineProgress) => void, signal: AbortSignal): Promise<void> {
  const key = platformKey()
  if (!key) throw new Error(`Plataforma no soportada: ${process.platform}-${process.arch}`)
  const dir = engineDir()
  fs.mkdirSync(dir, { recursive: true })
  const { bavail, bsize } = fs.statfsSync(dir)
  if (bavail * bsize < manifest.estimatedInstallBytes) {
    const gb = (n: number) => (n / 1024 ** 3).toFixed(1)
    throw new Error(`Espacio insuficiente: se necesitan ~${gb(manifest.estimatedInstallBytes)} GB y hay ${gb(bavail * bsize)} GB libres`)
  }
  fs.rmSync(markerFile(), { force: true })

  const archive = path.join(dir, 'python.tar.gz')
  const py = manifest.python[key]
  if (!fs.existsSync(pythonPath())) {
    await downloadWithResume(py.url, archive, py.sha256, pct => onProgress({ step: 'download', pct }), signal)
    onProgress({ step: 'extract', pct: 0 })
    fs.rmSync(path.join(dir, 'python'), { recursive: true, force: true })
    await tar.x({ file: archive, cwd: dir })
    fs.rmSync(archive, { force: true })
    onProgress({ step: 'extract', pct: 100 })
  }

  let pipLines = 0
  await runPython(
    ['-m', 'pip', 'install', '--disable-pip-version-check', '--extra-index-url', manifest.torchIndexUrl, ...manifest.pipRequirements],
    line => onProgress({ step: 'pip', pct: Math.min(95, ++pipLines), message: line.slice(0, 120) }),
    signal
  )

  onProgress({ step: 'ffmpeg', pct: 0 })
  fs.mkdirSync(binDir(), { recursive: true })
  // Python copies the binary itself (destination via argv) so no path round-trips through stdout encoding.
  await runPython(['-c', 'import imageio_ffmpeg, shutil, sys; shutil.copyfile(imageio_ffmpeg.get_ffmpeg_exe(), sys.argv[1])', ffmpegBin()],
    () => {}, signal)
  if (process.platform !== 'win32') fs.chmodSync(ffmpegBin(), 0o755)
  onProgress({ step: 'ffmpeg', pct: 100 })

  // Self-test: separates 1 s of silence; also downloads the htdemucs weights into TORCH_HOME.
  onProgress({ step: 'selftest', pct: 0 })
  const testDir = path.join(dir, 'selftest')
  fs.rmSync(testDir, { recursive: true, force: true })
  fs.mkdirSync(testDir, { recursive: true })
  const silence = path.join(testDir, 'silence.wav')
  await runPython(['-c',
    'import sys, numpy as np, soundfile as sf; sf.write(sys.argv[1], np.zeros((44100, 2), dtype="float32"), 44100)', silence], () => {}, signal)
  await runPython(['-m', 'demucs', '--two-stems=vocals', '-n', 'htdemucs', '-o', testDir, silence], () => {}, signal)
  if (!fs.existsSync(path.join(testDir, 'htdemucs', 'silence', 'vocals.wav'))) {
    throw new Error('La prueba del motor no produjo archivos de salida')
  }
  fs.rmSync(testDir, { recursive: true, force: true })

  fs.writeFileSync(markerFile(), JSON.stringify({ version: manifest.version, installedAt: new Date().toISOString() }))
  onProgress({ step: 'selftest', pct: 100 })
}
