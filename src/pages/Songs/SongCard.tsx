import { useDraggable } from '@dnd-kit/core'
import { Song } from '../../store/songs.store'

interface Props {
  song: Song
  onEdit: () => void
  onDelete: () => void
  onRemoveFromFolder?: () => void
}

export default function SongCard({ song, onEdit, onDelete, onRemoveFromFolder }: Props) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `song-${song.id}`,
    data: { songId: song.id }
  })

  const style = transform
    ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` }
    : undefined

  const firstSection = song.sections[0]
  const preview = firstSection?.lines.slice(0, 2).join(' · ') ?? ''

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`bg-slate-800 rounded-2xl p-4 transition-all duration-200 group border border-slate-700 hover:border-slate-600 hover:bg-slate-750 cursor-grab active:cursor-grabbing select-none${isDragging ? ' opacity-40 scale-95 shadow-2xl z-50' : ''}`}
      {...attributes}
      {...listeners}
    >
      <div className="flex items-start justify-between mb-2">
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-white truncate">{song.title}</h3>
          {song.artist && <p className="text-sm text-slate-400 truncate">{song.artist}</p>}
        </div>
        <div
          className="flex gap-1 ml-2 opacity-0 group-hover:opacity-100 transition-opacity"
          onPointerDown={e => e.stopPropagation()}
        >
          {onRemoveFromFolder && (
            <button
              onClick={e => { e.stopPropagation(); onRemoveFromFolder() }}
              className="text-slate-400 hover:text-amber-400 p-1.5 rounded-lg hover:bg-slate-700 transition-colors text-xs"
              title="Sacar de carpeta"
            >
              📤
            </button>
          )}
          <button
            onClick={e => { e.stopPropagation(); onEdit() }}
            className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-slate-700 transition-colors"
            title="Editar"
          >
            ✏️
          </button>
          <button
            onClick={e => { e.stopPropagation(); onDelete() }}
            className="text-slate-400 hover:text-red-400 p-1.5 rounded-lg hover:bg-slate-700 transition-colors"
            title="Eliminar"
          >
            🗑️
          </button>
        </div>
      </div>
      {preview && <p className="text-sm text-slate-500 truncate mt-1">{preview}</p>}
      <div className="flex items-center justify-between mt-3">
        <span className="text-xs text-slate-600">{song.sections.length} sección{song.sections.length !== 1 ? 'es' : ''}</span>
        {song.video_path && (
          <span className="text-xs text-indigo-400 bg-indigo-950 px-2 py-0.5 rounded-full">🎬 Video</span>
        )}
      </div>
    </div>
  )
}
