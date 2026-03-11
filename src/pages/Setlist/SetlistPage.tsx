import { useEffect, useState } from 'react'
import {
  DndContext, closestCenter, KeyboardSensor, PointerSensor,
  useSensor, useSensors, DragEndEvent
} from '@dnd-kit/core'
import {
  arrayMove, SortableContext, sortableKeyboardCoordinates,
  verticalListSortingStrategy, useSortable
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Song, useSongsStore } from '../../store/songs.store'
import { useLiveStore } from '../../store/live.store'
import { useSetlistsStore, SavedSetlist } from '../../store/setlists.store'

interface SetlistSong {
  id: string
  song: Song
}

export default function SetlistPage() {
  const { songs, fetchSongs } = useSongsStore()
  const { isLive, startLive, stopLive, changeSong, currentSong } = useLiveStore()
  const { setlists, fetchSetlists, saveSetlist } = useSetlistsStore()

  const [setlistSongs, setSetlistSongs] = useState<SetlistSong[]>([])
  const [setlistName, setSetlistName] = useState(`Servicio ${new Date().toLocaleDateString('es')}`)
  const [searchQuery, setSearchQuery] = useState('')
  const [showSaved, setShowSaved] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetchSongs()
    fetchSetlists()
  }, [])

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  const filteredSongs = songs.filter(s =>
    s.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (s.artist ?? '').toLowerCase().includes(searchQuery.toLowerCase())
  )

  function addSong(song: Song) {
    if (setlistSongs.find(s => s.song.id === song.id)) return
    setSetlistSongs(prev => [...prev, { id: `${song.id}-${Date.now()}`, song }])
  }

  function removeSong(id: string) {
    setSetlistSongs(prev => prev.filter(s => s.id !== id))
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (over && active.id !== over.id) {
      setSetlistSongs(prev => {
        const oldIndex = prev.findIndex(s => s.id === active.id)
        const newIndex = prev.findIndex(s => s.id === over.id)
        return arrayMove(prev, oldIndex, newIndex)
      })
    }
  }

  async function handlePresent() {
    if (setlistSongs.length === 0) return
    await startLive(setlistSongs.map(s => s.song))
  }

  async function handleSave() {
    if (setlistSongs.length === 0) return
    setSaving(true)
    await saveSetlist({
      name: setlistName,
      service_date: new Date().toISOString().slice(0, 10),
      songs: setlistSongs.map((s, i) => ({ song: s.song, position: i }))
    })
    setSaving(false)
  }

  function loadSetlist(saved: SavedSetlist) {
    if (!saved.songs) return
    setSetlistName(saved.name)
    setSetlistSongs(saved.songs.map((item, i) => ({
      id: `${item.song.id}-${i}-${Date.now()}`,
      song: item.song
    })))
    setShowSaved(false)
  }

  function handleSongClick(item: SetlistSong) {
    if (isLive) {
      changeSong(item.song)
    }
  }

  return (
    <div className="flex h-full">
      {/* Left: Song library */}
      <div className="w-72 border-r border-slate-800 p-4 flex flex-col bg-slate-950">
        <h2 className="font-semibold text-slate-300 mb-3 text-sm uppercase tracking-wide">Biblioteca</h2>
        <input
          type="search"
          placeholder="Buscar canción..."
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          className="bg-slate-800 text-white placeholder-slate-500 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500 border border-slate-700 mb-3"
        />
        <div className="flex-1 overflow-y-auto flex flex-col gap-1">
          {filteredSongs.map(song => (
            <button
              key={song.id}
              onClick={() => addSong(song)}
              className="text-left px-3 py-2.5 rounded-xl hover:bg-slate-800 transition-all duration-150 group border border-transparent hover:border-slate-700"
            >
              <p className="text-sm font-medium text-white truncate">{song.title}</p>
              {song.artist && <p className="text-xs text-slate-500 truncate">{song.artist}</p>}
            </button>
          ))}
          {filteredSongs.length === 0 && (
            <p className="text-xs text-slate-600 text-center py-4">Sin resultados</p>
          )}
        </div>
      </div>

      {/* Right: Setlist */}
      <div className="flex-1 p-6 flex flex-col">
        {/* Header row */}
        <div className="flex items-center gap-3 mb-5">
          <input
            value={setlistName}
            onChange={e => setSetlistName(e.target.value)}
            className="flex-1 bg-transparent text-xl font-bold text-white outline-none border-b border-transparent hover:border-slate-600 focus:border-indigo-500 transition-colors pb-1"
          />

          {/* Saved setlists button */}
          <div className="relative">
            <button
              onClick={() => setShowSaved(!showSaved)}
              className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm transition-colors border border-slate-700"
              title="Servicios guardados"
            >
              📂 Cargar
            </button>
            {showSaved && (
              <div className="absolute right-0 top-full mt-1 w-72 bg-slate-800 border border-slate-700 rounded-2xl shadow-xl z-10 overflow-hidden">
                <div className="p-3 border-b border-slate-700">
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Servicios guardados</p>
                </div>
                {setlists.length === 0 ? (
                  <p className="text-sm text-slate-500 text-center py-6">Sin servicios guardados</p>
                ) : (
                  <div className="max-h-64 overflow-y-auto">
                    {setlists.map((sl: SavedSetlist) => (
                      <button
                        key={sl.id}
                        onClick={() => loadSetlist(sl)}
                        className="w-full text-left px-4 py-3 hover:bg-slate-700 transition-colors border-b border-slate-700/50 last:border-0"
                      >
                        <p className="text-sm font-medium text-white">{sl.name}</p>
                        {sl.service_date && (
                          <p className="text-xs text-slate-500">{sl.service_date} · {sl.songs?.length ?? 0} canciones</p>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          <button
            onClick={handleSave}
            disabled={setlistSongs.length === 0 || saving}
            className="px-4 py-2 rounded-xl bg-slate-700 hover:bg-slate-600 disabled:opacity-40 text-white text-sm font-medium transition-colors border border-slate-600"
          >
            {saving ? 'Guardando...' : '💾 Guardar'}
          </button>

          <button
            onClick={isLive ? stopLive : handlePresent}
            disabled={setlistSongs.length === 0 && !isLive}
            className={`px-7 py-2.5 rounded-xl font-bold text-base transition-all duration-200 disabled:opacity-40 hover:scale-105 active:scale-95
              ${isLive
                ? 'bg-red-600 hover:bg-red-500 text-white'
                : 'bg-emerald-600 hover:bg-emerald-500 text-white'
              }`}
          >
            {isLive ? '⏹ Detener' : '▶ Presentar'}
          </button>
        </div>

        {/* Setlist */}
        {setlistSongs.length === 0 ? (
          <div className="flex-1 flex items-center justify-center text-slate-600 text-center border-2 border-dashed border-slate-800 rounded-2xl">
            <div>
              <p className="text-4xl mb-3">📋</p>
              <p className="text-slate-500">Pulsa una canción de la biblioteca para añadirla</p>
            </div>
          </div>
        ) : (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={setlistSongs.map(s => s.id)} strategy={verticalListSortingStrategy}>
              <div className="flex flex-col gap-2 overflow-y-auto">
                {setlistSongs.map((item, index) => {
                  const isCurrentSong = isLive && currentSong?.id === item.song.id
                  return (
                    <SortableSetlistItem
                      key={item.id}
                      id={item.id}
                      song={item.song}
                      index={index}
                      isLive={isLive}
                      isCurrentSong={isCurrentSong}
                      onRemove={() => removeSong(item.id)}
                      onClick={() => handleSongClick(item)}
                    />
                  )
                })}
              </div>
            </SortableContext>
          </DndContext>
        )}
      </div>
    </div>
  )
}

function SortableSetlistItem({ id, song, index, isLive, isCurrentSong, onRemove, onClick }: {
  id: string
  song: Song
  index: number
  isLive: boolean
  isCurrentSong: boolean
  onRemove: () => void
  onClick: () => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id })
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1
  }
  const firstLines = song.sections[0]?.lines.slice(0, 2).join(' · ')

  return (
    <div
      ref={setNodeRef}
      style={style}
      onClick={isLive ? onClick : undefined}
      className={`flex items-center gap-3 rounded-2xl px-4 py-3 group border transition-all duration-150
        ${isCurrentSong
          ? 'bg-indigo-950 border-indigo-500 border-l-4'
          : isLive
            ? 'bg-slate-800 border-slate-700 hover:border-indigo-400 hover:bg-slate-750 cursor-pointer'
            : 'bg-slate-800 border-slate-700'
        }`}
    >
      <span
        {...attributes}
        {...listeners}
        className="text-slate-600 cursor-grab active:cursor-grabbing text-lg select-none"
      >
        ⠿
      </span>
      <span className={`text-sm w-6 text-center font-mono shrink-0
        ${isCurrentSong ? 'text-indigo-400' : 'text-slate-600'}`}>
        {isCurrentSong ? '▶' : index + 1}
      </span>
      <div className="flex-1 min-w-0" title={firstLines}>
        <p className={`font-medium truncate ${isCurrentSong ? 'text-indigo-100' : 'text-white'}`}>
          {song.title}
        </p>
        {song.artist && (
          <p className="text-xs text-slate-500 truncate">{song.artist}</p>
        )}
      </div>
      <button
        onClick={e => { e.stopPropagation(); onRemove() }}
        className="opacity-0 group-hover:opacity-100 text-slate-500 hover:text-red-400 transition-all px-1"
      >
        ✕
      </button>
    </div>
  )
}
