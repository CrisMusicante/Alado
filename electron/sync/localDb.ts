/**
 * The slice of a SQLite handle the sync code uses. Both better-sqlite3 (the app) and
 * node:sqlite's DatabaseSync (tests) satisfy it, so sync logic is tested without Electron.
 */
export interface LocalDb {
  prepare(sql: string): {
    all(...params: unknown[]): unknown[]
    get(...params: unknown[]): unknown
    run(...params: unknown[]): { changes: number | bigint; lastInsertRowid: number | bigint }
  }
  exec(sql: string): unknown
}

export function inTransaction<T>(db: LocalDb, fn: () => T): T {
  db.exec('BEGIN')
  try {
    const out = fn()
    db.exec('COMMIT')
    return out
  } catch (e) {
    db.exec('ROLLBACK')
    throw e
  }
}
