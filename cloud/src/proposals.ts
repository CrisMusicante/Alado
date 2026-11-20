import { LYRIC_FIELDS, type FieldVersions, type Proposal, type ProposalStatus, type ProposalView, type SongField, type SongFields } from '../../shared/types'
import { type Ctx, type Result, fail, iso } from './ctx'
import type { Session } from './auth'
import { randomId } from './crypto'
import { authorOf, getSong, validSongFields, writeSong } from './sync'

interface ProposalRow {
  id: string; song_uid: string | null; author_id: string; author_name: string; seen: string; fields: string
  status: ProposalStatus; note: string | null; created_at: string; decided_at: string | null; decided_by: string | null
}

const parse = (r: ProposalRow): Proposal => ({ ...r, seen: JSON.parse(r.seen), fields: JSON.parse(r.fields) })

/** An Editor (or Leader) proposes lyric changes; nothing changes until a Leader approves. */
export async function propose(ctx: Ctx, s: Session, p: { song_uid: string | null; fields: Partial<SongFields>; seen: FieldVersions }):
  Promise<Result<{ id: string }>> {
  if (s.role !== 'editor' && s.role !== 'leader') return fail(403, 'No tienes permiso para proponer cambios.')
  const keys = Object.keys(p.fields ?? {}) as SongField[]
  if (!keys.length || !validSongFields(p.fields) || !keys.every(k => LYRIC_FIELDS.includes(k))) {
    return fail(400, 'La propuesta solo puede cambiar título, artista, letra, tono o video.')
  }
  if (p.song_uid === null) {
    if (!(typeof p.fields.title === 'string' && p.fields.title.trim())) return fail(400, 'Una canción nueva necesita título.')
  } else {
    const song = await getSong(ctx, s.churchId, String(p.song_uid))
    if (!song || song.deleted) return fail(404, 'Esa canción no existe.')
  }
  const id = randomId()
  await ctx.db.run(
    'INSERT INTO proposals (id, church_id, song_uid, author_id, author_name, seen, fields, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    id, s.churchId, p.song_uid, s.actor, s.name, JSON.stringify(p.seen ?? {}), JSON.stringify(p.fields), iso(ctx.now()))
  return { ok: true, id }
}

/** Leaders see every proposal; editors only theirs. Each comes with the current song and whether it went stale. */
export async function listProposals(ctx: Ctx, s: Session, q: { status?: ProposalStatus }):
  Promise<Result<{ proposals: ProposalView[] }>> {
  if (s.role !== 'editor' && s.role !== 'leader') return fail(403, 'No tienes acceso a las propuestas.')
  const where = ['church_id = ?']
  const params: unknown[] = [s.churchId]
  if (s.role === 'editor') { where.push('author_id = ?'); params.push(s.actor) }
  if (q.status) { where.push('status = ?'); params.push(q.status) }
  const rows = await ctx.db.all<ProposalRow>(`SELECT * FROM proposals WHERE ${where.join(' AND ')} ORDER BY created_at DESC LIMIT 200`, ...params)
  const proposals: ProposalView[] = []
  for (const r of rows) {
    const p = parse(r)
    const song = p.song_uid ? await getSong(ctx, s.churchId, p.song_uid) : null
    const stale = !!song && (Object.keys(p.fields) as SongField[]).some(f => (song.versions[f] ?? 0) > (p.seen[f] ?? 0))
    proposals.push({ ...p, current: song?.fields ?? null, stale })
  }
  return { ok: true, proposals }
}

export async function pendingCount(ctx: Ctx, s: Session): Promise<number> {
  if (s.role !== 'leader') return 0
  const r = await ctx.db.first<{ n: number }>("SELECT COUNT(*) AS n FROM proposals WHERE church_id = ? AND status = 'pending'", s.churchId)
  return r?.n ?? 0
}

async function pending(ctx: Ctx, s: Session, id: string): Promise<Proposal | null> {
  const r = await ctx.db.first<ProposalRow>("SELECT * FROM proposals WHERE id = ? AND church_id = ?", id, s.churchId)
  return r ? parse(r) : null
}

export async function decide(ctx: Ctx, s: Session, id: string, p: { action: 'approve' | 'reject'; note?: string | null }):
  Promise<Result<{ song_uid: string | null }>> {
  if (s.role !== 'leader') return fail(403, 'Solo un líder puede aprobar o rechazar.')
  const prop = await pending(ctx, s, String(id))
  if (!prop) return fail(404, 'No existe esa propuesta.')
  if (prop.status !== 'pending') return fail(409, 'Esa propuesta ya no está pendiente.')
  if (p.action !== 'approve' && p.action !== 'reject') return fail(400, 'Acción inválida.')

  let songUid = prop.song_uid
  if (p.action === 'approve') {
    const song = songUid ? await getSong(ctx, s.churchId, songUid) : null
    if (songUid && (!song || song.deleted)) return fail(409, 'La canción ya no existe.')
    songUid = songUid ?? randomId()
    // Applied as the leader's own change; the leader saw the current version when deciding.
    const r = await writeSong(ctx, s.churchId, songUid, prop.fields, song?.versions ?? {}, authorOf(s), { notify: false })
    if (!r.ok) return fail(400, 'No se pudo aplicar la propuesta.')
  }
  const note = typeof p.note === 'string' ? p.note.slice(0, 500) : null
  await ctx.db.run(
    "UPDATE proposals SET status = ?, note = ?, decided_at = ?, decided_by = ?, song_uid = ? WHERE id = ? AND status = 'pending'",
    p.action === 'approve' ? 'approved' : 'rejected', note, iso(ctx.now()), s.name, songUid, prop.id)
  return { ok: true, song_uid: songUid }
}

export async function withdraw(ctx: Ctx, s: Session, id: string): Promise<Result> {
  const prop = await pending(ctx, s, String(id))
  if (!prop) return fail(404, 'No existe esa propuesta.')
  if (prop.author_id !== s.actor) return fail(403, 'Solo quien la hizo puede retirarla.')
  if (prop.status !== 'pending') return fail(409, 'Esa propuesta ya no está pendiente.')
  await ctx.db.run("UPDATE proposals SET status = 'withdrawn', decided_at = ? WHERE id = ?", iso(ctx.now()), prop.id)
  return { ok: true }
}
