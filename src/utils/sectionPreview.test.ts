import { describe, it, expect } from 'vitest'
import { sectionLabel, previewSections } from './sectionPreview'
import type { Section, Song } from '../store/songs.store'

const sec = (label: string, lines: string[], repeat?: number): Section => ({ type: 'custom', label, lines, repeat })
const four = ['uno', 'dos', 'tres', 'cuatro']

describe('sectionLabel', () => {
  it('añade ×N cuando la sección se repite', () => {
    expect(sectionLabel(sec('Coro', [], 2))).toBe('Coro ×2')
  })
  it('sin repetición deja la etiqueta sola', () => {
    expect(sectionLabel(sec('Coro', [], 1))).toBe('Coro')
    expect(sectionLabel(sec('Coro', []))).toBe('Coro')
  })
})

describe('previewSections', () => {
  it('recorta a 2 secciones de 2 líneas', () => {
    const song: Song = { title: 'X', text_style: {}, sections: [sec('V1', four), sec('Coro', four, 2), sec('V2', four)] }
    expect(previewSections(song)).toEqual([
      { label: 'V1', lines: ['uno', 'dos'], truncated: true },
      { label: 'Coro ×2', lines: ['uno', 'dos'], truncated: true }
    ])
  })
  it('no marca recorte si la sección cabe', () => {
    const song: Song = { title: 'X', text_style: {}, sections: [sec('V1', ['uno'])] }
    expect(previewSections(song)).toEqual([{ label: 'V1', lines: ['uno'], truncated: false }])
  })
  it('canción sin secciones → []', () => {
    expect(previewSections({ title: 'X', text_style: {}, sections: [] })).toEqual([])
  })
})
