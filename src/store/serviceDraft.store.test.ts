import { describe, it, expect, beforeEach } from 'vitest'
import { useServiceDraftStore, todayISO, defaultServiceName, migrateDraft } from './serviceDraft.store'
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

  it('loadSaved conserva el video especial de cada canción del servicio', () => {
    draft().loadSaved({ id: 7, name: 'Dom', songs: [{ song: song(2), position: 0, custom_video: '/videos/esp.mp4' }] })
    expect(draft().items[0].custom_video).toBe('/videos/esp.mp4')
    draft().addSong(song(3))
    expect(draft().items[1].custom_video).toBeNull()
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

  it('el nombre por defecto sigue a la fecha mientras no se edite', () => {
    draft().setServiceDate('2026-11-01')
    expect(draft().name).toBe('Servicio 01/11/2026')
    draft().setName('Culto de jóvenes')
    draft().setServiceDate('2026-11-08')
    expect(draft().name).toBe('Culto de jóvenes')
  })

  it('setNotes guarda la descripción y marca dirty; loadSaved la trae', () => {
    draft().setNotes('Tono en Re')
    expect(draft().notes).toBe('Tono en Re')
    expect(draft().dirty).toBe(true)
    draft().loadSaved({ id: 4, name: 'Dom', service_date: '2026-10-26', notes: 'Santa cena', songs: [] })
    expect(draft().notes).toBe('Santa cena')
    draft().reset()
    expect(draft().notes).toBe('')
  })

  it('un servicio cargado con nombre propio no se renombra al cambiar la fecha', () => {
    draft().loadSaved({ id: 4, name: 'Santa cena', service_date: '2026-10-26', songs: [] })
    draft().setServiceDate('2026-11-02')
    expect(draft().name).toBe('Santa cena')
  })

  it('forgetSavedSetlist suelta el id si se borró el servicio cargado', () => {
    draft().addSong(song(1))
    draft().markSaved(5)
    draft().forgetSavedSetlist(6)
    expect(draft().setlistId).toBe(5)
    draft().forgetSavedSetlist(5)
    expect(draft().setlistId).toBeNull()
    expect(draft().dirty).toBe(true)
  })
})

describe('defaultServiceName', () => {
  it('formatea la fecha como DD/MM/AAAA', () => {
    expect(defaultServiceName('2026-10-25')).toBe('Servicio 25/10/2026')
  })
})

describe('migrateDraft', () => {
  it('un borrador de la versión anterior conserva su nombre propio', () => {
    expect(migrateDraft({ name: 'Culto de jóvenes', serviceDate: '2026-10-25' }, 0))
      .toMatchObject({ name: 'Culto de jóvenes', nameIsDefault: false, notes: '' })
    expect(migrateDraft({ name: 'Servicio 25/10/2026', serviceDate: '2026-10-25' }, 0))
      .toMatchObject({ nameIsDefault: true })
  })
})
