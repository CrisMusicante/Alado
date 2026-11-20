import type { PullResponse } from '../../shared/types'
import type { LocalDb } from './localDb'
import { SyncEngine, type Api, type SyncStatus } from './engine'
import { adoptOnLink, type LinkSummary } from './link'

export const PUSH_EVERY_MS = 60_000
export const SYNC_EVERY_MS = 3 * 60_000

export interface SyncServiceDeps {
  db: LocalDb
  cloudUrl: string
  fetch: typeof fetch
  videosDir: string
  backupDir: string
  isLive: () => boolean
  /** Push to the renderer (sync:status, sync:applied). */
  send: (channel: string, payload: unknown) => void
  /** Encrypts the device token at rest (Electron safeStorage in the app). */
  secret: { encrypt: (s: string) => string; decrypt: (s: string) => string }
  deviceName: string
  now: () => Date
}

export type Ok<T> = ({ ok: true } & T) | { ok: false; error: string }

const ALREADY_LINKED = 'Esta compu ya está vinculada. Desvincúlala primero en Configuración.'
const OFFLINE = 'No se pudo conectar con ALADO en la nube. Revisa el internet e intenta de nuevo.'

/**
 * The desktop's connection to the cloud: holds the device token, owns the timers (full sync at
 * start and every 3 min, upload-only every 60 s), and links the computer (new church or code).
 */
export class SyncService {
  private engine: SyncEngine
  private timers: ReturnType<typeof setInterval>[] = []
  private running: Promise<SyncStatus> | null = null

  constructor(private deps: SyncServiceDeps) {
    this.engine = new SyncEngine({
      db: deps.db, api: this.api(() => this.token()), videosDir: deps.videosDir, backupDir: deps.backupDir,
      isLive: deps.isLive, now: deps.now,
    })
  }

  private get(key: string): string | null {
    const r = this.deps.db.prepare('SELECT value FROM app_settings WHERE key = ?').get(key) as { value: string } | undefined
    return r?.value ?? null
  }

  private set(key: string, value: string | null): void {
    if (value === null) this.deps.db.prepare('DELETE FROM app_settings WHERE key = ?').run(key)
    else this.deps.db.prepare('INSERT OR REPLACE INTO app_settings (key, value) VALUES (?, ?)').run(key, value)
  }

  private token(): string | null {
    const stored = this.get('sync_token')
    if (!stored) return null
    try { return this.deps.secret.decrypt(stored) } catch { return null }
  }

  private api(token: () => string | null): Api {
    return async (method, path, body) => {
      const t = token()
      const res = await this.deps.fetch(`${this.deps.cloudUrl}${path}`, {
        method,
        headers: { 'Content-Type': 'application/json', ...(t ? { Authorization: `Bearer ${t}` } : {}) },
        body: body === undefined ? undefined : JSON.stringify(body),
      })
      let parsed: unknown = null
      try { parsed = await res.json() } catch { /* empty or non-JSON */ }
      return { status: res.status, body: parsed }
    }
  }

  info(): { linked: boolean; churchName: string | null; lastOk: string | null } {
    return { linked: !!this.token(), churchName: this.get('sync_church'), lastOk: this.get('sync_last_ok') }
  }

  status(): SyncStatus {
    return this.info().linked ? this.engine.status : { ...this.engine.status, state: 'off' }
  }

  private emit(s: SyncStatus): void {
    this.deps.send('sync:status', s)
    if (s.applied) this.deps.send('sync:applied', null)
  }

  /** One full sync at a time; concurrent callers share it. */
  run(opts: { force?: boolean } = {}): Promise<SyncStatus> {
    if (!this.info().linked) {
      const off = this.status()
      this.emit(off)
      return Promise.resolve(off)
    }
    this.running ??= (async () => {
      this.deps.send('sync:status', { ...this.engine.status, state: 'syncing', notices: [], applied: false })
      const s = await this.engine.run(opts)
      this.emit(s)
      return s
    })().finally(() => { this.running = null })
    return this.running
  }

  private async pushOnly(): Promise<void> {
    if (!this.info().linked || this.running) return
    const before = this.engine.status
    const s = await this.engine.pushOnly()
    if (s !== before) this.emit(s)
  }

  start(): void {
    this.stop()
    void this.run()
    this.timers.push(setInterval(() => void this.pushOnly(), PUSH_EVERY_MS))
    this.timers.push(setInterval(() => void this.run(), SYNC_EVERY_MS))
  }

  stop(): void {
    this.timers.forEach(clearInterval)
    this.timers = []
  }

  private remember(token: string, churchName: string): void {
    this.set('sync_token', this.deps.secret.encrypt(token))
    this.set('sync_church', churchName)
  }

  /** Creates the church from this computer (the trusted one) and uploads its catalog. */
  async setup(p: { churchName: string; leaderName: string; pin: string; setupKey: string }):
    Promise<Ok<{ churchCode: string; recoveryCode: string; churchName: string; status: SyncStatus }>> {
    if (this.info().linked) return { ok: false, error: ALREADY_LINKED }
    let res: { status: number; body: any }
    try {
      res = await this.api(() => null)('POST', '/api/setup', { ...p, deviceName: this.deps.deviceName })
    } catch {
      return { ok: false, error: OFFLINE }
    }
    if (res.status !== 200) return { ok: false, error: res.body?.error ?? `Error ${res.status}` }
    // A new church: forget any earlier sync and give every row a fresh id (ids from another
    // church or from the installer seed would collide in the cloud).
    try {
      this.remember(res.body.deviceToken, res.body.churchName)
    } catch (e) {
      return { ok: false, error: (e as Error).message }
    }
    this.clearSyncState()
    this.remintUids()
    this.start()
    const status = await this.run()
    return { ok: true, churchCode: res.body.churchCode, recoveryCode: res.body.recoveryCode, churchName: res.body.churchName, status }
  }

  /** Links this computer with a code from the leader's phone, adopting matching songs. */
  async link(p: { code: string }): Promise<Ok<{ churchName: string; summary: LinkSummary; status: SyncStatus }>> {
    if (this.info().linked) return { ok: false, error: ALREADY_LINKED }
    let res: { status: number; body: any }
    try {
      res = await this.api(() => null)('POST', '/api/link', { code: p.code, deviceName: this.deps.deviceName })
    } catch {
      return { ok: false, error: OFFLINE }
    }
    if (res.status !== 200) return { ok: false, error: res.body?.error ?? `Error ${res.status}` }
    const token: string = res.body.deviceToken
    let pulled: PullResponse
    try {
      const r = await this.api(() => token)('POST', '/api/sync/pull', { since: 0 })
      if (r.status !== 200) return { ok: false, error: r.body?.error ?? `Error ${r.status}` }
      pulled = r.body
    } catch {
      return { ok: false, error: OFFLINE }
    }
    this.clearSyncState()
    this.remintUids()
    let summary: LinkSummary
    try {
      summary = adoptOnLink(this.deps.db, pulled, { backupDir: this.deps.backupDir, now: this.deps.now })
    } catch (e) {
      return { ok: false, error: `No se pudo empatar el catálogo: ${(e as Error).message}` }
    }
    try {
      this.remember(token, res.body.churchName)
    } catch (e) {
      return { ok: false, error: (e as Error).message }
    }
    this.start()
    const status = await this.run()
    return { ok: true, churchName: res.body.churchName, summary, status }
  }

  private remintUids(): void {
    for (const t of ['songs', 'setlists', 'folders']) this.deps.db.prepare(`UPDATE ${t} SET uid = lower(hex(randomblob(16)))`).run()
  }

  private clearSyncState(): void {
    this.deps.db.prepare('DELETE FROM sync_snapshot').run()
    for (const k of ['sync_seq', 'sync_last_ok']) this.set(k, null)
  }

  /** Forgets the link on this computer (the cloud keeps the catalog). */
  async unlink(): Promise<void> {
    const token = this.token()
    if (token) await this.api(() => token)('POST', '/api/logout').catch(() => {})
    this.stop()
    this.clearSyncState()
    this.set('sync_token', null)
    this.set('sync_church', null)
    this.emit(this.status())
  }
}
