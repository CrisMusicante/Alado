import { useState } from 'react'
import { Song, Section, useSongsStore } from '../../store/songs.store'

interface Props {
  song: Song
  onClose: () => void
}

const SECTION_TYPES = [
  { value: 'verse', label: 'Verso' },
  { value: 'chorus', label: 'Coro' },
  { value: 'bridge', label: 'Puente' },
  { value: 'intro', label: 'Intro' },
  { value: 'outro', label: 'Outro' },
  { value: 'custom', label: 'Personalizado' }
] as const

export default function SongEditor({ song, onClose }: Props) {
  const { saveSong } = useSongsStore()
  const [title, setTitle] = useState(song.title)
  const [artist, setArtist] = useState(song.artist ?? '')
  const [sections, setSections] = useState<Section[]>(song.sections)
  const [videoPath, setVideoPath] = useState(song.video_path ?? '')
  const [saving, setSaving] = useState(false)

  async function handleSave() {
    if (!title.trim()) return
    setSaving(true)
    await saveSong({ ...song, title: title.trim(), artist: artist.trim() || undefined, sections, video_path: videoPath || undefined })
    setSaving(false)
    onClose()
  }

  async function pickVideo() {
    const path = await window.api.openFileDialog([
      { name: 'Video', extensions: ['mp4', 'webm', 'mov'] }
    ])
    if (path) setVideoPath(path)
  }

  function addSection() {
    setSections(prev => [...prev, { type: 'verse', label: `Verso ${prev.filter(s => s.type === 'verse').length + 1}`, lines: [] }])
  }

  function removeSection(index: number) {
    setSections(prev => prev.filter((_, i) => i !== index))
  }

  function updateSection(index: number, patch: Partial<Section>) {
    setSections(prev => prev.map((s, i) => i === index ? { ...s, ...patch } : s))
  }

  function updateLines(index: number, text: string) {
    updateSection(index, { lines: text.split('\n') })
  }

  return (
    <div className="flex flex-col h-full p-6 overflow-y-auto">
      <div className="flex items-center gap-4 mb-6">
        <button onClick={onClose} className="text-slate-400 hover:text-white text-lg">← Volver</button>
        <h1 className="text-2xl font-bold flex-1">{song.id ? 'Editar canción' : 'Nueva canción'}</h1>
        <button
          onClick={handleSave}
          disabled={saving || !title.trim()}
          className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white px-6 py-2.5 rounded-lg font-semibold transition-colors"
        >
          {saving ? 'Guardando...' : 'Guardar canción'}
        </button>
      </div>

      {/* Basic fields */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div>
          <label className="block text-sm text-slate-400 mb-1">Título *</label>
          <input
            value={title}
            onChange={e => setTitle(e.target.value)}
            className="w-full bg-slate-800 text-white rounded-lg px-4 py-2.5 outline-none focus:ring-2 focus:ring-indigo-500"
            placeholder="Nombre de la canción"
          />
        </div>
        <div>
          <label className="block text-sm text-slate-400 mb-1">Artista / Autor</label>
          <input
            value={artist}
            onChange={e => setArtist(e.target.value)}
            className="w-full bg-slate-800 text-white rounded-lg px-4 py-2.5 outline-none focus:ring-2 focus:ring-indigo-500"
            placeholder="Opcional"
          />
        </div>
      </div>

      {/* Video background */}
      <div className="mb-6">
        <label className="block text-sm text-slate-400 mb-1">Video de fondo</label>
        <div className="flex gap-2">
          <input
            value={videoPath}
            onChange={e => setVideoPath(e.target.value)}
            className="flex-1 bg-slate-800 text-white rounded-lg px-4 py-2.5 outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
            placeholder="Ruta del video (MP4, WebM)"
          />
          <button
            onClick={pickVideo}
            className="bg-slate-700 hover:bg-slate-600 text-white px-4 py-2.5 rounded-lg text-sm transition-colors"
          >
            Explorar...
          </button>
        </div>
      </div>

      {/* Sections */}
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg font-semibold">Secciones</h2>
        <button
          onClick={addSection}
          className="text-sm bg-slate-700 hover:bg-slate-600 text-white px-3 py-1.5 rounded-lg transition-colors"
        >
          + Añadir sección
        </button>
      </div>

      {sections.length === 0 && (
        <div className="text-center py-8 text-slate-500 border-2 border-dashed border-slate-700 rounded-xl mb-4">
          <p>Sin secciones. Añade un Verso, Coro, Puente...</p>
        </div>
      )}

      <div className="flex flex-col gap-4">
        {sections.map((section, i) => (
          <div key={i} className="bg-slate-800 rounded-xl p-4">
            <div className="flex gap-3 mb-3">
              <select
                value={section.type}
                onChange={e => updateSection(i, { type: e.target.value as any, label: SECTION_TYPES.find(t => t.value === e.target.value)?.label + ' ' + (i + 1) })}
                className="bg-slate-700 text-white rounded-lg px-3 py-2 outline-none"
              >
                {SECTION_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
              <input
                value={section.label}
                onChange={e => updateSection(i, { label: e.target.value })}
                className="flex-1 bg-slate-700 text-white rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="Etiqueta"
              />
              <button
                onClick={() => removeSection(i)}
                className="text-slate-500 hover:text-red-400 px-2 transition-colors"
                title="Eliminar sección"
              >
                ✕
              </button>
            </div>
            <textarea
              value={section.lines.join('\n')}
              onChange={e => updateLines(i, e.target.value)}
              rows={4}
              className="w-full bg-slate-900 text-white rounded-lg px-4 py-3 outline-none focus:ring-2 focus:ring-indigo-500 text-sm resize-none"
              placeholder="Escribe la letra aquí, una línea por renglón..."
            />
          </div>
        ))}
      </div>
    </div>
  )
}
