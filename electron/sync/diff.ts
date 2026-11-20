import { SONG_FIELDS, type Change, type FieldVersions, type SetlistData, type SongFields } from '../../shared/types'
import type { LocalDb } from './localDb'
import type { LocalView } from './localView'

const same = (a: unknown, b: unknown) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null)

export interface Snapshots {
  songs: Map<string, { data: SongFields; versions: FieldVersions; seq: number }>
  setlists: Map<string, { data: SetlistData; seq: number }>
  folders: Map<string, { data: string; seq: number }>
}

export function readSnapshots(db: LocalDb): Snapshots {
  const out: Snapshots = { songs: new Map(), setlists: new Map(), folders: new Map() }
  for (const r of db.prepare('SELECT kind, uid, data, versions, seq FROM sync_snapshot').all() as
    { kind: string; uid: string; data: string; versions: string; seq: number }[]) {
    const data = JSON.parse(r.data)
    if (r.kind === 'song') out.songs.set(r.uid, { data, versions: JSON.parse(r.versions), seq: r.seq })
    else if (r.kind === 'setlist') out.setlists.set(r.uid, { data, seq: r.seq })
    else if (r.kind === 'folder') out.folders.set(r.uid, { data, seq: r.seq })
  }
  return out
}

/**
 * What this computer has to upload: everything that differs from the last state known to match
 * the cloud. Order matters for the cloud's checks: folders, then songs, then services (which
 * reference songs), then deletions of services before the songs they held.
 */
export function localChanges(local: LocalView, snap: Snapshots): Change[] {
  const folders: Change[] = []
  const songs: Change[] = []
  const setlists: Change[] = []
  const setlistDeletes: Change[] = []
  const songDeletes: Change[] = []
  const folderDeletes: Change[] = []

  for (const [uid, name] of local.folders) {
    const s = snap.folders.get(uid)
    if (!s || s.data !== name) folders.push({ kind: 'folder', uid, name })
  }
  for (const uid of snap.folders.keys()) if (!local.folders.has(uid)) folderDeletes.push({ kind: 'folder-delete', uid })

  for (const [uid, fields] of local.songs) {
    const s = snap.songs.get(uid)
    if (!s) {
      songs.push({ kind: 'song', uid, fields, seen: {} })
      continue
    }
    const changed = SONG_FIELDS.filter(f => !same(fields[f], s.data[f]))
    if (!changed.length) continue
    const partial: Partial<SongFields> = {}
    const seen: FieldVersions = {}
    for (const f of changed) {
      (partial as Record<string, unknown>)[f] = fields[f]
      seen[f] = s.versions[f] ?? 0
    }
    songs.push({ kind: 'song', uid, fields: partial, seen })
  }
  for (const uid of snap.songs.keys()) if (!local.songs.has(uid)) songDeletes.push({ kind: 'song-delete', uid })

  for (const [uid, data] of local.setlists) {
    const s = snap.setlists.get(uid)
    if (!s || !same(s.data, data)) setlists.push({ kind: 'setlist', uid, data, seenSeq: s?.seq ?? 0 })
  }
  for (const uid of snap.setlists.keys()) if (!local.setlists.has(uid)) setlistDeletes.push({ kind: 'setlist-delete', uid })

  return [...folders, ...songs, ...setlists, ...setlistDeletes, ...songDeletes, ...folderDeletes]
}
