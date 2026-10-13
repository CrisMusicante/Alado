import { Folder } from '../../store/songs.store'
import FolderCard from './FolderCard'

interface Props {
  folders: Folder[]
  onEnter: (folder: Folder) => void
  onRename: (folder: Folder) => void
  onDelete: (folder: Folder) => void
}

export default function FolderRow({ folders, onEnter, onRename, onDelete }: Props) {
  if (folders.length === 0) return null

  return (
    <div className="mb-6">
      <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Carpetas</h2>
      <div className="flex flex-wrap gap-3">
        {folders.map(folder => (
          <FolderCard
            key={folder.id}
            folder={folder}
            onEnter={() => onEnter(folder)}
            onRename={() => onRename(folder)}
            onDelete={() => onDelete(folder)}
          />
        ))}
      </div>
    </div>
  )
}
