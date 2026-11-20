import { describe, it, expect } from 'vitest'
import { mergeEdits } from './songMerge'

const base = { id: 1, title: 'Uno', artist: 'X', song_key: 'E', sections: [], text_style: {}, video_path: undefined, sheet_style: null }

describe('mergeEdits', () => {
  it('keeps a field the cloud changed while the editor was open', () => {
    const latest = { ...base, song_key: 'G' }               // changed on the phone meanwhile
    const edited = { ...base, title: 'Uno (en vivo)' }       // the operator only renamed it
    expect(mergeEdits(base, edited, latest)).toMatchObject({ title: 'Uno (en vivo)', song_key: 'G' })
  })
  it('the operator wins on the fields they changed', () => {
    expect(mergeEdits(base, { ...base, song_key: 'A' }, { ...base, song_key: 'G' }).song_key).toBe('A')
  })
  it('without a newer copy it is just the edit', () => {
    expect(mergeEdits(base, { ...base, artist: 'Y' }, undefined)).toEqual({ ...base, artist: 'Y' })
  })
})
