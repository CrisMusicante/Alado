import { describe, it, expect } from 'vitest'
import { zipSync, strToU8 } from 'fflate'
import { buildPack, parsePack, isAllowedEntry, PACK_VERSION, PackContents } from './pack'

const contents = (): PackContents => ({
  manifest: { packVersion: PACK_VERSION, kind: 'song', appVersion: '1.0.0', id: 'abc' },
  song: {
    title: 'Cuán grande es Él', artist: 'Tradicional', sections: [{ type: 'verse', label: 'Verso 1', lines: ['a'] }],
    text_style: {}, cues: [{ sectionIndex: 0, time: 1.5 }], cues_sections_sig: '1:verse', vol_instrumental: 1, vol_vocals: 0
  },
  files: {
    'audio/instrumental.flac': new Uint8Array([1, 2, 3]),
    'audio/vocals.flac': new Uint8Array([4, 5, 6])
  }
})

const rawZip = (entries: Record<string, string | Uint8Array>) =>
  zipSync(Object.fromEntries(Object.entries(entries).map(([k, v]) => [k, typeof v === 'string' ? strToU8(v) : v])))

describe('pack round trip', () => {
  it('parses what it builds', () => {
    const out = parsePack(buildPack(contents()))
    expect(out.song.title).toBe('Cuán grande es Él')
    expect(out.song.cues).toEqual([{ sectionIndex: 0, time: 1.5 }])
    expect([...out.files['audio/vocals.flac']]).toEqual([4, 5, 6])
  })
})

describe('isAllowedEntry', () => {
  it.each([
    'manifest.json', 'song.json', 'audio/instrumental.flac', 'audio/vocals.wav', 'video/fondo con espacios.mp4'
  ])('allows %s', n => expect(isAllowedEntry(n)).toBe(true))

  it.each([
    '../evil.exe', 'audio/../../evil', '/etc/passwd', 'C:\\Windows\\evil.dll', 'video/sub/dir.mp4',
    'audio\\vocals.flac', 'audio/other.flac', 'video/..', 'run.bat'
  ])('rejects %s', n => expect(isAllowedEntry(n)).toBe(false))
})

describe('parsePack validation', () => {
  const manifest = JSON.stringify({ packVersion: PACK_VERSION, kind: 'song', appVersion: '1', id: 'x' })
  const song = JSON.stringify(contents().song)

  it('rejects zip-slip entries without extracting anything', () => { // Review Focus #1
    const zip = rawZip({ 'manifest.json': manifest, 'song.json': song, 'audio/instrumental.flac': 'x', 'audio/vocals.flac': 'y', '../../evil.exe': 'boom' })
    expect(() => parsePack(zip)).toThrow(/no permitido/)
  })
  it('rejects unknown packVersion', () => {
    const zip = rawZip({ 'manifest.json': JSON.stringify({ packVersion: 99, kind: 'song', appVersion: '1', id: 'x' }), 'song.json': song })
    expect(() => parsePack(zip)).toThrow(/versión/)
  })
  it('rejects missing stems', () => {
    const zip = rawZip({ 'manifest.json': manifest, 'song.json': song, 'audio/vocals.flac': 'y' })
    expect(() => parsePack(zip)).toThrow(/instrumental/)
  })
  it('rejects a non-zip file', () => {
    expect(() => parsePack(new Uint8Array([1, 2, 3, 4]))).toThrow(/no es un paquete/)
  })
  it('rejects song.json without title', () => {
    const zip = rawZip({ 'manifest.json': manifest, 'song.json': JSON.stringify({ sections: [] }), 'audio/instrumental.flac': 'x', 'audio/vocals.flac': 'y' })
    expect(() => parsePack(zip)).toThrow(/título/)
  })
})
