import type { Db } from './db'

/** What every cloud operation needs: the database and a clock (injectable in tests). */
export interface Ctx {
  db: Db
  now: () => number
}

export type Fail = { ok: false; status: number; error: string }
export type Result<T extends object = object> = ({ ok: true } & T) | Fail

export const fail = (status: number, error: string): Fail => ({ ok: false, status, error })

export const iso = (ms: number) => new Date(ms).toISOString()
