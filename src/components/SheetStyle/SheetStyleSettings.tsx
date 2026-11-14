import { useState } from 'react'
import { SheetStyle, SIZE_OPTIONS, COLUMN_OPTIONS, loadSheetStyle, saveSheetStyle } from '../../utils/sheetStyle'

const optionClass = (active: boolean) =>
  `rounded-xl text-sm font-medium border transition-all duration-150 ${active
    ? 'bg-indigo-950 border-indigo-500 text-indigo-200'
    : 'bg-slate-800 border-slate-700 text-slate-300 hover:border-slate-600'}`

/**
 * General layout of the musicians' lyrics PDF. Saved immediately; used both in Configuración and
 * in the modal opened from the song editor.
 */
export default function SheetStyleSettings({ onChange }: { onChange?: (style: SheetStyle) => void }) {
  const [style, setStyle] = useState<SheetStyle>(loadSheetStyle)

  function update(patch: Partial<SheetStyle>) {
    const next = { ...style, ...patch }
    setStyle(next)
    saveSheetStyle(next)
    onChange?.(next)
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <p className="text-sm text-slate-300 mb-2">Tamaño de letra</p>
        <div className="grid grid-cols-2 gap-2">
          {SIZE_OPTIONS.map(o => (
            <button key={o.value} onClick={() => update({ size: o.value })} className={`${optionClass(style.size === o.value)} px-4 py-2.5 text-left`}>
              {o.label}
              {o.value === 'auto' && <span className="ml-1.5 text-[11px] text-emerald-400">recomendado</span>}
              <span className="block text-xs font-normal text-slate-400">{o.hint}</span>
            </button>
          ))}
        </div>
      </div>
      <div>
        <p className="text-sm text-slate-300 mb-2">Columnas</p>
        <div className="flex gap-2">
          {COLUMN_OPTIONS.map(o => (
            <button key={String(o.value)} onClick={() => update({ columns: o.value })} className={`${optionClass(style.columns === o.value)} flex-1 py-2.5`}>
              {o.label}
            </button>
          ))}
        </div>
        <p className="text-xs text-slate-500 mt-2">
          Automático usa una columna y pasa a dos solo si así la letra queda más grande.
        </p>
      </div>
    </div>
  )
}
