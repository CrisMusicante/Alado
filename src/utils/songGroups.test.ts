import { describe, it, expect } from 'vitest'
import { groupSongs, matchesQuery } from './songGroups'
import type { Song, Folder } from '../store/songs.store'

const song = (id: number, title: string, folder_id: number | null, artist?: string): Song =>
  ({ id, title, artist, folder_id, sections: [], text_style: {} })

const folders: Folder[] = [{ id: 2, name: 'Adoración' }, { id: 1, name: 'Alabanza' }]
const songs = [
  song(1, 'Agnus Dei', 2),
  song(2, 'Fuego', 1),
  song(3, 'León', null),
  song(4, 'Altísimo', 2, 'Marcos Witt'),
]

describe('groupSongs', () => {
  it('groups every song under its folder, in folder order, loose songs last', () => {
    const groups = groupSongs(songs, folders, 'all', '')
    expect(groups.map(g => [g.name, g.songs.map(s => s.title)])).toEqual([
      ['Adoración', ['Agnus Dei', 'Altísimo']],
      ['Alabanza', ['Fuego']],
      ['Sin carpeta', ['León']],
    ])
  })

  it('shows only the selected folder', () => {
    expect(groupSongs(songs, folders, 1, '').map(g => g.name)).toEqual(['Alabanza'])
  })

  it('selects loose songs with null', () => {
    expect(groupSongs(songs, folders, null, '')[0].songs.map(s => s.id)).toEqual([3])
  })

  it('filters by query and drops empty groups', () => {
    const groups = groupSongs(songs, folders, 'all', 'fue')
    expect(groups.map(g => g.name)).toEqual(['Alabanza'])
  })

  it('treats songs whose folder no longer exists as loose', () => {
    const groups = groupSongs([song(9, 'Huérfana', 99)], folders, 'all', '')
    expect(groups.map(g => g.name)).toEqual(['Sin carpeta'])
  })
})

describe('matchesQuery', () => {
  it('ignores case and accents in title and artist', () => {
    expect(matchesQuery(song(1, 'Altísimo', null), 'ALTISIMO')).toBe(true)
    expect(matchesQuery(song(1, 'Altísimo', null, 'Marcos Witt'), 'witt')).toBe(true)
    expect(matchesQuery(song(1, 'León', null), 'fuego')).toBe(false)
  })
})
