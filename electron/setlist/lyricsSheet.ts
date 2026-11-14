import { chooseLayout, resolveSheetStyle, parseSheetStyle, SheetStyle, DEFAULT_SHEET_STYLE } from './sheetStyle'

/**
 * Printable lyrics sheet of a service for musicians and singers: an order page (title, artist,
 * key) and then each song on its own page, with section labels and repeats. Each song's font size
 * and columns come from its sheet style; an inline script measures the real text to fit it to a
 * page (see chooseLayout). setlist.handlers.ts renders it with printToPDF, or captures one song as
 * an image for the editor's preview.
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
  sheet_style?: unknown
}

export interface SheetOptions {
  general?: SheetStyle
  /** One song drawn as a letter page on screen (margins and page-break marks) instead of printed. */
  preview?: boolean
}

// Letter page at 96 px/in: 8.5 × 11 in, margins 16 mm (sides) and 14 mm (top/bottom).
export const PAGE_W = 816
export const PAGE_H = 1056
const MARGIN_X = 60
const MARGIN_Y = 53
const CONTENT_W = PAGE_W - 2 * MARGIN_X
const CONTENT_H = PAGE_H - 2 * MARGIN_Y

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
  html { background: #fff; }
  body { font-family: "Segoe UI", system-ui, sans-serif; color: #111; margin: 0; width: ${CONTENT_W}px; font-size: 14pt; line-height: 1.3; }
  h1 { font-size: 24pt; margin: 0 0 2pt; }
  .date { color: #555; margin: 0 0 16pt; }
  .date::first-letter { text-transform: uppercase; }
  table { width: 100%; border-collapse: collapse; }
  th { text-align: left; font-size: 10pt; text-transform: uppercase; letter-spacing: .06em; color: #666; border-bottom: 1.5pt solid #111; padding: 4pt 6pt; }
  td { padding: 7pt 6pt; border-bottom: .5pt solid #ccc; vertical-align: top; }
  td.n { width: 26pt; color: #666; }
  td.k, th.k { width: 70pt; text-align: center; font-weight: 700; }
  .artist { color: #666; font-size: 11pt; }
  .song { --pt: 18pt; break-before: page; }
  .head { display: flex; justify-content: space-between; align-items: flex-start; gap: 12pt; border-bottom: 1.5pt solid #111; padding-bottom: 6pt; margin-bottom: 10pt; }
  .head h2 { font-size: max(18pt, calc(var(--pt) * 1.2)); line-height: 1.15; margin: 0; }
  .head .artist { font-size: max(11pt, calc(var(--pt) * 0.65)); }
  .key { border: 1.5pt solid #111; border-radius: 6pt; padding: 3pt 10pt; font-weight: 700; font-size: max(14pt, calc(var(--pt) * 1.1)); white-space: nowrap; }
  .sections { font-size: var(--pt); }
  .song.two .sections { columns: 2; column-gap: 20pt; }
  .section { break-inside: avoid; margin: 0 0 0.6em; }
  .label { font-size: max(9pt, calc(var(--pt) * 0.6)); font-weight: 700; text-transform: uppercase; letter-spacing: .06em; color: #444; margin-bottom: 1pt; }
  .repeat { font-weight: 400; color: #666; }
  .lines { margin: 0; }
`

const PREVIEW_STYLE = `
  body { width: ${PAGE_W}px; min-height: ${PAGE_H}px; padding: ${MARGIN_Y}px ${MARGIN_X}px; position: relative; }
  .song { break-before: auto; }
  .page-break { position: absolute; left: 0; right: 0; border-top: 2px dashed #f59e0b; }
  .page-break span { position: absolute; right: 8px; top: 2px; font: 600 11px "Segoe UI", sans-serif; color: #b45309; background: #fff; padding: 0 4px; }
`

/** Fits every song (chooseLayout over real measurements); in preview, also marks page breaks. */
function fitScript(preview: boolean): string {
  return `
(function () {
  var chooseLayout = ${chooseLayout.toString()};
  var H = ${CONTENT_H - 4};
  document.querySelectorAll('.song').forEach(function (el) {
    var apply = function (pt, cols) { el.style.setProperty('--pt', pt + 'pt'); el.classList.toggle('two', cols === 2); };
    var fits = function (pt, cols) { apply(pt, cols); return el.getBoundingClientRect().height <= H; };
    var r = chooseLayout(JSON.parse(el.dataset.style), fits);
    apply(r.pt, r.cols);
    el.dataset.pt = r.pt; el.dataset.cols = r.cols;
  });
  ${preview ? `
  var song = document.querySelector('.song');
  if (song) {
    var pages = Math.max(1, Math.ceil(song.getBoundingClientRect().height / ${CONTENT_H}));
    document.body.style.minHeight = (pages * ${PAGE_H}) + 'px';
    for (var k = 1; k < pages; k++) {
      var mark = document.createElement('div');
      mark.className = 'page-break';
      mark.style.top = (${MARGIN_Y} + k * ${CONTENT_H}) + 'px';
      var label = document.createElement('span');
      label.textContent = 'sigue en la hoja ' + (k + 1);
      mark.appendChild(label);
      document.body.appendChild(mark);
    }
  }` : ''}
})();`
}

function songPage(song: SheetSong, n: number | null, general: SheetStyle): string {
  const style = resolveSheetStyle(general, parseSheetStyle(song.sheet_style))
  const sections = song.sections
    .filter(s => s.lines.some(l => l.trim()))
    .map(s => `
      <div class="section">
        <div class="label">${esc(s.label)}${(s.repeat ?? 1) > 1 ? ` <span class="repeat">×${s.repeat}</span>` : ''}</div>
        <p class="lines">${s.lines.map(esc).join('<br>')}</p>
      </div>`)
    .join('')
  return `
    <section class="song" data-style="${esc(JSON.stringify(style))}">
      <div class="head">
        <div>
          <h2>${n !== null ? `${n}. ` : ''}${esc(song.title)}</h2>
          ${song.artist ? `<div class="artist">${esc(song.artist)}</div>` : ''}
        </div>
        ${song.song_key ? `<div class="key">Tono: ${esc(song.song_key)}</div>` : ''}
      </div>
      <div class="sections">${sections}</div>
    </section>`
}

const CSP = `default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'`

function page(title: string, body: string, preview: boolean): string {
  return `<!doctype html>
<html lang="es">
<head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="${CSP}"><title>${esc(title)}</title>
<style>${STYLE}${preview ? PREVIEW_STYLE : ''}</style></head>
<body>${body}
<script>${fitScript(preview)}</script>
</body>
</html>`
}

export function buildLyricsSheetHtml(service: { name: string; service_date: string }, songs: SheetSong[], opts: SheetOptions = {}): string {
  const general = opts.general ?? DEFAULT_SHEET_STYLE
  if (opts.preview) return page(songs[0]?.title ?? '', songs[0] ? songPage(songs[0], null, general) : '', true)

  const date = longDate(service.service_date)
  const rows = songs.map((s, i) => `
      <tr>
        <td class="n">${i + 1}</td>
        <td>${esc(s.title)}${s.artist ? `<div class="artist">${esc(s.artist)}</div>` : ''}</td>
        <td class="k">${s.song_key ? esc(s.song_key) : '—'}</td>
      </tr>`).join('')
  return page(service.name, `
  <h1>${esc(service.name)}</h1>
  ${date ? `<p class="date">${esc(date)}</p>` : ''}
  <table>
    <thead><tr><th></th><th>Canción</th><th class="k">Tono</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>
  ${songs.map((s, i) => songPage(s, i + 1, general)).join('')}`, false)
}
