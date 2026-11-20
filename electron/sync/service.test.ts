import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import os from 'os'
import { sqliteDb } from '../../cloud/test/sqliteDb'
import { route } from '../../cloud/src/router'
import type { Ctx } from '../../cloud/src/ctx'
import { desktopDb, addSong, one } from './testDb'
import { SyncService } from './service'
import type { LocalDb } from './localDb'

let cloud: Ctx
let calls: string[]
let db: LocalDb
let sent: [string, unknown][]

/** fetch() against the in-memory cloud. */
const fakeFetch = (async (input: string | URL | Request, init?: RequestInit) => {
  const req = new Request(input as string, init)
  calls.push(new URL(req.url).pathname)
  const headers = new Headers(req.headers)
  headers.set('CF-Connecting-IP', '1.1.1.1')
  return route(cloud, new Request(req, { headers }))
}) as typeof fetch

const plainSecret = { encrypt: (s: string) => `enc:${s}`, decrypt: (s: string) => s.replace(/^enc:/, '') }

function service(live = false) {
  return new SyncService({
    db, cloudUrl: 'https://alado.test', fetch: fakeFetch, videosDir: os.tmpdir(), backupDir: os.tmpdir(),
    isLive: () => live, send: (c, p) => sent.push([c, p]), secret: plainSecret, deviceName: 'Compu pastor', now: () => new Date(),
  })
}

beforeEach(() => {
  cloud = { db: sqliteDb(), now: () => Date.now(), setupKey: 'k' }
  calls = []
  sent = []
  db = desktopDb()
})
afterEach(() => vi.useRealTimers())

describe('SyncService', () => {
  it('setup creates the church, stores the token encrypted and uploads the catalog', async () => {
    addSong(db, 'Tu fidelidad')
    const s = service()
    const r = await s.setup({ churchName: 'Iglesia', leaderName: 'Cris', pin: '1234', setupKey: 'k' })
    if (!r.ok) throw new Error(r.error)
    expect(r.churchCode).toMatch(/^[A-Z2-9]{4}-[A-Z2-9]{4}$/)
    expect(r.recoveryCode).toHaveLength(16)
    expect(one<{ value: string }>(db, "SELECT value FROM app_settings WHERE key = 'sync_token'").value).toMatch(/^enc:/)
    expect(s.info()).toMatchObject({ linked: true, churchName: 'Iglesia' })
    expect(calls).toContain('/api/sync/push')
    expect(sent.some(([c, p]) => c === 'sync:status' && (p as { state: string }).state === 'ok')).toBe(true)
  })

  it('a wrong install key is reported and nothing is stored', async () => {
    const r = await service().setup({ churchName: 'I', leaderName: 'C', pin: '1234', setupKey: 'nope' })
    expect(r).toMatchObject({ ok: false, error: 'Clave de instalación incorrecta.' })
    expect(one(db, "SELECT COUNT(*) AS n FROM app_settings WHERE key = 'sync_token'")).toEqual({ n: 0 })
  })

  it('runs at start when linked and not when unlinked', async () => {
    const unlinked = service()
    unlinked.start()
    await vi.waitFor(() => expect(sent.length).toBeGreaterThan(0))
    expect(calls).toEqual([])
    expect(sent.at(-1)).toEqual(['sync:status', expect.objectContaining({ state: 'off' })])
    unlinked.stop()

    await service().setup({ churchName: 'I', leaderName: 'C', pin: '1234', setupKey: 'k' })
    calls = []
    const linked = service()
    linked.start()
    await vi.waitFor(() => expect(calls).toContain('/api/sync/pull'))
    linked.stop()
  })

  it('pushes every 60 s and does a full sync every 3 min', async () => {
    await service().setup({ churchName: 'I', leaderName: 'C', pin: '1234', setupKey: 'k' })
    vi.useFakeTimers()
    const s = service()
    s.start()
    await s.run() // the start-up sync (shared with the one start() began)
    calls = []
    addSong(db, 'Nueva')
    await vi.advanceTimersByTimeAsync(60_000)
    expect(calls).toEqual(['/api/sync/push'])
    calls = []
    await vi.advanceTimersByTimeAsync(120_000)
    expect(calls).toContain('/api/sync/pull')
    s.stop()
  })

  it('link with a code from the leader adopts the catalog', async () => {
    // church created by another computer, with one song
    const other = desktopDb()
    addSong(other, 'Tu fidelidad')
    const first = new SyncService({ db: other, cloudUrl: 'https://alado.test', fetch: fakeFetch, videosDir: os.tmpdir(), backupDir: os.tmpdir(),
      isLive: () => false, send: () => {}, secret: plainSecret, deviceName: 'PC1', now: () => new Date() })
    const setup = await first.setup({ churchName: 'I', leaderName: 'Cris', pin: '1234', setupKey: 'k' })
    if (!setup.ok) throw new Error(setup.error)
    const login = await (await fakeFetch('https://alado.test/api/login', { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ churchCode: setup.churchCode, name: 'Cris', pin: '1234' }) })).json() as { token: string }
    const code = await (await fakeFetch('https://alado.test/api/link-codes', { method: 'POST', headers: { Authorization: `Bearer ${login.token}` } })).json() as { code: string }

    addSong(db, 'Tu fidelidad') // same song here
    addSong(db, 'Solo aquí')
    const r = await service().link({ code: code.code })
    if (!r.ok) throw new Error(r.error)
    expect(r.summary).toMatchObject({ adopted: 1, uploaded: 1 })
    const pulled = await (await fakeFetch('https://alado.test/api/sync/pull', { method: 'POST', headers: { Authorization: `Bearer ${login.token}`, 'Content-Type': 'application/json' }, body: '{"since":0}' })).json() as { songs: unknown[] }
    expect(pulled.songs).toHaveLength(2)
  })

  it('unlink forgets the token and the sync state', async () => {
    const s = service()
    await s.setup({ churchName: 'I', leaderName: 'C', pin: '1234', setupKey: 'k' })
    await s.unlink()
    expect(s.info().linked).toBe(false)
    expect(one(db, "SELECT COUNT(*) AS n FROM sync_snapshot")).toEqual({ n: 0 })
  })

  it('timers start after setup and again after unlink + link', async () => {
    vi.useFakeTimers()
    const s = service()
    await s.setup({ churchName: 'I', leaderName: 'C', pin: '1234', setupKey: 'k' })
    calls = []
    addSong(db, 'Nueva')
    await vi.advanceTimersByTimeAsync(60_000)
    expect(calls).toContain('/api/sync/push')
    s.stop()
  })

  it('setup gives every row fresh ids, so another church or the installer seed never collide', async () => {
    const { uid } = addSong(db, 'Uno')
    db.prepare("INSERT INTO sync_snapshot (kind, uid, data) VALUES ('song', ?, '{}')").run(uid)
    db.prepare("INSERT INTO app_settings (key, value) VALUES ('sync_seq', '999')").run()
    const r = await service().setup({ churchName: 'I', leaderName: 'C', pin: '1234', setupKey: 'k' })
    if (!r.ok) throw new Error(r.error)
    expect(one<{ uid: string }>(db, 'SELECT uid FROM songs').uid).not.toBe(uid)
    expect(r.status.state).toBe('ok')
    const login = await (await fakeFetch('https://alado.test/api/login', { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ churchCode: r.churchCode, name: 'C', pin: '1234' }) })).json() as { token: string }
    const pulled = await (await fakeFetch('https://alado.test/api/sync/pull', { method: 'POST', headers: { Authorization: `Bearer ${login.token}`, 'Content-Type': 'application/json' }, body: '{"since":0}' })).json() as { songs: unknown[] }
    expect(pulled.songs).toHaveLength(1)
  })

  it('a syncing message never repeats old notices', async () => {
    const s = service()
    await s.setup({ churchName: 'I', leaderName: 'C', pin: '1234', setupKey: 'k' })
    ;(s as any).engine.status = { ...(s as any).engine.status, notices: ['viejo'] }
    sent = []
    await s.run()
    expect(sent.filter(([c, p]) => c === 'sync:status' && (p as { state: string; notices: string[] }).state === 'syncing'
      && (p as { notices: string[] }).notices.length)).toEqual([])
  })
})

