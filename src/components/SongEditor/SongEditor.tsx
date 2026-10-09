import { useState } from 'react'
import { Song, Section, TextStyle, useSongsStore } from '../../store/songs.store'
import LyricsImportModal from './LyricsImportModal'
import {
  DndContext, closestCenter, KeyboardSensor, PointerSensor,
  useSensor, useSensors, DragEndEvent
} from '@dnd-kit/core'
import {
  arrayMove, SortableContext, sortableKeyboardCoordinates,
  verticalListSortingStrategy, useSortable
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

interface Props {
  song: Song
  onClose: () => void
}

const SECTION_TYPES = [
  { value: 'verse',      label: 'Verso' },
  { value: 'chorus',     label: 'Coro' },
  { value: 'estribillo', label: 'Estribillo' },
  { value: 'pre-chorus', label: 'Pre-Coro' },
  { value: 'bridge',     label: 'Puente' },
  { value: 'intro',      label: 'Intro' },
  { value: 'outro',      label: 'Outro' },
  { value: 'custom',     label: 'Personalizado' },
] as const

const SECTION_BORDER: Record<string, string> = {
  verse:      'border-l-blue-500',
  chorus:     'border-l-indigo-500',
  estribillo: 'border-l-violet-500',
  'pre-chorus': 'border-l-cyan-500',
  bridge:     'border-l-purple-500',
  intro:      'border-l-slate-400',
  outro:      'border-l-slate-400',
  custom:     'border-l-teal-500',
}

function SortableSectionCard({ id, section, index, onUpdate, onUpdateLines, onRemove }: {
  id: string
  section: Section
  index: number
  onUpdate: (i: number, patch: Partial<Section>) => void
  onUpdateLines: (i: number, text: string) => void
  onRemove: (i: number) => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id })
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`bg-slate-800 rounded-2xl p-4 border border-slate-700 border-l-4 ${SECTION_BORDER[section.type] ?? 'border-l-slate-500'}`}
    >
      <div className="flex gap-3 mb-3">
        <span
          {...attributes}
          {...listeners}
          className="text-slate-600 hover:text-slate-400 cursor-grab active:cursor-grabbing text-lg select-none flex items-center"
          title="Arrastrar para reordenar"
        >
          ⠿
        </span>
        <select
          value={section.type}
          onChange={e => {
            const newType = e.target.value as Section['type']
            const baseLabel = SECTION_TYPES.find(t => t.value === newType)?.label ?? newType
            onUpdate(index, { type: newType, label: baseLabel })
          }}
          className="bg-slate-700 text-white rounded-lg px-3 py-2 outline-none border border-slate-600"
        >
          {SECTION_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
        </select>
        <input
          value={section.label}
          onChange={e => onUpdate(index, { label: e.target.value })}
          className="flex-1 bg-slate-700 text-white rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-500 border border-slate-600"
          placeholder="Etiqueta"
        />
        <button
          onClick={() => onRemove(index)}
          className="text-slate-500 hover:text-red-400 px-2 transition-colors"
          title="Eliminar sección"
        >
          ✕
        </button>
      </div>
      <textarea
        value={section.lines.join('\n')}
        onChange={e => onUpdateLines(index, e.target.value)}
        rows={4}
        className="w-full bg-slate-900 text-white rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-indigo-500 text-sm resize-none border border-slate-700"
        placeholder="Escribe la letra aquí, una línea por renglón..."
      />
    </div>
  )
}

export default function SongEditor({ song, onClose }: Props) {
  const { saveSong } = useSongsStore()
  const [title, setTitle] = useState(song.title)
  const [artist, setArtist] = useState(song.artist ?? '')
  const [sections, setSections] = useState<Section[]>(song.sections)
  const [videoPath, setVideoPath] = useState(song.video_path ?? '')
  const [textStyle, setTextStyle] = useState<Partial<TextStyle>>(song.text_style ?? {})
  const [saving, setSaving] = useState(false)
  const [showImport, setShowImport] = useState(false)

  function updateTextStyle(patch: Partial<TextStyle>) {
    setTextStyle(prev => ({ ...prev, ...patch }))
  }

  async function handleSave() {
    if (!title.trim()) return
    setSaving(true)
    await saveSong({
      ...song,
      title: title.trim(),
      artist: artist.trim() || undefined,
      sections,
      video_path: videoPath || undefined,
      text_style: textStyle
    })
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
    setSections(prev => [...prev, {
      type: 'verse',
      label: `Verso ${prev.filter(s => s.type === 'verse').length + 1}`,
      lines: []
    }])
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

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (over && active.id !== over.id) {
      const oldIndex = sections.findIndex((_, i) => `section-${i}` === active.id)
      const newIndex = sections.findIndex((_, i) => `section-${i}` === over.id)
      setSections(prev => arrayMove(prev, oldIndex, newIndex))
    }
  }

  return (
    <div className="flex flex-col h-full p-6 overflow-y-auto">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <button
          onClick={onClose}
          className="text-slate-400 hover:text-white transition-colors text-lg"
        >
          ← Volver
        </button>
        <h1 className="text-2xl font-bold flex-1">
          {song.id ? 'Editar canción' : 'Nueva canción'}
        </h1>
        <button
          onClick={handleSave}
          disabled={saving || !title.trim()}
          className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white px-6 py-2.5 rounded-xl font-semibold transition-all duration-200 hover:scale-105 active:scale-95"
        >
          {saving ? 'Guardando...' : 'Guardar canción'}
        </button>
      </div>

      {/* Basic fields */}
      <div className="grid grid-cols-2 gap-4 mb-5">
        <div>
          <label className="block text-sm text-slate-400 mb-1.5">Título *</label>
          <input
            value={title}
            onChange={e => setTitle(e.target.value)}
            className="w-full bg-slate-800 text-white rounded-xl px-4 py-2.5 outline-none focus:ring-2 focus:ring-indigo-500 border border-slate-700"
            placeholder="Nombre de la canción"
          />
        </div>
        <div>
          <label className="block text-sm text-slate-400 mb-1.5">Artista / Autor</label>
          <input
            value={artist}
            onChange={e => setArtist(e.target.value)}
            className="w-full bg-slate-800 text-white rounded-xl px-4 py-2.5 outline-none focus:ring-2 focus:ring-indigo-500 border border-slate-700"
            placeholder="Opcional"
          />
        </div>
      </div>

      {/* Video background */}
      <div className="mb-5">
        <label className="block text-sm text-slate-400 mb-1.5">Video de fondo</label>
        <div className="flex gap-2">
          <input
            value={videoPath}
            onChange={e => setVideoPath(e.target.value)}
            className="flex-1 bg-slate-800 text-white rounded-xl px-4 py-2.5 outline-none focus:ring-2 focus:ring-indigo-500 border border-slate-700 text-sm"
            placeholder="Ruta del video (MP4, WebM, MOV)"
          />
          <button
            onClick={pickVideo}
            className="bg-slate-700 hover:bg-slate-600 text-white px-4 py-2.5 rounded-xl text-sm transition-colors border border-slate-600"
          >
            Explorar...
          </button>
        </div>
      </div>

      {/* Text Style Panel */}
      <div className="mb-6 bg-slate-800 rounded-2xl p-4 border border-slate-700">
        <h2 className="text-xs font-semibold text-slate-400 mb-4 uppercase tracking-widest">
          Estilo del texto en pantalla
        </h2>
        <div className="grid grid-cols-2 gap-4">
          {/* Font */}
          <div>
            <label className="block text-xs text-slate-400 mb-2">Fuente</label>
            <div className="flex gap-1.5">
              {(['sans', 'rounded', 'bold-condensed'] as const).map(f => (
                <button key={f} onClick={() => updateTextStyle({ font: f })}
                  className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition-colors border
                    ${textStyle.font === f
                      ? 'bg-indigo-600 border-indigo-500 text-white'
                      : 'bg-slate-700 border-slate-600 text-slate-300 hover:bg-slate-600'}`}
                >
                  {f === 'sans' ? 'Sans' : f === 'rounded' ? 'Redondo' : 'Bold'}
                </button>
              ))}
            </div>
          </div>

          {/* Size */}
          <div>
            <label className="block text-xs text-slate-400 mb-2">Tamaño</label>
            <div className="flex gap-1.5">
              {(['sm', 'md', 'lg', 'xl'] as const).map(s => (
                <button key={s} onClick={() => updateTextStyle({ size: s })}
                  className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition-colors border
                    ${textStyle.size === s
                      ? 'bg-indigo-600 border-indigo-500 text-white'
                      : 'bg-slate-700 border-slate-600 text-slate-300 hover:bg-slate-600'}`}
                >
                  {s.toUpperCase()}
                </button>
              ))}
            </div>
          </div>

          {/* Position */}
          <div>
            <label className="block text-xs text-slate-400 mb-2">Posición</label>
            <div className="flex gap-1.5">
              {([['top', '↑ Arriba'], ['center', '↕ Centro'], ['bottom', '↓ Abajo']] as [string, string][]).map(([pos, lbl]) => (
                <button key={pos} onClick={() => updateTextStyle({ position: pos as any })}
                  className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition-colors border
                    ${textStyle.position === pos
                      ? 'bg-indigo-600 border-indigo-500 text-white'
                      : 'bg-slate-700 border-slate-600 text-slate-300 hover:bg-slate-600'}`}
                >
                  {lbl}
                </button>
              ))}
            </div>
          </div>

          {/* Color + Effects */}
          <div>
            <label className="block text-xs text-slate-400 mb-2">Color y efectos</label>
            <div className="flex items-center gap-1.5">
              <input
                type="color"
                value={textStyle.color ?? '#FFFFFF'}
                onChange={e => updateTextStyle({ color: e.target.value })}
                className="w-9 h-9 rounded-lg cursor-pointer border border-slate-600 bg-slate-700 p-0.5 shrink-0"
                title="Color del texto"
              />
              <button
                onClick={() => updateTextStyle({ shadow: !textStyle.shadow })}
                className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition-colors border
                  ${textStyle.shadow
                    ? 'bg-indigo-600 border-indigo-500 text-white'
                    : 'bg-slate-700 border-slate-600 text-slate-300 hover:bg-slate-600'}`}
              >
                Sombra
              </button>
              <button
                onClick={() => updateTextStyle({ stroke: !textStyle.stroke })}
                className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition-colors border
                  ${textStyle.stroke
                    ? 'bg-indigo-600 border-indigo-500 text-white'
                    : 'bg-slate-700 border-slate-600 text-slate-300 hover:bg-slate-600'}`}
              >
                Contorno
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Sections */}
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg font-semibold">Secciones</h2>
        <div className="flex gap-2">
          <button
            onClick={() => setShowImport(true)}
            className="text-sm bg-slate-700 hover:bg-slate-600 text-white px-3 py-1.5 rounded-xl transition-colors border border-slate-600"
          >
            Importar letra
          </button>
          <button
            onClick={addSection}
            className="text-sm bg-slate-700 hover:bg-slate-600 text-white px-3 py-1.5 rounded-xl transition-colors border border-slate-600"
          >
            + Añadir sección
          </button>
        </div>
      </div>

      {sections.length === 0 && (
        <div className="text-center py-10 text-slate-500 border-2 border-dashed border-slate-700 rounded-2xl mb-4">
          <p className="text-3xl mb-2">🎼</p>
          <p>Sin secciones. Añade un Verso, Coro, Puente...</p>
        </div>
      )}

      {showImport && (
        <LyricsImportModal
          onApply={(imported) => { setSections(imported); setShowImport(false) }}
          onClose={() => setShowImport(false)}
        />
      )}

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={sections.map((_, i) => `section-${i}`)} strategy={verticalListSortingStrategy}>
          <div className="flex flex-col gap-4">
            {sections.map((section, i) => (
              <SortableSectionCard
                key={`section-${i}`}
                id={`section-${i}`}
                section={section}
                index={i}
                onUpdate={updateSection}
                onUpdateLines={updateLines}
                onRemove={removeSection}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>
    </div>
  )
}
