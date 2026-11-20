import path from 'path'
import { SONG_FIELDS, type FieldVersions, type PullResponse, type SetlistData, type SongField, type SongFields } from '../../shared/types'
import { inTransaction, type LocalDb } from './localDb'
import { fileName, readLocal, songRowToFields } from './localView'

export type SnapshotKind = 'song' | 'setlist' | 'folder'

const same = (a: unknown, b: unknown) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null)

export function readSnapshot<T>(db: LocalDb, kind: SnapshotKind, uid: string): { data: T; versions: FieldVersions; seq: number } | null {
  const r = db.prepare('SELECT data, versions, seq FROM sync_snapshot WHERE kind = ? AND uid = ?').get(kind, uid) as
    { data: string; versions: string; seq: number } | undefined
  return r ? { data: JSON.parse(r.data), versions: JSON.parse(r.versions), seq: r.seq } : null
}

/** Records `data` as the last state known to match the cloud. */
export function writeSnapshot(db: LocalDb, kind: SnapshotKind, uid: string, data: unknown, versions: FieldVersions, seq: number): void {
  db.prepare('INSERT OR REPLACE INTO sync_snapshot (kind, uid, data, versions, seq) VALUES (?, ?, ?, ?, ?)')
    .run(kind, uid, JSON.stringify(data), JSON.stringify(versions), seq)
}

export const dropSnapshot = (db: LocalDb, kind: SnapshotKind, uid: string) =>
  db.prepare('DELETE FROM sync_snapshot WHERE kind = ? AND uid = ?').run(kind, uid)

/** Song fields edited here since the last sync (vs. the snapshot; without one, whatever differs from `remote`). */
export function locallyEdited(local: SongFields, snapshot: SongFields | null, remote: SongFields): SongField[] {
  const base = snapshot ?? remote
  return SONG_FIELDS.filter(f => !same(local[f], base[f]))
}

const id = (db: LocalDb, table: 'songs' | 'folders' | 'setlists', uid: string | null): number | null => {
  if (!uid) return null
  const r = db.prepare(`SELECT id FROM ${table} WHERE uid = ?`).get(uid) as { id: number } | undefined
  return r?.id ?? null
}

/** A cloud video name as a local path: keep the current path if it is the same file name, else userData/videos/<name>. */
function videoPath(name: string | null, currentPath: string | null, videosDir: string): string | null {
  if (!name) return null
  if (currentPath && fileName(currentPath) === name) return currentPath
  return path.join(videosDir, name)
}

export interface ApplyResult {
  changedSongs: number
  changedSetlists: number
  /** Titles whose local, not-yet-uploaded edits were kept over the incoming version. */
  keptLocal: string[]
}

/**
 * Writes what the cloud sent into the local DB, in one transaction. Fields (or whole services)
 * edited locally since the last sync are kept, so the next push sends them; everything else
 * takes the cloud's value. Afterwards the snapshot holds the cloud's state.
 */
export function applyRemote(db: LocalDb, pulled: PullResponse, opts: { videosDir: string }): ApplyResult {
  const result: ApplyResult = { changedSongs: 0, changedSetlists: 0, keptLocal: [] }
  inTransaction(db, () => {
    const local = readLocal(db)

    for (const f of pulled.folders) {
      const folderId = id(db, 'folders', f.uid)
      if (f.deleted) {
        if (folderId) {
          db.prepare('UPDATE songs SET folder_id = NULL WHERE folder_id = ?').run(folderId)
          db.prepare('DELETE FROM folders WHERE id = ?').run(folderId)
        }
        dropSnapshot(db, 'folder', f.uid)
        continue
      }
      const snap = readSnapshot<string>(db, 'folder', f.uid)
      const localName = local.folders.get(f.uid)
      const editedHere = localName !== undefined && snap && localName !== snap.data
      if (folderId && !editedHere) db.prepare('UPDATE folders SET name = ? WHERE id = ?').run(f.name, folderId)
      else if (!folderId) db.prepare('INSERT INTO folders (name, uid) VALUES (?, ?)').run(f.name, f.uid)
      writeSnapshot(db, 'folder', f.uid, f.name, {}, f.seq)
    }

    for (const s of pulled.songs) {
      const row = db.prepare('SELECT id, video_path FROM songs WHERE uid = ?').get(s.uid) as { id: number; video_path: string | null } | undefined
      if (s.deleted) {
        if (row) {
          const used = db.prepare('SELECT 1 FROM setlist_items WHERE song_id = ? LIMIT 1').get(row.id)
          if (!used) db.prepare('DELETE FROM songs WHERE id = ?').run(row.id)
          // Still in a local service: kept, and without a snapshot it goes up again (restoring it).
        }
        dropSnapshot(db, 'song', s.uid)
        continue
      }
      const localFields = local.songs.get(s.uid)
      const snap = readSnapshot<SongFields>(db, 'song', s.uid)
      const edited = localFields ? locallyEdited(localFields, snap?.data ?? null, s.fields) : []
      const merged: SongFields = { ...s.fields }
      for (const f of edited) (merged as unknown as Record<string, unknown>)[f] = localFields![f]
      if (edited.length && localFields) result.keptLocal.push(merged.title)

      const values = [
        merged.title, merged.artist, JSON.stringify(merged.sections), merged.song_key,
        videoPath(merged.video_file, row?.video_path ?? null, opts.videosDir),
        JSON.stringify(merged.text_style ?? {}), merged.sheet_style ? JSON.stringify(merged.sheet_style) : null,
        id(db, 'folders', merged.folder_uid),
      ]
      if (row) {
        if (!localFields || !same(merged, localFields)) {
          db.prepare('UPDATE songs SET title = ?, artist = ?, sections = ?, song_key = ?, video_path = ?, text_style = ?, sheet_style = ?, folder_id = ? WHERE id = ?')
            .run(...values, row.id)
          result.changedSongs++
        }
      } else {
        db.prepare('INSERT INTO songs (title, artist, sections, song_key, video_path, text_style, sheet_style, folder_id, uid) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
          .run(...values, s.uid)
        result.changedSongs++
      }
      writeSnapshot(db, 'song', s.uid, s.fields, s.versions, s.seq)
    }

    for (const l of pulled.setlists) {
      const setlistId = id(db, 'setlists', l.uid)
      if (l.deleted) {
        if (setlistId) {
          db.prepare('DELETE FROM setlist_items WHERE setlist_id = ?').run(setlistId)
          db.prepare('DELETE FROM setlists WHERE id = ?').run(setlistId)
          result.changedSetlists++
        }
        dropSnapshot(db, 'setlist', l.uid)
        continue
      }
      const remoteData: SetlistData = { name: l.name, service_date: l.service_date, notes: l.notes, items: l.items }
      const localData = local.setlists.get(l.uid)
      const snap = readSnapshot<SetlistData>(db, 'setlist', l.uid)
      const editedHere = localData && !same(localData, snap ? snap.data : remoteData)
      if (editedHere) {
        result.keptLocal.push(localData!.name)
      } else if (!localData || !same(localData, remoteData)) {
        let sid = setlistId
        if (sid) {
          db.prepare('UPDATE setlists SET name = ?, service_date = ?, notes = ? WHERE id = ?').run(l.name, l.service_date, l.notes, sid)
          db.prepare('DELETE FROM setlist_items WHERE setlist_id = ?').run(sid)
        } else {
          sid = Number(db.prepare('INSERT INTO setlists (name, service_date, notes, uid) VALUES (?, ?, ?, ?)').run(l.name, l.service_date, l.notes, l.uid).lastInsertRowid)
        }
        const insert = db.prepare('INSERT INTO setlist_items (setlist_id, song_id, position, custom_video) VALUES (?, ?, ?, ?)')
        let position = 0
        for (const item of l.items) {
          const songId = id(db, 'songs', item.song_uid)
          if (songId) insert.run(sid, songId, position++, videoPath(item.custom_video_file, null, opts.videosDir))
        }
        result.changedSetlists++
      }
      writeSnapshot(db, 'setlist', l.uid, remoteData, {}, l.seq)
    }
  })
  return result
}

/** Local songs as the cloud would see them, by uid (re-exported for the engine). */
export { songRowToFields }
