import { describe, it, expect } from 'vitest'
import { assertSongId, assertStem } from './validate'

describe('assertSongId', () => {
  it('accepts positive integers', () => {
    expect(assertSongId(12)).toBe(12)
  })
  it.each([
    ['../..'], ['..\\..\\Windows'], ['12'], [0], [-1], [1.5], [NaN], [null], [undefined], [{}]
  ])('rejects %p (IPC input reaches fs paths)', v => {
    expect(() => assertSongId(v)).toThrow(/canción inválido/)
  })
})

describe('assertStem', () => {
  it('accepts the two stems', () => {
    expect(assertStem('instrumental')).toBe('instrumental')
    expect(assertStem('vocals')).toBe('vocals')
  })
  it.each([['../original'], ['vocals/../../x'], [''], [1]])('rejects %p', v => {
    expect(() => assertStem(v)).toThrow(/pista inválida/)
  })
})
