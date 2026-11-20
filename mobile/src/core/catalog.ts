import { EMPTY_SONG, type Catalog, type Change, type PullResponse, type SyncSong } from './types'

export const emptyCatalog = (): Catalog => ({ songs: {}, setlists: {}, folders: {} })

function without<T>(rec: Record<string, T>, key: string): Record<string, T> {
  const { [key]: _, ...rest } = rec
  return rest
}

/** Merges a pull: rows replace by uid; deleted rows leave the catalog. */
export function applyPull(c: Catalog, p: PullResponse): Catalog {
  const out: Catalog = { songs: { ...c.songs }, setlists: { ...c.setlists }, folders: { ...c.folders } }
  for (const s of p.songs) { if (s.deleted) delete out.songs[s.uid]; else out.songs[s.uid] = s }
  for (const s of p.setlists) { if (s.deleted) delete out.setlists[s.uid]; else out.setlists[s.uid] = s }
  for (const f of p.folders) { if (f.deleted) delete out.folders[f.uid]; else out.folders[f.uid] = f }
  return out
}

/** Shows a change right away, before it reaches the cloud. Versions are untouched (the cloud sets them). */
export function applyLocalChange(c: Catalog, ch: Change): Catalog {
  switch (ch.kind) {
    case 'song': {
      const prev: SyncSong = c.songs[ch.uid] ?? { uid: ch.uid, deleted: false, seq: 0, fields: { ...EMPTY_SONG }, versions: {} }
      return { ...c, songs: { ...c.songs, [ch.uid]: { ...prev, fields: { ...prev.fields, ...ch.fields } } } }
    }
    case 'song-delete':
      return { ...c, songs: without(c.songs, ch.uid) }
    case 'setlist': {
      const prev = c.setlists[ch.uid]
      return { ...c, setlists: { ...c.setlists, [ch.uid]: { uid: ch.uid, deleted: false, seq: prev?.seq ?? 0, ...ch.data } } }
    }
    case 'setlist-delete':
      return { ...c, setlists: without(c.setlists, ch.uid) }
    default:
      return c
  }
}

const fold = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim()

/** Songs by title (and artist), ignoring accents and case; all of them sorted when the query is empty. */
export function searchSongs(c: Catalog, q: string): SyncSong[] {
  const words = fold(q).split(' ').filter(Boolean)
  return Object.values(c.songs)
    .filter(s => {
      const hay = fold(`${s.fields.title} ${s.fields.artist ?? ''}`)
      return words.every(w => hay.includes(w))
    })
    .sort((a, b) => a.fields.title.localeCompare(b.fields.title, 'es'))
}

/** Video file names already used in the catalog (videos live on the computer; the phone picks by name). */
export function videoNames(c: Catalog): string[] {
  return [...new Set(Object.values(c.songs).map(s => s.fields.video_file).filter((v): v is string => !!v))]
    .sort((a, b) => a.localeCompare(b, 'es'))
}
