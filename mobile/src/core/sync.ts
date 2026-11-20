import type { Catalog, Change, FieldVersions, LocalState, Me, PullResponse, PushResponse, QueuedChange, SongFields } from './types'
import { emptyState } from './types'
import { applyPull, emptyCatalog } from './catalog'
import { acknowledge, enqueue, replay, takeBatch } from './outbox'

/** One call to the cloud. Throws when there is no connection. */
export type Api = (method: 'GET' | 'POST' | 'PATCH', path: string, body?: unknown) => Promise<{ status: number; body: any }>

/** What a sync learned; merged into whatever the state is when it finishes (the user may have kept editing). */
export interface SyncResult {
  /** Each push batch: what was sent and the cloud's answers. */
  acks: { sent: QueuedChange[]; results: { ok: true } | { ok: false; error: string } extends infer R ? R[] : never }[]
  sentProposals: string[]
  base: Catalog | null
  seq: number | null
  me: Me | null
  notices: string[]
  failed: { change: Change; error: string }[]
  /** The session is no longer valid (logged out elsewhere, code rotated): go back to login. */
  unauthorized: boolean
  offline: boolean
  token: string | null
}

class Unauthorized extends Error {}

/** Uploads the outbox and queued proposals, then pulls what changed. Never loses queued work. */
export async function syncOnce(state: LocalState, api: Api): Promise<SyncResult> {
  const r: SyncResult = {
    acks: [], sentProposals: [], base: null, seq: null, me: null, notices: [], failed: [],
    unauthorized: false, offline: false, token: state.session?.token ?? null,
  }
  const call = async (method: 'GET' | 'POST', path: string, body?: unknown) => {
    const res = await api(method, path, body)
    if (res.status === 401) throw new Unauthorized()
    return res
  }
  try {
    let pending = state.outbox
    while (pending.length) {
      const batch = takeBatch(pending)
      const res = await call('POST', '/api/sync/push', { changes: batch.map(q => q.change) })
      if (res.status >= 500) {
        r.notices.push('La nube no respondió bien; tus cambios se reintentarán.')
        break
      }
      // A 4xx for the whole batch (e.g. too large) would never succeed: report and drop it.
      const results = res.status === 200
        ? (res.body as PushResponse).results
        : batch.map(() => ({ ok: false as const, error: res.body?.error ?? `error ${res.status}` }))
      const a = acknowledge(pending, batch, results)
      r.acks.push({ sent: batch, results })
      r.failed.push(...a.failed)
      if (a.outbox.length >= pending.length) break // only transient refusals: retry next time
      pending = a.outbox
    }
    for (const p of state.pendingProposals) {
      const res = await call('POST', '/api/proposals', { song_uid: p.song_uid, fields: p.fields, seen: p.seen })
      if (res.status >= 500) throw new Error(`proposal ${res.status}`)
      if (res.status !== 200) r.notices.push(`No se pudo enviar una propuesta: ${res.body?.error ?? res.status}`)
      r.sentProposals.push(p.id)
    }
    const pulled = await call('POST', '/api/sync/pull', { since: state.seq })
    if (pulled.status !== 200) throw new Error(`pull ${pulled.status}`)
    const p = pulled.body as PullResponse
    r.notices.push(...p.notices.map(n => n.message))
    r.base = applyPull(state.base, p)
    r.seq = p.seq
    const me = await call('GET', '/api/me')
    if (me.status === 200) {
      const { role, name, actor, churchId, church, pending } = me.body as Me
      r.me = { role, name, actor, churchId, church, pending }
    }
  } catch (e) {
    if (e instanceof Unauthorized) r.unauthorized = true
    else r.offline = true
  }
  return r
}

/**
 * Folds a finished sync into the state as it is *now*: only the exact queued revisions the cloud
 * answered leave the outbox, proposals sent leave their queue, and the screen is rebuilt from the
 * new cloud copy plus whatever is still queued (so refused changes revert by themselves).
 */
export function mergeSyncResult(latest: LocalState, r: SyncResult): LocalState {
  // A sync for another session (logged out / signed in meanwhile) must not touch this one.
  if ((latest.session?.token ?? null) !== r.token) return latest
  let outbox = latest.outbox
  for (const a of r.acks) outbox = acknowledge(outbox, a.sent, a.results).outbox
  const base = r.base ?? latest.base
  const next: LocalState = {
    ...latest,
    base,
    outbox,
    pendingProposals: latest.pendingProposals.filter(p => !r.sentProposals.includes(p.id)),
    seq: r.seq ?? latest.seq,
    me: r.me ?? latest.me,
    lastSync: r.base ? new Date().toISOString() : latest.lastSync,
    catalog: replay(base, outbox),
  }
  return r.unauthorized ? { ...next, session: null, me: null } : next
}

export const newId = () => (globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`).replace(/[^A-Za-z0-9-]/g, '')

/**
 * Saves song fields from the phone. A leader's edit goes to the outbox (and shows at once); an
 * editor's becomes a proposal and the song stays as it is until a leader approves.
 * `uid` null = a new song. `seen` = versions when the editor was opened (defaults to now).
 */
export function saveSong(state: LocalState, uid: string | null, fields: Partial<SongFields>, seenAtOpen?: FieldVersions): LocalState {
  const current = uid ? state.base.songs[uid] : undefined
  const seen: FieldVersions = {}
  for (const f of Object.keys(fields) as (keyof FieldVersions)[]) seen[f] = seenAtOpen?.[f] ?? current?.versions[f] ?? 0
  if (state.me?.role === 'leader') {
    const outbox = enqueue(state.outbox, { kind: 'song', uid: uid ?? newId(), fields, seen }, newId)
    return { ...state, outbox, catalog: replay(state.base, outbox) }
  }
  return { ...state, pendingProposals: [...state.pendingProposals, { id: newId(), song_uid: uid, fields, seen }] }
}

/** Queues a service change (create/edit/delete) and shows it at once. */
export function saveSetlistChange(state: LocalState, change: Change): LocalState {
  const outbox = enqueue(state.outbox, change, newId)
  return { ...state, outbox, catalog: replay(state.base, outbox) }
}

/** The cloud's limits (cloud/src/sync.ts), checked before saving so a change isn't refused later. */
export function validateSong(f: Partial<SongFields>): string | null {
  if (f.title !== undefined && (!f.title.trim() || f.title.length > 200)) return 'El título debe tener entre 1 y 200 caracteres.'
  if (f.artist && f.artist.length > 200) return 'El artista es demasiado largo.'
  if (f.sections) {
    if (f.sections.length > 200) return 'Demasiadas secciones (máximo 200).'
    for (const s of f.sections) {
      if (s.label.length > 200) return `El nombre de la sección «${s.label.slice(0, 20)}…» es demasiado largo.`
      if (s.lines.length > 100) return `La sección «${s.label}» tiene más de 100 renglones.`
      if (s.lines.some(l => l.length > 500)) return `Un renglón de «${s.label}» pasa de 500 caracteres.`
    }
  }
  return null
}

/** States saved by earlier versions of the app (plain outbox, no cloud copy) are upgraded on load. */
export function normalizeState(saved: Partial<LocalState> & { outbox?: unknown[] }): LocalState {
  const s = { ...emptyState(), ...saved } as LocalState
  const outbox: QueuedChange[] = (saved.outbox ?? []).map(o =>
    o && typeof o === 'object' && 'change' in (o as object) ? o as unknown as QueuedChange : { id: newId(), rev: 0, change: o as unknown as Change })
  const base = saved.base ?? (saved.catalog as Catalog | undefined) ?? emptyCatalog()
  return { ...s, owner: saved.owner ?? null, base, outbox, catalog: replay(base, outbox) }
}
