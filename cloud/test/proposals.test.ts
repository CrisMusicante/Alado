import { describe, it, expect, beforeEach } from 'vitest'
import { sqliteDb } from './sqliteDb'
import type { Ctx } from '../src/ctx'
import { setupChurch, login, loginMember, authenticate, createUser, type Session } from '../src/auth'
import { pull, push } from '../src/sync'
import { propose, listProposals, decide, withdraw, pendingCount } from '../src/proposals'
import { EMPTY_SONG } from '../../shared/types'

let ctx: Ctx
let pc: Session, leader: Session, ana: Session, beto: Session, member: Session

beforeEach(async () => {
  ctx = { db: sqliteDb(), now: () => Date.now(), setupKey: 'k' }
  const r = await setupChurch(ctx, { churchName: 'I', leaderName: 'Cris', pin: '1234', deviceName: 'PC', setupKey: 'k' })
  if (!r.ok) throw new Error(r.error)
  const as = async (t: string) => (await authenticate(ctx, t))!
  pc = await as(r.deviceToken)
  const l = await login(ctx, 'ip', { churchCode: r.churchCode, name: 'Cris', pin: '1234' })
  if (!l.ok) throw new Error(l.error)
  leader = await as(l.token)
  await createUser(ctx, leader, { name: 'Ana', role: 'editor', pin: '4444' })
  await createUser(ctx, leader, { name: 'Beto', role: 'editor', pin: '5555' })
  const a = await login(ctx, 'ip', { churchCode: r.churchCode, name: 'Ana', pin: '4444' })
  const b = await login(ctx, 'ip', { churchCode: r.churchCode, name: 'Beto', pin: '5555' })
  const m = await loginMember(ctx, 'ip', { churchCode: r.churchCode })
  if (!a.ok || !b.ok || !m.ok) throw new Error('login')
  ana = await as(a.token); beto = await as(b.token); member = await as(m.token)
  await push(ctx, pc, [{ kind: 'song', uid: 'tf', seen: {}, fields: { ...EMPTY_SONG, title: 'Tu fidelidad', song_key: 'E', artist: 'X' } }])
})

const currentSong = async () => (await pull(ctx, pc, 0)).songs.find(s => s.uid === 'tf')!
const seenNow = async () => (await currentSong()).versions

describe('proposals', () => {
  it('editor proposal does not change the song', async () => {
    const p = await propose(ctx, ana, { song_uid: 'tf', fields: { song_key: 'G' }, seen: await seenNow() })
    expect(p.ok).toBe(true)
    expect((await currentSong()).fields.song_key).toBe('E')
    expect(await pendingCount(ctx, leader)).toBe(1)
  })

  it('approve applies only proposed fields and bumps seq', async () => {
    const before = await currentSong()
    const p = await propose(ctx, ana, { song_uid: 'tf', fields: { song_key: 'G' }, seen: before.versions })
    if (!p.ok) throw new Error(p.error)
    const d = await decide(ctx, leader, p.id, { action: 'approve' })
    expect(d.ok).toBe(true)
    const after = await currentSong()
    expect(after.fields).toMatchObject({ song_key: 'G', artist: 'X', title: 'Tu fidelidad' })
    expect(after.seq).toBeGreaterThan(before.seq)
    expect(await pendingCount(ctx, leader)).toBe(0)
    // nobody gets a "replaced" notice from an approval
    expect((await pull(ctx, pc, 0)).notices).toEqual([])
  })

  it('reject changes nothing and keeps the note', async () => {
    const p = await propose(ctx, ana, { song_uid: 'tf', fields: { song_key: 'G' }, seen: await seenNow() })
    if (!p.ok) throw new Error(p.error)
    await decide(ctx, leader, p.id, { action: 'reject', note: 'Mejor en E' })
    expect((await currentSong()).fields.song_key).toBe('E')
    const mine = await listProposals(ctx, ana, {})
    expect(mine.ok && mine.proposals.map(x => [x.status, x.note])).toEqual([['rejected', 'Mejor en E']])
  })

  it('stale is true when the song changed after the proposal', async () => {
    const seen = await seenNow()
    await propose(ctx, ana, { song_uid: 'tf', fields: { song_key: 'G' }, seen })
    await push(ctx, pc, [{ kind: 'song', uid: 'tf', fields: { song_key: 'F' }, seen }])
    const list = await listProposals(ctx, leader, { status: 'pending' })
    if (!list.ok) throw new Error(list.error)
    expect(list.proposals[0].stale).toBe(true)
    expect(list.proposals[0].current?.song_key).toBe('F')
  })

  it('new song proposal creates the song on approval', async () => {
    const p = await propose(ctx, ana, { song_uid: null, fields: { title: 'Nueva', sections: [], song_key: 'D' }, seen: {} })
    if (!p.ok) throw new Error(p.error)
    expect((await pull(ctx, pc, 0)).songs).toHaveLength(1)
    const d = await decide(ctx, leader, p.id, { action: 'approve' })
    if (!d.ok) throw new Error(d.error)
    const created = (await pull(ctx, pc, 0)).songs.find(s => s.fields.title === 'Nueva')
    expect(created?.uid).toBe(d.song_uid)
    expect(created?.fields.song_key).toBe('D')
  })

  it('a new song proposal needs a title and only lyric fields', async () => {
    expect(await propose(ctx, ana, { song_uid: null, fields: { song_key: 'D' }, seen: {} })).toMatchObject({ ok: false, status: 400 })
    expect(await propose(ctx, ana, { song_uid: 'tf', fields: { text_style: {} }, seen: {} })).toMatchObject({ ok: false, status: 400 })
    expect(await propose(ctx, ana, { song_uid: 'nope', fields: { song_key: 'G' }, seen: {} })).toMatchObject({ ok: false, status: 404 })
  })

  it('editor sees only own proposals; member cannot propose', async () => {
    await propose(ctx, ana, { song_uid: 'tf', fields: { song_key: 'G' }, seen: {} })
    await propose(ctx, beto, { song_uid: 'tf', fields: { song_key: 'A' }, seen: {} })
    const a = await listProposals(ctx, ana, {})
    const l = await listProposals(ctx, leader, { status: 'pending' })
    expect(a.ok && a.proposals.map(p => p.fields.song_key)).toEqual(['G'])
    expect(l.ok && l.proposals.map(p => p.fields.song_key).sort()).toEqual(['A', 'G'])
    expect(await propose(ctx, member, { song_uid: 'tf', fields: { song_key: 'G' }, seen: {} })).toMatchObject({ ok: false, status: 403 })
    expect(await decide(ctx, ana, 'x', { action: 'approve' })).toMatchObject({ ok: false, status: 403 })
  })

  it('withdraw by author only', async () => {
    const p = await propose(ctx, ana, { song_uid: 'tf', fields: { song_key: 'G' }, seen: {} })
    if (!p.ok) throw new Error(p.error)
    expect(await withdraw(ctx, beto, p.id)).toMatchObject({ ok: false, status: 403 })
    expect((await withdraw(ctx, ana, p.id)).ok).toBe(true)
    expect(await decide(ctx, leader, p.id, { action: 'approve' })).toMatchObject({ ok: false, status: 409 })
  })
})
