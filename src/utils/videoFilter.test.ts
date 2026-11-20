import { describe, it, expect } from 'vitest'
import { filterVideos } from './videoFilter'

const v = (name: string) => ({ name, path: `C:/videos/${name}`, size: 1 })
const list = [v('Canción Fondo.mp4'), v('Montañas.mp4'), v('fondo azul.webm')]

describe('filterVideos', () => {
  it('matches without accents or case', () => {
    expect(filterVideos(list, 'cancion').map(x => x.name)).toEqual(['Canción Fondo.mp4'])
  })
  it('empty query returns all', () => {
    expect(filterVideos(list, '   ')).toEqual(list)
  })
  it('trims the query', () => {
    expect(filterVideos(list, '  fondo ').map(x => x.name)).toEqual(['Canción Fondo.mp4', 'fondo azul.webm'])
  })
})
