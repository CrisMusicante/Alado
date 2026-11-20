import { EMPTY_SONG, type SetlistData, type SongFields } from '../../shared/types'
import type { LocalDb } from './localDb'

export interface LocalView {
  songs: Map<string, SongFields>
  setlists: Map<string, SetlistData>
  folders: Map<string, string>
}

/** A video travels by file name only. */
export const fileName = (p: string | null | undefined): string | null => {
  const name = p ? p.split(/[\\/]/).pop()!.trim() : ''
  return name || null
}

const json = <T>(text: string | null | undefined, fallback: T): T => {
  if (!text) return fallback
  try { return JSON.parse(text) as T } catch { return fallback }
}

interface SongRow {
  uid: string; title: string; artist: string | null; sections: string; video_path: string | null
  text_style: string | null; sheet_style: string | null; song_key: string | null; folder_uid: string | null
}

export function songRowToFields(r: SongRow): SongFields {
  const style = json<Record<string, unknown> | null>(r.text_style, null)
  return {
    ...EMPTY_SONG,
    title: r.title,
    artist: r.artist?.trim() ? r.artist : null,
    sections: json(r.sections, []),
    song_key: r.song_key || null,
    video_file: fileName(r.video_path),
    text_style: style && Object.keys(style).length ? style : null,
    sheet_style: json(r.sheet_style, null),
    folder_uid: r.folder_uid ?? null,
  }
}

/** The local DB in the cloud's shape (uids instead of ids, file names instead of paths). */
export function readLocal(db: LocalDb): LocalView {
  const songs = new Map<string, SongFields>()
  for (const r of db.prepare(
    `SELECT s.uid, s.title, s.artist, s.sections, s.video_path, s.text_style, s.sheet_style, s.song_key, f.uid AS folder_uid
     FROM songs s LEFT JOIN folders f ON f.id = s.folder_id`).all() as SongRow[]) {
    songs.set(r.uid, songRowToFields(r))
  }

  const folders = new Map<string, string>()
  for (const r of db.prepare('SELECT uid, name FROM folders').all() as { uid: string; name: string }[]) folders.set(r.uid, r.name)

  const setlists = new Map<string, SetlistData>()
  const items = db.prepare(
    `SELECT si.setlist_id, s.uid AS song_uid, si.custom_video FROM setlist_items si JOIN songs s ON s.id = si.song_id
     ORDER BY si.setlist_id, si.position`).all() as { setlist_id: number; song_uid: string; custom_video: string | null }[]
  for (const r of db.prepare('SELECT id, uid, name, service_date, notes FROM setlists').all() as
    { id: number; uid: string; name: string; service_date: string | null; notes: string | null }[]) {
    setlists.set(r.uid, {
      name: r.name,
      service_date: r.service_date || null,
      notes: r.notes || null,
      items: items.filter(i => i.setlist_id === r.id).map(i => ({ song_uid: i.song_uid, custom_video_file: fileName(i.custom_video) })),
    })
  }
  return { songs, setlists, folders }
}
