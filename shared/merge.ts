import type { FieldAuthors, FieldVersions, SongField, SongFields } from './types'

export interface Author { id: string; name: string }

export interface Replaced {
  field: SongField
  previousAuthor: Author
  previousValue: unknown
}

const same = (a: unknown, b: unknown) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null)

/**
 * Field-level "last write wins". A field counts as replaced unseen when the writer
 * had not seen its current version, someone else wrote it, and the value changes;
 * that author gets a notice (spec: no change is lost silently).
 */
export function mergeSongFields(
  server: { fields: SongFields; versions: FieldVersions; authors: FieldAuthors },
  change: { fields: Partial<SongFields>; seen: FieldVersions },
  author: Author,
  seq: number
): { fields: SongFields; versions: FieldVersions; authors: FieldAuthors; replaced: Replaced[] } {
  const fields = { ...server.fields }
  const versions = { ...server.versions }
  const authors = { ...server.authors }
  const replaced: Replaced[] = []

  for (const [key, value] of Object.entries(change.fields) as [SongField, unknown][]) {
    const current = versions[key] ?? 0
    const prev = authors[key]
    if (same(fields[key], value)) continue
    if ((change.seen[key] ?? 0) < current && prev && prev.id !== author.id) {
      replaced.push({ field: key, previousAuthor: prev, previousValue: fields[key] })
    }
    ;(fields as Record<string, unknown>)[key] = value
    versions[key] = seq
    authors[key] = author
  }
  return { fields, versions, authors, replaced }
}
