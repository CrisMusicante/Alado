import { describe, it, expect } from 'vitest'
import { buildDeckPlan, fitFontSize } from './pptxExport'
import type { Section, Song } from '../store/songs.store'

const sec = (lines: string[], repeat?: number): Section => ({ type: 'verse', label: 'V', lines, repeat })
const song = (title: string, sections: Section[], artist?: string): Song => ({ title, artist, sections, text_style: {} })

describe('buildDeckPlan', () => {
  it('una diapositiva de título por canción y una por sección, en orden', () => {
    const plan = buildDeckPlan([song('A', [sec(['a']), sec(['b'])], 'Art'), song('B', [sec(['c']), sec(['d']), sec(['e'])])])
    expect(plan.map(s => s.kind)).toEqual(['title', 'section', 'section', 'title', 'section', 'section', 'section'])
    expect(plan[0]).toEqual({ kind: 'title', songIndex: 0, title: 'A', artist: 'Art' })
    expect(plan[3]).toMatchObject({ kind: 'title', songIndex: 1, title: 'B' })
    expect(plan[6]).toMatchObject({ kind: 'section', songIndex: 1, text: 'e' })
  })

  it('una sección repetida es una sola diapositiva con repeat y líneas unidas por salto', () => {
    const plan = buildDeckPlan([song('A', [sec(['uno', 'dos'], 2)])])
    expect(plan[1]).toEqual({ kind: 'section', songIndex: 0, text: 'uno\ndos', repeat: 2 })
  })

  it('sin repeat → repeat 1; canción sin secciones → solo su título', () => {
    expect(buildDeckPlan([song('A', [sec(['x'])])])[1]).toMatchObject({ repeat: 1 })
    expect(buildDeckPlan([song('Sola', [])]).map(s => s.kind)).toEqual(['title'])
  })
})

describe('fitFontSize', () => {
  it('40 pt para pocas líneas cortas', () => {
    expect(fitFontSize('Abres camino\nhaces milagros')).toBe(40)
  })
  it('baja con muchas líneas, sin pasar de 20', () => {
    const ten = Array.from({ length: 10 }, (_, i) => `Línea número ${i} de la canción`).join('\n')
    expect(fitFontSize(ten)).toBeGreaterThanOrEqual(20)
    expect(fitFontSize(ten)).toBeLessThan(40)
    expect(fitFontSize(Array(40).fill('una línea muy larga de alabanza que sigue y sigue').join('\n'))).toBe(20)
  })
  it('baja con líneas muy largas', () => {
    expect(fitFontSize('x'.repeat(90))).toBeLessThan(40)
  })
})
