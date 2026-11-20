// Types shared by the cloud (Worker), the desktop app and the phone app (PWA).
// Pure TypeScript only: this folder is compiled into all three.

export type Role = 'leader' | 'editor' | 'member' | 'desktop'

export interface SyncSection {
  type: string
  label: string
  lines: string[]
  repeat?: number
}

export const SONG_FIELDS = [
  'title', 'artist', 'sections', 'song_key', 'video_file', 'text_style', 'sheet_style', 'folder_uid'
] as const
export type SongField = typeof SONG_FIELDS[number]

/** Fields an Editor may only change through a proposal, and a Leader directly. */
export const LYRIC_FIELDS: readonly SongField[] = ['title', 'artist', 'sections', 'song_key', 'video_file']
/** Fields only the trusted computer edits. */
export const DESKTOP_FIELDS: readonly SongField[] = ['text_style', 'sheet_style', 'folder_uid']

export interface SongFields {
  title: string
  artist: string | null
  sections: SyncSection[]
  song_key: string | null
  video_file: string | null
  text_style: Record<string, unknown> | null
  sheet_style: Record<string, unknown> | null
  folder_uid: string | null
}

export type FieldVersions = Partial<Record<SongField, number>>
/** Who wrote each field last: `user:<id>` or `device:<id>`, plus a display name. */
export type FieldAuthors = Partial<Record<SongField, { id: string; name: string }>>

export interface SyncSong {
  uid: string
  deleted: boolean
  seq: number
  fields: SongFields
  versions: FieldVersions
}

export interface SetlistItem {
  song_uid: string
  custom_video_file: string | null
}

export interface SetlistData {
  name: string
  service_date: string | null
  notes: string | null
  items: SetlistItem[]
}

export interface SyncSetlist extends SetlistData {
  uid: string
  deleted: boolean
  seq: number
}

export interface SyncFolder {
  uid: string
  deleted: boolean
  seq: number
  name: string
}

export interface Notice {
  id: string
  message: string
  created_at: string
}

export type Change =
  | { kind: 'song'; uid: string; fields: Partial<SongFields>; seen: FieldVersions }
  | { kind: 'song-delete'; uid: string }
  | { kind: 'setlist'; uid: string; data: SetlistData; seenSeq: number }
  | { kind: 'setlist-delete'; uid: string }
  | { kind: 'folder'; uid: string; name: string }
  | { kind: 'folder-delete'; uid: string }

export type ChangeResult = { ok: true } | { ok: false; error: string }

export interface PullResponse {
  seq: number
  songs: SyncSong[]
  folders: SyncFolder[]
  setlists: SyncSetlist[]
  notices: Notice[]
}

export interface PushResponse {
  seq: number
  results: ChangeResult[]
}

export type ProposalStatus = 'pending' | 'approved' | 'rejected' | 'withdrawn'

export interface Proposal {
  id: string
  song_uid: string | null
  author_id: string
  author_name: string
  seen: FieldVersions
  fields: Partial<SongFields>
  status: ProposalStatus
  note: string | null
  created_at: string
  decided_at: string | null
  decided_by: string | null
}

export interface ProposalView extends Proposal {
  /** Current song fields (null for a proposed new song). */
  current: SongFields | null
  /** Versions of `current`: send them back as `seen` when deciding, so a change made since is caught. */
  current_versions: FieldVersions | null
  /** True when a proposed field changed after the proposal was made. */
  stale: boolean
}

export const EMPTY_SONG: SongFields = {
  title: '', artist: null, sections: [], song_key: null, video_file: null,
  text_style: null, sheet_style: null, folder_uid: null
}
