// Findings of the B1b final review: concurrency, D1 query budget, lockout races, proposals.
import { describe, it, expect, beforeEach } from 'vitest'
import { sqliteDb } from './sqliteDb'
import type { Ctx } from '../src/ctx'
import type { Db } from '../src/db'
import {
  setupChurch, login, authenticate, createUser, listDevices, revokeDevice, logout, type Session,
} from '../src/auth'
import { pull, push, MAX_CHANGES_PER_PUSH } from '../src/sync'
import { propose, decide, listProposals } from '../src/proposals'
import { EMPTY_SONG, type Change } from '../../shared/types'

const KEY = 'clave'
let ctx: Ctx
let pc: Session, leader: Session, ana: Session
let churchCode: string, leaderToken: string, deviceToken: string

/** Counts every query the logic sends, like D1's per-invocation limit (a batch counts once). */
function counting(db: Db) {
  let n = 0
  const wrapped: Db = {
    all: (...a) => { n++; return db.all(...a) },
    first: (...a) => { n++; return db.first(...a) },
    run: (...a) => { n++; return db.run(...a) },
    batch: (s) => { n++; return db.batch(s) },
  }
  return { db: wrapped, count: () => n, reset: () => { n = 0 } }
}

const newSong = (uid: string, title: string): Change => ({ kind: 'song', uid, seen: {}, fields: { ...EMPTY_SONG, title } })

beforeEach(async () => {
  ctx = { db: sqliteDb(), now: () => Date.now(), setupKey: KEY }
  const r = await setupChurch(ctx, { churchName: 'I', leaderName: 'Cris', pin: '1234', deviceName: 'PC', setupKey: KEY })
  if (!r.ok) throw new Error(r.error)
  churchCode = r.churchCode
  deviceToken = r.deviceToken
  pc = (await authenticate(ctx, r.deviceToken))!
  const l = await login(ctx, 'ip', { churchCode, name: 'Cris', pin: '1234' })
  if (!l.ok) throw new Error(l.error)
  leaderToken = l.token
  leader = (await authenticate(ctx, l.token))!
  await createUser(ctx, leader, { name: 'Ana', role: 'editor', pin: '4444' })
  const a = await login(ctx, 'ip', { churchCode, name: 'Ana', pin: '4444' })
  if (!a.ok) throw new Error(a.error)
  ana = (await authenticate(ctx, a.token))!
})

describe('setup', () => {
  it('refuses setup when the server has no install key configured', async () => {
    const bare: Ctx = { db: sqliteDb(), now: () => Date.now() }
    expect(await setupChurch(bare, { churchName: 'I', leaderName: 'X', pin: '1234', deviceName: 'PC', setupKey: 'anything' }))
      .toMatchObject({ ok: false, status: 403 })
  })
})

describe('change numbers', () => {
  it('a failed write does not advance the change number', async () => {
    await push(ctx, pc, [newSong('a', 'Uno')])
    const before = (await pull(ctx, leader, 0)).seq
    const real = ctx.db
    ctx = { ...ctx, db: { ...real, batch: async () => { throw new Error('boom') }, run: async (sql, ...p) => {
      if (/^\s*(UPDATE|INSERT)\s+(songs|setlists|folders)/i.test(sql)) throw new Error('boom')
      return real.run(sql, ...p)
    } } }
    await push(ctx, pc, [{ kind: 'song', uid: 'a', seen: {}, fields: { song_key: 'G' } }]).catch(() => {})
    ctx = { ...ctx, db: real }
    expect((await pull(ctx, leader, 0)).seq).toBe(before)
  })

  it('concurrent writes to different fields of one song are both kept', async () => {
    await push(ctx, pc, [newSong('a', 'Uno')])
    const seen = (await pull(ctx, leader, 0)).songs[0].versions
    await Promise.all([
      push(ctx, pc, [{ kind: 'song', uid: 'a', seen, fields: { song_key: 'G' } }]),
      push(ctx, leader, [{ kind: 'song', uid: 'a', seen, fields: { artist: 'Marcos' } }]),
    ])
    const s = (await pull(ctx, leader, 0)).songs[0].fields
    expect([s.song_key, s.artist]).toEqual(['G', 'Marcos'])
  })

  it('concurrent writes to the same field notify the overwritten author', async () => {
    await push(ctx, pc, [newSong('a', 'Uno')])
    const seen = (await pull(ctx, leader, 0)).songs[0].versions
    await Promise.all([
      push(ctx, pc, [{ kind: 'song', uid: 'a', seen, fields: { song_key: 'F' } }]),
      push(ctx, leader, [{ kind: 'song', uid: 'a', seen, fields: { song_key: 'G' } }]),
    ])
    const notices = [...(await pull(ctx, pc, 0)).notices, ...(await pull(ctx, leader, 0)).notices]
    expect(notices).toHaveLength(1)
  })
})

describe('D1 query budget (50 per request on the free plan)', () => {
  it(`a push of ${'MAX_CHANGES_PER_PUSH'} changes stays under 45 queries`, async () => {
    const c = counting(ctx.db)
    const changes = Array.from({ length: MAX_CHANGES_PER_PUSH }, (_, i) => newSong(`s${i}`, `Canción ${i}`))
    const r = await push({ ...ctx, db: c.db }, pc, changes)
    expect(r.results.every(x => x.ok)).toBe(true)
    expect(c.count()).toBeLessThanOrEqual(45)
  })

  it('a push over the cap is refused whole', async () => {
    const changes = Array.from({ length: MAX_CHANGES_PER_PUSH + 1 }, (_, i) => newSong(`s${i}`, `C${i}`))
    const r = await push(ctx, pc, changes)
    expect(r.results.every(x => !x.ok && x.error === 'too-many')).toBe(true)
    expect((await pull(ctx, leader, 0)).songs).toEqual([])
  })

  it('a setlist with many songs and many pending notices stays in budget', async () => {
    const songs = Array.from({ length: 25 }, (_, i) => newSong(`s${i}`, `C${i}`))
    await push(ctx, pc, songs)
    const seen = (await pull(ctx, leader, 0)).songs
    // 30 conflicts → 30 notices for the computer
    for (let round = 0; round < 2; round++) {
      await push(ctx, leader, seen.slice(0, 15).map(s => ({ kind: 'song', uid: s.uid, seen: {}, fields: { song_key: `${round}` } }) as Change))
      await push(ctx, pc, seen.slice(0, 15).map(s => ({ kind: 'song', uid: s.uid, seen: {}, fields: { song_key: `x${round}` } }) as Change))
    }
    const c = counting(ctx.db)
    const items = seen.map(s => ({ song_uid: s.uid, custom_video_file: null }))
    await push({ ...ctx, db: c.db }, pc, [{ kind: 'setlist', uid: 'big', seenSeq: 0, data: { name: 'D', service_date: null, notes: null, items } }])
    expect(c.count()).toBeLessThanOrEqual(45)
    c.reset()
    const p = await pull({ ...ctx, db: c.db }, pc, 0)
    expect(p.notices.length).toBeGreaterThan(10)
    expect(c.count()).toBeLessThanOrEqual(45)
  })

  it('listing many proposals stays in budget', async () => {
    await push(ctx, pc, [newSong('a', 'Uno')])
    for (let i = 0; i < 60; i++) await propose(ctx, ana, { song_uid: 'a', fields: { song_key: `${i % 9}` }, seen: {} })
    const c = counting(ctx.db)
    const l = await listProposals({ ...ctx, db: c.db }, leader, {})
    expect(l.ok && l.proposals.length).toBe(50)
    expect(c.count()).toBeLessThanOrEqual(45)
  })
})

describe('lockout races', () => {
  it('parallel wrong PINs cannot get past the per-IP limit', async () => {
    const results = await Promise.all(Array.from({ length: 30 }, () => login(ctx, '9.9.9.9', { churchCode, name: 'Cris', pin: '0000' })))
    expect(results.filter(r => !r.ok && r.status === 401).length).toBeLessThanOrEqual(5)
  })
})

describe('proposals', () => {
  it('stored seen comes from the server, so an editor cannot hide staleness', async () => {
    await push(ctx, pc, [newSong('a', 'Uno')])
    const p = await propose(ctx, ana, { song_uid: 'a', fields: { song_key: 'G' }, seen: { song_key: 1e15 } })
    if (!p.ok) throw new Error(p.error)
    const seen = (await pull(ctx, leader, 0)).songs[0].versions
    await push(ctx, pc, [{ kind: 'song', uid: 'a', seen, fields: { song_key: 'F' } }])
    const l = await listProposals(ctx, leader, { status: 'pending' })
    expect(l.ok && l.proposals[0].stale).toBe(true)
  })

  it('approving with an out-of-date view is refused (409)', async () => {
    await push(ctx, pc, [newSong('a', 'Uno')])
    const p = await propose(ctx, ana, { song_uid: 'a', fields: { song_key: 'G' }, seen: {} })
    if (!p.ok) throw new Error(p.error)
    const viewed = (await pull(ctx, leader, 0)).songs[0].versions
    await push(ctx, pc, [{ kind: 'song', uid: 'a', seen: viewed, fields: { song_key: 'F' } }])
    expect(await decide(ctx, leader, p.id, { action: 'approve', seen: viewed })).toMatchObject({ ok: false, status: 409 })
  })

  it('two approvals at once create one song', async () => {
    const p = await propose(ctx, ana, { song_uid: null, fields: { title: 'Nueva' }, seen: {} })
    if (!p.ok) throw new Error(p.error)
    const [a, b] = await Promise.all([decide(ctx, leader, p.id, { action: 'approve' }), decide(ctx, leader, p.id, { action: 'approve' })])
    expect([a.ok, b.ok].filter(Boolean)).toHaveLength(1)
    expect((await pull(ctx, leader, 0)).songs.filter(s => s.fields.title === 'Nueva')).toHaveLength(1)
  })
})

describe('devices and logout', () => {
  it('a leader can list and revoke a linked computer', async () => {
    const list = await listDevices(ctx, leader)
    if (!list.ok) throw new Error(list.error)
    expect(list.devices.map(d => d.name)).toEqual(['PC'])
    expect(await listDevices(ctx, ana)).toMatchObject({ ok: false, status: 403 })
    expect((await revokeDevice(ctx, leader, list.devices[0].id)).ok).toBe(true)
    expect(await authenticate(ctx, deviceToken)).toBeNull()
  })

  it('logout ends only that session', async () => {
    await logout(ctx, leaderToken)
    expect(await authenticate(ctx, leaderToken)).toBeNull()
    expect(await authenticate(ctx, deviceToken)).not.toBeNull()
  })
})

describe('setlist data shape', () => {
  it('items are normalized and undefined date/notes are accepted as null', async () => {
    await push(ctx, pc, [newSong('a', 'Uno')])
    const r = await push(ctx, leader, [{ kind: 'setlist', uid: 's', seenSeq: 0,
      data: { name: 'D', items: [{ song_uid: 'a', extra: 'x' }] } as never }])
    expect(r.results).toEqual([{ ok: true }])
    const s = (await pull(ctx, pc, 0)).setlists[0]
    expect(s).toMatchObject({ service_date: null, notes: null, items: [{ song_uid: 'a', custom_video_file: null }] })
    expect(Object.keys(s.items[0]).sort()).toEqual(['custom_video_file', 'song_uid'])
  })
})
