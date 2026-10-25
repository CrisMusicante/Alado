import { describe, it, expect, beforeEach } from 'vitest'
import { useServiceDraftStore, todayISO } from './serviceDraft.store'
import type { Song } from './songs.store'

const song = (id: number, title = `Canción ${id}`): Song => ({ id, title, sections: [], text_style: {} })
const draft = () => useServiceDraftStore.getState()
const ids = () => draft().items.map(i => i.song.id)

beforeEach(() => draft().reset())

describe('serviceDraft', () => {
  it('addSong agrega una vez y marca dirty', () => {
    draft().addSong(song(1))
    draft().addSong(song(1))
    expect(draft().items).toHaveLength(1)
    expect(draft().dirty).toBe(true)
  })

  it('moveItem reordena', () => {
    ;[1, 2, 3].forEach(i => draft().addSong(song(i)))
    const [k1, , k3] = draft().items.map(i => i.key)
    draft().moveItem(k3, k1)
    expect(ids()).toEqual([3, 1, 2])
  })

  it('removeItem quita la canción', () => {
    ;[1, 2].forEach(i => draft().addSong(song(i)))
    draft().removeItem(draft().items[0].key)
    expect(ids()).toEqual([2])
  })

  it('loadSaved toma id, nombre, fecha y canciones sin dirty', () => {
    draft().loadSaved({ id: 7, name: 'Dom', service_date: '2026-10-26', songs: [{ song: song(2), position: 0 }] })
    expect(draft().setlistId).toBe(7)
    expect(draft().name).toBe('Dom')
    expect(draft().serviceDate).toBe('2026-10-26')
    expect(draft().dirty).toBe(false)
    expect(ids()).toEqual([2])
  })

  it('markSaved fija el id y limpia dirty', () => {
    draft().addSong(song(1))
    draft().markSaved(9)
    expect(draft().setlistId).toBe(9)
    expect(draft().dirty).toBe(false)
    draft().markSaved(9)
    expect(draft().setlistId).toBe(9)
  })

  it('syncWithCatalog descarta canciones borradas y refresca letras', () => {
    ;[1, 2].forEach(i => draft().addSong(song(i)))
    draft().markSaved(3)
    draft().syncWithCatalog([{ ...song(1), title: 'Nuevo' }])
    expect(ids()).toEqual([1])
    expect(draft().items[0].song.title).toBe('Nuevo')
    expect(draft().dirty).toBe(false)
  })

  it('reset deja nombre por defecto y fecha de hoy', () => {
    draft().setName('X')
    draft().reset()
    expect(draft().name.startsWith('Servicio ')).toBe(true)
    expect(draft().serviceDate).toBe(todayISO())
    expect(draft().setlistId).toBeNull()
    expect(draft().items).toEqual([])
  })
})
