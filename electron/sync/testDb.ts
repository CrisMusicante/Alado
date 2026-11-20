// Test helper: an in-memory desktop DB (schema v5 + migrateV6) over node:sqlite.
import { DatabaseSync } from 'node:sqlite'
import { SCHEMA_V5_FOR_TESTS } from '../db/schemaSql'
import { migrateV6 } from './schema'
import type { LocalDb } from './localDb'

export function desktopDb(): LocalDb {
  const raw = new DatabaseSync(':memory:')
  raw.exec('PRAGMA foreign_keys = ON')
  raw.exec(SCHEMA_V5_FOR_TESTS)
  const db = raw as unknown as LocalDb
  migrateV6(db)
  return db
}

export const one = <T>(db: LocalDb, sql: string, ...p: unknown[]) => db.prepare(sql).get(...p) as T
export const many = <T>(db: LocalDb, sql: string, ...p: unknown[]) => db.prepare(sql).all(...p) as T[]

export function addSong(db: LocalDb, title: string, extra: Record<string, unknown> = {}): { id: number; uid: string } {
  const cols = ['title', ...Object.keys(extra)]
  const r = db.prepare(`INSERT INTO songs (${cols.join(', ')}) VALUES (${cols.map(() => '?').join(', ')})`)
    .run(title, ...Object.values(extra))
  const id = Number(r.lastInsertRowid)
  return { id, uid: one<{ uid: string }>(db, 'SELECT uid FROM songs WHERE id = ?', id).uid }
}
