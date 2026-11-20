import { describe, it, expect, beforeEach } from 'vitest'
import fs from 'fs'
import os from 'os'
import path from 'path'
import { desktopDb, one, addSong } from './testDb'
import { adoptOnLink } from './link'
import { applyRemote } from './applyRemote'
import type { LocalDb } from './localDb'
import { EMPTY_SONG, type PullResponse, type SongFields } from '../../shared/types'

let db: LocalDb
let backupDir: string
const sections = (line: string) => JSON.stringify([{ type: 'verse', label: 'Verso', lines: [line] }])
const remote = (uid: string, f: Partial<SongFields>) => ({ uid, deleted: false, seq: 3, fields: { ...EMPTY_SONG, ...f }, versions: {} })
const pulled = (p: Partial<PullResponse>): PullResponse => ({ seq: 10, songs: [], folders: [], setlists: [], notices: [], ...p })

beforeEach(() => {
  db = desktopDb()
  backupDir = fs.mkdtempSync(path.join(os.tmpdir(), 'alado-link-'))
})

describe('adoptOnLink', () => {
  it('link: same title same lyrics adopts the cloud uid', () => {
    addSong(db, 'Tu Fidelidad ', { sections: sections('Grande es'), song_key: 'E' })
    const p = pulled({ songs: [remote('cloud-1', { title: 'tu fidelidad', sections: [{ type: 'verse', label: 'Verso', lines: ['Grande es'] }], song_key: 'E' })] })
    const r = adoptOnLink(db, p, { backupDir, now: () => new Date('2026-11-22T10:00:00Z') })
    expect(one(db, 'SELECT uid FROM songs')).toEqual({ uid: 'cloud-1' })
    expect(r).toMatchObject({ adopted: 1, replaced: [], uploaded: 0 })
  })

  it('link: same title different lyrics → cloud wins and local copy is backed up', () => {
    addSong(db, 'Tu fidelidad', { sections: sections('Letra vieja'), song_key: 'D' })
    addSong(db, 'Solo aquí')
    const p = pulled({ songs: [remote('cloud-1', { title: 'Tu fidelidad', sections: [{ type: 'verse', label: 'Verso', lines: ['Letra nueva'] }], song_key: 'E' })] })
    const r = adoptOnLink(db, p, { backupDir, now: () => new Date('2026-11-22T10:00:00Z') })
    applyRemote(db, p, { videosDir: backupDir })
    expect(one<{ sections: string; song_key: string }>(db, "SELECT sections, song_key FROM songs WHERE uid = 'cloud-1'"))
      .toEqual({ sections: JSON.stringify([{ type: 'verse', label: 'Verso', lines: ['Letra nueva'] }]), song_key: 'E' })
    expect(r.replaced.map(x => x.title)).toEqual(['Tu fidelidad'])
    expect(r.uploaded).toBe(1)
    const backup = JSON.parse(fs.readFileSync(r.backupFile!, 'utf8'))
    expect(backup.songs[0]).toMatchObject({ title: 'Tu fidelidad', song_key: 'D' })
    expect(path.basename(r.backupFile!)).toBe('vinculacion-2026-11-22.json')
  })

  it('services with the same name and date and folders with the same name are adopted', () => {
    db.prepare("INSERT INTO setlists (name, service_date) VALUES ('Domingo', '2026-11-22')").run()
    db.prepare("INSERT INTO folders (name) VALUES ('Adoración')").run()
    adoptOnLink(db, pulled({
      setlists: [{ uid: 's-cloud', deleted: false, seq: 1, name: 'Domingo', service_date: '2026-11-22', notes: null, items: [] }],
      folders: [{ uid: 'f-cloud', name: 'adoración', deleted: false, seq: 1 }],
    }), { backupDir, now: () => new Date() })
    expect(one(db, 'SELECT uid FROM setlists')).toEqual({ uid: 's-cloud' })
    expect(one(db, 'SELECT uid FROM folders')).toEqual({ uid: 'f-cloud' })
  })
})

describe('adoptOnLink safety', () => {
  it('backs up every adopted song before adopting, with a unique file name', () => {
    addSong(db, 'Uno', { sections: sections('a') })
    const p = pulled({ songs: [remote('c1', { title: 'Uno', sections: [{ type: 'verse', label: 'Verso', lines: ['a'] }] })] })
    const a = adoptOnLink(db, p, { backupDir, now: () => new Date('2026-11-22T10:00:00Z') })
    const db2 = desktopDb()
    addSong(db2, 'Uno')
    const b = adoptOnLink(db2, p, { backupDir, now: () => new Date('2026-11-22T10:00:00Z') })
    expect(a.backupFile).not.toBe(b.backupFile)
    expect(JSON.parse(fs.readFileSync(a.backupFile!, 'utf8')).songs).toHaveLength(1)
  })

  it('titles that normalize to nothing never match', () => {
    addSong(db, '   ')
    adoptOnLink(db, pulled({ songs: [remote('c1', { title: ' ' })] }), { backupDir, now: () => new Date() })
    expect(one<{ uid: string }>(db, 'SELECT uid FROM songs').uid).not.toBe('c1')
  })

  it('refuses to run on a computer that already synced', () => {
    addSong(db, 'Uno')
    db.prepare("INSERT INTO sync_snapshot (kind, uid, data) VALUES ('song', 'x', '{}')").run()
    expect(() => adoptOnLink(db, pulled({}), { backupDir, now: () => new Date() })).toThrow()
  })
})
