import type { VideoEntry } from '../store/songs.store'

const fold = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim()

/** Videos whose name contains the query, ignoring case, accents and surrounding spaces. */
export function filterVideos(list: VideoEntry[], query: string): VideoEntry[] {
  const q = fold(query)
  return q ? list.filter(v => fold(v.name).includes(q)) : list
}
