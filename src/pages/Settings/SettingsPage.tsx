import { useEffect, useRef, useState } from 'react'

interface DisplayInfo {
  id: number
  label: string
  bounds: { x: number; y: number; width: number; height: number }
  isPrimary: boolean
}

export default function SettingsPage() {
  const [displays, setDisplays] = useState<DisplayInfo[]>([])
  const [selectedDisplayId, setSelectedDisplayId] = useState<number | null>(
    Number(localStorage.getItem('liveDisplayId')) || null
  )
  const [transitionType, setTransitionType] = useState<'fade' | 'cut'>(
    (localStorage.getItem('transitionType') as 'fade' | 'cut') ?? 'fade'
  )
  const [transitionDuration, setTransitionDuration] = useState<number>(
    Number(localStorage.getItem('transitionDuration')) || 250
  )
  const [claudeKey, setClaudeKey] = useState(localStorage.getItem('claudeApiKey') ?? '')
  const [claudeKeySaved, setClaudeKeySaved] = useState(false)
  const claudeSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    window.api.getDisplays().then(setDisplays)
  }, [])

  function selectDisplay(id: number) {
    setSelectedDisplayId(id)
    localStorage.setItem('liveDisplayId', String(id))
  }

  function applyTransition(type: 'fade' | 'cut', duration: number) {
    window.api.setTransition({ type, duration })
    localStorage.setItem('transitionType', type)
    localStorage.setItem('transitionDuration', String(duration))
  }

  function handleTransitionType(type: 'fade' | 'cut') {
    setTransitionType(type)
    applyTransition(type, transitionDuration)
  }

  function handleTransitionDuration(duration: number) {
    setTransitionDuration(duration)
    applyTransition(transitionType, duration)
  }

  function saveClaudeKey(key: string) {
    setClaudeKey(key)
    if (claudeSaveTimer.current) clearTimeout(claudeSaveTimer.current)
    claudeSaveTimer.current = setTimeout(() => {
      if (key.trim()) {
        localStorage.setItem('claudeApiKey', key.trim())
      } else {
        localStorage.removeItem('claudeApiKey')
      }
      setClaudeKeySaved(true)
      setTimeout(() => setClaudeKeySaved(false), 2000)
    }, 800)
  }

  return (
    <div className="p-6 max-w-2xl">
      <h1 className="text-2xl font-bold mb-8">Configuración</h1>

      {/* Display selection */}
      <section className="mb-8">
        <h2 className="text-base font-semibold text-white mb-1">Pantalla de presentación</h2>
        <p className="text-sm text-slate-400 mb-4">
          Selecciona en qué monitor se mostrará la ventana de presentación al público.
        </p>
        <div className="flex flex-col gap-2">
          {displays.length === 0 && (
            <p className="text-sm text-slate-500">Detectando pantallas...</p>
          )}
          {displays.map(d => (
            <button
              key={d.id}
              onClick={() => selectDisplay(d.id)}
              className={`flex items-center gap-4 px-4 py-3 rounded-2xl border text-left transition-all duration-150
                ${selectedDisplayId === d.id
                  ? 'bg-indigo-950 border-indigo-500'
                  : 'bg-slate-800 border-slate-700 hover:border-slate-600'}`}
            >
              <div className={`w-4 h-4 rounded-full border-2 shrink-0 flex items-center justify-center
                ${selectedDisplayId === d.id ? 'border-indigo-400' : 'border-slate-600'}`}>
                {selectedDisplayId === d.id && (
                  <div className="w-2 h-2 rounded-full bg-indigo-400" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white">
                  {d.label || `Pantalla ${d.id}`}
                  {d.isPrimary && (
                    <span className="ml-2 text-xs text-slate-500">(Principal)</span>
                  )}
                </p>
                <p className="text-xs text-slate-500">
                  {d.bounds.width} × {d.bounds.height} px
                </p>
              </div>
            </button>
          ))}
        </div>
        {displays.length > 0 && (
          <button
            onClick={() => window.api.getDisplays().then(setDisplays)}
            className="mt-3 text-xs text-slate-500 hover:text-slate-300 transition-colors"
          >
            ↻ Refrescar pantallas
          </button>
        )}
      </section>

      {/* Transition */}
      <section className="mb-8">
        <h2 className="text-base font-semibold text-white mb-1">Transición de diapositivas</h2>
        <p className="text-sm text-slate-400 mb-4">
          Efecto visual al cambiar de sección durante la presentación.
        </p>

        <div className="flex gap-3 mb-5">
          <button
            onClick={() => handleTransitionType('fade')}
            className={`flex-1 py-3 rounded-xl text-sm font-medium border transition-all duration-150
              ${transitionType === 'fade'
                ? 'bg-indigo-950 border-indigo-500 text-indigo-200'
                : 'bg-slate-800 border-slate-700 text-slate-300 hover:border-slate-600'}`}
          >
            ✨ Fundido
          </button>
          <button
            onClick={() => handleTransitionType('cut')}
            className={`flex-1 py-3 rounded-xl text-sm font-medium border transition-all duration-150
              ${transitionType === 'cut'
                ? 'bg-indigo-950 border-indigo-500 text-indigo-200'
                : 'bg-slate-800 border-slate-700 text-slate-300 hover:border-slate-600'}`}
          >
            ⚡ Corte directo
          </button>
        </div>

        {transitionType === 'fade' && (
          <div className="bg-slate-800 rounded-2xl p-4 border border-slate-700">
            <div className="flex items-center justify-between mb-3">
              <label className="text-sm text-slate-300">Duración del fundido</label>
              <span className="text-sm font-mono text-indigo-400">{transitionDuration}ms</span>
            </div>
            <input
              type="range"
              min={100}
              max={800}
              step={50}
              value={transitionDuration}
              onChange={e => handleTransitionDuration(Number(e.target.value))}
              className="w-full accent-indigo-500"
            />
            <div className="flex justify-between text-xs text-slate-600 mt-1">
              <span>100ms (rápido)</span>
              <span>800ms (lento)</span>
            </div>
          </div>
        )}
      </section>
      {/* Claude AI Import */}
      <section className="mb-8">
        <h2 className="text-base font-semibold text-white mb-1">Importar con IA (Claude API)</h2>
        <p className="text-sm text-slate-400 mb-4">
          Permite usar Claude para importar letras automáticamente desde cualquier URL.
          Obtén tu clave en{' '}
          <span className="text-indigo-400">console.anthropic.com</span>.
        </p>
        <div>
          <label className="block text-sm text-slate-400 mb-1.5">Clave API de Anthropic</label>
          <div className="flex gap-2">
            <input
              type="password"
              value={claudeKey}
              onChange={e => saveClaudeKey(e.target.value)}
              className="flex-1 bg-slate-800 text-white rounded-xl px-4 py-2.5 outline-none focus:ring-2 focus:ring-indigo-500 border border-slate-700 text-sm font-mono"
              placeholder="sk-ant-..."
            />
            {claudeKeySaved && (
              <span className="flex items-center text-xs text-green-400 px-2">Guardado</span>
            )}
          </div>
          <p className="text-xs text-slate-600 mt-1.5">
            La clave se guarda localmente en este dispositivo y nunca se envía a servidores externos.
          </p>
        </div>
        <div className="mt-3 bg-indigo-950/30 border border-indigo-800/40 rounded-xl p-3">
          <p className="text-xs text-indigo-300">
            La importación con IA estará disponible en una próxima actualización.
            Puedes guardar tu clave ahora para tenerla lista.
          </p>
        </div>
      </section>
    </div>
  )
}
