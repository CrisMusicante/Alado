import { ipcMain, dialog, app } from 'electron'
import { spawn } from 'child_process'
import crypto from 'crypto'
import fs from 'fs'
import os from 'os'
import path from 'path'
import { getDb } from '../db/database'
import { buildPack, parsePack, PACK_VERSION, PackSong } from '../audio/pack'
import { getFfmpegPath } from '../audio/engine'
import { getSongAudio, upsertSongAudio } from '../audio/repo'
import { stemsDir, findStem } from '../audio/paths'
import { assertSongId } from '../audio/validate'
import { purgeSongAudio } from './audio.handlers'

function toFlac(wav: string): Promise<Uint8Array> {
  const ffmpeg = getFfmpegPath()
  if (!ffmpeg) return Promise.resolve(new Uint8Array(fs.readFileSync(wav)))
  const out = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'wfpack-')), 'out.flac')
  return new Promise((resolve, reject) => {
    const child = spawn(ffmpeg, ['-y', '-loglevel', 'error', '-i', wav, '-c:a', 'flac', out], { windowsHide: true })
    child.on('error', reject)
    child.on('close', code => {
      if (code !== 0) return reject(new Error(`ffmpeg falló al comprimir (${code})`))
      const data = new Uint8Array(fs.readFileSync(out))
      fs.rmSync(path.dirname(out), { recursive: true, force: true })
      resolve(data)
    })
  })
}

async function stemEntry(songId: number, stem: 'instrumental' | 'vocals'): Promise<[string, Uint8Array]> {
  const p = findStem(songId, stem)
  if (!p) throw new Error(`Falta la pista ${stem}`)
  if (p.endsWith('.flac')) return [`audio/${stem}.flac`, new Uint8Array(fs.readFileSync(p))]
  const data = await toFlac(p)
  const isFlac = getFfmpegPath() !== null
  return [`audio/${stem}.${isFlac ? 'flac' : 'wav'}`, data]
}

const findDuplicate = (title: string, artist?: string) => getDb().prepare(
  `SELECT id FROM songs WHERE title = ? COLLATE NOCASE AND IFNULL(artist, '') = IFNULL(?, '') COLLATE NOCASE LIMIT 1`
).get(title, artist ?? null) as { id: number } | undefined

export function registerPackHandlers(): void {
  ipcMain.handle('pack:export', async (_e, rawId: number) => {
    const songId = assertSongId(rawId)
    const song = getDb().prepare('SELECT * FROM songs WHERE id = ?').get(songId) as any
    const audio = getSongAudio(songId)
    if (!song || audio?.status !== 'ready') throw new Error('La canción no tiene audio listo para exportar')

    const safeName = song.title.replace(/[<>:"/\\|?*]/g, '').trim() || 'cancion'
    const { canceled, filePath } = await dialog.showSaveDialog({
      defaultPath: `${safeName}.wfpack`,
      filters: [{ name: 'Paquete WorshipFlow', extensions: ['wfpack'] }]
    })
    if (canceled || !filePath) return null

    const files: Record<string, Uint8Array> = Object.fromEntries(
      await Promise.all([stemEntry(songId, 'instrumental'), stemEntry(songId, 'vocals')]))

    let video: string | undefined
    if (song.video_path && fs.existsSync(song.video_path)) {
      video = path.basename(song.video_path)
      files[`video/${video}`] = new Uint8Array(fs.readFileSync(song.video_path))
    }

    const packSong: PackSong = {
      title: song.title,
      artist: song.artist ?? undefined,
      sections: JSON.parse(song.sections),
      text_style: JSON.parse(song.text_style),
      cues: audio.cues,
      cues_sections_sig: audio.cues_sections_sig,
      vol_instrumental: audio.vol_instrumental,
      vol_vocals: audio.vol_vocals,
      video
    }
    const data = buildPack({
      manifest: { packVersion: PACK_VERSION, kind: 'song', appVersion: app.getVersion(), id: crypto.randomUUID() },
      song: packSong,
      files
    })
    fs.writeFileSync(filePath, data)
    return { path: filePath }
  })

  ipcMain.handle('pack:inspect', async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog({
      properties: ['openFile'],
      filters: [{ name: 'Paquete WorshipFlow', extensions: ['wfpack'] }]
    })
    if (canceled || !filePaths[0]) return null
    const { song } = parsePack(new Uint8Array(fs.readFileSync(filePaths[0])))
    const dup = findDuplicate(song.title, song.artist)
    return { path: filePaths[0], title: song.title, artist: song.artist, duplicateOf: dup?.id ?? null }
  })

  ipcMain.handle('pack:import', (_e, { path: packPath, mode }: { path: string; mode: 'copy' | 'replace' }) => {
    if (mode !== 'copy' && mode !== 'replace') throw new Error(`Modo de importación inválido: ${String(mode)}`)
    if (typeof packPath !== 'string' || !packPath.toLowerCase().endsWith('.wfpack')) throw new Error('Solo se pueden importar archivos .wfpack')
    const { song, files } = parsePack(new Uint8Array(fs.readFileSync(packPath)))
    const db = getDb()

    let songId: number
    const dup = findDuplicate(song.title, song.artist)

    if (mode === 'replace' && dup) {
      songId = dup.id
      purgeSongAudio(songId)
      db.prepare('UPDATE songs SET sections = ?, text_style = ? WHERE id = ?')
        .run(JSON.stringify(song.sections), JSON.stringify(song.text_style), songId)
    } else {
      const title = dup ? `${song.title} (importada)` : song.title
      songId = Number(db.prepare('INSERT INTO songs (title, artist, sections, text_style) VALUES (?,?,?,?)')
        .run(title, song.artist ?? null, JSON.stringify(song.sections), JSON.stringify(song.text_style)).lastInsertRowid)
    }

    // Every name in `files` already passed isAllowedEntry; path.basename is a second guard.
    const dir = stemsDir(songId)
    fs.mkdirSync(dir, { recursive: true })
    for (const [name, bytes] of Object.entries(files)) {
      if (name.startsWith('audio/')) fs.writeFileSync(path.join(dir, path.basename(name)), bytes)
    }
    if (song.video && files[`video/${song.video}`]) {
      const mediaDir = path.join(app.getPath('userData'), 'media', String(songId))
      fs.mkdirSync(mediaDir, { recursive: true })
      const videoPath = path.join(mediaDir, path.basename(song.video))
      fs.writeFileSync(videoPath, files[`video/${song.video}`])
      db.prepare('UPDATE songs SET video_path = ? WHERE id = ?').run(videoPath, songId)
    }

    upsertSongAudio(songId, {
      status: 'ready', error: null, original_hash: null,
      cues: song.cues, cues_sections_sig: song.cues_sections_sig,
      vol_instrumental: song.vol_instrumental, vol_vocals: song.vol_vocals
    })
    return songId
  })
}
