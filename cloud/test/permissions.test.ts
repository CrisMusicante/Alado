import { describe, it, expect, beforeEach } from 'vitest'
import { sqliteDb } from './sqliteDb'
import type { Ctx } from '../src/ctx'
import { setupChurch, login, loginMember, authenticate, createUser, type Session } from '../src/auth'
import { push } from '../src/sync'
import { canApply } from '../src/permissions'
import { EMPTY_SONG, type Change } from '../../shared/types'

const newSong: Change = { kind: 'song', uid: 'a', fields: { ...EMPTY_SONG, title: 'Uno' }, seen: {} }
const setlist: Change = { kind: 'setlist', uid: 's', seenSeq: 0, data: { name: 'Domingo', service_date: null, notes: null, items: [{ song_uid: 'a', custom_video_file: null }] } }
const edit = (fields: object): Change => ({ kind: 'song', uid: 'a', fields, seen: {} })
const existing = { uid: 'a', fields: { ...EMPTY_SONG, title: 'Uno' }, versions: {}, authors: {}, deleted: false, seq: 1 }

describe('canApply', () => {
  it('member cannot push anything', () => {
    for (const c of [newSong, setlist, { kind: 'folder', uid: 'f', name: 'x' } as Change]) {
      expect(canApply('member', c, null)).toBe('forbidden')
    }
  })
  it('editor can push setlists', () => {
    expect(canApply('editor', setlist, null)).toBe(true)
    expect(canApply('editor', { kind: 'setlist-delete', uid: 's' }, null)).toBe(true)
  })
  it('editor cannot push song fields directly (must propose)', () => {
    expect(canApply('editor', edit({ song_key: 'G' }), existing)).toBe('forbidden')
    expect(canApply('editor', newSong, null)).toBe('forbidden')
  })
  it('leader can push title/artist/sections/song_key/video_file but not text_style', () => {
    expect(canApply('leader', edit({ title: 'Dos', artist: 'X', sections: [], song_key: 'G', video_file: 'a.mp4' }), existing)).toBe(true)
    expect(canApply('leader', edit({ text_style: { size: 'xl' } }), existing)).toBe('forbidden')
    expect(canApply('leader', edit({ folder_uid: 'f' }), existing)).toBe('forbidden')
    // creating a song sends the desktop fields with their empty values: that is not a change
    expect(canApply('leader', newSong, null)).toBe(true)
    expect(canApply('leader', { kind: 'folder', uid: 'f', name: 'x' }, null)).toBe('forbidden')
  })
  it('desktop can push every song field and folders', () => {
    expect(canApply('desktop', edit({ text_style: {}, sheet_style: {}, folder_uid: 'f', song_key: 'A' }), existing)).toBe(true)
    expect(canApply('desktop', { kind: 'folder', uid: 'f', name: 'x' }, null)).toBe(true)
    expect(canApply('desktop', { kind: 'folder-delete', uid: 'f' }, null)).toBe(true)
  })
  it('only leader and desktop delete songs', () => {
    const del: Change = { kind: 'song-delete', uid: 'a' }
    expect(canApply('leader', del, null)).toBe(true)
    expect(canApply('desktop', del, null)).toBe(true)
    expect(canApply('editor', del, null)).toBe('forbidden')
    expect(canApply('member', del, null)).toBe('forbidden')
  })
})

describe('push enforces roles end to end', () => {
  let ctx: Ctx
  let pc: Session, editor: Session, member: Session

  beforeEach(async () => {
    ctx = { db: sqliteDb(), now: () => Date.now(), setupKey: 'k' }
    const r = await setupChurch(ctx, { churchName: 'I', leaderName: 'Cris', pin: '1234', deviceName: 'PC', setupKey: 'k' })
    if (!r.ok) throw new Error(r.error)
    pc = (await authenticate(ctx, r.deviceToken))!
    const l = await login(ctx, 'ip', { churchCode: r.churchCode, name: 'Cris', pin: '1234' })
    if (!l.ok) throw new Error(l.error)
    await createUser(ctx, (await authenticate(ctx, l.token))!, { name: 'Ana', role: 'editor', pin: '4444' })
    const e = await login(ctx, 'ip', { churchCode: r.churchCode, name: 'Ana', pin: '4444' })
    const m = await loginMember(ctx, 'ip', { churchCode: r.churchCode })
    if (!e.ok || !m.ok) throw new Error('login')
    editor = (await authenticate(ctx, e.token))!
    member = (await authenticate(ctx, m.token))!
    await push(ctx, pc, [newSong])
  })

  it('rejects forbidden changes with forbidden and applies allowed ones', async () => {
    expect((await push(ctx, member, [setlist])).results).toEqual([{ ok: false, error: 'forbidden' }])
    expect((await push(ctx, editor, [edit({ song_key: 'G' }), setlist])).results)
      .toEqual([{ ok: false, error: 'forbidden' }, { ok: true }])
  })
})
