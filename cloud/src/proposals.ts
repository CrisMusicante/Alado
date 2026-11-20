import { LYRIC_FIELDS, type FieldVersions, type Proposal, type ProposalStatus, type ProposalView, type SongField, type SongFields } from '../../shared/types'
import { type Ctx, type Result, fail, iso } from './ctx'
import type { Session } from './auth'
import { randomId } from './crypto'
import { authorOf, getSong, loadSongs, validSongFields, writeSong } from './sync'

interface ProposalRow {
  id: string; song_uid: string | null; author_id: string; author_name: string; seen: string; fields: string
  status: ProposalStatus | 'approving'; note: string | null; created_at: string; decided_at: string | null; decided_by: string | null
}

const LIST_LIMIT = 50

const parse = (r: ProposalRow): Proposal => ({
  ...r, status: r.status === 'approving' ? 'pending' : r.status, seen: JSON.parse(r.seen), fields: JSON.parse(r.fields),
})

const changedSince = (versions: FieldVersions, fields: string[], seen: FieldVersions | undefined) =>
  fields.some(f => (versions[f as SongField] ?? 0) > (seen?.[f as SongField] ?? 0))

/** An Editor (or Leader) proposes lyric changes; nothing changes until a Leader approves. */
export async function propose(ctx: Ctx, s: Session, p: { song_uid: string | null; fields: Partial<SongFields>; seen: FieldVersions }):
  Promise<Result<{ id: string }>> {
  if (s.role !== 'editor' && s.role !== 'leader') return fail(403, 'No tienes permiso para proponer cambios.')
  const keys = Object.keys(p.fields ?? {}) as SongField[]
  if (!keys.length || !validSongFields(p.fields) || !keys.every(k => LYRIC_FIELDS.includes(k))) {
    return fail(400, 'La propuesta solo puede cambiar título, artista, letra, tono o video.')
  }
  // What the proposal was based on comes from the server (an editor must not be able to hide
  // staleness); an older version the client says it saw is honored, a newer or bogus one is not.
  const seen: FieldVersions = {}
  if (p.song_uid === null) {
    if (!(typeof p.fields.title === 'string' && p.fields.title.trim())) return fail(400, 'Una canción nueva necesita título.')
  } else {
    const song = await getSong(ctx, s.churchId, String(p.song_uid))
    if (!song || song.deleted) return fail(404, 'Esa canción no existe.')
    for (const f of keys) {
      const server = song.versions[f] ?? 0
      const client = (p.seen as Record<string, unknown> | undefined)?.[f]
      seen[f] = Number.isInteger(client) && (client as number) >= 0 ? Math.min(client as number, server) : server
    }
  }
  const id = randomId()
  await ctx.db.run(
    'INSERT INTO proposals (id, church_id, song_uid, author_id, author_name, seen, fields, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    id, s.churchId, p.song_uid, s.actor, s.name, JSON.stringify(seen), JSON.stringify(p.fields), iso(ctx.now()))
  return { ok: true, id }
}

/** Leaders see every proposal; editors only theirs (newest 50). Each comes with the current song and whether it went stale. */
export async function listProposals(ctx: Ctx, s: Session, q: { status?: ProposalStatus }):
  Promise<Result<{ proposals: ProposalView[] }>> {
  if (s.role !== 'editor' && s.role !== 'leader') return fail(403, 'No tienes acceso a las propuestas.')
  const where = ['church_id = ?']
  const params: unknown[] = [s.churchId]
  if (s.role === 'editor') { where.push('author_id = ?'); params.push(s.actor) }
  if (q.status === 'pending') where.push("status IN ('pending', 'approving')")
  else if (q.status) { where.push('status = ?'); params.push(q.status) }
  const rows = await ctx.db.all<ProposalRow>(
    `SELECT * FROM proposals WHERE ${where.join(' AND ')} ORDER BY created_at DESC LIMIT ${LIST_LIMIT}`, ...params)
  const songs = await loadSongs(ctx, s.churchId, rows.map(r => r.song_uid).filter((u): u is string => !!u))
  const proposals: ProposalView[] = rows.map(r => {
    const p = parse(r)
    const song = p.song_uid ? songs.get(p.song_uid) ?? null : null
    const stale = !!song && changedSince(song.versions, Object.keys(p.fields), p.seen)
    return { ...p, current: song?.fields ?? null, stale }
  })
  return { ok: true, proposals }
}

export async function pendingCount(ctx: Ctx, s: Session): Promise<number> {
  if (s.role !== 'leader') return 0
  const r = await ctx.db.first<{ n: number }>("SELECT COUNT(*) AS n FROM proposals WHERE church_id = ? AND status = 'pending'", s.churchId)
  return r?.n ?? 0
}

async function getProposal(ctx: Ctx, s: Session, id: string): Promise<ProposalRow | null> {
  return ctx.db.first<ProposalRow>('SELECT * FROM proposals WHERE id = ? AND church_id = ?', id, s.churchId)
}

/**
 * Approve or reject. `seen` = the song versions the leader was looking at: if a proposed field
 * changed since, approval is refused (409) so nothing is overwritten unseen.
 */
export async function decide(ctx: Ctx, s: Session, id: string, p: { action: 'approve' | 'reject'; note?: string | null; seen?: FieldVersions }):
  Promise<Result<{ song_uid: string | null }>> {
  if (s.role !== 'leader') return fail(403, 'Solo un líder puede aprobar o rechazar.')
  if (p.action !== 'approve' && p.action !== 'reject') return fail(400, 'Acción inválida.')
  const row = await getProposal(ctx, s, String(id))
  if (!row) return fail(404, 'No existe esa propuesta.')
  if (row.status !== 'pending') return fail(409, 'Esa propuesta ya no está pendiente.')
  const prop = parse(row)
  const note = typeof p.note === 'string' ? p.note.slice(0, 500) : null

  if (p.action === 'reject') {
    const r = await ctx.db.run("UPDATE proposals SET status = 'rejected', note = ?, decided_at = ?, decided_by = ? WHERE id = ? AND status = 'pending'",
      note, iso(ctx.now()), s.name, prop.id)
    return r.changes ? { ok: true, song_uid: prop.song_uid } : fail(409, 'Esa propuesta ya no está pendiente.')
  }

  const song = prop.song_uid ? await getSong(ctx, s.churchId, prop.song_uid) : null
  if (prop.song_uid && (!song || song.deleted)) return fail(409, 'La canción ya no existe.')
  if (song && p.seen && changedSince(song.versions, Object.keys(prop.fields), p.seen)) {
    return fail(409, 'La canción cambió mientras revisabas. Vuelve a revisar la propuesta.')
  }
  // Claim it first, so two approvals at once can't both write (or create two songs).
  const claim = await ctx.db.run("UPDATE proposals SET status = 'approving' WHERE id = ? AND status = 'pending'", prop.id)
  if (!claim.changes) return fail(409, 'Esa propuesta ya no está pendiente.')

  const songUid = prop.song_uid ?? randomId()
  const r = await writeSong(ctx, s.churchId, songUid, prop.fields, song?.versions ?? {}, authorOf(s), { notify: false, known: song })
  if (!r.ok) {
    await ctx.db.run("UPDATE proposals SET status = 'pending' WHERE id = ? AND status = 'approving'", prop.id)
    return fail(409, 'No se pudo aplicar la propuesta. Intenta de nuevo.')
  }
  await ctx.db.run("UPDATE proposals SET status = 'approved', note = ?, decided_at = ?, decided_by = ?, song_uid = ? WHERE id = ?",
    note, iso(ctx.now()), s.name, songUid, prop.id)
  return { ok: true, song_uid: songUid }
}

export async function withdraw(ctx: Ctx, s: Session, id: string): Promise<Result> {
  const row = await getProposal(ctx, s, String(id))
  if (!row) return fail(404, 'No existe esa propuesta.')
  if (row.author_id !== s.actor) return fail(403, 'Solo quien la hizo puede retirarla.')
  const r = await ctx.db.run("UPDATE proposals SET status = 'withdrawn', decided_at = ? WHERE id = ? AND status = 'pending'", iso(ctx.now()), row.id)
  return r.changes ? { ok: true } : fail(409, 'Esa propuesta ya no está pendiente.')
}
