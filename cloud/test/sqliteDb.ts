import { DatabaseSync } from 'node:sqlite'
import fs from 'fs'
import path from 'path'
import type { Db } from '../src/db'

const MIGRATIONS = path.join(__dirname, '..', 'migrations')

/** An in-memory Db with every migration applied — a stand-in for D1 in tests. */
export function sqliteDb(): Db & { raw: DatabaseSync } {
  const raw = new DatabaseSync(':memory:')
  for (const f of fs.readdirSync(MIGRATIONS).filter(f => f.endsWith('.sql')).sort()) {
    raw.exec(fs.readFileSync(path.join(MIGRATIONS, f), 'utf8'))
  }
  const plain = <T>(row: unknown) => (row ? { ...(row as object) } as T : null)
  const args = (params: unknown[]) => params.map(p => (p === undefined ? null : typeof p === 'boolean' ? Number(p) : p)) as never[]
  return {
    raw,
    async all<T>(sql: string, ...params: unknown[]) {
      return raw.prepare(sql).all(...args(params)).map(r => plain<T>(r)!)
    },
    async first<T>(sql: string, ...params: unknown[]) {
      return plain<T>(raw.prepare(sql).get(...args(params)))
    },
    async run(sql: string, ...params: unknown[]) {
      const r = raw.prepare(sql).run(...args(params))
      return { changes: Number(r.changes) }
    },
    async batch(stmts) {
      raw.exec('BEGIN')
      try {
        for (const s of stmts) raw.prepare(s.sql).run(...args(s.params))
        raw.exec('COMMIT')
      } catch (e) {
        raw.exec('ROLLBACK')
        throw e
      }
    },
  }
}
