import { describe, it, expect } from 'vitest'
import { sqliteDb } from './sqliteDb'

describe('schema', () => {
  it('creates every table', async () => {
    const db = sqliteDb()
    const rows = await db.all<{ name: string }>("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name")
    expect(rows.map(r => r.name)).toEqual([
      'attempts', 'churches', 'devices', 'folders', 'link_codes', 'notices',
      'proposals', 'sessions', 'setlists', 'songs', 'users',
    ])
  })
})
