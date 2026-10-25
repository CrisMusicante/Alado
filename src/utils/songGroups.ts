import type { Song, Folder } from '../store/songs.store'

/** 'all' = every folder; null = songs without a folder; number = that folder. */
export type FolderFilter = 'all' | number | null

export interface SongGroup {
  key: string
  name: string
  songs: Song[]
}

const fold = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

export function matchesQuery(song: Song, query: string): boolean {
  const q = fold(query.trim())
  return !q || fold(song.title).includes(q) || fold(song.artist ?? '').includes(q)
}

/** Library for the service page: songs grouped by folder (folder order kept, loose songs last). */
export function groupSongs(songs: Song[], folders: Folder[], filter: FolderFilter, query: string): SongGroup[] {
  const known = new Set(folders.map(f => f.id))
  const folderOf = (s: Song) => (s.folder_id != null && known.has(s.folder_id) ? s.folder_id : null)
  const visible = songs.filter(s => matchesQuery(s, query))

  const groups: SongGroup[] = [
    ...folders.map(f => ({ key: `folder-${f.id}`, name: f.name, id: f.id as number | null })),
    { key: 'loose', name: 'Sin carpeta', id: null },
  ]
    .filter(g => filter === 'all' || g.id === filter)
    .map(g => ({ key: g.key, name: g.name, songs: visible.filter(s => folderOf(s) === g.id) }))

  return groups.filter(g => g.songs.length > 0)
}
