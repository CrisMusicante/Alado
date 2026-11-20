import type { Change, ChangeResult, FieldVersions } from './types'

/** Must match MAX_CHANGES_PER_PUSH in cloud/src/sync.ts. */
export const PUSH_LIMIT = 30

/**
 * Queues a change made on the phone. Edits of the same song merge (keeping the version seen at the
 * first edit, so the cloud knows what this phone had seen); a newer edit of a service replaces the
 * queued one; deleting a service drops its queued edit.
 */
export function enqueue(outbox: Change[], ch: Change): Change[] {
  if (ch.kind === 'song') {
    const i = outbox.findIndex(o => o.kind === 'song' && o.uid === ch.uid)
    if (i >= 0) {
      const prev = outbox[i] as Extract<Change, { kind: 'song' }>
      const seen: FieldVersions = { ...ch.seen, ...prev.seen }
      for (const f of Object.keys(ch.fields)) if (!(f in prev.fields)) seen[f as keyof FieldVersions] = ch.seen[f as keyof FieldVersions]
      const merged: Change = { kind: 'song', uid: ch.uid, fields: { ...prev.fields, ...ch.fields }, seen }
      return outbox.map((o, k) => (k === i ? merged : o))
    }
  }
  if (ch.kind === 'setlist') {
    const i = outbox.findIndex(o => o.kind === 'setlist' && o.uid === ch.uid)
    if (i >= 0) {
      const prev = outbox[i] as Extract<Change, { kind: 'setlist' }>
      return outbox.map((o, k) => (k === i ? { ...ch, seenSeq: prev.seenSeq } : o))
    }
  }
  if (ch.kind === 'setlist-delete') {
    return [...outbox.filter(o => !(o.kind === 'setlist' && o.uid === ch.uid)), ch]
  }
  return [...outbox, ch]
}

export const takeBatch = (outbox: Change[], n = PUSH_LIMIT) => outbox.slice(0, n)

/** After a push of `batch` (the head of the outbox): every answered change leaves; refusals are reported. */
export function settle(outbox: Change[], batch: Change[], results: ChangeResult[]): { outbox: Change[]; failed: { change: Change; error: string }[] } {
  // Only a complete answer settles the batch; anything else is a transient failure (kept queued).
  if (!Array.isArray(results) || results.length !== batch.length) throw new Error('Respuesta incompleta de la nube')
  const failed = batch.flatMap((change, i) => {
    const r = results[i]
    return r && !r.ok ? [{ change, error: r.error }] : []
  })
  return { outbox: outbox.slice(batch.length), failed }
}
