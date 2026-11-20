import { describe, it, expect } from 'vitest'
import { applyPull, applyLocalChange, searchSongs, videoNames, emptyCatalog } from './catalog'
import { enqueue, takeBatch, acknowledge, replay } from './outbox'
import { syncOnce, mergeSyncResult, saveSong, saveSetlistChange, validateSong, normalizeState, type Api } from './sync'
import { emptyState, type LocalState, type QueuedChange } from './types'
import { EMPTY_SONG, type Change, type PullResponse, type SyncSong } from '../../../shared/types'

const song = (uid: string, title: string, extra: Partial<SyncSong['fields']> = {}, seq = 1): SyncSong =>
  ({ uid, deleted: false, seq, fields: { ...EMPTY_SONG, title, ...extra }, versions: { title: seq } })
const pulled = (p: Partial<PullResponse>): PullResponse => ({ seq: 5, songs: [], setlists: [], folders: [], notices: [], ...p })
const songChange = (uid: string, fields: object, seen: object): Change => ({ kind: 'song', uid, fields, seen } as Change)
const setlistChange = (uid: string, name: string, seenSeq = 0, items: string[] = []): Change =>
  ({ kind: 'setlist', uid, seenSeq, data: { name, service_date: null, notes: null, items: items.map(song_uid => ({ song_uid, custom_video_file: null })) } })
let n = 0
const id = () => `q${++n}`
const q = (change: Change, rev = 0): QueuedChange => ({ id: id(), rev, change })
const changes = (o: QueuedChange[]) => o.map(x => x.change)

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
  it('enqueue merges two edits of one song keeping the oldest seen and bumping rev', () => {
    let o = enqueue([], songChange('a', { song_key: 'G' }, { song_key: 3 }), id)
    o = enqueue(o, songChange('a', { song_key: 'A', title: 'Nuevo' }, { song_key: 9, title: 9 }), id)
    expect(changes(o)).toEqual([songChange('a', { song_key: 'A', title: 'Nuevo' }, { song_key: 3, title: 9 })])
    expect(o[0].rev).toBe(1)
  })

  it('a later setlist edit moves after songs created meanwhile and keeps its seenSeq', () => {
    let o = enqueue([], setlistChange('x', 'Uno', 4), id)
    o = enqueue(o, songChange('s', { ...EMPTY_SONG, title: 'Nueva' }, {}), id)
    o = enqueue(o, setlistChange('x', 'Dos', 9, ['s']), id)
    expect(changes(o).map(c => c.kind)).toEqual(['song', 'setlist'])
    expect((o[1].change as Extract<Change, { kind: 'setlist' }>).seenSeq).toBe(4)
    o = enqueue(o, { kind: 'setlist-delete', uid: 'x' }, id)
    expect(changes(o).map(c => c.kind)).toEqual(['song', 'setlist-delete'])
  })

  it('takeBatch respects 30; acknowledge drops what was answered and reports refusals', () => {
    const o = Array.from({ length: 35 }, (_, i) => q(setlistChange(`s${i}`, `S${i}`)))
    const batch = takeBatch(o, 30)
    expect(batch).toHaveLength(30)
    const results = batch.map((_, i) => (i === 2 ? { ok: false as const, error: 'unknown-song' } : i === 3 ? { ok: false as const, error: 'busy' } : { ok: true as const }))
    const r = acknowledge(o, batch, results)
    expect(r.outbox).toHaveLength(6) // 5 not sent + 1 busy kept
    expect(r.failed).toEqual([{ change: batch[2].change, error: 'unknown-song' }])
  })

  it('an entry edited while its push was in flight stays queued', () => {
    const sent = [q(songChange('a', { song_key: 'G' }, {}))]
    const latest = [{ ...sent[0], rev: 1, change: songChange('a', { song_key: 'A' }, {}) }]
    expect(acknowledge(latest, sent, [{ ok: true }]).outbox).toEqual(latest)
  })

  it('a malformed push answer keeps the batch queued', () => {
    const o = [q(setlistChange('a', 'A')), q(setlistChange('b', 'B'))]
    expect(() => acknowledge(o, o, [{ ok: true }])).toThrow()
  })

  it('replay shows queued changes over the cloud copy; a dropped change disappears', () => {
    const base = applyPull(emptyCatalog(), pulled({ songs: [song('a', 'Uno', { song_key: 'E' })] }))
    const o = [q(songChange('a', { song_key: 'G' }, {}))]
    expect(replay(base, o).songs.a.fields.song_key).toBe('G')
    expect(replay(base, []).songs.a.fields.song_key).toBe('E')
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

const leaderMe = { role: 'leader' as const, name: 'Cris', actor: 'user:1', churchId: 'c1', church: { name: 'I', code: 'AAAA-BBBB' }, pending: 0 }
const leaderState = (): LocalState => ({ ...emptyState(), session: { token: 't', churchCode: 'AAAA-BBBB' }, me: leaderMe, owner: { churchId: 'c1', actor: 'user:1' } })
const meBody = (role = 'leader', pending = 0) => ({ status: 200, body: { ok: true, ...leaderMe, role, pending } })
const okPull = (p: Partial<PullResponse> = {}) => () => ({ status: 200, body: { ok: true, ...pulled(p) } })
const withBase = (s: LocalState, songs: SyncSong[]): LocalState => {
  const base = applyPull(s.base, pulled({ songs }))
  return { ...s, base, catalog: base }
}

describe('sync', () => {
  it('syncOnce pushes then pulls and returns notices', async () => {
    const log: string[] = []
    const state = saveSetlistChange(leaderState(), setlistChange('s', 'Domingo'))
    const r = await syncOnce(state, fakeApi({
      'POST /api/sync/push': () => ({ status: 200, body: { ok: true, seq: 6, results: [{ ok: true }] } }),
      'POST /api/sync/pull': okPull({ seq: 6, setlists: [{ uid: 's', deleted: false, seq: 6, name: 'Domingo', service_date: null, notes: null, items: [] }],
        notices: [{ id: 'n', message: 'Aviso', created_at: '' }] }),
      'GET /api/me': () => meBody('leader', 2),
    }, log))
    expect(log).toEqual(['POST /api/sync/push', 'POST /api/sync/pull', 'GET /api/me'])
    const next = mergeSyncResult(state, r)
    expect(next.outbox).toEqual([])
    expect(next.seq).toBe(6)
    expect(next.me?.pending).toBe(2)
    expect(next.catalog.setlists.s.name).toBe('Domingo')
    expect(r.notices).toEqual(['Aviso'])
  })

  it('edits made while a sync runs survive it (merged, replaced or deleted)', async () => {
    let state = withBase(leaderState(), [song('a', 'Uno', { song_key: 'E' })])
    state = saveSetlistChange(state, setlistChange('x', 'Domingo'))
    state = saveSong(state, 'a', { song_key: 'G' })
    let during: LocalState = state
    const r = await syncOnce(state, fakeApi({
      'POST /api/sync/push': () => {
        // meanwhile: re-edit the queued song and delete the queued service
        during = saveSong(during, 'a', { title: 'Uno bis' })
        during = saveSetlistChange(during, { kind: 'setlist-delete', uid: 'x' })
        return { status: 200, body: { ok: true, seq: 6, results: [{ ok: true }, { ok: true }] } }
      },
      'POST /api/sync/pull': okPull({ seq: 6, setlists: [{ uid: 'x', deleted: false, seq: 6, name: 'Domingo', service_date: null, notes: null, items: [] }] }),
      'GET /api/me': () => meBody(),
    }))
    const next = mergeSyncResult(during, r)
    expect(changes(next.outbox).map(c => c.kind)).toEqual(['song', 'setlist-delete'])
    expect(next.catalog.songs.a.fields.title).toBe('Uno bis')
    expect(next.catalog.setlists.x).toBeUndefined()
  })

  it('a refused change disappears from the screen (reverts to the cloud copy)', async () => {
    const state = saveSong(withBase(leaderState(), [song('a', 'Uno', { song_key: 'E' })]), 'a', { song_key: 'G' })
    expect(state.catalog.songs.a.fields.song_key).toBe('G')
    const r = await syncOnce(state, fakeApi({
      'POST /api/sync/push': () => ({ status: 200, body: { ok: true, seq: 1, results: [{ ok: false, error: 'invalid' }] } }),
      'POST /api/sync/pull': okPull(), 'GET /api/me': () => meBody(),
    }))
    const next = mergeSyncResult(state, r)
    expect(next.catalog.songs.a.fields.song_key).toBe('E')
    expect(r.failed.map(f => f.error)).toEqual(['invalid'])
  })

  it('offline keeps everything and says so', async () => {
    const state = saveSetlistChange(leaderState(), setlistChange('s', 'Domingo'))
    const r = await syncOnce(state, fakeApi({}))
    expect(r.offline).toBe(true)
    expect(mergeSyncResult(state, r).outbox).toHaveLength(1)
  })

  it('401 marks unauthorized and keeps the outbox', async () => {
    const state = saveSetlistChange(leaderState(), setlistChange('s', 'Domingo'))
    const r = await syncOnce(state, fakeApi({ 'POST /api/sync/push': () => ({ status: 401, body: { ok: false } }) }))
    expect(r.unauthorized).toBe(true)
    expect(mergeSyncResult(state, r).outbox).toHaveLength(1)
  })

  it('a 4xx answer to a push drops that batch with a notice and still pulls', async () => {
    const log: string[] = []
    const state = saveSetlistChange(leaderState(), setlistChange('s', 'Domingo'))
    const r = await syncOnce(state, fakeApi({
      'POST /api/sync/push': () => ({ status: 413, body: { ok: false, error: 'Solicitud demasiado grande.' } }),
      'POST /api/sync/pull': okPull(), 'GET /api/me': () => meBody(),
    }, log))
    expect(log).toContain('POST /api/sync/pull')
    expect(mergeSyncResult(state, r).outbox).toEqual([])
    expect(r.failed).toHaveLength(1)
  })

  it('editor song edit becomes a pending proposal and the catalog is untouched', () => {
    const s = withBase({ ...leaderState(), me: { ...leaderMe, role: 'editor' } }, [song('a', 'Uno', { song_key: 'E' })])
    const after = saveSong(s, 'a', { song_key: 'G' })
    expect(after.catalog.songs.a.fields.song_key).toBe('E')
    expect(after.outbox).toEqual([])
    expect(after.pendingProposals.map(p => [p.song_uid, p.fields])).toEqual([['a', { song_key: 'G' }]])
  })

  it('leader song edit goes to the outbox with the versions seen when the editor opened', () => {
    const s = withBase(leaderState(), [{ ...song('a', 'Uno', { song_key: 'E' }), versions: { song_key: 9 } }])
    const after = saveSong(s, 'a', { song_key: 'G' }, { song_key: 4 })
    expect(after.catalog.songs.a.fields.song_key).toBe('G')
    expect(changes(after.outbox)).toEqual([songChange('a', { song_key: 'G' }, { song_key: 4 })])
  })

  it('pending proposals are sent and cleared', async () => {
    const s = { ...leaderState(), me: { ...leaderMe, role: 'editor' as const },
      pendingProposals: [{ id: 'p1', song_uid: 'a', fields: { song_key: 'G' }, seen: {} }] }
    const sent: unknown[] = []
    const r = await syncOnce(s, fakeApi({
      'POST /api/proposals': b => { sent.push(b); return { status: 200, body: { ok: true, id: 'srv' } } },
      'POST /api/sync/pull': okPull(), 'GET /api/me': () => meBody('editor'),
    }))
    expect(sent).toEqual([{ song_uid: 'a', fields: { song_key: 'G' }, seen: {} }])
    expect(mergeSyncResult(s, r).pendingProposals).toEqual([])
  })
})

describe('validateSong (cloud limits)', () => {
  it('flags what the cloud would refuse', () => {
    expect(validateSong({ title: '' })).toMatch(/título/)
    expect(validateSong({ title: 'x'.repeat(201) })).toMatch(/título/)
    expect(validateSong({ title: 'Ok', sections: [{ type: 'verse', label: 'V', lines: ['y'.repeat(501)] }] })).toMatch(/renglón/)
    expect(validateSong({ title: 'Ok', sections: [{ type: 'verse', label: 'V', lines: Array(101).fill('a') }] })).toMatch(/renglones/)
    expect(validateSong({ title: 'Ok', sections: [] })).toBeNull()
  })
})

describe('normalizeState', () => {
  it('upgrades a state saved by the first version (plain outbox, no base)', () => {
    const old = { ...emptyState(), outbox: [setlistChange('s', 'D')], catalog: applyPull(emptyCatalog(), pulled({ songs: [song('a', 'A')] })) } as any
    delete old.base
    const s = normalizeState(old)
    expect(s.outbox[0].change.kind).toBe('setlist')
    expect(s.base.songs.a).toBeDefined()
    expect(s.catalog.setlists.s).toBeDefined()
  })
})
