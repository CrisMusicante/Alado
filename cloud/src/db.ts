/** The slice of D1 the cloud logic uses; tests implement it over node:sqlite. */
export interface Db {
  all<T = Record<string, unknown>>(sql: string, ...params: unknown[]): Promise<T[]>
  first<T = Record<string, unknown>>(sql: string, ...params: unknown[]): Promise<T | null>
  run(sql: string, ...params: unknown[]): Promise<{ changes: number }>
  /** Runs all statements atomically (one transaction); rows changed by each. */
  batch(stmts: { sql: string; params: unknown[] }[]): Promise<{ changes: number }[]>
}

/** The parts of D1Database used here (declared locally so the desktop's tsc, which sees this file through tests, needs no Workers types). */
interface D1Like {
  prepare(sql: string): {
    bind(...params: unknown[]): {
      all<T>(): Promise<{ results: T[] }>
      first<T>(): Promise<T | null>
      run(): Promise<{ meta: { changes?: number } }>
    }
  }
  batch(stmts: unknown[]): Promise<{ meta: { changes?: number } }[]>
}

export function d1Db(d1: D1Like): Db {
  return {
    async all<T>(sql: string, ...params: unknown[]) {
      return (await d1.prepare(sql).bind(...params).all<T>()).results
    },
    async first<T>(sql: string, ...params: unknown[]) {
      return (await d1.prepare(sql).bind(...params).first<T>()) ?? null
    },
    async run(sql: string, ...params: unknown[]) {
      const r = await d1.prepare(sql).bind(...params).run()
      return { changes: r.meta.changes ?? 0 }
    },
    async batch(stmts) {
      const results = await d1.batch(stmts.map(s => d1.prepare(s.sql).bind(...s.params)))
      return results.map((r: { meta: { changes?: number } }) => ({ changes: r.meta.changes ?? 0 }))
    },
  }
}
