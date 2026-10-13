import { getDb } from '../db/database'
import { AudioStatus, Cue } from './types'

export interface SongAudio {
  song_id: number
  status: AudioStatus
  error: string | null
  original_hash: string | null
  duration_sec: number | null
  vol_instrumental: number
  vol_vocals: number
  cues: Cue[]
  cues_sections_sig: string | null
}

function deserialize(row: any): SongAudio {
  return { ...row, cues: JSON.parse(row.cues || '[]') }
}

export function getSongAudio(songId: number): SongAudio | null {
  const row = getDb().prepare('SELECT * FROM song_audio WHERE song_id = ?').get(songId)
  return row ? deserialize(row) : null
}

const COLUMNS = ['status', 'error', 'original_hash', 'duration_sec', 'vol_instrumental', 'vol_vocals', 'cues', 'cues_sections_sig'] as const

export function upsertSongAudio(songId: number, patch: Partial<Omit<SongAudio, 'song_id'>>): SongAudio {
  const db = getDb()
  db.prepare('INSERT OR IGNORE INTO song_audio (song_id) VALUES (?)').run(songId)
  const keys = COLUMNS.filter(k => k in patch)
  if (keys.length > 0) {
    const values = keys.map(k => k === 'cues' ? JSON.stringify(patch.cues) : (patch as any)[k])
    db.prepare(`UPDATE song_audio SET ${keys.map(k => `${k} = ?`).join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE song_id = ?`)
      .run(...values, songId)
  }
  return getSongAudio(songId)!
}

/** Jobs cannot survive an app restart: mark them so the operator can retry. */
export function markInterruptedJobs(): void {
  getDb().prepare(
    `UPDATE song_audio SET status = 'failed', error = 'Interrumpida al cerrar la app' WHERE status IN ('pending', 'processing')`
  ).run()
}
