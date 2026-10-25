import { ipcMain, dialog, app } from 'electron'
import fs from 'fs'
import path from 'path'
import { getDb } from '../db/database'
import { deserializeSong } from './db.handlers'
import { buildAladoFile, parseAladoFile, planImport, LocalSong } from '../setlist/aladoFile'

export interface ImportSummary {
  setlistId: number
  reused: number
  created: string[]
  differing: string[]
  missingVideo: string[]
  missingAudio: string[]
}

const safeFileName = (name: string, fallback: string) => name.replace(/[<>:"/\\|?*]/g, '').trim() || fallback
const videosDir = () => path.join(app.getPath('userData'), 'videos')

function videoNames(dir: string): Set<string> {
  try { return new Set(fs.readdirSync(dir)) } catch { return new Set() }
}

function findDuplicateSetlist(name: string, serviceDate: string | null): number | null {
  const row = getDb().prepare(
    `SELECT id FROM setlists WHERE name = ? AND IFNULL(service_date, '') = IFNULL(?, '') ORDER BY id DESC LIMIT 1`
  ).get(name, serviceDate) as { id: number } | undefined
  return row?.id ?? null
}

export function registerSetlistHandlers(): void {
  ipcMain.handle('setlist:export', async (_e, p: { name: string; service_date: string; songIds: number[] }) => {
    const db = getDb()
    const byId = db.prepare('SELECT * FROM songs WHERE id = ?')
    const songs = p.songIds
      .map(id => byId.get(id))
      .filter(Boolean)
      .map(deserializeSong)
    const file = buildAladoFile({ name: p.name, service_date: p.service_date || null, notes: null }, songs, new Date())

    const { canceled, filePath } = await dialog.showSaveDialog({
      defaultPath: `${safeFileName(p.name, 'servicio')}.alado`,
      filters: [{ name: 'Servicio ALADO', extensions: ['alado'] }]
    })
    if (canceled || !filePath) return null
    fs.writeFileSync(filePath, JSON.stringify(file, null, 2), 'utf-8')
    return { path: filePath }
  })

  ipcMain.handle('setlist:save-pptx', async (_e, p: { bytes: Uint8Array; defaultName: string }) => {
    const { canceled, filePath } = await dialog.showSaveDialog({
      defaultPath: `${safeFileName(p.defaultName, 'servicio')}.pptx`,
      filters: [{ name: 'Presentación de PowerPoint', extensions: ['pptx'] }]
    })
    if (canceled || !filePath) return null
    fs.writeFileSync(filePath, Buffer.from(p.bytes))
    return { path: filePath }
  })

  ipcMain.handle('setlist:import-inspect', async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog({
      properties: ['openFile'],
      filters: [{ name: 'Servicio ALADO', extensions: ['alado'] }]
    })
    if (canceled || !filePaths[0]) return null
    const file = parseAladoFile(fs.readFileSync(filePaths[0], 'utf-8'))
    return {
      path: filePaths[0],
      name: file.setlist.name,
      service_date: file.setlist.service_date,
      songCount: file.items.length,
      duplicateOf: findDuplicateSetlist(file.setlist.name, file.setlist.service_date)
    }
  })

  ipcMain.handle('setlist:import-apply', (_e, p: { path: string; mode: 'new' | 'replace'; replaceId?: number }): ImportSummary => {
    const file = parseAladoFile(fs.readFileSync(p.path, 'utf-8'))
    const db = getDb()
    const local: LocalSong[] = (db.prepare('SELECT id, title, artist, sections, updated_at FROM songs').all() as any[])
      .map(r => ({ ...r, sections: JSON.parse(r.sections || '[]') }))
    const dir = videosDir()
    const names = videoNames(dir)
    const steps = planImport(file, local, dir, names)

    const summary: Omit<ImportSummary, 'setlistId' | 'missingAudio'> = { reused: 0, created: [], differing: [], missingVideo: [] }
    const insertSong = db.prepare(
      'INSERT INTO songs (title, artist, sections, video_path, text_style, folder_id) VALUES (?,?,?,?,?,NULL)')
    const insertItem = db.prepare(
      'INSERT INTO setlist_items (setlist_id, song_id, position, custom_video) VALUES (?,?,?,?)')

    const run = db.transaction((): { setlistId: number; songIds: number[] } => {
      const songIds = steps.map(step => {
        if (step.kind === 'existing') {
          summary.reused++
          if (step.differs) summary.differing.push(step.title)
          return step.songId
        }
        const { song } = step
        summary.created.push(song.title)
        if (!step.videoPath) summary.missingVideo.push(song.title)
        const r = insertSong.run(song.title, song.artist ?? null, JSON.stringify(song.sections),
          step.videoPath, JSON.stringify(song.text_style ?? {}))
        return Number(r.lastInsertRowid)
      })

      const { name, service_date, notes } = file.setlist
      let setlistId: number
      if (p.mode === 'replace' && p.replaceId) {
        db.prepare('UPDATE setlists SET name=?, service_date=?, notes=? WHERE id=?').run(name, service_date, notes, p.replaceId)
        db.prepare('DELETE FROM setlist_items WHERE setlist_id = ?').run(p.replaceId)
        setlistId = p.replaceId
      } else {
        setlistId = Number(db.prepare('INSERT INTO setlists (name, service_date, notes) VALUES (?,?,?)')
          .run(name, service_date, notes).lastInsertRowid)
      }

      file.items.forEach((item, i) => {
        const custom = item.custom_video_file && names.has(item.custom_video_file)
          ? path.join(dir, item.custom_video_file) : null
        insertItem.run(setlistId, songIds[i], i, custom)
      })
      return { setlistId, songIds }
    })

    const { setlistId, songIds } = run()
    const ready = db.prepare(`SELECT 1 FROM song_audio WHERE song_id = ? AND status = 'ready'`)
    const titles = new Map((db.prepare('SELECT id, title FROM songs').all() as any[]).map(r => [r.id, r.title]))
    const missingAudio = [...new Set(songIds)].filter(id => !ready.get(id)).map(id => titles.get(id) as string)
    return { setlistId, ...summary, missingAudio }
  })
}
