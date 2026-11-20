import {
  EMPTY_SONG, SONG_FIELDS,
  type Change, type ChangeResult, type FieldAuthors, type FieldVersions, type Notice, type PullResponse,
  type PushResponse, type SetlistData, type SongField, type SongFields, type SyncFolder, type SyncSetlist, type SyncSong,
} from '../../shared/types'
import { mergeSongFields, type Author } from '../../shared/merge'
import type { Ctx } from './ctx'
import { iso } from './ctx'
import type { Session } from './auth'
import { randomId } from './crypto'
import { canApply } from './permissions'

const FIELD_LABEL: Record<SongField, string> = {
  title: 'título', artist: 'artista', sections: 'letra', song_key: 'tono', video_file: 'video',
  text_style: 'estilo', sheet_style: 'hoja PDF', folder_uid: 'carpeta',
}

interface SongRow { uid: string; fields: string; versions: string; authors: string; deleted: number; seq: number }
interface SetlistRow { uid: string; name: string; service_date: string | null; notes: string | null; items: string; deleted: number; seq: number; author: string | null }

export interface StoredSong { uid: string; fields: SongFields; versions: FieldVersions; authors: FieldAuthors; deleted: boolean; seq: number }

const parseSong = (r: SongRow): StoredSong => ({
  uid: r.uid,
  fields: { ...EMPTY_SONG, ...JSON.parse(r.fields) },
  versions: JSON.parse(r.versions),
  authors: JSON.parse(r.authors),
  deleted: !!r.deleted,
  seq: r.seq,
})

export async function getSong(ctx: Ctx, churchId: string, uid: string): Promise<StoredSong | null> {
  const r = await ctx.db.first<SongRow>('SELECT * FROM songs WHERE church_id = ? AND uid = ?', churchId, uid)
  return r ? parseSong(r) : null
}

/** Hands out the church's next change number. */
export async function nextSeq(ctx: Ctx, churchId: string): Promise<number> {
  const r = await ctx.db.first<{ seq: number }>('UPDATE churches SET seq = seq + 1 WHERE id = ? RETURNING seq', churchId)
  return r!.seq
}

export async function addNotice(ctx: Ctx, churchId: string, target: string, message: string): Promise<void> {
  await ctx.db.run('INSERT INTO notices (id, church_id, target, message, created_at) VALUES (?, ?, ?, ?, ?)',
    randomId(), churchId, target, message, iso(ctx.now()))
}

export const authorOf = (s: Session): Author => ({ id: s.actor, name: s.name })

// ---------- Validation ----------

const isStr = (v: unknown, max: number) => typeof v === 'string' && v.length <= max
const isOptStr = (v: unknown, max: number) => v === null || isStr(v, max)
const isObjOrNull = (v: unknown) => v === null || (typeof v === 'object' && !Array.isArray(v))

function validSections(v: unknown): boolean {
  return Array.isArray(v) && v.length <= 200 && v.every(s =>
    s && typeof s === 'object' &&
    isStr((s as { label: unknown }).label, 200) && isStr((s as { type: unknown }).type, 40) &&
    Array.isArray((s as { lines: unknown }).lines) && (s as { lines: unknown[] }).lines.every(l => isStr(l, 500)) &&
    ((s as { repeat?: unknown }).repeat === undefined || (Number.isInteger((s as { repeat: unknown }).repeat) && (s as { repeat: number }).repeat >= 1 && (s as { repeat: number }).repeat <= 20)))
}

/** A video travels by file name only; never a path. */
const validVideoFile = (v: unknown) => v === null || (isStr(v, 255) && !/[\\/]/.test(v as string) && !(v as string).startsWith('.') && (v as string).trim() !== '')

const FIELD_CHECK: Record<SongField, (v: unknown) => boolean> = {
  title: v => isStr(v, 200) && (v as string).trim() !== '',
  artist: v => isOptStr(v, 200),
  sections: validSections,
  song_key: v => isOptStr(v, 8),
  video_file: validVideoFile,
  text_style: isObjOrNull,
  sheet_style: isObjOrNull,
  folder_uid: v => isOptStr(v, 64),
}

export function validSongFields(fields: unknown): fields is Partial<SongFields> {
  if (!fields || typeof fields !== 'object' || Array.isArray(fields)) return false
  return Object.entries(fields).every(([k, v]) =>
    (SONG_FIELDS as readonly string[]).includes(k) && FIELD_CHECK[k as SongField](v))
}

function validSetlistData(d: unknown): d is SetlistData {
  if (!d || typeof d !== 'object') return false
  const s = d as SetlistData
  return isStr(s.name, 200) && s.name.trim() !== '' && isOptStr(s.service_date, 10) && isOptStr(s.notes, 2000) &&
    Array.isArray(s.items) && s.items.length <= 100 &&
    s.items.every(i => i && isStr(i.song_uid, 64) && validVideoFile(i.custom_video_file ?? null))
}

const validUid = (u: unknown) => isStr(u, 64) && /^[A-Za-z0-9_-]+$/.test(u as string)

// ---------- Apply one change ----------

/** Applies song fields as `author` (used by push and by approving a proposal). */
export async function writeSong(ctx: Ctx, churchId: string, uid: string, fields: Partial<SongFields>, seen: FieldVersions, author: Author,
  opts: { notify: boolean }): Promise<ChangeResult> {
  const existing = await getSong(ctx, churchId, uid)
  if (!existing && !(typeof fields.title === 'string' && fields.title.trim())) return { ok: false, error: 'missing-title' }
  const base = existing ?? { fields: { ...EMPTY_SONG }, versions: {}, authors: {}, deleted: false }
  const seq = await nextSeq(ctx, churchId)
  const merged = mergeSongFields(base, { fields, seen }, author, seq)
  if (existing) {
    await ctx.db.run('UPDATE songs SET fields = ?, versions = ?, authors = ?, deleted = 0, seq = ? WHERE uid = ? AND church_id = ?',
      JSON.stringify(merged.fields), JSON.stringify(merged.versions), JSON.stringify(merged.authors), seq, uid, churchId)
  } else {
    await ctx.db.run('INSERT INTO songs (uid, church_id, fields, versions, authors, deleted, seq) VALUES (?, ?, ?, ?, ?, 0, ?)',
      uid, churchId, JSON.stringify(merged.fields), JSON.stringify(merged.versions), JSON.stringify(merged.authors), seq)
  }
  if (opts.notify) {
    for (const r of merged.replaced) {
      await addNotice(ctx, churchId, r.previousAuthor.id,
        `Tu cambio de «${FIELD_LABEL[r.field]}» en «${merged.fields.title}» fue reemplazado por uno más reciente de ${author.name}.`)
    }
  }
  return { ok: true }
}

async function applyChange(ctx: Ctx, s: Session, c: Change): Promise<ChangeResult> {
  if (!c || typeof c !== 'object' || !validUid((c as { uid?: unknown }).uid)) return { ok: false, error: 'invalid' }

  switch (c.kind) {
    case 'song': {
      if (!validSongFields(c.fields)) return { ok: false, error: 'invalid' }
      const existing = await getSong(ctx, s.churchId, c.uid)
      const allowed = canApply(s.role, c, existing)
      if (allowed !== true) return { ok: false, error: allowed }
      return writeSong(ctx, s.churchId, c.uid, c.fields, c.seen ?? {}, authorOf(s), { notify: true })
    }
    case 'song-delete': {
      const allowed = canApply(s.role, c, null)
      if (allowed !== true) return { ok: false, error: allowed }
      const existing = await getSong(ctx, s.churchId, c.uid)
      if (!existing || existing.deleted) return { ok: true }
      const inUse = await ctx.db.all<{ items: string }>('SELECT items FROM setlists WHERE church_id = ? AND deleted = 0', s.churchId)
      if (inUse.some(r => (JSON.parse(r.items) as { song_uid: string }[]).some(i => i.song_uid === c.uid))) {
        return { ok: false, error: 'song-in-use' }
      }
      await ctx.db.run('UPDATE songs SET deleted = 1, seq = ? WHERE uid = ? AND church_id = ?', await nextSeq(ctx, s.churchId), c.uid, s.churchId)
      return { ok: true }
    }
    case 'setlist': {
      if (!validSetlistData(c.data)) return { ok: false, error: 'invalid' }
      const allowed = canApply(s.role, c, null)
      if (allowed !== true) return { ok: false, error: allowed }
      // Every song must exist (a proposed new song can't go in a service until approved).
      const restore: StoredSong[] = []
      for (const uid of new Set(c.data.items.map(i => i.song_uid))) {
        const song = await getSong(ctx, s.churchId, uid)
        if (!song) return { ok: false, error: 'unknown-song' }
        if (song.deleted) restore.push(song)
      }
      for (const song of restore) {
        await ctx.db.run('UPDATE songs SET deleted = 0, seq = ? WHERE uid = ? AND church_id = ?', await nextSeq(ctx, s.churchId), song.uid, s.churchId)
        await addNotice(ctx, s.churchId, 'leaders',
          `La canción «${song.fields.title}» estaba borrada y se restauró porque ${s.name} la usa en el servicio «${c.data.name}».`)
      }
      const existing = await ctx.db.first<SetlistRow>('SELECT * FROM setlists WHERE church_id = ? AND uid = ?', s.churchId, c.uid)
      const seq = await nextSeq(ctx, s.churchId)
      const author = JSON.stringify(authorOf(s))
      const d = c.data
      if (existing) {
        const prev = existing.author ? JSON.parse(existing.author) as Author : null
        if ((c.seenSeq ?? 0) < existing.seq && prev && prev.id !== s.actor) {
          await addNotice(ctx, s.churchId, prev.id,
            `Tu versión del servicio «${existing.name}» fue reemplazada por una más reciente de ${s.name}.`)
        }
        await ctx.db.run('UPDATE setlists SET name = ?, service_date = ?, notes = ?, items = ?, deleted = 0, seq = ?, author = ? WHERE uid = ? AND church_id = ?',
          d.name.trim(), d.service_date, d.notes, JSON.stringify(d.items), seq, author, c.uid, s.churchId)
      } else {
        await ctx.db.run('INSERT INTO setlists (uid, church_id, name, service_date, notes, items, deleted, seq, author) VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?)',
          c.uid, s.churchId, d.name.trim(), d.service_date, d.notes, JSON.stringify(d.items), seq, author)
      }
      return { ok: true }
    }
    case 'setlist-delete': {
      const allowed = canApply(s.role, c, null)
      if (allowed !== true) return { ok: false, error: allowed }
      await ctx.db.run('UPDATE setlists SET deleted = 1, seq = ? WHERE uid = ? AND church_id = ? AND deleted = 0',
        await nextSeq(ctx, s.churchId), c.uid, s.churchId)
      return { ok: true }
    }
    case 'folder':
    case 'folder-delete': {
      const allowed = canApply(s.role, c, null)
      if (allowed !== true) return { ok: false, error: allowed }
      if (c.kind === 'folder' && !(isStr(c.name, 100) && c.name.trim())) return { ok: false, error: 'invalid' }
      const seq = await nextSeq(ctx, s.churchId)
      if (c.kind === 'folder') {
        await ctx.db.run(
          'INSERT INTO folders (uid, church_id, name, deleted, seq) VALUES (?, ?, ?, 0, ?) ON CONFLICT(uid) DO UPDATE SET name = excluded.name, deleted = 0, seq = excluded.seq WHERE church_id = excluded.church_id',
          c.uid, s.churchId, c.name.trim(), seq)
      } else {
        await ctx.db.run('UPDATE folders SET deleted = 1, seq = ? WHERE uid = ? AND church_id = ?', seq, c.uid, s.churchId)
      }
      return { ok: true }
    }
    default:
      return { ok: false, error: 'invalid' }
  }
}

export async function push(ctx: Ctx, s: Session, changes: Change[]): Promise<PushResponse> {
  const results: ChangeResult[] = []
  for (const c of Array.isArray(changes) ? changes.slice(0, 500) : []) {
    // A uid already owned by another church must never be touched.
    const uid = (c as { uid?: unknown })?.uid
    const kind = (c as { kind?: string })?.kind ?? ''
    const table = kind.startsWith('song') ? 'songs' : kind.startsWith('setlist') ? 'setlists' : kind.startsWith('folder') ? 'folders' : null
    if (table && typeof uid === 'string') {
      const owner = await ctx.db.first<{ church_id: string }>(`SELECT church_id FROM ${table} WHERE uid = ?`, uid)
      if (owner && owner.church_id !== s.churchId) { results.push({ ok: false, error: 'invalid' }); continue }
    }
    results.push(await applyChange(ctx, s, c))
  }
  const church = await ctx.db.first<{ seq: number }>('SELECT seq FROM churches WHERE id = ?', s.churchId)
  return { seq: church!.seq, results }
}

// ---------- Pull ----------

export async function pull(ctx: Ctx, s: Session, since: number): Promise<PullResponse> {
  const from = Number.isFinite(since) && since > 0 ? since : 0
  const church = await ctx.db.first<{ seq: number }>('SELECT seq FROM churches WHERE id = ?', s.churchId)
  const songRows = await ctx.db.all<SongRow>('SELECT * FROM songs WHERE church_id = ? AND seq > ? ORDER BY seq', s.churchId, from)
  const folderRows = await ctx.db.all<{ uid: string; name: string; deleted: number; seq: number }>(
    'SELECT * FROM folders WHERE church_id = ? AND seq > ? ORDER BY seq', s.churchId, from)
  const setlistRows = await ctx.db.all<SetlistRow>('SELECT * FROM setlists WHERE church_id = ? AND seq > ? ORDER BY seq', s.churchId, from)

  const songs: SyncSong[] = songRows.map(r => {
    const p = parseSong(r)
    const fields = s.role === 'member' ? { ...p.fields, text_style: null, sheet_style: null } : p.fields
    return { uid: p.uid, deleted: p.deleted, seq: p.seq, fields, versions: p.versions }
  })
  const folders: SyncFolder[] = folderRows.map(r => ({ uid: r.uid, name: r.name, deleted: !!r.deleted, seq: r.seq }))
  const setlists: SyncSetlist[] = setlistRows.map(r => ({
    uid: r.uid, name: r.name, service_date: r.service_date, notes: r.notes, items: JSON.parse(r.items), deleted: !!r.deleted, seq: r.seq,
  }))

  return { seq: church!.seq, songs, folders, setlists, notices: await takeNotices(ctx, s) }
}

/** Notices for this session's actor (and for leaders, the ones addressed to all leaders), each delivered once. */
async function takeNotices(ctx: Ctx, s: Session): Promise<Notice[]> {
  if (s.role === 'member') return []
  const targets = [s.actor, ...(s.role === 'leader' ? ['leaders'] : [])]
  const rows = await ctx.db.all<{ id: string; message: string; created_at: string; delivered: string; target: string }>(
    `SELECT * FROM notices WHERE church_id = ? AND target IN (${targets.map(() => '?').join(', ')}) ORDER BY created_at`,
    s.churchId, ...targets)
  const out: Notice[] = []
  for (const r of rows) {
    const delivered = JSON.parse(r.delivered) as string[]
    if (delivered.includes(s.actor)) continue
    out.push({ id: r.id, message: r.message, created_at: r.created_at })
    await ctx.db.run('UPDATE notices SET delivered = ? WHERE id = ?', JSON.stringify([...delivered, s.actor]), r.id)
  }
  return out
}
