import {
  EMPTY_SONG, SONG_FIELDS,
  type Change, type ChangeResult, type FieldAuthors, type FieldVersions, type Notice, type PullResponse,
  type PushResponse, type SetlistData, type SetlistItem, type SongField, type SongFields, type SyncFolder, type SyncSetlist, type SyncSong,
} from '../../shared/types'
import { mergeSongFields, type Author } from '../../shared/merge'
import type { Ctx } from './ctx'
import { iso } from './ctx'
import type { Session } from './auth'
import { randomId } from './crypto'
import { canApply } from './permissions'

/**
 * D1's free plan allows 50 queries per request (a batch counts once). A push preloads
 * what it needs in a few queries and writes each change as one batch, so this many fit.
 */
export const MAX_CHANGES_PER_PUSH = 30
const MAX_NOTICES_PER_PULL = 30

const FIELD_LABEL: Record<SongField, string> = {
  title: 'título', artist: 'artista', sections: 'letra', song_key: 'tono', video_file: 'video',
  text_style: 'estilo', sheet_style: 'hoja PDF', folder_uid: 'carpeta',
}

interface SongRow { uid: string; church_id: string; fields: string; versions: string; authors: string; deleted: number; seq: number }
interface SetlistRow { uid: string; church_id: string; name: string; service_date: string | null; notes: string | null; items: string; deleted: number; seq: number; author: string | null }

export interface StoredSong { uid: string; fields: SongFields; versions: FieldVersions; authors: FieldAuthors; deleted: boolean; seq: number }

type Stmt = { sql: string; params: unknown[] }

const parseSong = (r: SongRow): StoredSong => ({
  uid: r.uid,
  fields: { ...EMPTY_SONG, ...JSON.parse(r.fields) },
  versions: JSON.parse(r.versions),
  authors: JSON.parse(r.authors),
  deleted: !!r.deleted,
  seq: r.seq,
})

const placeholders = (n: number) => Array.from({ length: n }, () => '?').join(', ')

export async function getSong(ctx: Ctx, churchId: string, uid: string): Promise<StoredSong | null> {
  const r = await ctx.db.first<SongRow>('SELECT * FROM songs WHERE church_id = ? AND uid = ?', churchId, uid)
  return r ? parseSong(r) : null
}

/** Songs by uid in one query, across churches (callers check `church_id` to refuse foreign uids). */
async function songsByUid(ctx: Ctx, uids: string[]): Promise<Map<string, SongRow>> {
  if (!uids.length) return new Map()
  const rows = await ctx.db.all<SongRow>(`SELECT * FROM songs WHERE uid IN (${placeholders(uids.length)})`, ...uids)
  return new Map(rows.map(r => [r.uid, r]))
}

export async function loadSongs(ctx: Ctx, churchId: string, uids: string[]): Promise<Map<string, StoredSong>> {
  const rows = await songsByUid(ctx, [...new Set(uids)])
  return new Map([...rows.values()].filter(r => r.church_id === churchId).map(r => [r.uid, parseSong(r)]))
}

// ---------- Atomic writes stamped with the next change number ----------

/**
 * Increments the church's change number and runs `stmts` in the same transaction, so a pull
 * can never see the new number before the row that carries it. Inside `stmts`, `SEQ` stands
 * for the new number.
 */
function stamped(churchId: string, stmts: Stmt[]): Stmt[] {
  const SEQ = '(SELECT seq FROM churches WHERE id = ?)'
  return [
    { sql: 'UPDATE churches SET seq = seq + 1 WHERE id = ?', params: [churchId] },
    ...stmts.map(s => {
      const parts = s.sql.split('SEQ')
      if (parts.length === 1) return s
      // Each SEQ adds one bound churchId, in order of appearance relative to the other ?s.
      let sql = ''
      const params: unknown[] = []
      let pi = 0
      parts.forEach((part, i) => {
        const marks = (part.match(/\?/g) ?? []).length
        sql += part
        params.push(...s.params.slice(pi, pi + marks))
        pi += marks
        if (i < parts.length - 1) { sql += SEQ; params.push(churchId) }
      })
      params.push(...s.params.slice(pi))
      return { sql, params }
    }),
  ]
}

/** A notice that is only written if the statement right before it changed a row (chained by changes()). */
const noticeAfterWrite = (churchId: string, target: string, message: string, createdAt: string): Stmt => ({
  sql: 'INSERT INTO notices (id, church_id, target, message, created_at) SELECT ?, ?, ?, ?, ? WHERE changes() > 0',
  params: [randomId(), churchId, target, message, createdAt],
})

export async function addNotice(ctx: Ctx, churchId: string, target: string, message: string): Promise<void> {
  await ctx.db.run('INSERT INTO notices (id, church_id, target, message, created_at) VALUES (?, ?, ?, ?, ?)',
    randomId(), churchId, target, message, iso(ctx.now()))
}

export const authorOf = (s: Session): Author => ({ id: s.actor, name: s.name })

// ---------- Validation ----------

const isStr = (v: unknown, max: number) => typeof v === 'string' && v.length <= max
const isOptStr = (v: unknown, max: number) => v === null || v === undefined || isStr(v, max)
const isSmallObjOrNull = (v: unknown) =>
  v === null || (typeof v === 'object' && !Array.isArray(v) && JSON.stringify(v).length <= 4000)

function validSections(v: unknown): boolean {
  return Array.isArray(v) && v.length <= 200 && v.every(s =>
    s && typeof s === 'object' &&
    isStr((s as { label: unknown }).label, 200) && isStr((s as { type: unknown }).type, 40) &&
    Array.isArray((s as { lines: unknown }).lines) && (s as { lines: unknown[] }).lines.length <= 100 &&
    (s as { lines: unknown[] }).lines.every(l => isStr(l, 500)) &&
    ((s as { repeat?: unknown }).repeat === undefined ||
      (Number.isInteger((s as { repeat: unknown }).repeat) && (s as { repeat: number }).repeat >= 1 && (s as { repeat: number }).repeat <= 20)))
}

/** A video travels by file name only; never a path. */
const validVideoFile = (v: unknown) =>
  v === null || v === undefined || (isStr(v, 255) && !/[\\/]/.test(v as string) && !(v as string).startsWith('.') && (v as string).trim() !== '')

const FIELD_CHECK: Record<SongField, (v: unknown) => boolean> = {
  title: v => isStr(v, 200) && (v as string).trim() !== '',
  artist: v => v === null || isStr(v, 200),
  sections: validSections,
  song_key: v => v === null || isStr(v, 8),
  video_file: v => v === null || validVideoFile(v),
  text_style: isSmallObjOrNull,
  sheet_style: isSmallObjOrNull,
  folder_uid: v => v === null || isStr(v, 64),
}

export function validSongFields(fields: unknown): fields is Partial<SongFields> {
  if (!fields || typeof fields !== 'object' || Array.isArray(fields)) return false
  return Object.entries(fields).every(([k, v]) =>
    (SONG_FIELDS as readonly string[]).includes(k) && FIELD_CHECK[k as SongField](v))
}

/** `seen` decides whether a writer gets told it overwrote someone: whole numbers no newer than the church. */
export function validSeen(seen: unknown, maxSeq: number): seen is FieldVersions {
  if (seen === undefined) return true
  if (!seen || typeof seen !== 'object' || Array.isArray(seen)) return false
  return Object.entries(seen).every(([k, v]) =>
    (SONG_FIELDS as readonly string[]).includes(k) && Number.isInteger(v) && (v as number) >= 0 && (v as number) <= maxSeq)
}

export const validUid = (u: unknown) => isStr(u, 64) && /^[A-Za-z0-9_-]+$/.test(u as string)

/** Normalized service, or null if invalid. Missing date/notes/custom video are null; unknown item keys are dropped. */
function normalizeSetlist(d: unknown): SetlistData | null {
  if (!d || typeof d !== 'object') return null
  const s = d as Partial<SetlistData>
  if (!(isStr(s.name, 200) && s.name!.trim() !== '' && isOptStr(s.service_date, 10) && isOptStr(s.notes, 2000))) return null
  if (!Array.isArray(s.items) || s.items.length > 100) return null
  const items: SetlistItem[] = []
  for (const i of s.items as unknown[]) {
    const it = i as Partial<SetlistItem> | null
    if (!it || !validUid(it.song_uid) || !validVideoFile(it.custom_video_file)) return null
    items.push({ song_uid: it.song_uid!, custom_video_file: it.custom_video_file ?? null })
  }
  return { name: s.name!.trim(), service_date: s.service_date ?? null, notes: s.notes ?? null, items }
}

// ---------- Song writes (optimistic concurrency) ----------

const VERSION_MARK = -1

/**
 * Applies song fields as `author`. Field-level last write wins; a writer that had not seen the
 * value it replaces makes a notice for that value's author (unless `notify` is off). The row is
 * only written if nobody changed it since it was read; otherwise it is re-read and merged again.
 */
export async function writeSong(ctx: Ctx, churchId: string, uid: string, fields: Partial<SongFields>, seen: FieldVersions,
  author: Author, opts: { notify: boolean; known?: StoredSong | null }): Promise<ChangeResult> {
  let existing = opts.known !== undefined ? opts.known : await getSong(ctx, churchId, uid)
  for (let attempt = 0; attempt < 4; attempt++) {
    if (!existing && !(typeof fields.title === 'string' && fields.title.trim())) return { ok: false, error: 'missing-title' }
    const base = existing ?? { fields: { ...EMPTY_SONG }, versions: {}, authors: {}, deleted: false }
    const merged = mergeSongFields(base, { fields, seen }, author, VERSION_MARK)
    const changed = (Object.keys(merged.versions) as SongField[]).filter(f => merged.versions[f] === VERSION_MARK)
    if (existing && !existing.deleted && !changed.length) return { ok: true } // nothing new

    // versions: the merged map with each changed field set to the new change number.
    const versionsSql = changed.length
      ? `json_set(?, ${changed.map(f => `'$.${f}', SEQ`).join(', ')})`
      : '?'
    const versionsParam = JSON.stringify(merged.versions)
    const write: Stmt = existing
      ? { sql: `UPDATE songs SET fields = ?, versions = ${versionsSql}, authors = ?, deleted = 0, seq = SEQ WHERE uid = ? AND church_id = ? AND seq = ?`,
          params: [JSON.stringify(merged.fields), versionsParam, JSON.stringify(merged.authors), uid, churchId, existing.seq] }
      : { sql: `INSERT INTO songs (uid, church_id, fields, versions, authors, deleted, seq) VALUES (?, ?, ?, ${versionsSql}, ?, 0, SEQ) ON CONFLICT(uid) DO NOTHING`,
          params: [uid, churchId, JSON.stringify(merged.fields), versionsParam, JSON.stringify(merged.authors)] }
    const now = iso(ctx.now())
    const notices = opts.notify
      ? merged.replaced.map(r => noticeAfterWrite(churchId, r.previousAuthor.id,
        `Tu cambio de «${FIELD_LABEL[r.field]}» en «${merged.fields.title}» fue reemplazado por uno más reciente de ${author.name}.`, now))
      : []
    const results = await ctx.db.batch(stamped(churchId, [write, ...notices]))
    if (results[1].changes > 0) return { ok: true }
    existing = await getSong(ctx, churchId, uid) // someone wrote it meanwhile: merge again on the fresh row
  }
  return { ok: false, error: 'busy' }
}

// ---------- Push ----------

interface PushState {
  churchSeq: number
  songs: Map<string, SongRow>        // preloaded, any church (foreign uids are refused)
  stale: Set<string>                 // songs written in this push: re-read before reuse
  setlists: Map<string, SetlistRow>
  folders: Map<string, { church_id: string }>
  activeSetlists: { uid: string; items: string }[] | null
}

async function songFor(ctx: Ctx, st: PushState, uid: string): Promise<SongRow | null> {
  if (st.stale.has(uid)) {
    const fresh = await ctx.db.first<SongRow>('SELECT * FROM songs WHERE uid = ?', uid)
    st.stale.delete(uid)
    if (fresh) st.songs.set(uid, fresh); else st.songs.delete(uid)
  }
  return st.songs.get(uid) ?? null
}

async function applyChange(ctx: Ctx, s: Session, c: Change, st: PushState): Promise<ChangeResult> {
  if (!c || typeof c !== 'object' || !validUid((c as { uid?: unknown }).uid)) return { ok: false, error: 'invalid' }
  const now = iso(ctx.now())

  switch (c.kind) {
    case 'song': {
      if (!validSongFields(c.fields) || !validSeen(c.seen, st.churchSeq)) return { ok: false, error: 'invalid' }
      const row = await songFor(ctx, st, c.uid)
      if (row && row.church_id !== s.churchId) return { ok: false, error: 'invalid' }
      const existing = row ? parseSong(row) : null
      const allowed = canApply(s.role, c, existing)
      if (allowed !== true) return { ok: false, error: allowed }
      const r = await writeSong(ctx, s.churchId, c.uid, c.fields, c.seen ?? {}, authorOf(s), { notify: true, known: existing })
      st.stale.add(c.uid)
      return r
    }
    case 'song-delete': {
      const allowed = canApply(s.role, c, null)
      if (allowed !== true) return { ok: false, error: allowed }
      const row = await songFor(ctx, st, c.uid)
      if (row && row.church_id !== s.churchId) return { ok: false, error: 'invalid' }
      if (!row || row.deleted) return { ok: true }
      st.activeSetlists ??= await ctx.db.all<{ uid: string; items: string }>(
        'SELECT uid, items FROM setlists WHERE church_id = ? AND deleted = 0', s.churchId)
      if (st.activeSetlists.some(r => (JSON.parse(r.items) as SetlistItem[]).some(i => i.song_uid === c.uid))) {
        return { ok: false, error: 'song-in-use' }
      }
      await ctx.db.batch(stamped(s.churchId, [
        { sql: 'UPDATE songs SET deleted = 1, seq = SEQ WHERE uid = ? AND church_id = ? AND deleted = 0', params: [c.uid, s.churchId] },
      ]))
      st.stale.add(c.uid)
      return { ok: true }
    }
    case 'setlist': {
      const data = normalizeSetlist(c.data)
      if (!data) return { ok: false, error: 'invalid' }
      if (c.seenSeq !== undefined && !(Number.isInteger(c.seenSeq) && c.seenSeq >= 0)) return { ok: false, error: 'invalid' }
      const allowed = canApply(s.role, c, null)
      if (allowed !== true) return { ok: false, error: allowed }
      const existing = st.setlists.get(c.uid)
      if (existing && existing.church_id !== s.churchId) return { ok: false, error: 'invalid' }

      // Every song must exist (a proposed new song can't go in a service until approved).
      const stmts: Stmt[] = []
      for (const uid of new Set(data.items.map(i => i.song_uid))) {
        const song = await songFor(ctx, st, uid)
        if (!song || song.church_id !== s.churchId) return { ok: false, error: 'unknown-song' }
        if (song.deleted) {
          const title = parseSong(song).fields.title
          stmts.push(
            { sql: 'UPDATE songs SET deleted = 0, seq = SEQ WHERE uid = ? AND church_id = ? AND deleted = 1', params: [uid, s.churchId] },
            noticeAfterWrite(s.churchId, 'leaders',
              `La canción «${title}» estaba borrada y se restauró porque ${s.name} la usa en el servicio «${data.name}».`, now))
          st.stale.add(uid)
        }
      }
      const author = JSON.stringify(authorOf(s))
      stmts.push({
        sql: `INSERT INTO setlists (uid, church_id, name, service_date, notes, items, deleted, seq, author) VALUES (?, ?, ?, ?, ?, ?, 0, SEQ, ?)
              ON CONFLICT(uid) DO UPDATE SET name = excluded.name, service_date = excluded.service_date, notes = excluded.notes,
              items = excluded.items, deleted = 0, seq = excluded.seq, author = excluded.author WHERE setlists.church_id = excluded.church_id`,
        params: [c.uid, s.churchId, data.name, data.service_date, data.notes, JSON.stringify(data.items), author],
      })
      const prev = existing?.author ? JSON.parse(existing.author) as Author : null
      if (existing && (c.seenSeq ?? 0) < existing.seq && prev && prev.id !== s.actor) {
        stmts.push(noticeAfterWrite(s.churchId, prev.id,
          `Tu versión del servicio «${existing.name}» fue reemplazada por una más reciente de ${s.name}.`, now))
      }
      await ctx.db.batch(stamped(s.churchId, stmts))
      st.activeSetlists = null
      return { ok: true }
    }
    case 'setlist-delete': {
      const allowed = canApply(s.role, c, null)
      if (allowed !== true) return { ok: false, error: allowed }
      await ctx.db.batch(stamped(s.churchId, [
        { sql: 'UPDATE setlists SET deleted = 1, seq = SEQ WHERE uid = ? AND church_id = ? AND deleted = 0', params: [c.uid, s.churchId] },
      ]))
      st.activeSetlists = null
      return { ok: true }
    }
    case 'folder':
    case 'folder-delete': {
      const allowed = canApply(s.role, c, null)
      if (allowed !== true) return { ok: false, error: allowed }
      const owner = st.folders.get(c.uid)
      if (owner && owner.church_id !== s.churchId) return { ok: false, error: 'invalid' }
      if (c.kind === 'folder' && !(isStr(c.name, 100) && c.name.trim())) return { ok: false, error: 'invalid' }
      await ctx.db.batch(stamped(s.churchId, [c.kind === 'folder'
        ? { sql: `INSERT INTO folders (uid, church_id, name, deleted, seq) VALUES (?, ?, ?, 0, SEQ)
                  ON CONFLICT(uid) DO UPDATE SET name = excluded.name, deleted = 0, seq = excluded.seq WHERE folders.church_id = excluded.church_id`,
            params: [c.uid, s.churchId, c.name.trim()] }
        : { sql: 'UPDATE folders SET deleted = 1, seq = SEQ WHERE uid = ? AND church_id = ?', params: [c.uid, s.churchId] },
      ]))
      st.folders.set(c.uid, { church_id: s.churchId })
      return { ok: true }
    }
    default:
      return { ok: false, error: 'invalid' }
  }
}

export async function push(ctx: Ctx, s: Session, changes: Change[]): Promise<PushResponse> {
  const list = Array.isArray(changes) ? changes : []
  const church = await ctx.db.first<{ seq: number }>('SELECT seq FROM churches WHERE id = ?', s.churchId)
  if (list.length > MAX_CHANGES_PER_PUSH) {
    return { seq: church!.seq, results: list.map(() => ({ ok: false, error: 'too-many' })) }
  }

  // Preload everything referenced, a few queries total.
  const uidsOf = (kinds: string[]) => list.filter(c => c && kinds.includes(c.kind) && validUid(c.uid)).map(c => c.uid)
  const songUids = [...uidsOf(['song', 'song-delete']),
    ...list.flatMap(c => (c?.kind === 'setlist' && Array.isArray(c.data?.items) ? c.data.items.map(i => i?.song_uid) : []))
      .filter(validUid) as string[]]
  const setlistUids = [...new Set(uidsOf(['setlist', 'setlist-delete']))]
  const folderUids = [...new Set(uidsOf(['folder', 'folder-delete']))]
  const st: PushState = {
    churchSeq: church!.seq,
    songs: await songsByUid(ctx, [...new Set(songUids)]),
    stale: new Set(),
    setlists: new Map(setlistUids.length
      ? (await ctx.db.all<SetlistRow>(`SELECT * FROM setlists WHERE uid IN (${placeholders(setlistUids.length)})`, ...setlistUids)).map(r => [r.uid, r])
      : []),
    folders: new Map(folderUids.length
      ? (await ctx.db.all<{ uid: string; church_id: string }>(`SELECT uid, church_id FROM folders WHERE uid IN (${placeholders(folderUids.length)})`, ...folderUids)).map(r => [r.uid, r])
      : []),
    activeSetlists: null,
  }

  const results: ChangeResult[] = []
  for (const c of list) results.push(await applyChange(ctx, s, c, st))
  const after = await ctx.db.first<{ seq: number }>('SELECT seq FROM churches WHERE id = ?', s.churchId)
  return { seq: after!.seq, results }
}

// ---------- Pull ----------

export async function pull(ctx: Ctx, s: Session, since: number): Promise<PullResponse> {
  const from = Number.isFinite(since) && since > 0 ? since : 0
  // Read the number first: every write commits its row together with its number (one batch),
  // so all rows up to this number are visible below. Rows that land meanwhile come again next time.
  const church = await ctx.db.first<{ seq: number }>('SELECT seq FROM churches WHERE id = ?', s.churchId)
  const songRows = await ctx.db.all<SongRow>('SELECT * FROM songs WHERE church_id = ? AND seq > ? ORDER BY seq', s.churchId, from)
  const folderRows = await ctx.db.all<{ uid: string; name: string; deleted: number; seq: number }>(
    'SELECT uid, name, deleted, seq FROM folders WHERE church_id = ? AND seq > ? ORDER BY seq', s.churchId, from)
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
  const rows = await ctx.db.all<{ id: string; message: string; created_at: string }>(
    `SELECT n.id, n.message, n.created_at FROM notices n
     WHERE n.church_id = ? AND n.target IN (${placeholders(targets.length)})
       AND NOT EXISTS (SELECT 1 FROM json_each(n.delivered) WHERE json_each.value = ?)
     ORDER BY n.created_at LIMIT ${MAX_NOTICES_PER_PULL}`,
    s.churchId, ...targets, s.actor)
  if (rows.length) {
    await ctx.db.run(`UPDATE notices SET delivered = json_insert(delivered, '$[#]', ?) WHERE id IN (${placeholders(rows.length)})`,
      s.actor, ...rows.map(r => r.id))
  }
  return rows.map(r => ({ id: r.id, message: r.message, created_at: r.created_at }))
}
