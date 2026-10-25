import { useEffect } from 'react'
import { useLiveStore } from '../../store/live.store'
import AudioTransport from './AudioTransport'
import { confirmDialog, useDialogStore } from '../../store/dialog.store'

export default function LiveControlsPanel() {
  const {
    currentSong, currentSectionIndex,
    blackout, whiteout,
    nextSection, prevSection, goToSection,
    toggleBlackout, toggleWhiteout, stopLive
  } = useLiveStore()

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement).tagName)) return
      if (useDialogStore.getState().current) return // keys belong to the open dialog (Esc = cancel)
      switch (e.key) {
        case 'ArrowRight': case ' ': e.preventDefault(); nextSection(); break
        case 'ArrowLeft': e.preventDefault(); prevSection(); break
        case 'b': case 'B': toggleBlackout(); break
        case 'w': case 'W': toggleWhiteout(); break
        case 'Escape': stopLive(); break
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  if (!currentSong) return null

  const sections = currentSong.sections
  const activeSection = sections[currentSectionIndex]

  return (
    <div className="bg-slate-950 border-b border-slate-800 px-4 py-3 flex items-center gap-4">
      {/* Live indicator + current info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1.5">
          <span className="flex items-center gap-1.5 text-xs font-bold text-red-400 uppercase tracking-widest">
            <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse inline-block" />
            En vivo
          </span>
          <span className="text-sm text-white font-semibold truncate">{currentSong.title}</span>
        </div>
        <div className="bg-slate-900 rounded-xl px-3 py-2 text-sm text-white border border-slate-800">
          <span className="text-indigo-400 font-semibold mr-2">{activeSection?.label}</span>
          <span className="text-slate-300">{activeSection?.lines[0]}</span>
        </div>
      </div>

      {/* Section quick-jump */}
      <div className="flex gap-1 flex-wrap max-w-sm">
        {sections.map((s, i) => (
          <button
            key={i}
            onClick={() => goToSection(i)}
            className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all duration-150
              ${i === currentSectionIndex
                ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-900'
                : 'bg-slate-800 text-slate-300 hover:bg-slate-700 border border-slate-700'}`}
          >
            {s.label}
          </button>
        ))}
      </div>

      <AudioTransport />

      {/* Prev / Next */}
      <div className="flex gap-2 shrink-0">
        <button
          onClick={prevSection}
          disabled={currentSectionIndex === 0}
          className="w-10 h-10 rounded-xl bg-slate-800 hover:bg-slate-700 disabled:opacity-30 text-white transition-colors flex items-center justify-center text-lg border border-slate-700"
          title="Anterior (←)"
        >
          ‹
        </button>
        <button
          onClick={nextSection}
          disabled={currentSectionIndex === sections.length - 1}
          className="w-10 h-10 rounded-xl bg-slate-800 hover:bg-slate-700 disabled:opacity-30 text-white transition-colors flex items-center justify-center text-lg border border-slate-700"
          title="Siguiente (→ / Espacio)"
        >
          ›
        </button>
      </div>

      {/* Emergency controls */}
      <div className="flex gap-2 shrink-0">
        <button
          onClick={toggleBlackout}
          className={`px-3 py-2 rounded-xl text-xs font-bold transition-all duration-150 border
            ${blackout
              ? 'bg-slate-700 border-slate-500 text-white shadow-inner'
              : 'bg-slate-900 border-slate-700 text-slate-400 hover:text-white hover:border-slate-500'}`}
          title="Pantalla negra (B)"
        >
          ■ Negro
        </button>
        <button
          onClick={toggleWhiteout}
          className={`px-3 py-2 rounded-xl text-xs font-bold transition-all duration-150 border
            ${whiteout
              ? 'bg-white border-slate-300 text-black'
              : 'bg-slate-900 border-slate-700 text-slate-400 hover:text-white hover:border-slate-500'}`}
          title="Pantalla blanca (W)"
        >
          □ Blanco
        </button>
        <button
          onClick={async () => {
            if (await confirmDialog('¿Detener la presentación?', { title: 'Detener', confirmLabel: 'Detener', danger: true })) stopLive()
          }}
          className="px-3 py-2 rounded-xl text-xs font-bold bg-red-950 border border-red-800 text-red-400 hover:bg-red-700 hover:text-white transition-all duration-150"
          title="Detener (Escape)"
        >
          ⏹ Detener
        </button>
      </div>
    </div>
  )
}
