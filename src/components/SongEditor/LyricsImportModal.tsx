import { useState } from 'react'
import { Section } from '../../store/songs.store'
import { parseLyricsToSections } from '../../utils/lyricsParser'

interface Props {
  onApply: (sections: Section[]) => void
  onClose: () => void
}

type Tab = 'paste' | 'url' | 'ai'

const SECTION_TYPE_LABEL: Record<string, string> = {
  verse:        'Verso',
  chorus:       'Coro',
  estribillo:   'Estribillo',
  'pre-chorus': 'Pre-Coro',
  bridge:       'Puente',
  intro:        'Intro',
  outro:        'Outro',
  custom:       'Personalizado',
}

const SECTION_COLOR: Record<string, string> = {
  verse:        'bg-blue-900/40 border-blue-700',
  chorus:       'bg-indigo-900/40 border-indigo-700',
  estribillo:   'bg-violet-900/40 border-violet-700',
  'pre-chorus': 'bg-cyan-900/40 border-cyan-700',
  bridge:       'bg-purple-900/40 border-purple-700',
  intro:        'bg-slate-700/40 border-slate-600',
  outro:        'bg-slate-700/40 border-slate-600',
  custom:       'bg-teal-900/40 border-teal-700',
}

export default function LyricsImportModal({ onApply, onClose }: Props) {
  const [tab, setTab] = useState<Tab>('paste')

  // Paste tab state
  const [pasteText, setPasteText] = useState('')

  // URL tab state
  const [url, setUrl] = useState('')
  const [urlLoading, setUrlLoading] = useState(false)
  const [urlError, setUrlError] = useState<string | null>(null)

  // Shared preview state
  const [preview, setPreview] = useState<Section[] | null>(null)

  // ── Paste ──────────────────────────────────────────────────────────────────

  function handleParsePaste() {
    const sections = parseLyricsToSections(pasteText)
    setPreview(sections.length > 0 ? sections : null)
  }

  // ── URL ────────────────────────────────────────────────────────────────────

  async function handleFetchUrl() {
    if (!url.trim()) return
    setUrlLoading(true)
    setUrlError(null)
    setPreview(null)

    const result = await window.api.fetchLyricsUrl(url.trim())

    if (!result.success || !result.rawText) {
      setUrlError(result.error ?? 'Error desconocido')
      setUrlLoading(false)
      return
    }

    const sections = parseLyricsToSections(result.rawText)
    if (sections.length === 0) {
      setUrlError('La letra se descargó pero no se pudo dividir en secciones. Prueba la pestaña "Pegar letra".')
    } else {
      setPreview(sections)
    }
    setUrlLoading(false)
  }

  // ── Apply ──────────────────────────────────────────────────────────────────

  function handleApply() {
    if (preview && preview.length > 0) onApply(preview)
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  const claudeApiKey = localStorage.getItem('claudeApiKey') ?? ''

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl w-full max-w-2xl mx-4 max-h-[90vh] flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-slate-700 shrink-0">
          <h2 className="text-lg font-bold">Importar letra</h2>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white transition-colors text-xl leading-none"
          >
            ✕
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 px-6 pt-4 shrink-0">
          {([
            ['paste', 'Pegar letra'],
            ['url',   'Importar URL'],
            ['ai',    'Claude IA'],
          ] as [Tab, string][]).map(([t, label]) => (
            <button
              key={t}
              onClick={() => { setTab(t); setPreview(null); setUrlError(null) }}
              className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors border
                ${tab === t
                  ? 'bg-indigo-600 border-indigo-500 text-white'
                  : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-white hover:border-slate-600'}`}
            >
              {label}
              {t === 'ai' && (
                <span className="ml-1.5 text-xs bg-slate-700 text-slate-400 px-1.5 py-0.5 rounded-md">
                  Próximamente
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-4 flex flex-col gap-4">

          {/* ── PASTE TAB ── */}
          {tab === 'paste' && (
            <>
              <p className="text-sm text-slate-400">
                Copia la letra desde cualquier sitio web y pégala aquí. El sistema detecta
                automáticamente versos, coros, puentes y más.
              </p>
              <textarea
                value={pasteText}
                onChange={e => { setPasteText(e.target.value); setPreview(null) }}
                rows={10}
                className="w-full bg-slate-800 text-white rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-indigo-500 text-sm resize-none border border-slate-700 font-mono"
                placeholder={`Ejemplo:\n\n[Verso 1]\nEn la cruz\nDonde todo fue consumado\n\n[Coro]\nAlabado seas\nPor siempre alabado`}
              />
              <button
                onClick={handleParsePaste}
                disabled={!pasteText.trim()}
                className="self-start bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white px-5 py-2 rounded-xl text-sm font-semibold transition-colors"
              >
                Analizar letra
              </button>
            </>
          )}

          {/* ── URL TAB ── */}
          {tab === 'url' && (
            <>
              <p className="text-sm text-slate-400">
                Ingresa la URL de la página con la letra. Funciona mejor con{' '}
                <span className="text-slate-300">letras.com</span>,{' '}
                <span className="text-slate-300">genius.com</span> y{' '}
                <span className="text-slate-300">musica.com</span>.
                Algunos sitios con carga dinámica pueden no funcionar.
              </p>
              <div className="flex gap-2">
                <input
                  value={url}
                  onChange={e => { setUrl(e.target.value); setUrlError(null); setPreview(null) }}
                  onKeyDown={e => e.key === 'Enter' && handleFetchUrl()}
                  className="flex-1 bg-slate-800 text-white rounded-xl px-4 py-2.5 outline-none focus:ring-2 focus:ring-indigo-500 border border-slate-700 text-sm"
                  placeholder="https://www.letras.com/..."
                  type="url"
                />
                <button
                  onClick={handleFetchUrl}
                  disabled={!url.trim() || urlLoading}
                  className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white px-5 py-2.5 rounded-xl text-sm font-semibold transition-colors shrink-0"
                >
                  {urlLoading ? 'Descargando...' : 'Importar'}
                </button>
              </div>
              {urlError && (
                <div className="bg-red-950/60 border border-red-800 text-red-300 rounded-xl px-4 py-3 text-sm">
                  {urlError}
                </div>
              )}
            </>
          )}

          {/* ── AI TAB ── */}
          {tab === 'ai' && (
            <div className="flex flex-col gap-4">
              <div className="bg-indigo-950/40 border border-indigo-800/50 rounded-2xl p-5">
                <p className="text-sm font-semibold text-indigo-200 mb-1">Importar con Claude AI</p>
                <p className="text-sm text-slate-400">
                  Claude analiza cualquier URL o texto y extrae la letra dividiéndola
                  inteligentemente en secciones etiquetadas, sin importar el formato de la página.
                </p>
              </div>

              <div>
                <label className="block text-sm text-slate-400 mb-1.5">
                  Clave API de Claude (Anthropic)
                </label>
                <input
                  type="password"
                  defaultValue={claudeApiKey}
                  readOnly
                  className="w-full bg-slate-800/60 text-slate-500 rounded-xl px-4 py-2.5 border border-slate-700 text-sm cursor-not-allowed"
                  placeholder={claudeApiKey ? '••••••••••••••••' : 'No configurada'}
                />
                <p className="text-xs text-slate-500 mt-1.5">
                  Configura la clave en{' '}
                  <span className="text-indigo-400">Ajustes → Importar con IA</span>.
                </p>
              </div>

              <div className="bg-slate-800/60 rounded-2xl p-4 border border-slate-700 opacity-60">
                <p className="text-sm text-slate-400 mb-3">URL o texto a procesar</p>
                <input
                  disabled
                  className="w-full bg-slate-900 text-slate-600 rounded-xl px-4 py-2.5 border border-slate-700 text-sm cursor-not-allowed"
                  placeholder="https://... (disponible próximamente)"
                />
              </div>

              <div className="text-xs text-slate-600 bg-slate-800/40 rounded-xl p-3 border border-slate-700/50">
                Esta función estará disponible en una próxima actualización.
                Se requiere una clave de API de Anthropic (claude.ai).
              </div>
            </div>
          )}

          {/* ── SECTION PREVIEW ── */}
          {preview && preview.length > 0 && (
            <div className="border-t border-slate-700 pt-4">
              <p className="text-sm text-slate-400 mb-3">
                Vista previa — <span className="text-white font-medium">{preview.length} secciones detectadas</span>
              </p>
              <div className="flex flex-col gap-2 max-h-56 overflow-y-auto">
                {preview.map((s, i) => (
                  <div
                    key={i}
                    className={`rounded-xl px-3 py-2 border text-sm ${SECTION_COLOR[s.type] ?? 'bg-slate-800 border-slate-700'}`}
                  >
                    <span className="font-semibold text-xs uppercase tracking-wider text-slate-300 mr-2">
                      {SECTION_TYPE_LABEL[s.type] ?? s.type}
                    </span>
                    <span className="text-slate-400">{s.label}</span>
                    {s.lines.length > 0 && (
                      <p className="text-slate-300 mt-1 text-xs truncate">
                        {s.lines[0]}
                        {s.lines.length > 1 && ` · ${s.lines[1]}`}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {preview !== null && preview.length === 0 && (
            <div className="bg-yellow-950/40 border border-yellow-800/50 text-yellow-300 rounded-xl px-4 py-3 text-sm">
              No se detectaron secciones. Revisa el formato del texto o añade encabezados como
              [Verso 1], [Coro], etc.
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-700 shrink-0">
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl text-sm text-slate-400 hover:text-white transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleApply}
            disabled={!preview || preview.length === 0}
            className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white px-6 py-2 rounded-xl text-sm font-semibold transition-colors"
          >
            Aplicar {preview && preview.length > 0 ? `${preview.length} secciones` : ''}
          </button>
        </div>
      </div>
    </div>
  )
}
