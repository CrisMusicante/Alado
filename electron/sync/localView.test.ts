import { describe, it, expect, beforeEach } from 'vitest'
import { DatabaseSync } from 'node:sqlite'
import { SCHEMA_V5_FOR_TESTS } from '../db/schemaSql'
import { migrateV6 } from './schema'
import { readLocal } from './localView'
import type { LocalDb } from './localDb'

let db: LocalDb
beforeEach(() => {
  const raw = new DatabaseSync(':memory:')
  raw.exec(SCHEMA_V5_FOR_TESTS)
  db = raw as unknown as LocalDb
})

const uidOf = (table: string, id: number) => (db.prepare(`SELECT uid FROM ${table} WHERE id = ?`).get(id) as { uid: string }).uid

describe('migrateV6', () => {
  it('existing rows get a uid and new inserts get one too', () => {
    db.prepare("INSERT INTO songs (title) VALUES ('Vieja')").run()
    migrateV6(db)
    db.prepare("INSERT INTO songs (title) VALUES ('Nueva')").run()
    db.prepare("INSERT INTO folders (name) VALUES ('Adoración')").run()
    db.prepare("INSERT INTO setlists (name) VALUES ('Domingo')").run()
    expect(uidOf('songs', 1)).toMatch(/^[0-9a-f]{32}$/)
    expect(uidOf('songs', 2)).toMatch(/^[0-9a-f]{32}$/)
    expect(uidOf('songs', 1)).not.toBe(uidOf('songs', 2))
    expect(uidOf('folders', 1)).toMatch(/^[0-9a-f]{32}$/)
    expect(uidOf('setlists', 1)).toMatch(/^[0-9a-f]{32}$/)
  })

  it('migrateV6 is idempotent', () => {
    migrateV6(db)
    db.prepare("INSERT INTO songs (title) VALUES ('Uno')").run()
    const before = uidOf('songs', 1)
    migrateV6(db)
    expect(uidOf('songs', 1)).toBe(before)
  })
})

describe('readLocal', () => {
  beforeEach(() => migrateV6(db))

  it('readLocal maps video_path to file name and folder_id to folder uid', () => {
    db.prepare("INSERT INTO folders (name) VALUES ('Adoración')").run()
    db.prepare(`INSERT INTO songs (title, artist, sections, video_path, text_style, folder_id, song_key, sheet_style)
      VALUES ('Tu fidelidad', '', ?, ?, '{"size":"xl"}', 1, 'E', '{"mode":"auto"}')`)
      .run(JSON.stringify([{ type: 'chorus', label: 'Coro', lines: ['Grande es'] }]), 'C:\\Users\\x\\videos\\Fondo 07.mp4')
    const local = readLocal(db)
    const song = local.songs.get(uidOf('songs', 1))!
    expect(song).toEqual({
      title: 'Tu fidelidad', artist: null, sections: [{ type: 'chorus', label: 'Coro', lines: ['Grande es'] }],
      song_key: 'E', video_file: 'Fondo 07.mp4', text_style: { size: 'xl' }, sheet_style: { mode: 'auto' },
      folder_uid: uidOf('folders', 1),
    })
    expect(local.folders.get(uidOf('folders', 1))).toBe('Adoración')
  })

  it('setlist items keep order and custom video file names', () => {
    db.prepare("INSERT INTO songs (title) VALUES ('A')").run()
    db.prepare("INSERT INTO songs (title) VALUES ('B')").run()
    db.prepare("INSERT INTO setlists (name, service_date, notes) VALUES ('Domingo', '2026-11-22', NULL)").run()
    db.prepare("INSERT INTO setlist_items (setlist_id, song_id, position, custom_video) VALUES (1, 2, 0, '/v/otro.mp4')").run()
    db.prepare("INSERT INTO setlist_items (setlist_id, song_id, position, custom_video) VALUES (1, 1, 1, NULL)").run()
    expect(readLocal(db).setlists.get(uidOf('setlists', 1))).toEqual({
      name: 'Domingo', service_date: '2026-11-22', notes: null,
      items: [
        { song_uid: uidOf('songs', 2), custom_video_file: 'otro.mp4' },
        { song_uid: uidOf('songs', 1), custom_video_file: null },
      ],
    })
  })
})
