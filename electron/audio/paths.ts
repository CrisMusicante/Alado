import { app } from 'electron'
import fs from 'fs'
import path from 'path'

export const stemsRoot = (): string => path.join(app.getPath('userData'), 'stems')
export const stemsDir = (songId: number): string => path.join(stemsRoot(), String(songId))

export function findStem(songId: number, stem: 'instrumental' | 'vocals'): string | null {
  for (const ext of ['wav', 'flac']) {
    const p = path.join(stemsDir(songId), `${stem}.${ext}`)
    if (fs.existsSync(p)) return p
  }
  return null
}

export function findOriginal(songId: number): string | null {
  const dir = stemsDir(songId)
  if (!fs.existsSync(dir)) return null
  const f = fs.readdirSync(dir).find(n => n.startsWith('original.'))
  return f ? path.join(dir, f) : null
}
