import { useEffect, useState } from 'react'
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragEndEvent } from '@dnd-kit/core'
import { arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Song, useSongsStore } from '../../store/songs.store'
import { useLiveStore } from '../../store/live.store'

interface SetlistSong {
  id: string  // unique key for DnD
  song: Song
}

export default function SetlistPage() {
  const { songs, fetchSongs } = useSongsStore()
  const { isLive, startLive, stopLive } = useLiveStore()
  const [setlistSongs, setSetlistSongs] = useState<SetlistSong[]>([])
  const [setlistName, setSetlistName] = useState(`Servicio ${new Date().toLocaleDateString('es')}`)
  const [searchQuery, setSearchQuery] = useState('')

  useEffect(() => { fetchSongs() }, [])

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  const filteredSongs = songs.filter(s =>
    s.title.toLowerCase().includes(searchQuery.toLowerCase())
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

  return (
    <div className="flex h-full">
      {/* Left: Song library */}
      <div className="w-80 border-r border-slate-800 p-4 flex flex-col">
        <h2 className="font-semibold text-slate-300 mb-3">Biblioteca</h2>
        <input
          type="search"
          placeholder="Buscar canción..."
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          className="bg-slate-800 text-white placeholder-slate-500 rounded-lg px-3 py-2 text-sm outline-none mb-3"
        />
        <div className="flex-1 overflow-y-auto flex flex-col gap-1">
          {filteredSongs.map(song => (
            <button
              key={song.id}
              onClick={() => addSong(song)}
              className="text-left px-3 py-2.5 rounded-lg hover:bg-slate-800 transition-colors group"
            >
              <p className="text-sm font-medium text-white truncate">{song.title}</p>
              {song.artist && <p className="text-xs text-slate-500 truncate">{song.artist}</p>}
            </button>
          ))}
        </div>
      </div>

      {/* Right: Setlist */}
      <div className="flex-1 p-6 flex flex-col">
        <div className="flex items-center gap-4 mb-4">
          <input
            value={setlistName}
            onChange={e => setSetlistName(e.target.value)}
            className="flex-1 bg-transparent text-xl font-bold text-white outline-none border-b border-transparent hover:border-slate-600 focus:border-indigo-500 transition-colors pb-1"
          />
          <button
            onClick={isLive ? stopLive : handlePresent}
            disabled={setlistSongs.length === 0 && !isLive}
            className={`px-8 py-3 rounded-xl font-bold text-lg transition-colors disabled:opacity-40
              ${isLive
                ? 'bg-red-600 hover:bg-red-500 text-white'
                : 'bg-emerald-600 hover:bg-emerald-500 text-white'
              }`}
          >
            {isLive ? '⏹ Detener' : '▶ Presentar'}
          </button>
        </div>

        {setlistSongs.length === 0 ? (
          <div className="flex-1 flex items-center justify-center text-slate-600 text-center">
            <div>
              <p className="text-4xl mb-3">📋</p>
              <p>Arrastra canciones aquí o pulsa una de la biblioteca</p>
            </div>
          </div>
        ) : (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={setlistSongs.map(s => s.id)} strategy={verticalListSortingStrategy}>
              <div className="flex flex-col gap-2">
                {setlistSongs.map((item, index) => (
                  <SortableSetlistItem
                    key={item.id}
                    id={item.id}
                    song={item.song}
                    index={index}
                    onRemove={() => removeSong(item.id)}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        )}
      </div>
    </div>
  )
}

function SortableSetlistItem({ id, song, index, onRemove }: {
  id: string; song: Song; index: number; onRemove: () => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id })
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 }
  const firstLines = song.sections[0]?.lines.slice(0, 2).join(' · ')

  return (
    <div ref={setNodeRef} style={style} className="flex items-center gap-3 bg-slate-800 rounded-xl px-4 py-3 group">
      <span {...attributes} {...listeners} className="text-slate-600 cursor-grab active:cursor-grabbing text-lg">⠿</span>
      <span className="text-slate-600 text-sm w-5 text-center">{index + 1}</span>
      <div className="flex-1 min-w-0" title={firstLines}>
        <p className="font-medium text-white truncate">{song.title}</p>
        {song.artist && <p className="text-xs text-slate-500">{song.artist}</p>}
      </div>
      <button onClick={onRemove} className="opacity-0 group-hover:opacity-100 text-slate-500 hover:text-red-400 transition-all px-1">✕</button>
    </div>
  )
}
