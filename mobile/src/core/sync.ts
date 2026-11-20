import type { Change, LocalState, Me, PullResponse, PushResponse, SongFields, FieldVersions } from './types'
import { applyLocalChange, applyPull } from './catalog'
import { enqueue, settle, takeBatch } from './outbox'

/** One call to the cloud. Throws when there is no connection. */
export type Api = (method: 'GET' | 'POST' | 'PATCH', path: string, body?: unknown) => Promise<{ status: number; body: any }>

export interface SyncResult {
  state: LocalState
  notices: string[]
  failed: { change: Change; error: string }[]
  /** The session is no longer valid (logged out elsewhere, code rotated): go back to login. */
  unauthorized: boolean
  offline: boolean
}

class Unauthorized extends Error {}

/** Uploads the outbox and queued proposals, then pulls what changed. Never loses queued work. */
export async function syncOnce(initial: LocalState, api: Api): Promise<SyncResult> {
  let state = initial
  const notices: string[] = []
  const failed: SyncResult['failed'] = []
  const call = async (method: 'GET' | 'POST', path: string, body?: unknown) => {
    const r = await api(method, path, body)
    if (r.status === 401) throw new Unauthorized()
    return r
  }
  try {
    while (state.outbox.length) {
      const batch = takeBatch(state.outbox)
      const r = await call('POST', '/api/sync/push', { changes: batch })
      if (r.status !== 200) throw new Error(`push ${r.status}`)
      const s = settle(state.outbox, batch, (r.body as PushResponse).results)
      failed.push(...s.failed)
      state = { ...state, outbox: s.outbox }
    }
    for (const p of [...state.pendingProposals]) {
      const r = await call('POST', '/api/proposals', { song_uid: p.song_uid, fields: p.fields, seen: p.seen })
      if (r.status >= 500) throw new Error(`proposal ${r.status}`)
      if (r.status !== 200) notices.push(`No se pudo enviar una propuesta: ${r.body?.error ?? r.status}`)
      state = { ...state, pendingProposals: state.pendingProposals.filter(x => x.id !== p.id) }
    }
    const pulled = await call('POST', '/api/sync/pull', { since: state.seq })
    if (pulled.status !== 200) throw new Error(`pull ${pulled.status}`)
    const p = pulled.body as PullResponse
    notices.push(...p.notices.map(n => n.message))
    // Changes still queued stay visible on top of what the cloud sent.
    let catalog = applyPull(state.catalog, p)
    for (const ch of state.outbox) catalog = applyLocalChange(catalog, ch)
    state = { ...state, catalog, seq: p.seq, lastSync: new Date().toISOString() }
    const me = await call('GET', '/api/me')
    if (me.status === 200) {
      const { role, name, actor, church, pending } = me.body as Me
      state = { ...state, me: { role, name, actor, church, pending } }
    }
    return { state, notices, failed, unauthorized: false, offline: false }
  } catch (e) {
    return { state, notices, failed, unauthorized: e instanceof Unauthorized, offline: !(e instanceof Unauthorized) }
  }
}

const newId = () => (globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`).replace(/[^A-Za-z0-9-]/g, '')

/**
 * Saves song fields from the phone. A leader's edit goes to the outbox (and shows at once); an
 * editor's becomes a proposal and the song stays as it is until a leader approves.
 * `uid` null = a new song.
 */
export function saveSong(state: LocalState, uid: string | null, fields: Partial<SongFields>): LocalState {
  const current = uid ? state.catalog.songs[uid] : undefined
  const seen: FieldVersions = {}
  for (const f of Object.keys(fields) as (keyof FieldVersions)[]) seen[f] = current?.versions[f] ?? 0
  if (state.me?.role === 'leader') {
    const change: Change = { kind: 'song', uid: uid ?? newId(), fields, seen }
    return { ...state, outbox: enqueue(state.outbox, change), catalog: applyLocalChange(state.catalog, change) }
  }
  return { ...state, pendingProposals: [...state.pendingProposals, { id: newId(), song_uid: uid, fields, seen }] }
}

/** Queues a service change (create/edit/delete) and shows it at once. */
export function saveSetlistChange(state: LocalState, change: Change): LocalState {
  return { ...state, outbox: enqueue(state.outbox, change), catalog: applyLocalChange(state.catalog, change) }
}

export { newId }
