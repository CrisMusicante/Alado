import { describe, it, expect } from 'vitest'
import { applyPull, applyLocalChange, searchSongs, videoNames, emptyCatalog } from './catalog'
import { enqueue, takeBatch, settle } from './outbox'
import { syncOnce, saveSong, type Api } from './sync'
import { emptyState, type LocalState } from './types'
import { EMPTY_SONG, type Change, type PullResponse, type SyncSong } from '../../../shared/types'

const song = (uid: string, title: string, extra: Partial<SyncSong['fields']> = {}, seq = 1): SyncSong =>
  ({ uid, deleted: false, seq, fields: { ...EMPTY_SONG, title, ...extra }, versions: { title: seq } })
const pulled = (p: Partial<PullResponse>): PullResponse => ({ seq: 5, songs: [], setlists: [], folders: [], notices: [], ...p })
const songChange = (uid: string, fields: object, seen: object): Change => ({ kind: 'song', uid, fields, seen } as Change)
const setlistChange = (uid: string, name: string, seenSeq = 0): Change =>
  ({ kind: 'setlist', uid, seenSeq, data: { name, service_date: null, notes: null, items: [] } })

describe('catalog', () => {
  it('applyPull merges by uid and drops deleted rows', () => {
    let c = applyPull(emptyCatalog(), pulled({ songs: [song('a', 'Uno'), song('b', 'Dos')] }))
    c = applyPull(c, pulled({ songs: [{ ...song('a', 'Uno'), deleted: true }, song('b', 'Dos editada', {}, 3)] }))
    expect(Object.keys(c.songs)).toEqual(['b'])
    expect(c.songs.b.fields.title).toBe('Dos editada')
  })

  it('local changes apply at once (optimistic)', () => {
    let c = applyPull(emptyCatalog(), pulled({ songs: [song('a', 'Uno', { song_key: 'E' })] }))
    c = applyLocalChange(c, songChange('a', { song_key: 'G' }, {}))
    c = applyLocalChange(c, setlistChange('s', 'Domingo'))
    expect(c.songs.a.fields.song_key).toBe('G')
    expect(c.setlists.s.name).toBe('Domingo')
    c = applyLocalChange(c, { kind: 'setlist-delete', uid: 's' })
    expect(c.setlists.s).toBeUndefined()
  })

  it('search ignores accents and case; video names are unique and sorted', () => {
    const c = applyPull(emptyCatalog(), pulled({ songs: [
      song('a', 'Canción del Espíritu', { video_file: 'b.mp4' }), song('b', 'Amor', { video_file: 'a.mp4' }), song('c', 'X', { video_file: 'a.mp4' }),
    ] }))
    expect(searchSongs(c, 'cancion espiritu').map(s => s.uid)).toEqual(['a'])
    expect(searchSongs(c, '').map(s => s.fields.title)).toEqual(['Amor', 'Canción del Espíritu', 'X'])
    expect(videoNames(c)).toEqual(['a.mp4', 'b.mp4'])
  })
})

describe('outbox', () => {
  it('enqueue merges two edits of one song keeping the oldest seen', () => {
    let o = enqueue([], songChange('a', { song_key: 'G' }, { song_key: 3 }))
    o = enqueue(o, songChange('a', { song_key: 'A', title: 'Nuevo' }, { song_key: 9, title: 9 }))
    expect(o).toEqual([songChange('a', { song_key: 'A', title: 'Nuevo' }, { song_key: 3, title: 9 })])
  })

  it('a later setlist edit replaces the queued one and keeps its seenSeq', () => {
    let o = enqueue([], setlistChange('s', 'Uno', 4))
    o = enqueue(o, setlistChange('s', 'Dos', 9))
    expect(o).toEqual([setlistChange('s', 'Dos', 4)])
    o = enqueue(o, { kind: 'setlist-delete', uid: 's' })
    expect(o).toEqual([{ kind: 'setlist-delete', uid: 's' }])
  })

  it('takeBatch respects 30 and settle drops accepted and reports rejected', () => {
    const o = Array.from({ length: 35 }, (_, i) => setlistChange(`s${i}`, `S${i}`))
    const batch = takeBatch(o, 30)
    expect(batch).toHaveLength(30)
    const results = batch.map((_, i) => (i === 2 ? { ok: false as const, error: 'unknown-song' } : { ok: true as const }))
    const r = settle(o, batch, results)
    expect(r.outbox).toHaveLength(5)
    expect(r.failed).toEqual([{ change: batch[2], error: 'unknown-song' }])
  })
})

function fakeApi(handlers: Record<string, (body: any) => { status: number; body: any }>, log: string[] = []): Api {
  return async (method, path, body) => {
    log.push(`${method} ${path}`)
    const h = handlers[`${method} ${path.split('?')[0]}`]
    if (!h) throw new Error('fetch failed')
    return h(body)
  }
}

const leaderState = (): LocalState => ({
  ...emptyState(), session: { token: 't', churchCode: 'AAAA-BBBB' },
  me: { role: 'leader', name: 'Cris', actor: 'user:1', church: { name: 'I', code: 'AAAA-BBBB' }, pending: 0 },
})
const meBody = (role = 'leader', pending = 0) =>
  ({ status: 200, body: { ok: true, role, name: 'Cris', actor: 'user:1', church: { name: 'I', code: 'X' }, pending } })

describe('sync', () => {
  it('syncOnce pushes then pulls and returns notices', async () => {
    const log: string[] = []
    const state = { ...leaderState(), outbox: [setlistChange('s', 'Domingo')] }
    const r = await syncOnce(state, fakeApi({
      'POST /api/sync/push': () => ({ status: 200, body: { ok: true, seq: 6, results: [{ ok: true }] } }),
      'POST /api/sync/pull': () => ({ status: 200, body: { ok: true, ...pulled({ seq: 6,
        setlists: [{ uid: 's', deleted: false, seq: 6, name: 'Domingo', service_date: null, notes: null, items: [] }],
        notices: [{ id: 'n', message: 'Aviso', created_at: '' }] }) } }),
      'GET /api/me': () => meBody('leader', 2),
    }, log))
    expect(log).toEqual(['POST /api/sync/push', 'POST /api/sync/pull', 'GET /api/me'])
    expect(r.state.outbox).toEqual([])
    expect(r.state.seq).toBe(6)
    expect(r.state.me?.pending).toBe(2)
    expect(r.notices).toEqual(['Aviso'])
  })

  it('offline keeps everything and says so', async () => {
    const state = { ...leaderState(), outbox: [setlistChange('s', 'Domingo')] }
    const r = await syncOnce(state, fakeApi({}))
    expect(r.offline).toBe(true)
    expect(r.state.outbox).toHaveLength(1)
  })

  it('401 marks unauthorized and keeps the outbox', async () => {
    const state = { ...leaderState(), outbox: [setlistChange('s', 'Domingo')] }
    const r = await syncOnce(state, fakeApi({ 'POST /api/sync/push': () => ({ status: 401, body: { ok: false } }) }))
    expect(r.unauthorized).toBe(true)
    expect(r.state.outbox).toHaveLength(1)
  })

  it('a rejected change leaves the outbox and is reported', async () => {
    const state = { ...leaderState(), outbox: [setlistChange('s', 'Domingo')] }
    const r = await syncOnce(state, fakeApi({
      'POST /api/sync/push': () => ({ status: 200, body: { ok: true, seq: 1, results: [{ ok: false, error: 'unknown-song' }] } }),
      'POST /api/sync/pull': () => ({ status: 200, body: { ok: true, ...pulled({}) } }),
      'GET /api/me': () => meBody(),
    }))
    expect(r.state.outbox).toEqual([])
    expect(r.failed.map(f => f.error)).toEqual(['unknown-song'])
  })

  it('editor song edit becomes a pending proposal and the catalog is untouched', () => {
    let s: LocalState = { ...leaderState(), me: { ...leaderState().me!, role: 'editor' } }
    s = { ...s, catalog: applyPull(s.catalog, pulled({ songs: [song('a', 'Uno', { song_key: 'E' })] })) }
    const after = saveSong(s, 'a', { song_key: 'G' })
    expect(after.catalog.songs.a.fields.song_key).toBe('E')
    expect(after.outbox).toEqual([])
    expect(after.pendingProposals.map(p => [p.song_uid, p.fields])).toEqual([['a', { song_key: 'G' }]])
  })

  it('leader song edit goes to the outbox with the versions it saw', () => {
    let s = leaderState()
    s = { ...s, catalog: applyPull(s.catalog, pulled({ songs: [{ ...song('a', 'Uno', { song_key: 'E' }), versions: { song_key: 4 } }] })) }
    const after = saveSong(s, 'a', { song_key: 'G' })
    expect(after.catalog.songs.a.fields.song_key).toBe('G')
    expect(after.outbox).toEqual([songChange('a', { song_key: 'G' }, { song_key: 4 })])
  })

  it('pending proposals are sent and cleared', async () => {
    const s = { ...leaderState(), me: { ...leaderState().me!, role: 'editor' as const },
      pendingProposals: [{ id: 'p1', song_uid: 'a', fields: { song_key: 'G' }, seen: {} }] }
    const sent: unknown[] = []
    const r = await syncOnce(s, fakeApi({
      'POST /api/proposals': b => { sent.push(b); return { status: 200, body: { ok: true, id: 'srv' } } },
      'POST /api/sync/pull': () => ({ status: 200, body: { ok: true, ...pulled({}) } }),
      'GET /api/me': () => meBody('editor'),
    }))
    expect(sent).toEqual([{ song_uid: 'a', fields: { song_key: 'G' }, seen: {} }])
    expect(r.state.pendingProposals).toEqual([])
  })
})
