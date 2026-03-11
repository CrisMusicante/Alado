import { useEffect, useState } from 'react'
import { useSongsStore, Song } from '../../store/songs.store'
import SongEditor from '../../components/SongEditor/SongEditor'

export default function SongsPage() {
  const { songs, loading, searchQuery, setSearchQuery, fetchSongs, deleteSong } = useSongsStore()
  const [editingSong, setEditingSong] = useState<Song | null>(null)
  const [showEditor, setShowEditor] = useState(false)

  useEffect(() => {
    fetchSongs()
  }, [])

  useEffect(() => {
    const timeout = setTimeout(() => fetchSongs(searchQuery || undefined), 200)
    return () => clearTimeout(timeout)
  }, [searchQuery])

  function openNew() {
    setEditingSong({ title: '', sections: [], text_style: {} })
    setShowEditor(true)
  }

  function openEdit(song: Song) {
    setEditingSong(song)
    setShowEditor(true)
  }

  function closeEditor() {
    setShowEditor(false)
    setEditingSong(null)
  }

  if (showEditor && editingSong) {
    return <SongEditor song={editingSong} onClose={closeEditor} />
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Canciones</h1>
        <button
          onClick={openNew}
          className="bg-indigo-600 hover:bg-indigo-500 text-white px-5 py-2.5 rounded-lg font-semibold transition-colors"
        >
          + Nueva canción
        </button>
      </div>

      <input
        type="search"
        placeholder="Buscar por título o letra..."
        value={searchQuery}
        onChange={e => setSearchQuery(e.target.value)}
        className="w-full bg-slate-800 text-white placeholder-slate-400 rounded-lg px-4 py-3 mb-6 outline-none focus:ring-2 focus:ring-indigo-500"
      />

      {loading ? (
        <p className="text-slate-400">Cargando...</p>
      ) : songs.length === 0 ? (
        <div className="text-center py-20 text-slate-500">
          <p className="text-5xl mb-4">🎵</p>
          <p className="text-lg">No hay canciones aún.</p>
          <p>Pulsa "+ Nueva canción" para comenzar.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {songs.map(song => (
            <SongCard
              key={song.id}
              song={song}
              onEdit={() => openEdit(song)}
              onDelete={() => {
                if (confirm(`¿Eliminar "${song.title}"?`)) deleteSong(song.id!)
              }}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function SongCard({ song, onEdit, onDelete }: { song: Song; onEdit: () => void; onDelete: () => void }) {
  const firstSection = song.sections[0]
  const preview = firstSection?.lines.slice(0, 2).join(' · ') ?? ''

  return (
    <div className="bg-slate-800 rounded-xl p-4 hover:bg-slate-750 transition-colors group">
      <div className="flex items-start justify-between mb-2">
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-white truncate">{song.title}</h3>
          {song.artist && <p className="text-sm text-slate-400 truncate">{song.artist}</p>}
        </div>
        <div className="flex gap-2 ml-2 opacity-0 group-hover:opacity-100 transition-opacity">
          <button onClick={onEdit} className="text-slate-400 hover:text-white p-1" title="Editar">✏️</button>
          <button onClick={onDelete} className="text-slate-400 hover:text-red-400 p-1" title="Eliminar">🗑️</button>
        </div>
      </div>
      {preview && <p className="text-sm text-slate-500 truncate">{preview}</p>}
      <p className="text-xs text-slate-600 mt-2">{song.sections.length} secciones</p>
    </div>
  )
}
