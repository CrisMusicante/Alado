import { useDroppable } from '@dnd-kit/core'
import { Folder } from '../../store/songs.store'

interface Props {
  folder: Folder
  onEnter: () => void
  onRename: () => void
  onDelete: () => void
}

export default function FolderCard({ folder, onEnter, onRename, onDelete }: Props) {
  const { setNodeRef, isOver } = useDroppable({
    id: `folder-${folder.id}`,
    data: { folderId: folder.id }
  })

  return (
    <div
      ref={setNodeRef}
      onClick={onEnter}
      className={`relative group flex flex-col items-center justify-center gap-2 w-36 h-24 rounded-2xl border cursor-pointer transition-all duration-150 select-none
        ${isOver
          ? 'border-indigo-400 bg-indigo-950 scale-105'
          : 'border-slate-700 bg-slate-800 hover:border-slate-500 hover:bg-slate-750'
        }`}
    >
      <span className="text-3xl leading-none">📁</span>
      <span className="text-xs font-medium text-slate-300 max-w-[7rem] truncate text-center px-1">
        {folder.name}
      </span>

      {/* Hover actions */}
      <div
        className="absolute top-1.5 right-1.5 flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
        onPointerDown={e => e.stopPropagation()}
        onClick={e => e.stopPropagation()}
      >
        <button
          onClick={onRename}
          className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-700 transition-colors text-xs"
          title="Renombrar"
        >
          ✏️
        </button>
        <button
          onClick={onDelete}
          className="text-slate-400 hover:text-red-400 p-1 rounded-lg hover:bg-slate-700 transition-colors text-xs"
          title="Eliminar carpeta"
        >
          🗑️
        </button>
      </div>
    </div>
  )
}
