import { useEffect, useRef } from 'react'
import { useDialogStore, DialogAction } from '../store/dialog.store'

const VARIANT: Record<NonNullable<DialogAction['variant']>, string> = {
  primary: 'bg-indigo-600 hover:bg-indigo-500 text-white font-semibold',
  danger: 'bg-red-600 hover:bg-red-500 text-white font-semibold',
  neutral: 'text-slate-400 hover:text-white hover:bg-slate-700'
}

/** Renders the dialogs requested through ask / confirmDialog / alertDialog. Mounted once in App. */
export default function DialogHost() {
  const current = useDialogStore(s => s.current)
  const answer = useDialogStore(s => s.answer)
  const defaultRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!current) return
    defaultRef.current?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); answer(null) }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [current])

  if (!current) return null
  const last = current.actions.length - 1

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[200]" onClick={() => answer(null)}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="dialog-title"
        className="bg-slate-800 border border-slate-700 rounded-2xl p-6 w-96 max-w-[90vw] shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        <h3 id="dialog-title" className="text-white font-semibold mb-2">{current.title}</h3>
        {current.message && <p className="text-sm text-slate-300 mb-5 whitespace-pre-line">{current.message}</p>}
        <div className="flex gap-2 justify-end">
          {current.actions.map((a, i) => (
            <button
              key={a.value}
              ref={i === last ? defaultRef : undefined}
              onClick={() => answer(a.value)}
              className={`px-4 py-2 rounded-xl transition-colors ${VARIANT[a.variant ?? 'neutral']}`}
            >
              {a.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
