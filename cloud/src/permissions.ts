import { DESKTOP_FIELDS, LYRIC_FIELDS, type Change, type Role, type SongField, type SongFields } from '../../shared/types'
import type { StoredSong } from './sync'

const same = (a: unknown, b: unknown) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null)

/** Song fields this change actually modifies (sending the current value is not a change). */
function changedFields(fields: Partial<SongFields>, existing: StoredSong | null): SongField[] {
  return (Object.keys(fields) as SongField[]).filter(f => !same(fields[f], existing?.fields[f] ?? null))
}

/**
 * Whether `role` may apply `change` directly; 'forbidden' otherwise.
 * - member: read only.
 * - editor: services only; song changes go through proposals.
 * - leader: services, lyric fields (title, artist, sections, key, video) and song deletes.
 * - desktop (the trusted computer): everything, including style, PDF sheet and folders.
 */
export function canApply(role: Role, change: Change, existing: StoredSong | null): true | 'forbidden' {
  if (role === 'desktop') return true
  if (role === 'member') return 'forbidden'

  switch (change.kind) {
    case 'setlist':
    case 'setlist-delete':
      return true
    case 'song':
      if (role !== 'leader') return 'forbidden'
      return changedFields(change.fields, existing).every(f => LYRIC_FIELDS.includes(f) && !DESKTOP_FIELDS.includes(f))
        ? true : 'forbidden'
    case 'song-delete':
      return role === 'leader' ? true : 'forbidden'
    default:
      return 'forbidden' // folders: computer only
  }
}
