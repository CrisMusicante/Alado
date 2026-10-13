import { useEffect, useState } from 'react'
import { DndContext, DragEndEvent, PointerSensor, useDroppable, useSensor, useSensors } from '@dnd-kit/core'
import { useSongsStore, Song, Folder } from '../../store/songs.store'
import { useFoldersStore } from '../../store/folders.store'
import SongEditor from '../../components/SongEditor/SongEditor'
import SongCard from './SongCard'
import FolderRow from './FolderRow'
import CreateFolderModal from './CreateFolderModal'
import RenameFolderModal from './RenameFolderModal'

// Drop zone used when inside a folder — drag song here to move it back to root
function RootDropZone({ children }: { children: React.ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id: 'root', data: { folderId: null } })
  return (
    <div
      ref={setNodeRef}
      className={`min-h-32 rounded-2xl transition-all duration-150 ${isOver ? 'ring-2 ring-indigo-400 ring-offset-2 ring-offset-slate-900' : ''}`}
    >
      {children}
    </div>
  )
}

export default function SongsPage() {
  const { songs, loading: songsLoading, searchQuery, setSearchQuery, fetchSongs, deleteSong } = useSongsStore()
  const {
    folders, currentFolderId, songsInView, loading: foldersLoading,
    fetchFolders, createFolder, renameFolder, deleteFolder,
    enterFolder, moveSongToFolder, refreshSongsInView
  } = useFoldersStore()

  const [editingSong, setEditingSong] = useState<Song | null>(null)
  const [showEditor, setShowEditor] = useState(false)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [renamingFolder, setRenamingFolder] = useState<Folder | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  )

  useEffect(() => {
    fetchFolders()
    enterFolder(null)
  }, [])

  // Global search: bypass folder view when query is active
  useEffect(() => {
    const timeout = setTimeout(() => fetchSongs(searchQuery || undefined), 200)
    return () => clearTimeout(timeout)
  }, [searchQuery])

  function openNew() {
    setEditingSong({ title: '', sections: [], text_style: {} })
    setShowEditor(true)
  }

  async function importPack() {
    try {
      const info = await window.api.packInspect()
      if (!info) return
      let mode: 'copy' | 'replace' = 'copy'
      if (info.duplicateOf !== null) {
        const replace = window.confirm(`"${info.title}" ya existe. Aceptar = reemplazar la existente · Cancelar = elegir otra opción`)
        if (replace) mode = 'replace'
        else if (!window.confirm('¿Crear una copia como canción nueva? (Cancelar = no importar)')) return
      }
      await window.api.packImport(info.path, mode)
      await fetchSongs()
      await refreshSongsInView()
    } catch (e) {
      window.alert((e as Error).message)
    }
  }

  function openEdit(song: Song) {
    setEditingSong(song)
    setShowEditor(true)
  }

  function closeEditor() {
    setShowEditor(false)
    setEditingSong(null)
    // Refresh both lists after save
    fetchSongs(searchQuery || undefined)
    refreshSongsInView()
  }

  async function handleDelete(song: Song) {
    if (confirm(`¿Eliminar "${song.title}"?`)) {
      await deleteSong(song.id!)
      refreshSongsInView()
    }
  }

  async function handleDeleteFolder(folder: Folder) {
    if (confirm(`¿Eliminar la carpeta "${folder.name}"? Las canciones dentro quedarán sin carpeta.`)) {
      await deleteFolder(folder.id!)
    }
  }

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over) return
    const songId = active.data.current?.songId as number | undefined
    const folderId = over.data.current?.folderId as number | null | undefined
    if (songId == null || folderId === undefined) return
    await moveSongToFolder(songId, folderId)
  }

  if (showEditor && editingSong) {
    return <SongEditor song={editingSong} onClose={closeEditor} />
  }

  const isSearching = searchQuery.length > 0
  const currentFolder = folders.find(f => f.id === currentFolderId)
  const loading = isSearching ? songsLoading : foldersLoading
  const displayedSongs = isSearching ? songs : songsInView

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          {currentFolderId !== null && !isSearching && (
            <button
              onClick={() => enterFolder(null)}
              className="text-slate-400 hover:text-white transition-colors text-sm flex items-center gap-1"
            >
              ← Canciones
            </button>
          )}
          <h1 className="text-2xl font-bold">
            {currentFolderId !== null && !isSearching ? currentFolder?.name ?? 'Carpeta' : 'Canciones'}
          </h1>
        </div>
        <div className="flex gap-2">
          {currentFolderId === null && (
            <button
              onClick={() => setShowCreateModal(true)}
              className="bg-slate-700 hover:bg-slate-600 text-white px-4 py-2.5 rounded-xl font-semibold transition-all duration-200 hover:scale-105 active:scale-95 text-sm"
            >
              + Nueva carpeta
            </button>
          )}
          <button
            onClick={importPack}
            className="bg-slate-700 hover:bg-slate-600 text-white px-4 py-2.5 rounded-xl font-semibold transition-all duration-200 hover:scale-105 active:scale-95 text-sm"
          >
            Importar paquete
          </button>
          <button
            onClick={openNew}
            className="bg-indigo-600 hover:bg-indigo-500 text-white px-5 py-2.5 rounded-xl font-semibold transition-all duration-200 hover:scale-105 active:scale-95"
          >
            + Nueva canción
          </button>
        </div>
      </div>

      {/* Search */}
      <input
        type="search"
        placeholder="Buscar por título o artista..."
        value={searchQuery}
        onChange={e => setSearchQuery(e.target.value)}
        className="w-full bg-slate-800 text-white placeholder-slate-400 rounded-xl px-4 py-3 mb-6 outline-none focus:ring-2 focus:ring-indigo-500 border border-slate-700"
      />

      <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
        {/* Folder row — only at root, not while searching */}
        {!isSearching && currentFolderId === null && (
          <FolderRow
            folders={folders}
            onEnter={folder => enterFolder(folder.id!)}
            onRename={folder => setRenamingFolder(folder)}
            onDelete={handleDeleteFolder}
          />
        )}

        {loading ? (
          <div className="text-center py-20 text-slate-500">
            <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            <p>Cargando...</p>
          </div>
        ) : displayedSongs.length === 0 ? (
          <div className="text-center py-20 text-slate-500">
            {currentFolderId !== null && !isSearching ? (
              <>
                <p className="text-5xl mb-4">📂</p>
                <p className="text-lg font-medium text-slate-400">Esta carpeta está vacía</p>
                <p className="text-sm mt-1">Arrastra canciones aquí para organizarlas</p>
              </>
            ) : (
              <>
                <p className="text-5xl mb-4">🎵</p>
                <p className="text-lg font-medium text-slate-400">No hay canciones aún</p>
                <p className="text-sm mt-1">Pulsa "+ Nueva canción" para comenzar</p>
              </>
            )}
          </div>
        ) : (
          /* Song grid — wrapped in RootDropZone when inside a folder so songs can be dragged out */
          currentFolderId !== null && !isSearching ? (
            <RootDropZone>
              <SongsGrid songs={displayedSongs} onEdit={openEdit} onDelete={handleDelete} insideFolder onRemoveFromFolder={s => moveSongToFolder(s.id!, null)} />
            </RootDropZone>
          ) : (
            <SongsGrid songs={displayedSongs} onEdit={openEdit} onDelete={handleDelete} />
          )
        )}
      </DndContext>

      {/* Modals */}
      {showCreateModal && (
        <CreateFolderModal
          onConfirm={async (name) => { await createFolder(name); setShowCreateModal(false) }}
          onCancel={() => setShowCreateModal(false)}
        />
      )}
      {renamingFolder && (
        <RenameFolderModal
          folder={renamingFolder}
          onConfirm={async (name) => { await renameFolder(renamingFolder.id!, name); setRenamingFolder(null) }}
          onCancel={() => setRenamingFolder(null)}
        />
      )}
    </div>
  )
}

function SongsGrid({
  songs, onEdit, onDelete, insideFolder, onRemoveFromFolder
}: {
  songs: Song[]
  onEdit: (s: Song) => void
  onDelete: (s: Song) => void
  insideFolder?: boolean
  onRemoveFromFolder?: (s: Song) => void
}) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
      {songs.map(song => (
        <SongCard
          key={song.id}
          song={song}
          onEdit={() => onEdit(song)}
          onDelete={() => onDelete(song)}
          onRemoveFromFolder={insideFolder && onRemoveFromFolder ? () => onRemoveFromFolder(song) : undefined}
        />
      ))}
    </div>
  )
}
