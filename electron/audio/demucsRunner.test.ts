import { describe, it, expect, beforeEach } from 'vitest'
import fs from 'fs'
import os from 'os'
import path from 'path'
import { buildDemucsArgs, runDemucs, DemucsCommand } from './demucsRunner'

const fake = path.join(__dirname, '__fixtures__', 'fake-demucs.cjs')
const cmd = (env: NodeJS.ProcessEnv = {}): DemucsCommand => ({ file: process.execPath, baseArgs: [fake], env })

let outDir: string
let input: string
beforeEach(() => {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'wf-'))
  outDir = path.join(base, 'con espacios ñ', '12') // Review Focus #2
  fs.mkdirSync(outDir, { recursive: true })
  input = path.join(outDir, 'original.mp3')
  fs.writeFileSync(input, 'MP3')
})

describe('buildDemucsArgs', () => {
  it('uses two-stems vocals with htdemucs', () => {
    expect(buildDemucsArgs('/a/original.mp3', '/a/.tmp')).toEqual(
      ['--two-stems=vocals', '-n', 'htdemucs', '-o', '/a/.tmp', '/a/original.mp3'])
  })
})

describe('runDemucs', () => {
  it('produces instrumental.wav and vocals.wav and reports progress', async () => {
    const seen: number[] = []
    await runDemucs(cmd(), { songId: 12, inputPath: input, outDir }, p => seen.push(p), new AbortController().signal)
    expect(fs.readFileSync(path.join(outDir, 'instrumental.wav'), 'utf8')).toBe('INSTRUMENTAL')
    expect(fs.readFileSync(path.join(outDir, 'vocals.wav'), 'utf8')).toBe('VOCALS')
    expect(seen.at(-1)).toBe(100)
    expect(fs.existsSync(path.join(outDir, '.tmp-demucs'))).toBe(false)
  })

  it('rejects with the tail of stderr when Demucs fails', async () => { // Review Focus #5
    await expect(runDemucs(cmd({ FAKE_DEMUCS_FAIL: '1' }), { songId: 12, inputPath: input, outDir }, () => {}, new AbortController().signal))
      .rejects.toThrow(/código 1.*Could not load file/)
    expect(fs.existsSync(path.join(outDir, 'vocals.wav'))).toBe(false)
  })

  it('kills the process on abort', async () => {
    const abort = new AbortController()
    const p = runDemucs(cmd({ FAKE_DEMUCS_HANG: '1' }), { songId: 12, inputPath: input, outDir }, () => {}, abort.signal)
    setTimeout(() => abort.abort(), 200)
    await expect(p).rejects.toThrow()
  })

  it('does not spawn when aborted while preparing the temp dir (cancel right as the job starts)', async () => {
    const abort = new AbortController()
    const p = runDemucs(cmd(), { songId: 12, inputPath: input, outDir }, () => {}, abort.signal)
    abort.abort() // lands while runDemucs awaits fs.rm / fs.mkdir
    await expect(p).rejects.toThrow('cancelado')
    expect(fs.existsSync(path.join(outDir, 'vocals.wav'))).toBe(false)
    expect(fs.existsSync(path.join(outDir, '.tmp-demucs'))).toBe(false)
  })

  it('converts non-WAV input (m4a) to WAV with ffmpeg before Demucs', async () => {
    const m4a = path.join(outDir, 'original.m4a')
    fs.writeFileSync(m4a, 'M4A')
    const withFfmpeg: DemucsCommand = {
      ...cmd({ FAKE_DEMUCS_REQUIRE_WAV: '1' }),
      ffmpeg: { file: process.execPath, baseArgs: [path.join(__dirname, '__fixtures__', 'fake-ffmpeg.cjs')] }
    }
    await runDemucs(withFfmpeg, { songId: 12, inputPath: m4a, outDir }, () => {}, new AbortController().signal)
    expect(fs.readFileSync(path.join(outDir, 'vocals.wav'), 'utf8')).toBe('VOCALS')
    expect(fs.existsSync(path.join(outDir, '.tmp-demucs'))).toBe(false)
  })

  it('reports a readable error when ffmpeg cannot decode the input', async () => {
    const m4a = path.join(outDir, 'original.m4a')
    fs.writeFileSync(m4a, 'M4A')
    const withFfmpeg: DemucsCommand = {
      ...cmd(),
      ffmpeg: { file: process.execPath, baseArgs: [path.join(__dirname, '__fixtures__', 'fake-ffmpeg.cjs')], env: { FAKE_FFMPEG_FAIL: '1' } }
    }
    await expect(runDemucs(withFfmpeg, { songId: 12, inputPath: m4a, outDir }, () => {}, new AbortController().signal))
      .rejects.toThrow(/No se pudo leer el audio.*Invalid data/)
  })

  it('rejects immediately when already aborted', async () => {
    const abort = new AbortController(); abort.abort()
    await expect(runDemucs(cmd(), { songId: 12, inputPath: input, outDir }, () => {}, abort.signal)).rejects.toThrow('cancelado')
  })
})
