import type { Song } from '../store/songs.store'

const FIELDS = ['title', 'artist', 'song_key', 'sheet_style', 'sections', 'video_path', 'text_style'] as const
const same = (a: unknown, b: unknown) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null)

/**
 * What to save from the song editor: the fields the operator changed since opening it, on top of
 * the latest copy (which the cloud may have updated meanwhile), so a phone edit isn't reverted.
 */
export function mergeEdits<T extends Partial<Song>>(opened: T, edited: T, latest: T | undefined): T {
  if (!latest) return edited
  const out = { ...latest }
  for (const f of FIELDS) {
    if (!same((edited as Record<string, unknown>)[f], (opened as Record<string, unknown>)[f])) {
      (out as Record<string, unknown>)[f] = (edited as Record<string, unknown>)[f]
    }
  }
  return out
}
