import { describe, it, expect } from 'vitest'
import path from 'path'
import {
  ALADO_FORMAT, ALADO_VERSION, buildAladoFile, parseAladoFile, normalizeTitle,
  pickMatch, sectionsDiffer, planImport, Section, LocalSong, AladoSong
} from './aladoFile'

const sec = (label: string, lines: string[], repeat?: number): Section => ({ type: 'chorus', label, lines, ...(repeat ? { repeat } : {}) })
const now = new Date('2026-10-25T18:00:00Z')
const meta = { name: 'Domingo', service_date: '2026-10-26', notes: null }
const exported = (songs: Parameters<typeof buildAladoFile>[1]) => buildAladoFile(meta, songs, now)
const aSong = (title: string, sections: Section[] = [sec('Coro', ['a'])], extra: Partial<AladoSong> = {}): AladoSong =>
  ({ title, artist: null, sections, text_style: {}, video_file: null, ...extra })
const local = (id: number, title: string, extra: Partial<LocalSong> = {}): LocalSong =>
  ({ id, title, artist: null, sections: [sec('Coro', ['a'])], updated_at: null, ...extra })

describe('buildAladoFile', () => {
  it('guarda solo el nombre del video, posiciones en orden y metadatos', () => {
    const f = exported([
      { title: 'Uno', sections: [], text_style: {}, video_path: 'C:\\x\\videos\\fondo.mp4' },
      { title: 'Dos', sections: [], text_style: {}, video_path: '/home/u/videos/otro.mp4', custom_video: 'D:\\v\\esp.mp4' }
    ])
    expect(f.format).toBe(ALADO_FORMAT)
    expect(f.version).toBe(ALADO_VERSION)
    expect(f.exported_at).toBe(now.toISOString())
    expect(f.setlist).toEqual(meta)
    expect(f.items.map(i => i.position)).toEqual([0, 1])
    expect(f.items[0].song.video_file).toBe('fondo.mp4')
    expect(f.items[1].song.video_file).toBe('otro.mp4')
    expect(f.items[1].custom_video_file).toBe('esp.mp4')
  })

  it('ida y vuelta conserva secciones, repeat y estilo', () => {
    const f = exported([{ title: 'Uno', artist: 'A', sections: [sec('V1', ['x', 'y']), sec('Coro', ['z'], 2)], text_style: { size: 'xl', shadow: true } }])
    expect(parseAladoFile(JSON.stringify(f))).toEqual(f)
  })
})

describe('parseAladoFile', () => {
  it.each(['{}', 'hola', JSON.stringify({ format: 'otra-cosa', version: 1, setlist: meta, items: [] })])(
    'rechaza lo que no es un servicio de ALADO: %s', text => {
      expect(() => parseAladoFile(text)).toThrow('no es un servicio de ALADO')
    })

  it('rechaza una versión futura', () => {
    const f = { ...exported([]), version: 2 }
    expect(() => parseAladoFile(JSON.stringify(f))).toThrow('versión más nueva')
  })

  it('rechaza items sin título o con secciones inválidas', () => {
    const base = exported([{ title: 'Uno', sections: [], text_style: {} }])
    const noTitle = structuredClone(base); (noTitle.items[0].song as any).title = ''
    const badSections = structuredClone(base); (badSections.items[0].song as any).sections = 'x'
    expect(() => parseAladoFile(JSON.stringify(noTitle))).toThrow()
    expect(() => parseAladoFile(JSON.stringify(badSections))).toThrow()
  })
})

describe('coincidencias', () => {
  it('normalizeTitle ignora acentos, mayúsculas y espacios', () => {
    expect(normalizeTitle('  Cuán  Grande Es ÉL ')).toBe(normalizeTitle('cuan grande es el'))
  })

  it('pickMatch prefiere el mismo artista, luego la más reciente; sin título igual → null', () => {
    const locals = [
      local(1, 'Cuan grande es El', { artist: 'Otro', updated_at: '2026-10-20 10:00:00' }),
      local(2, 'Cuán grande es Él', { artist: 'Marcos', updated_at: '2026-01-01 10:00:00' })
    ]
    expect(pickMatch(aSong('cuan grande es el', undefined, { artist: 'marcos' }), locals)?.id).toBe(2)
    expect(pickMatch(aSong('cuan grande es el', undefined, { artist: 'Nadie' }), locals)?.id).toBe(1)
    expect(pickMatch(aSong('Otra canción'), locals)).toBeNull()
  })

  it('sectionsDiffer detecta líneas, etiquetas y repeticiones distintas', () => {
    const a = [sec('Coro', ['a', 'b'])]
    expect(sectionsDiffer(a, [sec('Coro', ['a', 'b'])])).toBe(false)
    expect(sectionsDiffer(a, [sec('Coro', ['a', 'c'])])).toBe(true)
    expect(sectionsDiffer(a, [sec('Puente', ['a', 'b'])])).toBe(true)
    expect(sectionsDiffer(a, [sec('Coro', ['a', 'b'], 2)])).toBe(true)
    expect(sectionsDiffer([sec('Coro', ['a'], 1)], [sec('Coro', ['a'])])).toBe(false)
  })
})

describe('planImport', () => {
  const videosDir = path.join('C:', 'ud', 'videos')
  it('reusa existentes (marcando diferencias) y crea nuevas con su video si existe', () => {
    const file = exported([
      { title: 'Existe', sections: [sec('Coro', ['distinta'])], text_style: {} },
      { title: 'Nueva con video', sections: [], text_style: {}, video_path: 'X:\\v\\fondo.mp4' },
      { title: 'Nueva sin video', sections: [], text_style: {}, video_path: 'X:\\v\\falta.mp4' }
    ])
    const steps = planImport(file, [local(5, 'existe')], videosDir, new Set(['fondo.mp4']))
    expect(steps[0]).toEqual({ kind: 'existing', songId: 5, title: 'existe', differs: true })
    expect(steps[1]).toMatchObject({ kind: 'create', videoPath: path.join(videosDir, 'fondo.mp4') })
    expect(steps[2]).toMatchObject({ kind: 'create', videoPath: null })
  })
})
