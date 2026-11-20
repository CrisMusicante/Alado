import { describe, it, expect, beforeEach } from 'vitest'
import path from 'path'
import { desktopDb, one, many, addSong } from './testDb'
import { applyRemote, writeSnapshot } from './applyRemote'
import { readLocal } from './localView'
import type { LocalDb } from './localDb'
import { EMPTY_SONG, type PullResponse, type SyncSong, type SongFields } from '../../shared/types'

const VIDEOS = path.join('C:', 'alado', 'videos')
let db: LocalDb

const pulled = (p: Partial<PullResponse>): PullResponse => ({ seq: 10, songs: [], folders: [], setlists: [], notices: [], ...p })
const remoteSong = (uid: string, fields: Partial<SongFields>, seq = 5): SyncSong =>
  ({ uid, deleted: false, seq, fields: { ...EMPTY_SONG, ...fields }, versions: { title: seq } })

beforeEach(() => { db = desktopDb() })

describe('applyRemote', () => {
  it('incoming song is inserted with video path in videosDir', () => {
    applyRemote(db, pulled({ songs: [remoteSong('r1', { title: 'Tu fidelidad', song_key: 'E', video_file: 'Fondo 07.mp4',
      sections: [{ type: 'chorus', label: 'Coro', lines: ['Grande es'] }] })] }), { videosDir: VIDEOS })
    const row = one<{ title: string; song_key: string; video_path: string; sections: string; uid: string }>(db, 'SELECT * FROM songs')
    expect(row).toMatchObject({ title: 'Tu fidelidad', song_key: 'E', video_path: path.join(VIDEOS, 'Fondo 07.mp4'), uid: 'r1' })
    expect(JSON.parse(row.sections)[0].label).toBe('Coro')
    // snapshot = cloud state, so nothing is pending to push
    expect(readLocal(db).songs.get('r1')).toMatchObject({ title: 'Tu fidelidad', video_file: 'Fondo 07.mp4' })
    expect(one<{ seq: number }>(db, "SELECT seq FROM sync_snapshot WHERE kind = 'song' AND uid = 'r1'").seq).toBe(5)
  })

  it('incoming change keeps a locally edited field and replaces the rest', () => {
    const { uid } = addSong(db, 'Tu fidelidad', { song_key: 'E', artist: 'X' })
    writeSnapshot(db, 'song', uid, readLocal(db).songs.get(uid)!, {}, 3)
    db.prepare('UPDATE songs SET song_key = ? WHERE uid = ?').run('G', uid) // local edit, not yet pushed
    const r = applyRemote(db, pulled({ songs: [remoteSong(uid, { title: 'Grande es tu fidelidad', song_key: 'F', artist: 'X' }, 7)] }), { videosDir: VIDEOS })
    expect(one(db, 'SELECT title, song_key FROM songs WHERE uid = ?', uid)).toEqual({ title: 'Grande es tu fidelidad', song_key: 'G' })
    expect(r.keptLocal).toEqual(['Grande es tu fidelidad'])
  })

  it('a video outside videosDir with the same file name keeps its local path', () => {
    const { uid } = addSong(db, 'Uno', { video_path: 'D:\\otros\\fondo.mp4' })
    writeSnapshot(db, 'song', uid, readLocal(db).songs.get(uid)!, {}, 1)
    applyRemote(db, pulled({ songs: [remoteSong(uid, { title: 'Uno', video_file: 'fondo.mp4', song_key: 'A' })] }), { videosDir: VIDEOS })
    expect(one<{ video_path: string }>(db, 'SELECT video_path FROM songs WHERE uid = ?', uid).video_path).toBe('D:\\otros\\fondo.mp4')
  })

  it('incoming setlist maps song uids to local ids in order', () => {
    applyRemote(db, pulled({
      songs: [remoteSong('a', { title: 'A' }), remoteSong('b', { title: 'B' })],
      setlists: [{ uid: 's1', deleted: false, seq: 6, name: 'Domingo', service_date: '2026-11-22', notes: null,
        items: [{ song_uid: 'b', custom_video_file: 'otro.mp4' }, { song_uid: 'a', custom_video_file: null }] }],
    }), { videosDir: VIDEOS })
    expect(many(db, `SELECT s.title, si.position, si.custom_video FROM setlist_items si JOIN songs s ON s.id = si.song_id ORDER BY si.position`))
      .toEqual([{ title: 'B', position: 0, custom_video: path.join(VIDEOS, 'otro.mp4') }, { title: 'A', position: 1, custom_video: null }])
    expect(one(db, 'SELECT name, service_date, uid FROM setlists')).toEqual({ name: 'Domingo', service_date: '2026-11-22', uid: 's1' })
  })

  it('folders arrive first so songs land in them', () => {
    applyRemote(db, pulled({
      folders: [{ uid: 'f1', name: 'Adoración', deleted: false, seq: 2 }],
      songs: [remoteSong('a', { title: 'A', folder_uid: 'f1' })],
    }), { videosDir: VIDEOS })
    expect(one(db, 'SELECT f.name FROM songs s JOIN folders f ON f.id = s.folder_id')).toEqual({ name: 'Adoración' })
  })

  it('remote delete of a song used by a local setlist keeps it and clears its snapshot', () => {
    applyRemote(db, pulled({ songs: [remoteSong('a', { title: 'A' })],
      setlists: [{ uid: 's1', deleted: false, seq: 6, name: 'D', service_date: null, notes: null, items: [{ song_uid: 'a', custom_video_file: null }] }] }),
      { videosDir: VIDEOS })
    applyRemote(db, pulled({ songs: [{ ...remoteSong('a', { title: 'A' }), deleted: true }] }), { videosDir: VIDEOS })
    expect(one(db, 'SELECT title FROM songs')).toEqual({ title: 'A' })
    expect(one(db, "SELECT COUNT(*) AS n FROM sync_snapshot WHERE kind = 'song'")).toEqual({ n: 0 })
  })

  it('remote deletes remove unused songs, setlists and folders', () => {
    applyRemote(db, pulled({ folders: [{ uid: 'f1', name: 'F', deleted: false, seq: 1 }], songs: [remoteSong('a', { title: 'A', folder_uid: 'f1' })],
      setlists: [{ uid: 's1', deleted: false, seq: 6, name: 'D', service_date: null, notes: null, items: [] }] }), { videosDir: VIDEOS })
    applyRemote(db, pulled({
      setlists: [{ uid: 's1', deleted: true, seq: 7, name: 'D', service_date: null, notes: null, items: [] }],
      songs: [{ ...remoteSong('a', { title: 'A' }), deleted: true }],
      folders: [{ uid: 'f1', name: 'F', deleted: true, seq: 8 }],
    }), { videosDir: VIDEOS })
    expect(one(db, 'SELECT (SELECT COUNT(*) FROM songs) AS s, (SELECT COUNT(*) FROM setlists) AS l, (SELECT COUNT(*) FROM folders) AS f'))
      .toEqual({ s: 0, l: 0, f: 0 })
  })

  it('a locally edited setlist is kept when the cloud changes it too', () => {
    applyRemote(db, pulled({ songs: [remoteSong('a', { title: 'A' })],
      setlists: [{ uid: 's1', deleted: false, seq: 6, name: 'Domingo', service_date: null, notes: null, items: [] }] }), { videosDir: VIDEOS })
    db.prepare("UPDATE setlists SET name = 'Domingo local' WHERE uid = 's1'").run()
    applyRemote(db, pulled({ setlists: [{ uid: 's1', deleted: false, seq: 9, name: 'Domingo nube', service_date: null, notes: null, items: [] }] }), { videosDir: VIDEOS })
    expect(one(db, 'SELECT name FROM setlists')).toEqual({ name: 'Domingo local' })
  })
})

describe('applyRemote never trusts names or drops local work', () => {
  it('a video name with a path is ignored', () => {
    applyRemote(db, pulled({ songs: [remoteSong('a', { title: 'A', video_file: '..\..\Windows\evil.mp4' }), remoteSong('b', { title: 'B', video_file: '../x.mp4' }),
      remoteSong('c', { title: 'C', video_file: '.hidden.mp4' })] }), { videosDir: VIDEOS })
    expect(many(db, 'SELECT video_path FROM songs')).toEqual([{ video_path: null }, { video_path: null }, { video_path: null }])
  })

  it('a remote delete keeps a song edited here and not yet uploaded', () => {
    applyRemote(db, pulled({ songs: [remoteSong('a', { title: 'A' })] }), { videosDir: VIDEOS })
    db.prepare("UPDATE songs SET song_key = 'G' WHERE uid = 'a'").run()
    applyRemote(db, pulled({ songs: [{ ...remoteSong('a', { title: 'A' }), deleted: true }] }), { videosDir: VIDEOS })
    expect(one(db, 'SELECT song_key FROM songs')).toEqual({ song_key: 'G' })
  })
})
