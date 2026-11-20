import fs from 'fs'
import path from 'path'
import type { PullResponse, SetlistData, SongFields } from '../../shared/types'
import { normalizeTitle } from '../setlist/aladoFile'
import { inTransaction, type LocalDb } from './localDb'
import { readLocal } from './localView'
import { writeSnapshot } from './applyRemote'

export interface LinkSummary {
  /** Local songs now tied to their cloud copy. */
  adopted: number
  /** Same title, different lyrics or key: the cloud version won. Every adopted song's local version is in `backupFile`. */
  replaced: { title: string }[]
  backupFile: string | null
  /** Songs only on this computer: they go up on the next sync. */
  uploaded: number
}

const same = (a: unknown, b: unknown) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null)

/**
 * Linking a computer that already has data to a church that already has a catalog: each local
 * song, service and folder with a cloud twin (same normalized title / name+date / name) takes the
 * twin's uid and a snapshot of its local state, so the following applyRemote makes the cloud win.
 * Local songs whose lyrics or key differ are written to a backup file first. Run once, before the
 * first applyRemote, on a computer that has never synced.
 */
export function adoptOnLink(db: LocalDb, pulled: PullResponse, opts: { backupDir: string; now: () => Date }): LinkSummary {
  if (db.prepare('SELECT 1 FROM sync_snapshot LIMIT 1').get()) {
    throw new Error('Esta compu ya estuvo sincronizada; no se puede volver a empatar su catálogo.')
  }
  const local = readLocal(db)
  const summary: LinkSummary = { adopted: 0, replaced: [], backupFile: null, uploaded: 0 }

  // 1) Decide every match first (nothing written yet).
  const songMatches: { localUid: string; remoteUid: string; fields: SongFields }[] = []
  const takenSongs = new Set<string>()
  for (const remote of pulled.songs.filter(s => !s.deleted)) {
    const key = normalizeTitle(remote.fields.title)
    if (!key) continue
    const candidates = [...local.songs].filter(([uid, f]) => !takenSongs.has(uid) && normalizeTitle(f.title) === key)
    // Several local songs with that title: prefer the same artist.
    const match = candidates.find(([, f]) => normalizeTitle(f.artist ?? '') === normalizeTitle(remote.fields.artist ?? '')) ?? candidates[0]
    if (!match) continue
    takenSongs.add(match[0])
    songMatches.push({ localUid: match[0], remoteUid: remote.uid, fields: match[1] })
    if (!same(match[1].sections, remote.fields.sections) || !same(match[1].song_key, remote.fields.song_key)) {
      summary.replaced.push({ title: match[1].title })
    }
  }
  summary.adopted = songMatches.length
  summary.uploaded = [...local.songs.keys()].filter(uid => !takenSongs.has(uid)).length

  const setlistMatches: [string, string, SetlistData][] = []
  const takenSetlists = new Set<string>()
  for (const remote of pulled.setlists.filter(s => !s.deleted)) {
    const match = [...local.setlists].find(([uid, l]) => !takenSetlists.has(uid) && normalizeTitle(l.name) !== '' &&
      normalizeTitle(l.name) === normalizeTitle(remote.name) && (l.service_date ?? null) === (remote.service_date ?? null))
    if (!match) continue
    takenSetlists.add(match[0])
    setlistMatches.push([match[0], remote.uid, match[1]])
  }
  const folderMatches: [string, string, string][] = []
  const takenFolders = new Set<string>()
  for (const remote of pulled.folders.filter(f => !f.deleted)) {
    const match = [...local.folders].find(([uid, name]) => !takenFolders.has(uid) && normalizeTitle(name) !== '' && normalizeTitle(name) === normalizeTitle(remote.name))
    if (!match) continue
    takenFolders.add(match[0])
    folderMatches.push([match[0], remote.uid, match[1]])
  }

  // 2) Back up every song about to take the cloud's version — before touching the DB.
  if (songMatches.length) {
    fs.mkdirSync(opts.backupDir, { recursive: true })
    const stamp = opts.now().toISOString().slice(0, 10)
    for (let n = 1; ; n++) {
      const file = path.join(opts.backupDir, n === 1 ? `vinculacion-${stamp}.json` : `vinculacion-${stamp}-${n}.json`)
      try {
        fs.writeFileSync(file, JSON.stringify({
          note: 'Canciones de esta compu como estaban antes de vincularla; la versión de la nube las reemplazó.',
          songs: songMatches.map(m => m.fields),
        }, null, 2), { flag: 'wx' })
        summary.backupFile = file
        break
      } catch (e) {
        if ((e as NodeJS.ErrnoException).code !== 'EEXIST') throw e
      }
    }
  }

  // 3) Adopt: each matched row takes the cloud's uid and a snapshot of its local state, so the
  //    following applyRemote makes the cloud version win.
  inTransaction(db, () => {
    for (const m of songMatches) db.prepare('UPDATE songs SET uid = ? WHERE uid = ?').run(m.remoteUid, m.localUid)
    for (const [localUid, remoteUid] of setlistMatches) db.prepare('UPDATE setlists SET uid = ? WHERE uid = ?').run(remoteUid, localUid)
    for (const [localUid, remoteUid] of folderMatches) db.prepare('UPDATE folders SET uid = ? WHERE uid = ?').run(remoteUid, localUid)
    // Snapshots from the state after every rewrite (services and songs point at the new uids).
    const now = readLocal(db)
    for (const m of songMatches) writeSnapshot(db, 'song', m.remoteUid, now.songs.get(m.remoteUid), {}, 0)
    for (const [, remoteUid] of setlistMatches) writeSnapshot(db, 'setlist', remoteUid, now.setlists.get(remoteUid), {}, 0)
    for (const [, remoteUid] of folderMatches) writeSnapshot(db, 'folder', remoteUid, now.folders.get(remoteUid), {}, 0)
  })
  return summary
}
