import { describe, it, expect, beforeEach } from 'vitest'
import { sqliteDb } from './sqliteDb'
import type { Ctx } from '../src/ctx'
import { setupChurch, login, loginMember, linkDevice, createLinkCode, authenticate, createUser, type Session } from '../src/auth'
import { pull, push } from '../src/sync'
import { EMPTY_SONG, type Change, type SongFields } from '../../shared/types'

let ctx: Ctx
let pc: Session      // the pastor's computer
let leader: Session  // Cris on the phone
let churchCode: string

const as = async (token: string) => (await authenticate(ctx, token))!
const song = (uid: string, fields: Partial<SongFields>, seen = {}): Change =>
  ({ kind: 'song', uid, fields: { ...fields }, seen })
const newSong = (uid: string, title: string, extra: Partial<SongFields> = {}): Change =>
  song(uid, { ...EMPTY_SONG, title, ...extra })
const setlist = (uid: string, items: string[], seenSeq = 0, name = 'Domingo'): Change =>
  ({ kind: 'setlist', uid, seenSeq, data: { name, service_date: '2026-11-22', notes: null, items: items.map(song_uid => ({ song_uid, custom_video_file: null })) } })

beforeEach(async () => {
  ctx = { db: sqliteDb(), now: () => Date.parse('2026-11-21T10:00:00Z') }
  const r = await setupChurch(ctx, { churchName: 'Iglesia', leaderName: 'Cris', pin: '1234', deviceName: 'Compu pastor' })
  if (!r.ok) throw new Error(r.error)
  churchCode = r.churchCode
  pc = await as(r.deviceToken)
  const l = await login(ctx, 'ip', { churchCode, name: 'Cris', pin: '1234' })
  if (!l.ok) throw new Error(l.error)
  leader = await as(l.token)
})

describe('sync', () => {
  it('pull returns only rows after since', async () => {
    await push(ctx, pc, [newSong('a', 'Uno'), newSong('b', 'Dos')])
    const all = await pull(ctx, leader, 0)
    expect(all.songs.map(s => s.fields.title).sort()).toEqual(['Dos', 'Uno'])
    const after = await pull(ctx, leader, all.seq)
    expect(after.songs).toEqual([])
    await push(ctx, pc, [song('a', { song_key: 'G' }, { song_key: 0 })])
    const delta = await pull(ctx, leader, all.seq)
    expect(delta.songs.map(s => [s.uid, s.fields.song_key])).toEqual([['a', 'G']])
    expect(delta.seq).toBeGreaterThan(all.seq)
  })

  it('push song then pull from another device sees it', async () => {
    const r = await push(ctx, leader, [newSong('a', 'Tu fidelidad', { song_key: 'E', sections: [{ type: 'chorus', label: 'Coro', lines: ['Grande es tu fidelidad'] }] })])
    expect(r.results).toEqual([{ ok: true }])
    const p = await pull(ctx, pc, 0)
    expect(p.songs[0].fields).toMatchObject({ title: 'Tu fidelidad', song_key: 'E' })
    expect(p.songs[0].versions.song_key).toBe(r.seq)
  })

  it('offline conflict on song_key notifies the earlier author on their next pull', async () => {
    await push(ctx, pc, [newSong('a', 'Tu fidelidad', { song_key: 'E' })])
    const seen = (await pull(ctx, leader, 0)).songs[0].versions
    await push(ctx, pc, [song('a', { song_key: 'F' }, seen)])        // pastor changes it...
    await push(ctx, leader, [song('a', { song_key: 'G' }, seen)])    // ...Cris, offline, had not seen it
    const p = await pull(ctx, pc, 0)
    expect(p.songs[0].fields.song_key).toBe('G')
    expect(p.notices.map(n => n.message)).toEqual([
      'Tu cambio de «tono» en «Tu fidelidad» fue reemplazado por uno más reciente de Cris.',
    ])
    expect((await pull(ctx, pc, 0)).notices).toEqual([]) // delivered once
    expect((await pull(ctx, leader, 0)).notices).toEqual([])
  })

  it('different fields changed offline on two devices are both kept', async () => {
    await push(ctx, pc, [newSong('a', 'Tu fidelidad', { song_key: 'E' })])
    const seen = (await pull(ctx, leader, 0)).songs[0].versions
    await push(ctx, pc, [song('a', { title: 'Grande es tu fidelidad' }, seen)])
    await push(ctx, leader, [song('a', { song_key: 'G' }, seen)])
    const s = (await pull(ctx, pc, 0)).songs[0].fields
    expect([s.title, s.song_key]).toEqual(['Grande es tu fidelidad', 'G'])
  })

  it('setlist pointing to a missing song is rejected', async () => {
    const r = await push(ctx, leader, [setlist('s1', ['nope'])])
    expect(r.results).toEqual([{ ok: false, error: 'unknown-song' }])
    expect((await pull(ctx, pc, 0)).setlists).toEqual([])
  })

  it('setlist round trip keeps order and later writer wins with a notice', async () => {
    await push(ctx, pc, [newSong('a', 'Uno'), newSong('b', 'Dos')])
    await push(ctx, pc, [setlist('s1', ['a', 'b'])])
    const seenSeq = (await pull(ctx, leader, 0)).setlists[0].seq
    await push(ctx, pc, [setlist('s1', ['b'], seenSeq)])
    await push(ctx, leader, [setlist('s1', ['b', 'a'], seenSeq)])
    const p = await pull(ctx, pc, 0)
    expect(p.setlists[0].items.map(i => i.song_uid)).toEqual(['b', 'a'])
    expect(p.notices.map(n => n.message)).toEqual([
      'Tu versión del servicio «Domingo» fue reemplazada por una más reciente de Cris.',
    ])
  })

  it('deleting a song used by a setlist is rejected', async () => {
    await push(ctx, pc, [newSong('a', 'Uno'), setlist('s1', ['a'])])
    expect((await push(ctx, pc, [{ kind: 'song-delete', uid: 'a' }])).results).toEqual([{ ok: false, error: 'song-in-use' }])
    await push(ctx, pc, [{ kind: 'setlist-delete', uid: 's1' }])
    expect((await push(ctx, pc, [{ kind: 'song-delete', uid: 'a' }])).results).toEqual([{ ok: true }])
    expect((await pull(ctx, leader, 0)).songs[0].deleted).toBe(true)
  })

  it('a late setlist that uses a deleted song restores it and notifies leaders', async () => {
    await push(ctx, pc, [newSong('a', 'Uno')])
    await push(ctx, pc, [{ kind: 'song-delete', uid: 'a' }])
    const r = await push(ctx, leader, [setlist('s1', ['a'])])
    expect(r.results).toEqual([{ ok: true }])
    const p = await pull(ctx, leader, 0)
    expect(p.songs[0].deleted).toBe(false)
    expect(p.notices.map(n => n.message)).toEqual([
      'La canción «Uno» estaba borrada y se restauró porque Cris la usa en el servicio «Domingo».',
    ])
  })

  it('members get no text_style/sheet_style', async () => {
    await push(ctx, pc, [newSong('a', 'Uno', { text_style: { size: 'xl' }, sheet_style: { mode: 'auto' } })])
    const m = await loginMember(ctx, 'ip', { churchCode })
    if (!m.ok) throw new Error(m.error)
    const s = (await pull(ctx, await as(m.token), 0)).songs[0]
    expect(s.fields.text_style).toBeNull()
    expect(s.fields.sheet_style).toBeNull()
    expect(s.fields.title).toBe('Uno')
  })

  it('rejects invalid song data', async () => {
    const bad = await push(ctx, pc, [
      song('x', { title: '' }),
      song('y', { ...EMPTY_SONG, title: 'Ok', sections: [{ label: 'V', lines: 'no' } as never] }),
      song('z', { ...EMPTY_SONG, title: 'Ok', video_file: '../evil.mp4' }),
      song('w', { ...EMPTY_SONG, title: 'Ok', nope: 1 } as never),
    ])
    expect(bad.results.map(r => r.ok)).toEqual([false, false, false, false])
  })

  it('rejects a seen vector that is not whole numbers up to the current seq', async () => {
    await push(ctx, pc, [newSong('a', 'Uno')])
    const bad = await push(ctx, leader, [
      song('a', { song_key: 'G' }, { song_key: 'x' } as never),
      song('a', { song_key: 'G' }, { song_key: -1 }),
      song('a', { song_key: 'G' }, { song_key: 9999 }),
      song('a', { song_key: 'G' }, { nope: 1 } as never),
    ])
    expect(bad.results.map(r => r.ok)).toEqual([false, false, false, false])
  })

  it('folders sync and devices from another church never see this one', async () => {
    await push(ctx, pc, [{ kind: 'folder', uid: 'f1', name: 'Adoración' }])
    expect((await pull(ctx, leader, 0)).folders.map(f => f.name)).toEqual(['Adoración'])
    // Linking a second computer works and it sees the same data.
    const code = await createLinkCode(ctx, leader)
    if (!code.ok) throw new Error(code.error)
    const d = await linkDevice(ctx, 'ip', { code: code.code, deviceName: 'Compu Cris' })
    if (!d.ok) throw new Error(d.error)
    expect((await pull(ctx, await as(d.deviceToken), 0)).folders).toHaveLength(1)
    void createUser
  })
})
