import { describe, it, expect } from 'vitest'
import { importSummaryText } from './importSummary'

const base = { setlistId: 1, reused: 0, created: [], differing: [], missingVideo: [], missingAudio: [] }

describe('importSummaryText', () => {
  it('una línea por categoría con contenido, omitiendo las vacías', () => {
    expect(importSummaryText({ ...base, reused: 4, created: ['Nueva'], differing: ['Way Maker'], missingVideo: ['Nueva'], missingAudio: ['Nueva', 'Way Maker'] }))
      .toBe([
        '4 canciones ya estaban en esta compu.',
        'Se crearon: Nueva',
        'Con letra distinta (se usó la de esta compu): Way Maker',
        'Sin video (fondo por defecto): Nueva',
        'Sin audio en esta compu: Nueva, Way Maker'
      ].join('\n'))
  })
  it('singular para una canción', () => {
    expect(importSummaryText({ ...base, reused: 1 })).toBe('1 canción ya estaba en esta compu.')
  })
})
