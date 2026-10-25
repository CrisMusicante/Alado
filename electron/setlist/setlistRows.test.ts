import { describe, it, expect } from 'vitest'
import { toSetlistItem } from './setlistRows'

describe('toSetlistItem', () => {
  it('convierte la fila de setlist_items + songs en { song, position, custom_video }', () => {
    const row = {
      id: 40, setlist_id: 3, song_id: 12, position: 1, custom_video: null,
      title: 'Way Maker', artist: 'Sinach', sections: '[{"type":"chorus","label":"Coro","lines":["a"]}]',
      video_path: 'C:\\v\\x.mp4', text_style: '{"size":"xl"}'
    }
    expect(toSetlistItem(row)).toEqual({
      position: 1,
      custom_video: null,
      song: {
        id: 12, title: 'Way Maker', artist: 'Sinach', video_path: 'C:\\v\\x.mp4',
        sections: [{ type: 'chorus', label: 'Coro', lines: ['a'] }], text_style: { size: 'xl' }
      }
    })
  })
})
