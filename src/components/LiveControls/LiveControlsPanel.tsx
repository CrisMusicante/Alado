import { useEffect } from 'react'
import { useLiveStore } from '../../store/live.store'

export default function LiveControlsPanel() {
  const {
    currentSong, currentSectionIndex,
    blackout, whiteout,
    nextSection, prevSection, goToSection,
    toggleBlackout, toggleWhiteout, stopLive
  } = useLiveStore()

  // Keyboard shortcuts
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement).tagName)) return
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
    <div className="bg-slate-950 border-b border-slate-800 p-3 flex items-start gap-4">
      {/* Current section display */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-xs text-indigo-400 font-medium uppercase tracking-wide">En vivo</span>
          <span className="text-sm text-white font-semibold truncate">{currentSong.title}</span>
        </div>
        <div className="bg-slate-900 rounded-lg px-3 py-2 text-sm text-white">
          <span className="text-indigo-400 font-medium mr-2">{activeSection?.label}</span>
          {activeSection?.lines.slice(0, 1).join(' ')}
        </div>
      </div>

      {/* Section list */}
      <div className="flex gap-1 flex-wrap max-w-xs">
        {sections.map((s, i) => (
          <button
            key={i}
            onClick={() => goToSection(i)}
            className={`px-2.5 py-1 rounded text-xs font-medium transition-colors
              ${i === currentSectionIndex ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'}`}
          >
            {s.label}
          </button>
        ))}
      </div>

      {/* Navigation */}
      <div className="flex gap-2">
        <button
          onClick={prevSection}
          disabled={currentSectionIndex === 0}
          className="w-10 h-10 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-30 text-white transition-colors flex items-center justify-center"
          title="Anterior (←)"
        >
          ‹
        </button>
        <button
          onClick={nextSection}
          disabled={currentSectionIndex === sections.length - 1}
          className="w-10 h-10 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-30 text-white transition-colors flex items-center justify-center"
          title="Siguiente (→ / Espacio)"
        >
          ›
        </button>
      </div>

      {/* Emergency controls */}
      <div className="flex gap-2">
        <button
          onClick={toggleBlackout}
          className={`px-3 py-2 rounded-lg text-xs font-bold transition-colors ${blackout ? 'bg-slate-600 text-white' : 'bg-slate-800 text-slate-400 hover:text-white'}`}
          title="Pantalla negra (B)"
        >
          ■ Negro
        </button>
        <button
          onClick={toggleWhiteout}
          className={`px-3 py-2 rounded-lg text-xs font-bold transition-colors ${whiteout ? 'bg-white text-black' : 'bg-slate-800 text-slate-400 hover:text-white'}`}
          title="Pantalla blanca (W)"
        >
          □ Blanco
        </button>
        <button
          onClick={() => { if (confirm('¿Detener la presentación?')) stopLive() }}
          className="px-3 py-2 rounded-lg text-xs font-bold bg-red-900 text-red-300 hover:bg-red-700 hover:text-white transition-colors"
          title="Detener (Escape)"
        >
          ⏹ Detener
        </button>
      </div>
    </div>
  )
}
