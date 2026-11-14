import { useEffect, useRef, useState } from 'react'
import type { Song } from '../../store/songs.store'
import {
  SheetStyle, SongSheetStyle, SheetSize, SheetColumns, SIZE_OPTIONS, COLUMN_OPTIONS,
  loadSheetStyle, sizeLabel, columnsLabel
} from '../../utils/sheetStyle'
import SheetStyleSettings from './SheetStyleSettings'

const PREVIEW_DELAY_MS = 700

const chipClass = (active: boolean) =>
  `px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-colors ${active
    ? 'bg-indigo-600 border-indigo-500 text-white'
    : 'bg-slate-700 border-slate-600 text-slate-300 hover:bg-slate-600'}`

/**
 * Song editor panel for the musicians' lyrics PDF: per-song override of size and columns (or
 * "General"), a live image of the song's page, and a shortcut to the general setting.
 */
export default function SheetStylePanel({ song, value, onChange }: {
  song: Song
  value: SongSheetStyle | null
  onChange: (v: SongSheetStyle | null) => void
}) {
  const [general, setGeneral] = useState<SheetStyle>(loadSheetStyle)
  const [showGeneral, setShowGeneral] = useState(false)
  const [preview, setPreview] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(false)
  const [enlarged, setEnlarged] = useState(false)
  const [pages, setPages] = useState(1)
  const seq = useRef(0)

  function set(patch: SongSheetStyle) {
    const next = { ...(value ?? {}), ...patch }
    for (const k of Object.keys(next) as Array<keyof SongSheetStyle>) if (next[k] === undefined) delete next[k]
    onChange(Object.keys(next).length > 0 ? next : null)
  }

  // Redraw the page after edits settle; only the latest request may update the image.
  const songKey = JSON.stringify([song.title, song.artist, song.song_key, song.sections, value, general])
  useEffect(() => {
    const id = ++seq.current
    setLoading(true)
    const timer = setTimeout(() => {
      window.api.sheetPreview({ song: { ...song, sheet_style: value }, sheetStyle: general })
        .then(url => { if (id === seq.current) { setPreview(url); setError(false) } })
        .catch(e => { console.error('No se pudo generar la vista previa del PDF', e); if (id === seq.current) setError(true) })
        .finally(() => { if (id === seq.current) setLoading(false) })
    }, PREVIEW_DELAY_MS)
    return () => clearTimeout(timer)
  }, [songKey])

  useEffect(() => {
    if (!showGeneral && !enlarged) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { setShowGeneral(false); setEnlarged(false) } }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [showGeneral, enlarged])

  return (
    <div className="mb-6 bg-slate-800 rounded-2xl p-4 border border-slate-700">
      <div className="flex items-center gap-3 mb-4">
        <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-widest flex-1">
          Hoja para músicos (PDF)
        </h2>
        <button
          onClick={() => setShowGeneral(true)}
          className="text-xs text-indigo-300 hover:text-indigo-200 px-2.5 py-1.5 rounded-lg hover:bg-slate-700 transition-colors"
          title="Cambiar el ajuste que usan todas las canciones"
        >
          ⚙ Configuración general
        </button>
      </div>

      <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-5 items-start">
        <div className="flex flex-col gap-4">
          <div>
            <label className="block text-xs text-slate-400 mb-2">Tamaño de letra</label>
            <div className="flex flex-wrap gap-1.5">
              <button onClick={() => set({ size: undefined })} className={chipClass(value?.size === undefined)}>
                General ({sizeLabel(general.size)})
              </button>
              {SIZE_OPTIONS.map(o => (
                <button key={o.value} onClick={() => set({ size: o.value as SheetSize })} className={chipClass(value?.size === o.value)} title={o.hint}>
                  {o.label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-2">Columnas</label>
            <div className="flex flex-wrap gap-1.5">
              <button onClick={() => set({ columns: undefined })} className={chipClass(value?.columns === undefined)}>
                General ({columnsLabel(general.columns)})
              </button>
              {COLUMN_OPTIONS.map(o => (
                <button key={String(o.value)} onClick={() => set({ columns: o.value as SheetColumns })} className={chipClass(value?.columns === o.value)}>
                  {o.label}
                </button>
              ))}
            </div>
          </div>
          <p className="text-xs text-slate-500">
            Deja "General" para que esta canción siga la configuración general. Cámbialo solo si esta canción lo necesita.
          </p>
        </div>

        <div className="w-72">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs text-slate-400">Vista previa</span>
            {loading
              ? <span className="text-[11px] text-slate-500">Actualizando…</span>
              : pages > 1 && <span className="text-[11px] text-amber-400">Ocupa {pages} hojas</span>}
          </div>
          <button
            onClick={() => preview && setEnlarged(true)}
            disabled={!preview}
            className="block w-full bg-white rounded-md overflow-hidden ring-1 ring-slate-600 hover:ring-indigo-400 transition-shadow disabled:cursor-default"
            title="Ver en grande"
            style={{ aspectRatio: '8.5 / 11' }}
          >
            {preview
              ? <img
                  src={preview} alt="Vista previa de la hoja" className="w-full h-full object-cover object-top"
                  // The image is one letter page tall per sheet the song needs.
                  onLoad={e => setPages(Math.max(1, Math.round(e.currentTarget.naturalHeight / e.currentTarget.naturalWidth / (11 / 8.5))))}
                />
              : <span className="text-xs text-slate-400">{error ? 'No se pudo generar' : 'Generando…'}</span>}
          </button>
        </div>
      </div>

      {showGeneral && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-6" onClick={() => setShowGeneral(false)}>
          <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 w-full max-w-lg shadow-2xl" onClick={e => e.stopPropagation()}>
            <h3 className="text-base font-semibold text-white mb-1">PDF de letras: configuración general</h3>
            <p className="text-sm text-slate-400 mb-4">Aplica a todas las canciones que estén en "General". También está en Configuración.</p>
            <SheetStyleSettings onChange={setGeneral} />
            <div className="flex justify-end mt-6">
              <button onClick={() => setShowGeneral(false)} className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium transition-colors">
                Listo
              </button>
            </div>
          </div>
        </div>
      )}

      {enlarged && preview && (
        <div className="fixed inset-0 z-50 bg-black/70 overflow-y-auto p-6 flex justify-center" onClick={() => setEnlarged(false)}>
          <img src={preview} alt="Vista previa de la hoja" className="max-w-[816px] w-full h-auto self-start rounded-md shadow-2xl bg-white" />
        </div>
      )}
    </div>
  )
}
