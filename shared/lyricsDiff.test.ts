import { describe, it, expect } from 'vitest'
import { diffSections } from './lyricsDiff'

const sec = (label: string, lines: string[]) => ({ type: 'verse', label, lines })

describe('diffSections', () => {
  it('marks added and removed lines per section', () => {
    const d = diffSections([sec('Coro', ['Grande es', 'tu fidelidad'])], [sec('Coro', ['Grande es', 'tu gran fidelidad'])])
    expect(d).toEqual([{ label: 'Coro', lines: [
      { kind: 'same', text: 'Grande es' },
      { kind: 'removed', text: 'tu fidelidad' },
      { kind: 'added', text: 'tu gran fidelidad' },
    ] }])
  })
  it('a new section is entirely added and a dropped one entirely removed', () => {
    const d = diffSections([sec('Verso', ['a'])], [sec('Coro', ['b'])])
    expect(d).toEqual([
      { label: 'Verso', lines: [{ kind: 'removed', text: 'a' }] },
      { label: 'Coro', lines: [{ kind: 'added', text: 'b' }] },
    ])
  })
  it('unchanged sections keep only same lines', () => {
    expect(diffSections([sec('V', ['x'])], [sec('V', ['x'])])).toEqual([{ label: 'V', lines: [{ kind: 'same', text: 'x' }] }])
  })
})
