import { describe, it, expect } from 'vitest'
import { buildLyricsSheetHtml } from './lyricsSheet'

const song = (title: string, extra: Record<string, unknown> = {}) => ({
  title, artist: null, song_key: null,
  sections: [{ type: 'verse', label: 'Verso 1', lines: ['Línea uno', 'Línea dos'] }, { type: 'chorus', label: 'Coro', lines: ['Santo'], repeat: 2 }],
  ...extra
})

describe('buildLyricsSheetHtml', () => {
  it('incluye el orden del servicio con tonos y cada canción con sus secciones', () => {
    const html = buildLyricsSheetHtml({ name: 'Domingo', service_date: '2026-11-15' }, [
      song('Way Maker', { artist: 'Sinach', song_key: 'E' }),
      song('Sin tono')
    ])
    expect(html).toContain('<title>Domingo</title>')
    expect(html).toContain('domingo, 15 de noviembre de 2026')
    expect(html).toMatch(/Way Maker[\s\S]*Tono: E/)
    expect(html).toContain('Sinach')
    expect(html).toContain('Verso 1')
    expect(html).toContain('Línea uno<br>Línea dos')
    expect(html).toContain('×2')
    // the song without key shows a dash in the order, not "Tono:"
    expect(html.match(/Tono:/g)).toHaveLength(1)
  })

  it('escapa el HTML de títulos y letras', () => {
    const html = buildLyricsSheetHtml({ name: '<b>x</b>', service_date: '' }, [
      song('A & B', { sections: [{ type: 'verse', label: '<i>', lines: ['<script>alert(1)</script>'] }] })
    ])
    expect(html).not.toContain('<script>alert')
    expect(html).toContain('&lt;script&gt;')
    expect(html).toContain('A &amp; B')
    expect(html).toContain('&lt;b&gt;x&lt;/b&gt;')
  })

  it('omite secciones vacías', () => {
    const html = buildLyricsSheetHtml({ name: 'S', service_date: '' }, [
      song('A', { sections: [{ type: 'verse', label: 'Vacía', lines: ['', '  '] }] })
    ])
    expect(html).not.toContain('Vacía')
  })
})
