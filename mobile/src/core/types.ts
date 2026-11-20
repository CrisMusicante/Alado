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
  churchId: string
  church: { name: string; code: string | null }
  pending: number
}

/** A change waiting to go up. `rev` grows when it is merged or replaced, so a sync only clears the version it sent. */
export interface QueuedChange {
  id: string
  rev: number
  change: Change
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
  /** Who this data belongs to; kept after a 401 so signing in as someone else starts clean. */
  owner: { churchId: string; actor: string } | null
  /** The cloud's copy, as last pulled. */
  base: Catalog
  /** What the screens show: `base` with the outbox applied on top (always derived, never edited). */
  catalog: Catalog
  seq: number
  outbox: QueuedChange[]
  pendingProposals: PendingProposal[]
  lastSync: string | null
}

const emptyCatalog = (): Catalog => ({ songs: {}, setlists: {}, folders: {} })

export const emptyState = (): LocalState => ({
  session: null, me: null, owner: null, base: emptyCatalog(), catalog: emptyCatalog(), seq: 0, outbox: [], pendingProposals: [], lastSync: null,
})
