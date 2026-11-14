/**
 * Printable lyrics sheet of a service for musicians and singers: an order page (title, artist,
 * key) and then each song on its own page, with section labels and repeats. Pure HTML builder;
 * setlist.handlers.ts renders it with printToPDF.
 */

interface SheetSection {
  label: string
  lines: string[]
  repeat?: number
}

export interface SheetSong {
  title: string
  artist?: string | null
  song_key?: string | null
  sections: SheetSection[]
}

const esc = (s: string): string =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

/** "2026-11-15" → "domingo, 15 de noviembre de 2026"; anything else → "". */
export function longDate(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso)
  if (!m) return ''
  const date = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
  return date.toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
}

const STYLE = `
  @page { size: letter; margin: 14mm 16mm; }
  * { box-sizing: border-box; }
  body { font-family: "Segoe UI", system-ui, sans-serif; color: #111; margin: 0; font-size: 12pt; line-height: 1.35; }
  h1 { font-size: 22pt; margin: 0 0 2pt; }
  .date { color: #555; margin: 0 0 14pt; }
  .date::first-letter { text-transform: uppercase; }
  table { width: 100%; border-collapse: collapse; font-size: 12pt; }
  th { text-align: left; font-size: 9pt; text-transform: uppercase; letter-spacing: .06em; color: #666; border-bottom: 1.5pt solid #111; padding: 4pt 6pt; }
  td { padding: 6pt; border-bottom: .5pt solid #ccc; vertical-align: top; }
  td.n { width: 22pt; color: #666; }
  td.k, th.k { width: 60pt; text-align: center; font-weight: 700; }
  .artist { color: #666; font-size: 10pt; }
  .song { break-before: page; }
  .head { display: flex; justify-content: space-between; align-items: flex-start; gap: 12pt; border-bottom: 1.5pt solid #111; padding-bottom: 6pt; margin-bottom: 10pt; }
  .head h2 { font-size: 18pt; margin: 0; }
  .key { border: 1.5pt solid #111; border-radius: 6pt; padding: 3pt 9pt; font-weight: 700; font-size: 14pt; white-space: nowrap; }
  .sections { columns: 2; column-gap: 18pt; }
  .section { break-inside: avoid; margin: 0 0 10pt; }
  .label { font-size: 9pt; font-weight: 700; text-transform: uppercase; letter-spacing: .06em; color: #444; margin-bottom: 2pt; }
  .repeat { font-weight: 400; color: #666; }
  .lines { margin: 0; }
`

function songPage(song: SheetSong, n: number): string {
  const sections = song.sections
    .filter(s => s.lines.some(l => l.trim()))
    .map(s => `
      <div class="section">
        <div class="label">${esc(s.label)}${(s.repeat ?? 1) > 1 ? ` <span class="repeat">×${s.repeat}</span>` : ''}</div>
        <p class="lines">${s.lines.map(esc).join('<br>')}</p>
      </div>`)
    .join('')
  return `
    <section class="song">
      <div class="head">
        <div>
          <h2>${n}. ${esc(song.title)}</h2>
          ${song.artist ? `<div class="artist">${esc(song.artist)}</div>` : ''}
        </div>
        ${song.song_key ? `<div class="key">Tono: ${esc(song.song_key)}</div>` : ''}
      </div>
      <div class="sections">${sections}</div>
    </section>`
}

export function buildLyricsSheetHtml(service: { name: string; service_date: string }, songs: SheetSong[]): string {
  const date = longDate(service.service_date)
  const rows = songs.map((s, i) => `
      <tr>
        <td class="n">${i + 1}</td>
        <td>${esc(s.title)}${s.artist ? `<div class="artist">${esc(s.artist)}</div>` : ''}</td>
        <td class="k">${s.song_key ? esc(s.song_key) : '—'}</td>
      </tr>`).join('')
  return `<!doctype html>
<html lang="es">
<head><meta charset="utf-8"><title>${esc(service.name)}</title><style>${STYLE}</style></head>
<body>
  <h1>${esc(service.name)}</h1>
  ${date ? `<p class="date">${esc(date)}</p>` : ''}
  <table>
    <thead><tr><th></th><th>Canción</th><th class="k">Tono</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>
  ${songs.map((s, i) => songPage(s, i + 1)).join('')}
</body>
</html>`
}
