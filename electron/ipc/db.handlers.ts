import { ipcMain } from 'electron'
import { getDb } from '../db/database'

export interface Section {
  type: 'verse' | 'chorus' | 'bridge' | 'outro' | 'intro' | 'custom'
  label: string
  lines: string[]
  repeat?: number
}

export interface TextStyle {
  font: 'sans' | 'rounded' | 'bold-condensed'
  size: 'sm' | 'md' | 'lg' | 'xl'
  color: string
  position: 'top' | 'center' | 'bottom'
  shadow: boolean
  stroke: boolean
}

export interface Song {
  id?: number
  title: string
  artist?: string
  sections: Section[]
  video_path?: string
  text_style: Partial<TextStyle>
  created_at?: string
  updated_at?: string
}

export interface Setlist {
  id?: number
  name: string
  service_date?: string
  notes?: string
  songs?: Array<{ song: Song; position: number; custom_video?: string }>
}

export function registerDbHandlers(): void {
  // ── Songs ──────────────────────────────────────────────────────────────────

  ipcMain.handle('db:get-songs', (_e, query?: string) => {
    const db = getDb()
    if (query) {
      return db.prepare(
        `SELECT * FROM songs WHERE title LIKE ? OR artist LIKE ? ORDER BY title COLLATE NOCASE`
      ).all(`%${query}%`, `%${query}%`)
        .map(deserializeSong)
    }
    return db.prepare('SELECT * FROM songs ORDER BY title COLLATE NOCASE').all().map(deserializeSong)
  })

  ipcMain.handle('db:save-song', (_e, song: Song) => {
    const db = getDb()
    const sections = JSON.stringify(song.sections)
    const textStyle = JSON.stringify(song.text_style)

    if (song.id) {
      db.prepare(
        `UPDATE songs SET title=?, artist=?, sections=?, video_path=?, text_style=? WHERE id=?`
      ).run(song.title, song.artist ?? null, sections, song.video_path ?? null, textStyle, song.id)
      return song.id
    } else {
      const result = db.prepare(
        `INSERT INTO songs (title, artist, sections, video_path, text_style) VALUES (?,?,?,?,?)`
      ).run(song.title, song.artist ?? null, sections, song.video_path ?? null, textStyle)
      return result.lastInsertRowid
    }
  })

  ipcMain.handle('db:delete-song', (_e, id: number) => {
    getDb().prepare('DELETE FROM songs WHERE id = ?').run(id)
  })

  // ── Setlists ───────────────────────────────────────────────────────────────

  ipcMain.handle('db:get-setlists', () => {
    const db = getDb()
    const setlists = db.prepare('SELECT * FROM setlists ORDER BY created_at DESC').all() as any[]
    return setlists.map(sl => ({
      ...sl,
      songs: db.prepare(
        `SELECT si.*, s.title, s.artist, s.sections, s.video_path, s.text_style
         FROM setlist_items si JOIN songs s ON s.id = si.song_id
         WHERE si.setlist_id = ? ORDER BY si.position`
      ).all(sl.id).map((row: any) => ({ ...row, ...deserializeSong(row) }))
    }))
  })

  ipcMain.handle('db:save-setlist', (_e, setlist: Setlist) => {
    const db = getDb()
    let setlistId = setlist.id

    if (setlistId) {
      db.prepare('UPDATE setlists SET name=?, service_date=?, notes=? WHERE id=?')
        .run(setlist.name, setlist.service_date ?? null, setlist.notes ?? null, setlistId)
    } else {
      const result = db.prepare(
        'INSERT INTO setlists (name, service_date, notes) VALUES (?,?,?)'
      ).run(setlist.name, setlist.service_date ?? null, setlist.notes ?? null)
      setlistId = result.lastInsertRowid as number
    }

    // Replace items
    db.prepare('DELETE FROM setlist_items WHERE setlist_id = ?').run(setlistId)
    const insertItem = db.prepare(
      'INSERT INTO setlist_items (setlist_id, song_id, position, custom_video) VALUES (?,?,?,?)'
    )
    setlist.songs?.forEach((item, i) => {
      insertItem.run(setlistId, item.song.id, i, item.custom_video ?? null)
    })

    return setlistId
  })

  ipcMain.handle('db:delete-setlist', (_e, id: number) => {
    getDb().prepare('DELETE FROM setlists WHERE id = ?').run(id)
  })
}

function deserializeSong(row: any): Song {
  return {
    ...row,
    sections: JSON.parse(row.sections || '[]'),
    text_style: JSON.parse(row.text_style || '{}')
  }
}
