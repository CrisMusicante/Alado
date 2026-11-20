import { describe, it, expect } from 'vitest'
import { mergeSongFields } from './merge'
import { EMPTY_SONG } from './types'

const pastor = { id: 'device:pc', name: 'Compu pastor' }
const cris = { id: 'user:cris', name: 'Cris' }
const base = {
  fields: { ...EMPTY_SONG, title: 'Tu fidelidad', song_key: 'E' },
  versions: { title: 3, song_key: 3 },
  authors: { title: pastor, song_key: pastor },
}

describe('mergeSongFields', () => {
  it('different fields do not conflict', () => {
    const r = mergeSongFields(base, { fields: { artist: 'Marcos' }, seen: { title: 3, song_key: 3 } }, cris, 7)
    expect(r.fields).toMatchObject({ title: 'Tu fidelidad', song_key: 'E', artist: 'Marcos' })
    expect(r.versions).toEqual({ title: 3, song_key: 3, artist: 7 })
    expect(r.authors.artist).toEqual(cris)
    expect(r.replaced).toEqual([])
  })

  it('same field: last write wins and reports the replaced value', () => {
    const r = mergeSongFields(base, { fields: { song_key: 'G' }, seen: { song_key: 1 } }, cris, 8)
    expect(r.fields.song_key).toBe('G')
    expect(r.versions.song_key).toBe(8)
    expect(r.replaced).toEqual([{ field: 'song_key', previousAuthor: pastor, previousValue: 'E' }])
  })

  it('same author overwriting its own value is not a conflict', () => {
    const r = mergeSongFields(base, { fields: { song_key: 'G' }, seen: { song_key: 1 } }, pastor, 8)
    expect(r.replaced).toEqual([])
  })

  it('seen up to date is not a conflict', () => {
    const r = mergeSongFields(base, { fields: { song_key: 'G' }, seen: { song_key: 3 } }, cris, 8)
    expect(r.replaced).toEqual([])
  })

  it('writing the same value is not a conflict', () => {
    const r = mergeSongFields(base, { fields: { song_key: 'E' }, seen: {} }, cris, 8)
    expect(r.replaced).toEqual([])
  })
})
