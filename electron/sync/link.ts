import fs from 'fs'
import path from 'path'
import type { PullResponse } from '../../shared/types'
import { normalizeTitle } from '../setlist/aladoFile'
import { inTransaction, type LocalDb } from './localDb'
import { readLocal } from './localView'
import { writeSnapshot } from './applyRemote'

export interface LinkSummary {
  /** Local songs now tied to their cloud copy. */
  adopted: number
  /** Same title, different lyrics or key: the cloud version won; the local one is in `backupFile`. */
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
  const local = readLocal(db)
  const summary: LinkSummary = { adopted: 0, replaced: [], backupFile: null, uploaded: 0 }
  const backup: unknown[] = []

  inTransaction(db, () => {
    const takenSongs = new Set<string>()
    for (const remote of pulled.songs.filter(s => !s.deleted)) {
      const key = normalizeTitle(remote.fields.title)
      const match = [...local.songs].find(([uid, f]) => !takenSongs.has(uid) && normalizeTitle(f.title) === key)
      if (!match) continue
      const [localUid, fields] = match
      takenSongs.add(localUid)
      if (!same(fields.sections, remote.fields.sections) || !same(fields.song_key, remote.fields.song_key)) {
        summary.replaced.push({ title: fields.title })
        backup.push(fields)
      }
      db.prepare('UPDATE songs SET uid = ? WHERE uid = ?').run(remote.uid, localUid)
      writeSnapshot(db, 'song', remote.uid, fields, {}, 0)
      summary.adopted++
    }
    summary.uploaded = [...local.songs.keys()].filter(uid => !takenSongs.has(uid)).length

    const takenSetlists = new Set<string>()
    for (const remote of pulled.setlists.filter(s => !s.deleted)) {
      const match = [...local.setlists].find(([uid, l]) => !takenSetlists.has(uid) &&
        normalizeTitle(l.name) === normalizeTitle(remote.name) && (l.service_date ?? null) === (remote.service_date ?? null))
      if (!match) continue
      takenSetlists.add(match[0])
      db.prepare('UPDATE setlists SET uid = ? WHERE uid = ?').run(remote.uid, match[0])
      writeSnapshot(db, 'setlist', remote.uid, match[1], {}, 0)
    }

    const takenFolders = new Set<string>()
    for (const remote of pulled.folders.filter(f => !f.deleted)) {
      const match = [...local.folders].find(([uid, name]) => !takenFolders.has(uid) && normalizeTitle(name) === normalizeTitle(remote.name))
      if (!match) continue
      takenFolders.add(match[0])
      db.prepare('UPDATE folders SET uid = ? WHERE uid = ?').run(remote.uid, match[0])
      writeSnapshot(db, 'folder', remote.uid, match[1], {}, 0)
    }
  })

  if (backup.length) {
    fs.mkdirSync(opts.backupDir, { recursive: true })
    const file = path.join(opts.backupDir, `vinculacion-${opts.now().toISOString().slice(0, 10)}.json`)
    fs.writeFileSync(file, JSON.stringify({ note: 'Canciones de esta compu reemplazadas por la versión de la nube al vincular.', songs: backup }, null, 2))
    summary.backupFile = file
  }
  return summary
}
