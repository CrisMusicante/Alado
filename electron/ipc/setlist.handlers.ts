import { ipcMain, dialog, app } from 'electron'
import fs from 'fs'
import path from 'path'
import { getDb } from '../db/database'
import { deserializeSong, serializeSheetStyle } from './db.handlers'
import { buildAladoFile, parseAladoFile, planImport, LocalSong } from '../setlist/aladoFile'
import { buildLyricsSheetHtml, SheetSong } from '../setlist/lyricsSheet'
import { renderSheetPdf, renderSheetPreview } from '../setlist/renderSheet'
import { parseSheetStyle, resolveSheetStyle, DEFAULT_SHEET_STYLE, SheetStyle } from '../setlist/sheetStyle'

export interface ImportSummary {
  setlistId: number
  reused: number
  created: string[]
  differing: string[]
  missingVideo: string[]
  missingAudio: string[]
}

const safeFileName = (name: string, fallback: string) => name.replace(/[<>:"/\\|?*]/g, '').trim() || fallback
/** The general sheet setting sent by the renderer (Configuración), with unknown values dropped. */
const generalSheetStyle = (v: unknown): SheetStyle => resolveSheetStyle(DEFAULT_SHEET_STYLE, parseSheetStyle(v))

/** A song being edited (possibly unsaved), validated just enough to draw its preview. */
function previewSong(v: any): SheetSong {
  const str = (x: unknown) => (typeof x === 'string' ? x : '')
  const sections = Array.isArray(v?.sections) ? v.sections : []
  return {
    title: str(v?.title), artist: str(v?.artist) || null, song_key: str(v?.song_key) || null, sheet_style: v?.sheet_style,
    sections: sections.map((s: any) => ({
      label: str(s?.label), repeat: Number(s?.repeat) || 1,
      lines: Array.isArray(s?.lines) ? s.lines.map(str) : []
    }))
  }
}

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
  ipcMain.handle('setlist:export', async (_e, p: { name: string; service_date: string; notes?: string | null; songIds: number[]; customVideos?: Array<string | null> }) => {
    const db = getDb()
    const byId = db.prepare('SELECT * FROM songs WHERE id = ?')
    const songs = p.songIds
      .map((id, i) => {
        const row = byId.get(id)
        return row ? { ...deserializeSong(row), custom_video: p.customVideos?.[i] ?? null } : null
      })
      .filter((s): s is NonNullable<typeof s> => s !== null)
    const file = buildAladoFile({ name: p.name, service_date: p.service_date || null, notes: p.notes ?? null }, songs, new Date())

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

  ipcMain.handle('setlist:export-pdf', async (_e, p: { name: string; service_date: string; songIds: number[]; sheetStyle?: unknown }) => {
    const { canceled, filePath } = await dialog.showSaveDialog({
      defaultPath: `${safeFileName(p.name, 'servicio')} - letras.pdf`,
      filters: [{ name: 'PDF', extensions: ['pdf'] }]
    })
    if (canceled || !filePath) return null

    const byId = getDb().prepare('SELECT * FROM songs WHERE id = ?')
    const songs = p.songIds.map(id => byId.get(id)).filter(Boolean).map(deserializeSong)
    const html = buildLyricsSheetHtml({ name: p.name, service_date: p.service_date || '' }, songs, { general: generalSheetStyle(p.sheetStyle) })
    fs.writeFileSync(filePath, await renderSheetPdf(html))
    return { path: filePath }
  })

  ipcMain.handle('setlist:sheet-preview', (_e, p: { song: unknown; sheetStyle?: unknown }) =>
    renderSheetPreview(buildLyricsSheetHtml({ name: '', service_date: '' }, [previewSong(p?.song)],
      { general: generalSheetStyle(p?.sheetStyle), preview: true })))

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
    const local: LocalSong[] = (db.prepare('SELECT id, title, artist, song_key, sheet_style, sections, updated_at FROM songs').all() as any[])
      .map(r => ({ ...r, sections: JSON.parse(r.sections || '[]') }))
    const dir = videosDir()
    const names = videoNames(dir)
    const steps = planImport(file, local, dir, names)

    const summary: Omit<ImportSummary, 'setlistId' | 'missingAudio'> = { reused: 0, created: [], differing: [], missingVideo: [] }
    const insertSong = db.prepare(
      'INSERT INTO songs (title, artist, song_key, sheet_style, sections, video_path, text_style, folder_id) VALUES (?,?,?,?,?,?,?,NULL)')
    const fillSheetStyle = db.prepare('UPDATE songs SET sheet_style = ? WHERE id = ? AND sheet_style IS NULL')
    const fillKey = db.prepare('UPDATE songs SET song_key = ? WHERE id = ? AND song_key IS NULL')
    const insertItem = db.prepare(
      'INSERT INTO setlist_items (setlist_id, song_id, position, custom_video) VALUES (?,?,?,?)')

    const run = db.transaction((): { setlistId: number; songIds: number[] } => {
      const songIds = steps.map(step => {
        if (step.kind === 'existing') {
          summary.reused++
          if (step.differs) summary.differing.push(step.title)
          if (step.fillKey) fillKey.run(step.fillKey, step.songId)
          if (step.fillSheetStyle) fillSheetStyle.run(serializeSheetStyle(step.fillSheetStyle), step.songId)
          return step.songId
        }
        const { song } = step
        summary.created.push(song.title)
        if (!step.videoPath) summary.missingVideo.push(song.title)
        const r = insertSong.run(song.title, song.artist ?? null, song.song_key ?? null, serializeSheetStyle(song.sheet_style), JSON.stringify(song.sections),
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
