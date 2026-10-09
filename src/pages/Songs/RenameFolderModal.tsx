import { useEffect, useRef, useState } from 'react'
import { Folder } from '../../store/songs.store'

interface Props {
  folder: Folder
  onConfirm: (name: string) => void
  onCancel: () => void
}

export default function RenameFolderModal({ folder, onConfirm, onCancel }: Props) {
  const [name, setName] = useState(folder.name)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    inputRef.current?.select()
  }, [])

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const trimmed = name.trim()
    if (trimmed) onConfirm(trimmed)
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={onCancel}>
      <div
        className="bg-slate-800 border border-slate-700 rounded-2xl p-6 w-80 shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        <h3 className="text-white font-semibold mb-4">Renombrar carpeta</h3>
        <form onSubmit={handleSubmit}>
          <input
            ref={inputRef}
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            className="w-full bg-slate-700 text-white placeholder-slate-400 rounded-xl px-4 py-2.5 outline-none focus:ring-2 focus:ring-indigo-500 border border-slate-600 mb-4"
            autoFocus
          />
          <div className="flex gap-2 justify-end">
            <button
              type="button"
              onClick={onCancel}
              className="px-4 py-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-700 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold transition-colors"
            >
              Guardar
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
