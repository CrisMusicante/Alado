import type { Change, ChangeResult, PullResponse, PushResponse, SongFields } from '../../shared/types'
import type { LocalDb } from './localDb'
import { readLocal } from './localView'
import { applyRemote, writeSnapshot } from './applyRemote'
import { localChanges, readSnapshots } from './diff'

/** One HTTP call to the cloud API. Throws on network failure. */
export type Api = (method: 'GET' | 'POST' | 'PATCH', path: string, body?: unknown) => Promise<{ status: number; body: any }>

export interface SyncStatus {
  state: 'off' | 'syncing' | 'ok' | 'error' | 'held'
  lastOk: string | null
  error: string | null
  /** The cloud rejected this computer's token: it must be linked again. */
  unauthorized: boolean
  /** Messages for the operator since the last run (conflict notices, refused deletions). */
  notices: string[]
  /** Something new was written locally in the last run (the UI reloads its lists). */
  applied: boolean
}

/** Must match MAX_CHANGES_PER_PUSH in cloud/src/sync.ts. */
const PUSH_CHUNK = 30

const OFFLINE = 'No se pudo conectar con ALADO en la nube.'

class ApiError extends Error {
  constructor(message: string, readonly status: number) { super(message) }
}

export interface EngineDeps {
  db: LocalDb
  api: Api
  videosDir: string
  backupDir: string
  /** True while the projection window is open: incoming changes wait. */
  isLive: () => boolean
  now: () => Date
}

function setting(db: LocalDb, key: string): string | null {
  const r = db.prepare('SELECT value FROM app_settings WHERE key = ?').get(key) as { value: string } | undefined
  return r?.value ?? null
}

function setSetting(db: LocalDb, key: string, value: string): void {
  db.prepare('INSERT OR REPLACE INTO app_settings (key, value) VALUES (?, ?)').run(key, value)
}

/**
 * Desktop ⇄ cloud sync. A run pulls what changed (applying it unless the projection is open),
 * pushes what differs from the snapshot in chunks, then pulls again to record the cloud's
 * versions. Never throws: failures end in an `error` status and local data is untouched.
 */
export class SyncEngine {
  status: SyncStatus

  constructor(private deps: EngineDeps) {
    this.status = {
      state: 'off', lastOk: setting(deps.db, 'sync_last_ok'), error: null, unauthorized: false, notices: [], applied: false,
    }
  }

  /** Local changes not yet in the cloud. */
  pending(): number {
    return localChanges(readLocal(this.deps.db), readSnapshots(this.deps.db)).length
  }

  private get since(): number {
    return Number(setting(this.deps.db, 'sync_seq') ?? 0) || 0
  }

  private async call(method: 'POST', path: string, body: unknown) {
    let res: { status: number; body: any }
    try {
      res = await this.deps.api(method, path, body)
    } catch {
      throw new ApiError(OFFLINE, 0)
    }
    if (res.status === 401) throw new ApiError('Esta compu ya no está vinculada a ALADO en la nube. Vuelve a vincularla.', 401)
    if (res.status >= 400) throw new ApiError(res.body?.error ?? `Error ${res.status} de la nube.`, res.status)
    return res.body
  }

  private async pullAndApply(notices: string[]): Promise<boolean> {
    const pulled = await this.call('POST', '/api/sync/pull', { since: this.since }) as PullResponse
    notices.push(...pulled.notices.map(n => n.message))
    const r = applyRemote(this.deps.db, pulled, { videosDir: this.deps.videosDir })
    setSetting(this.deps.db, 'sync_seq', String(pulled.seq))
    return r.changedSongs + r.changedSetlists > 0 || pulled.folders.length > 0
  }

  /** Uploads local changes; returns whether anything was sent. */
  private async push(notices: string[]): Promise<boolean> {
    const changes = localChanges(readLocal(this.deps.db), readSnapshots(this.deps.db))
    for (let i = 0; i < changes.length; i += PUSH_CHUNK) {
      const chunk = changes.slice(i, i + PUSH_CHUNK)
      const res = await this.call('POST', '/api/sync/push', { changes: chunk }) as PushResponse
      chunk.forEach((c, k) => this.afterPush(c, res.results[k], notices))
    }
    return changes.length > 0
  }

  /** Records an accepted change in the snapshot so it isn't sent again; handles refusals. */
  private afterPush(c: Change, r: ChangeResult | undefined, notices: string[]): void {
    const db = this.deps.db
    const snaps = readSnapshots(db)
    const local = readLocal(db)
    if (r?.ok) {
      if (c.kind === 'song') {
        const prev = snaps.songs.get(c.uid)
        writeSnapshot(db, 'song', c.uid, local.songs.get(c.uid) ?? { ...prev?.data, ...c.fields }, prev?.versions ?? {}, prev?.seq ?? 0)
      } else if (c.kind === 'setlist') {
        writeSnapshot(db, 'setlist', c.uid, c.data, {}, snaps.setlists.get(c.uid)?.seq ?? 0)
      } else if (c.kind === 'folder') {
        writeSnapshot(db, 'folder', c.uid, c.name, {}, 0)
      } else {
        const kind = c.kind === 'song-delete' ? 'song' : c.kind === 'setlist-delete' ? 'setlist' : 'folder'
        db.prepare('DELETE FROM sync_snapshot WHERE kind = ? AND uid = ?').run(kind, c.uid)
      }
      return
    }
    if (c.kind === 'song-delete' && r?.error === 'song-in-use') {
      // The cloud has it in a service this computer hadn't heard of yet: bring it back.
      const snap = snaps.songs.get(c.uid)
      if (snap) {
        db.prepare('DELETE FROM sync_snapshot WHERE kind = ? AND uid = ?').run('song', c.uid)
        applyRemote(db, { seq: 0, songs: [{ uid: c.uid, deleted: false, seq: snap.seq, fields: snap.data as SongFields, versions: snap.versions }],
          folders: [], setlists: [], notices: [] }, { videosDir: this.deps.videosDir })
        notices.push(`«${snap.data.title}» no se borró: está en un servicio de la nube.`)
      }
      return
    }
    const what = c.kind === 'song' ? `la canción «${local.songs.get(c.uid)?.title ?? ''}»`
      : c.kind === 'setlist' ? `el servicio «${c.data.name}»` : 'un cambio'
    notices.push(`No se pudo subir ${what} (${r?.error ?? 'sin respuesta'}).`)
  }

  async run(opts: { force?: boolean } = {}): Promise<SyncStatus> {
    const notices: string[] = []
    this.status = { ...this.status, state: 'syncing', notices: [], applied: false }
    try {
      let applied = false
      let held = false
      if (this.deps.isLive() && !opts.force) {
        // Only check whether something is waiting; don't touch what is being projected.
        const peek = await this.call('POST', '/api/sync/pull', { since: this.since }) as PullResponse
        held = peek.songs.length + peek.setlists.length + peek.folders.length > 0
        notices.push(...peek.notices.map(n => n.message))
      } else {
        applied = await this.pullAndApply(notices)
      }
      const pushed = await this.push(notices)
      if (pushed && !held) applied = (await this.pullAndApply(notices)) || applied
      const lastOk = this.deps.now().toISOString()
      setSetting(this.deps.db, 'sync_last_ok', lastOk)
      this.status = { state: held ? 'held' : 'ok', lastOk, error: null, unauthorized: false, notices, applied }
    } catch (e) {
      const err = e instanceof ApiError ? e : new ApiError(String((e as Error)?.message ?? e), 0)
      console.error('ALADO sync failed:', err.message)
      this.status = { ...this.status, state: 'error', error: err.message, unauthorized: err.status === 401, notices, applied: false }
    }
    return this.status
  }

  /** Uploads local changes only (frequent, cheap). Incoming changes wait for the next run(). */
  async pushOnly(): Promise<SyncStatus> {
    const notices: string[] = []
    try {
      if (!this.pending()) return this.status
      await this.push(notices)
      this.status = { ...this.status, notices, applied: notices.length > 0 }
    } catch (e) {
      const err = e instanceof ApiError ? e : new ApiError(String((e as Error)?.message ?? e), 0)
      this.status = { ...this.status, state: 'error', error: err.message, unauthorized: err.status === 401, notices }
    }
    return this.status
  }
}
