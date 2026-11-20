import type { Change, FieldVersions, Role, SongFields, SyncFolder, SyncSetlist, SyncSong } from '../../../shared/types'

export * from '../../../shared/types'

export interface Catalog {
  songs: Record<string, SyncSong>
  setlists: Record<string, SyncSetlist>
  folders: Record<string, SyncFolder>
}

export interface Session {
  token: string
  churchCode: string
}

export interface Me {
  role: Role
  name: string
  actor: string
  church: { name: string; code: string | null }
  pending: number
}

/** An editor's proposal written offline, sent on the next sync. */
export interface PendingProposal {
  id: string
  song_uid: string | null
  fields: Partial<SongFields>
  seen: FieldVersions
}

/** Everything the phone keeps (IndexedDB), so it works without signal. */
export interface LocalState {
  session: Session | null
  me: Me | null
  catalog: Catalog
  seq: number
  outbox: Change[]
  pendingProposals: PendingProposal[]
  lastSync: string | null
}

export const emptyState = (): LocalState => ({
  session: null, me: null, catalog: { songs: {}, setlists: {}, folders: {} }, seq: 0, outbox: [], pendingProposals: [], lastSync: null,
})
