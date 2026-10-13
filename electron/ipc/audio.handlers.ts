import { ipcMain, BrowserWindow } from 'electron'
import fs from 'fs'
import path from 'path'
import { SeparationQueue } from '../audio/queue'
import { runDemucs } from '../audio/demucsRunner'
import { getEngineStatus, installEngine, getDemucsCommand, EngineProgress } from '../audio/engine'
import { getSongAudio, upsertSongAudio, markInterruptedJobs } from '../audio/repo'
import { stemsRoot, stemsDir, findStem, findOriginal } from '../audio/paths'
import { sha256File } from '../audio/download'
import { Cue } from '../audio/types'
import { assertSongId, assertStem } from '../audio/validate'

const SUPPORTED = ['.mp3', '.wav', '.flac', '.m4a']
let queue: SeparationQueue
let installAbort: AbortController | null = null

export function registerAudioHandlers(getWindow: () => BrowserWindow | null): void {
  const send = (channel: string, payload: unknown) => getWindow()?.webContents.send(channel, payload)

  markInterruptedJobs()

  queue = new SeparationQueue(
    (job, onProgress, signal) => runDemucs(getDemucsCommand(), job, onProgress, signal),
    {
      onStatus: (songId, status, error) => {
        if (!getSongAudio(songId)) return // song deleted meanwhile
        upsertSongAudio(songId, { status, error: error ?? null })
        send('audio:status-changed', { songId, status, error })
      },
      onProgress: (songId, pct) => send('audio:progress', { songId, pct })
    }
  )

  ipcMain.handle('audio:engine-status', () => getEngineStatus())

  ipcMain.handle('audio:install-engine', async () => {
    installAbort = new AbortController()
    try {
      await installEngine((p: EngineProgress) => send('audio:engine-progress', p), installAbort.signal)
      return { ok: true }
    } catch (e) {
      return { ok: false, error: installAbort.signal.aborted ? 'Instalación cancelada' : (e as Error).message }
    } finally {
      installAbort = null
    }
  })

  ipcMain.handle('audio:cancel-install', () => installAbort?.abort())

  ipcMain.handle('audio:import-track', async (_e, { songId: rawId, filePath }: { songId: number; filePath: string }) => {
    const songId = assertSongId(rawId)
    const ext = path.extname(filePath).toLowerCase()
    if (!SUPPORTED.includes(ext)) throw new Error(`Formato no soportado: ${ext}. Usa mp3, wav, flac o m4a.`)
    // Two 44.1 kHz stereo WAV stems ≈ 20 MB/min; a 10 min song plus the original fits in 300 MB.
    const { bavail, bsize } = fs.statfsSync(path.dirname(stemsRoot())) // userData always exists
    if (bavail * bsize < 300 * 1024 ** 2) throw new Error('Espacio insuficiente en disco: libera al menos 300 MB e inténtalo de nuevo.')
    const hash = await sha256File(filePath)
    const existing = getSongAudio(songId)
    if (existing?.original_hash === hash && existing.status === 'ready') return existing

    const dir = stemsDir(songId)
    fs.rmSync(dir, { recursive: true, force: true })
    fs.mkdirSync(dir, { recursive: true })
    const original = path.join(dir, `original${ext}`)
    fs.copyFileSync(filePath, original)

    const row = upsertSongAudio(songId, { status: 'pending', error: null, original_hash: hash, cues: [], cues_sections_sig: null })
    queue.enqueue({ songId, inputPath: original, outDir: dir })
    return row
  })

  ipcMain.handle('audio:reprocess', (_e, rawId: number) => {
    const songId = assertSongId(rawId)
    const original = findOriginal(songId)
    if (!original) throw new Error('No se encontró el audio original; vuelve a importarlo.')
    const row = upsertSongAudio(songId, { status: 'pending', error: null })
    queue.enqueue({ songId, inputPath: original, outDir: stemsDir(songId) })
    return row
  })

  ipcMain.handle('audio:cancel', (_e, songId: number) => queue.cancel(assertSongId(songId)))
  ipcMain.handle('audio:get-queue', () => queue.snapshot())
  ipcMain.handle('audio:get-song-audio', (_e, songId: number) => getSongAudio(assertSongId(songId)))

  ipcMain.handle('audio:read-stem', (_e, { songId, stem }: { songId: number; stem: 'instrumental' | 'vocals' }) => {
    const p = findStem(assertSongId(songId), assertStem(stem))
    if (!p) throw new Error(`No existe la pista ${stem} de la canción ${songId}`)
    return new Uint8Array(fs.readFileSync(p))
  })

  ipcMain.handle('audio:update', (_e, { songId, patch }: {
    songId: number
    patch: { cues?: Cue[]; cues_sections_sig?: string | null; vol_instrumental?: number; vol_vocals?: number; duration_sec?: number }
  }) => upsertSongAudio(assertSongId(songId), patch))
}

/** Called after a song row is deleted: stop any job and remove its files. */
export function purgeSongAudio(songId: number): void {
  queue?.cancel(songId)
  fs.rmSync(stemsDir(songId), { recursive: true, force: true })
}
