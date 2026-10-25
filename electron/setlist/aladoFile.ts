import path from 'path'

/**
 * `.alado` service files: a versioned JSON snapshot of a setlist with each song's full lyrics,
 * used to move a service between computers. Media never travels in the file — only the video's
 * file name, resolved against userData/videos on import. Pure functions; the IPC handler does
 * the dialogs and the DB transaction.
 */

export const ALADO_FORMAT = 'alado-setlist'
export const ALADO_VERSION = 1

// Same shape as Section in db.handlers.ts / songs.store.ts (processes can't share types at runtime).
export interface Section {
  type: string
  label: string
  lines: string[]
  repeat?: number
}

export interface AladoSong {
  title: string
  artist?: string | null
  sections: Section[]
  text_style: Record<string, unknown>
  video_file: string | null
}

export interface AladoFile {
  format: string
  version: number
  exported_at: string
  setlist: { name: string; service_date: string | null; notes: string | null }
  items: Array<{ position: number; song: AladoSong; custom_video_file: string | null }>
}

export interface LocalSong {
  id: number
  title: string
  artist: string | null
  sections: Section[]
  updated_at: string | null
}

export type ImportStep =
  | { kind: 'existing'; songId: number; title: string; differs: boolean }
  | { kind: 'create'; song: AladoSong; videoPath: string | null }

/** Last path segment for both Windows and POSIX separators (a file may come from either). */
const fileName = (p?: string | null): string | null => (p ? p.split(/[\\/]/).pop() || null : null)

export function buildAladoFile(
  setlist: AladoFile['setlist'],
  songs: Array<{ title: string; artist?: string | null; sections: Section[]; text_style: object; video_path?: string | null; custom_video?: string | null }>,
  now: Date
): AladoFile {
  return {
    format: ALADO_FORMAT,
    version: ALADO_VERSION,
    exported_at: now.toISOString(),
    setlist,
    items: songs.map((s, position) => ({
      position,
      song: {
        title: s.title,
        artist: s.artist ?? null,
        sections: s.sections,
        text_style: s.text_style as Record<string, unknown>,
        video_file: fileName(s.video_path)
      },
      custom_video_file: fileName(s.custom_video)
    }))
  }
}

const NOT_ALADO = 'El archivo no es un servicio de ALADO.'
const isObj = (v: unknown): v is Record<string, any> => typeof v === 'object' && v !== null && !Array.isArray(v)

function assertSections(v: unknown, title: string): asserts v is Section[] {
  const ok = Array.isArray(v) && v.every(s =>
    isObj(s) && typeof s.label === 'string' && Array.isArray(s.lines) && s.lines.every((l: unknown) => typeof l === 'string'))
  if (!ok) throw new Error(`El archivo está dañado: la letra de "${title}" no es válida.`)
}

/** Validates a `.alado` file's text. Throws an Error with a user-facing Spanish message. */
export function parseAladoFile(text: string): AladoFile {
  let data: unknown
  try { data = JSON.parse(text) } catch { throw new Error(NOT_ALADO) }
  if (!isObj(data) || data.format !== ALADO_FORMAT || typeof data.version !== 'number') throw new Error(NOT_ALADO)
  if (data.version > ALADO_VERSION) {
    throw new Error('El servicio se exportó con una versión más nueva de ALADO. Actualiza la app para importarlo.')
  }
  if (!isObj(data.setlist) || typeof data.setlist.name !== 'string' || !Array.isArray(data.items)) {
    throw new Error('El archivo está dañado: faltan los datos del servicio.')
  }
  data.items.forEach((item: unknown, i: number) => {
    if (!isObj(item) || !isObj(item.song) || typeof item.song.title !== 'string' || !item.song.title.trim()) {
      throw new Error(`El archivo está dañado: la canción ${i + 1} no tiene título.`)
    }
    assertSections(item.song.sections, item.song.title)
  })
  return data as AladoFile
}

/** Title key for matching: no accents, case or extra whitespace. */
export function normalizeTitle(t: string): string {
  return t.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().replace(/\s+/g, ' ').trim()
}

/** Local song with the same title; on ties prefer the same artist, then the most recently edited. */
export function pickMatch(song: AladoSong, local: LocalSong[]): LocalSong | null {
  const key = normalizeTitle(song.title)
  const same = local.filter(l => normalizeTitle(l.title) === key)
  if (same.length === 0) return null
  const artist = song.artist ? normalizeTitle(song.artist) : ''
  const byArtist = artist ? same.filter(l => l.artist && normalizeTitle(l.artist) === artist) : []
  const pool = byArtist.length > 0 ? byArtist : same
  return pool.reduce((best, l) => ((l.updated_at ?? '') > (best.updated_at ?? '') ? l : best))
}

export function sectionsDiffer(a: Section[], b: Section[]): boolean {
  if (a.length !== b.length) return true
  return a.some((s, i) => {
    const o = b[i]
    return s.label !== o.label || s.type !== o.type || (s.repeat ?? 1) !== (o.repeat ?? 1)
      || s.lines.length !== o.lines.length || s.lines.some((l, j) => l !== o.lines[j])
  })
}

/** Decides, per item, whether to reuse a local song (never modified) or create it. */
export function planImport(file: AladoFile, local: LocalSong[], videosDir: string, videoNames: Set<string>): ImportStep[] {
  return file.items.map(({ song }) => {
    const match = pickMatch(song, local)
    if (match) return { kind: 'existing', songId: match.id, title: match.title, differs: sectionsDiffer(match.sections, song.sections) }
    const videoPath = song.video_file && videoNames.has(song.video_file) ? path.join(videosDir, song.video_file) : null
    return { kind: 'create', song, videoPath }
  })
}
