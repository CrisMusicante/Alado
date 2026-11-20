import { describe, it, expect, beforeEach } from 'vitest'
import os from 'os'
import path from 'path'
import { sqliteDb } from '../../cloud/test/sqliteDb'
import { route } from '../../cloud/src/router'
import type { Ctx } from '../../cloud/src/ctx'
import { desktopDb, one, many, addSong } from './testDb'
import { SyncEngine, type Api } from './engine'
import type { LocalDb } from './localDb'

let cloud: Ctx
let online = true

/** An Api that talks to the real cloud router in memory. */
function api(token: () => string | null): Api {
  return async (method, p, body) => {
    if (!online) throw new Error('fetch failed')
    const res = await route(cloud, new Request(`https://alado.test${p}`, {
      method,
      headers: { 'Content-Type': 'application/json', 'CF-Connecting-IP': '1.1.1.1', ...(token() ? { Authorization: `Bearer ${token()}` } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body),
    }))
    return { status: res.status, body: await res.json() }
  }
}

const tmp = os.tmpdir()
let pcDb: LocalDb, pc: SyncEngine, pcToken: string, live = false
let leaderToken: string, churchCode: string
const phone = api(() => leaderToken)

function engine(db: LocalDb, token: () => string) {
  return new SyncEngine({ db, api: api(token), videosDir: path.join(tmp, 'videos'), backupDir: tmp, isLive: () => live, now: () => new Date() })
}

beforeEach(async () => {
  cloud = { db: sqliteDb(), now: () => Date.now(), setupKey: 'k' }
  online = true
  live = false
  pcDb = desktopDb()
  const setup = await api(() => null)('POST', '/api/setup', { churchName: 'Iglesia', leaderName: 'Cris', pin: '1234', deviceName: 'Compu pastor', setupKey: 'k' })
  pcToken = setup.body.deviceToken
  churchCode = setup.body.churchCode
  leaderToken = (await api(() => null)('POST', '/api/login', { churchCode, name: 'Cris', pin: '1234' })).body.token
  pc = engine(pcDb, () => pcToken)
})

const phoneSongs = async () => (await phone('POST', '/api/sync/pull', { since: 0 })).body.songs as { uid: string; fields: Record<string, unknown>; versions: Record<string, number>; deleted: boolean }[]

describe('SyncEngine', () => {
  it('first sync uploads the whole catalog', async () => {
    for (let i = 0; i < 45; i++) addSong(pcDb, `Canción ${i}`, { song_key: 'E' }) // more than one push batch
    pcDb.prepare("INSERT INTO folders (name) VALUES ('Adoración')").run()
    pcDb.prepare("INSERT INTO setlists (name, service_date) VALUES ('Domingo', '2026-11-22')").run()
    pcDb.prepare('INSERT INTO setlist_items (setlist_id, song_id, position) VALUES (1, 1, 0)').run()
    const status = await pc.run()
    expect(status.state).toBe('ok')
    expect((await phoneSongs()).length).toBe(45)
    const pulled = (await phone('POST', '/api/sync/pull', { since: 0 })).body
    expect(pulled.folders.map((f: { name: string }) => f.name)).toEqual(['Adoración'])
    expect(pulled.setlists[0].items).toHaveLength(1)
    // nothing left to push
    expect(pc.pending()).toBe(0)
  })

  it('a change on the phone reaches the computer', async () => {
    const { uid } = addSong(pcDb, 'Tu fidelidad', { song_key: 'E' })
    await pc.run()
    const seen = (await phoneSongs())[0].versions
    await phone('POST', '/api/sync/push', { changes: [{ kind: 'song', uid, seen, fields: { song_key: 'G' } }] })
    await pc.run()
    expect(one(pcDb, 'SELECT song_key FROM songs WHERE uid = ?', uid)).toEqual({ song_key: 'G' })
  })

  it('a service armed on the phone appears on the computer', async () => {
    const { uid } = addSong(pcDb, 'Tu fidelidad')
    await pc.run()
    await phone('POST', '/api/sync/push', { changes: [{ kind: 'setlist', uid: 'sab', seenSeq: 0,
      data: { name: 'Domingo 22', service_date: '2026-11-22', notes: null, items: [{ song_uid: uid, custom_video_file: null }] } }] })
    const status = await pc.run()
    expect(status.applied).toBe(true)
    expect(many(pcDb, 'SELECT name FROM setlists')).toEqual([{ name: 'Domingo 22' }])
  })

  it('a change on the computer reaches the phone', async () => {
    const { uid } = addSong(pcDb, 'Tu fidelidad', { song_key: 'E' })
    await pc.run()
    pcDb.prepare('UPDATE songs SET song_key = ? WHERE uid = ?').run('A', uid)
    expect(pc.pending()).toBe(1)
    await pc.pushOnly()
    expect((await phoneSongs())[0].fields.song_key).toBe('A')
  })

  it('same field edited on both: last arrival wins and the computer gets the notice', async () => {
    const { uid } = addSong(pcDb, 'Tu fidelidad', { song_key: 'E' })
    await pc.run()
    pcDb.prepare('UPDATE songs SET song_key = ? WHERE uid = ?').run('A', uid) // offline edit on the computer
    online = false
    expect((await pc.run()).state).toBe('error')
    online = true
    const seen = (await phoneSongs())[0].versions
    // the phone pushes first… then the computer comes back
    await phone('POST', '/api/sync/push', { changes: [{ kind: 'song', uid, seen, fields: { song_key: 'G' } }] })
    await pc.run()
    // the computer's edit arrived last: it wins in the cloud, and the phone's author is told
    const after = (await phone('POST', '/api/sync/pull', { since: 0 })).body
    expect(after.songs[0].fields.song_key).toBe('A')
    const phoneNotices = after.notices
    expect(phoneNotices.map((n: { message: string }) => n.message)).toEqual([
      'Tu cambio de «tono» en «Tu fidelidad» fue reemplazado por uno más reciente de Compu pastor.',
    ])
  })

  it('the computer hears when its value was replaced', async () => {
    const { uid } = addSong(pcDb, 'Tu fidelidad', { song_key: 'E' })
    await pc.run()
    pcDb.prepare('UPDATE songs SET song_key = ? WHERE uid = ?').run('A', uid)
    await pc.run()
    await phone('POST', '/api/sync/push', { changes: [{ kind: 'song', uid, seen: {}, fields: { song_key: 'G' } }] })
    const status = await pc.run()
    expect(status.notices).toEqual(['Tu cambio de «tono» en «Tu fidelidad» fue reemplazado por uno más reciente de Cris.'])
    expect(one(pcDb, 'SELECT song_key FROM songs WHERE uid = ?', uid)).toEqual({ song_key: 'G' })
  })

  it('deleting locally a song used by a cloud setlist restores it with a notice', async () => {
    const { uid } = addSong(pcDb, 'Tu fidelidad')
    await pc.run()
    await phone('POST', '/api/sync/push', { changes: [{ kind: 'setlist', uid: 'sab', seenSeq: 0,
      data: { name: 'Sábado', service_date: null, notes: null, items: [{ song_uid: uid, custom_video_file: null }] } }] })
    // the computer deletes it before hearing about that service
    pcDb.prepare('DELETE FROM songs WHERE uid = ?').run(uid)
    await pc.pushOnly()
    const status = pc.status
    expect(status.notices).toContain('«Tu fidelidad» no se borró: está en un servicio de la nube.')
    expect(one(pcDb, 'SELECT title FROM songs WHERE uid = ?', uid)).toEqual({ title: 'Tu fidelidad' })
    expect((await phoneSongs())[0].deleted).toBe(false)
  })

  it('offline: state error, lastOk kept, local data intact', async () => {
    addSong(pcDb, 'Uno')
    const ok = await pc.run()
    online = false
    addSong(pcDb, 'Dos')
    const s = await pc.run()
    expect(s.state).toBe('error')
    expect(s.lastOk).toBe(ok.lastOk)
    expect(s.error).toMatch(/No se pudo conectar/)
    expect(many(pcDb, 'SELECT title FROM songs ORDER BY id')).toEqual([{ title: 'Uno' }, { title: 'Dos' }])
    expect(pc.pending()).toBe(1)
  })

  it('while live, incoming changes are held until run({ force }) or live ends', async () => {
    const { uid } = addSong(pcDb, 'Tu fidelidad', { song_key: 'E' })
    await pc.run()
    await phone('POST', '/api/sync/push', { changes: [{ kind: 'song', uid, seen: {}, fields: { song_key: 'G' } }] })
    live = true
    const held = await pc.run()
    expect(held.state).toBe('held')
    expect(one(pcDb, 'SELECT song_key FROM songs WHERE uid = ?', uid)).toEqual({ song_key: 'E' })
    const forced = await pc.run({ force: true })
    expect(forced.state).toBe('ok')
    expect(one(pcDb, 'SELECT song_key FROM songs WHERE uid = ?', uid)).toEqual({ song_key: 'G' })
  })

  it('a revoked computer reports it must be linked again', async () => {
    addSong(pcDb, 'Uno')
    pcToken = 'nope'
    const s = await pc.run()
    expect(s).toMatchObject({ state: 'error', unauthorized: true })
  })
})
