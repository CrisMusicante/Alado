import { zipSync, unzipSync, strToU8, strFromU8, Zippable } from 'fflate'
import { Cue } from './types'

export const PACK_VERSION = 1

export interface PackManifest {
  packVersion: number
  kind: 'song'
  appVersion: string
  id: string
}

export interface PackSong {
  title: string
  artist?: string
  sections: unknown[]
  text_style: Record<string, unknown>
  cues: Cue[]
  cues_sections_sig: string | null
  vol_instrumental: number
  vol_vocals: number
  video?: string
}

export interface PackContents {
  manifest: PackManifest
  song: PackSong
  files: Record<string, Uint8Array>
}

const AUDIO_ENTRY = /^audio\/(instrumental|vocals)\.(flac|wav)$/
const VIDEO_ENTRY = /^video\/[^/\\]+\.(mp4|webm|mov)$/i

export function isAllowedEntry(name: string): boolean {
  if (name.includes('\\') || name.includes('..') || name.startsWith('/') || /^[a-zA-Z]:/.test(name)) return false
  return name === 'manifest.json' || name === 'song.json' || AUDIO_ENTRY.test(name) || VIDEO_ENTRY.test(name)
}

export function buildPack(contents: PackContents): Uint8Array {
  const entries: Zippable = {
    'manifest.json': strToU8(JSON.stringify(contents.manifest, null, 2)),
    'song.json': strToU8(JSON.stringify(contents.song, null, 2))
  }
  for (const [name, data] of Object.entries(contents.files)) {
    if (!isAllowedEntry(name)) throw new Error(`Archivo no permitido en el paquete: ${name}`)
    entries[name] = [data, { level: 0 }] // audio/video are already compressed
  }
  return zipSync(entries)
}

export function parsePack(data: Uint8Array): PackContents {
  let raw: Record<string, Uint8Array>
  try {
    raw = unzipSync(data)
  } catch {
    throw new Error('El archivo no es un paquete .wfpack válido')
  }
  for (const name of Object.keys(raw)) {
    if (name.endsWith('/')) continue // directory entries
    if (!isAllowedEntry(name)) throw new Error(`Archivo no permitido en el paquete: ${name}`)
  }

  const manifest = readJson(raw, 'manifest.json') as PackManifest
  if (manifest.packVersion !== PACK_VERSION) {
    throw new Error(`Este paquete usa la versión ${manifest.packVersion} del formato; esta app solo entiende la versión ${PACK_VERSION}. Actualiza ALADO.`)
  }
  if (manifest.kind !== 'song') throw new Error(`Tipo de paquete no soportado: ${manifest.kind}`)

  const song = readJson(raw, 'song.json') as PackSong
  if (typeof song.title !== 'string' || !song.title.trim()) throw new Error('El paquete no tiene título de canción')
  if (!Array.isArray(song.sections)) throw new Error('El paquete no tiene secciones válidas')

  const files: Record<string, Uint8Array> = {}
  for (const [name, bytes] of Object.entries(raw)) {
    if (name.startsWith('audio/') || name.startsWith('video/')) files[name] = bytes
  }
  for (const stem of ['instrumental', 'vocals']) {
    if (!Object.keys(files).some(n => n.startsWith(`audio/${stem}.`))) throw new Error(`Al paquete le falta la pista ${stem}`)
  }
  return { manifest, song: { ...song, cues: Array.isArray(song.cues) ? song.cues : [] }, files }
}

function readJson(raw: Record<string, Uint8Array>, name: string): unknown {
  if (!raw[name]) throw new Error(`Al paquete le falta ${name}`)
  try {
    return JSON.parse(strFromU8(raw[name]))
  } catch {
    throw new Error(`${name} está dañado`)
  }
}
