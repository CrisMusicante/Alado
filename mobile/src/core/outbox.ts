import type { Catalog, Change, ChangeResult, FieldVersions, QueuedChange } from './types'
import { applyLocalChange } from './catalog'

/** Must match MAX_CHANGES_PER_PUSH in cloud/src/sync.ts. */
export const PUSH_LIMIT = 30

/** Refusals worth retrying (the cloud was busy), so the change stays queued. */
const TRANSIENT = new Set(['busy'])

/**
 * Queues a change made on the phone.
 * - Edits of the same song merge in place, keeping the version seen at the first edit of each field.
 * - A newer edit of a service replaces the queued one and moves to the end (after any song created
 *   meanwhile that it may now use), keeping the oldest `seenSeq`.
 * - Deleting a service drops its queued edit.
 */
export function enqueue(outbox: QueuedChange[], ch: Change, newId: () => string): QueuedChange[] {
  if (ch.kind === 'song') {
    const i = outbox.findIndex(o => o.change.kind === 'song' && o.change.uid === ch.uid)
    if (i >= 0) {
      const prev = outbox[i].change as Extract<Change, { kind: 'song' }>
      const seen: FieldVersions = { ...ch.seen, ...prev.seen }
      for (const f of Object.keys(ch.fields) as (keyof FieldVersions)[]) if (!(f in prev.fields)) seen[f] = ch.seen[f]
      const merged: Change = { kind: 'song', uid: ch.uid, fields: { ...prev.fields, ...ch.fields }, seen }
      return outbox.map((o, k) => (k === i ? { id: o.id, rev: o.rev + 1, change: merged } : o))
    }
  }
  if (ch.kind === 'setlist') {
    const prev = outbox.find(o => o.change.kind === 'setlist' && o.change.uid === ch.uid)
    if (prev) {
      const seenSeq = (prev.change as Extract<Change, { kind: 'setlist' }>).seenSeq
      return [...outbox.filter(o => o !== prev), { id: prev.id, rev: prev.rev + 1, change: { ...ch, seenSeq } }]
    }
  }
  if (ch.kind === 'setlist-delete') {
    return [...outbox.filter(o => !(o.change.kind === 'setlist' && o.change.uid === ch.uid)), { id: newId(), rev: 0, change: ch }]
  }
  return [...outbox, { id: newId(), rev: 0, change: ch }]
}

export const takeBatch = (outbox: QueuedChange[], n = PUSH_LIMIT) => outbox.slice(0, n)

/**
 * After pushing `sent`: each answered entry leaves `outbox` — but only the exact revision that was
 * sent (an entry edited during the push stays, so its newer version goes up next). Transient
 * refusals stay queued; real refusals are reported.
 */
export function acknowledge(outbox: QueuedChange[], sent: QueuedChange[], results: ChangeResult[]):
  { outbox: QueuedChange[]; failed: { change: Change; error: string }[] } {
  // Only a complete answer settles the batch; anything else is a transient failure (kept queued).
  if (!Array.isArray(results) || results.length !== sent.length) throw new Error('Respuesta incompleta de la nube')
  const done = new Set<string>()
  const failed: { change: Change; error: string }[] = []
  sent.forEach((q, i) => {
    const r = results[i]
    if (r && !r.ok && TRANSIENT.has(r.error)) return
    if (r && !r.ok) failed.push({ change: q.change, error: r.error })
    done.add(`${q.id}:${q.rev}`)
  })
  return { outbox: outbox.filter(q => !done.has(`${q.id}:${q.rev}`)), failed }
}

/** What the screens show: the cloud's copy with every queued change on top. A dropped change simply disappears. */
export function replay(base: Catalog, outbox: QueuedChange[]): Catalog {
  return outbox.reduce((c, q) => applyLocalChange(c, q.change), base)
}
