import { useEffect, useRef, useState } from 'react'
import {
  DndContext, closestCenter, KeyboardSensor, PointerSensor,
  useSensor, useSensors, DragEndEvent
} from '@dnd-kit/core'
import {
  SortableContext, sortableKeyboardCoordinates,
  verticalListSortingStrategy, useSortable
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Song, useSongsStore } from '../../store/songs.store'
import { useLiveStore } from '../../store/live.store'
import { useSetlistsStore, SavedSetlist } from '../../store/setlists.store'
import { useFoldersStore } from '../../store/folders.store'
import { useServiceDraftStore, defaultServiceName, formatServiceDate } from '../../store/serviceDraft.store'
import { confirmDialog, alertDialog, ask } from '../../store/dialog.store'
import { ipcErrorMessage } from '../../utils/ipcError'
import { importSummaryText } from '../../utils/importSummary'
import { exportServicePptx } from '../../setlist/pptxExport'
import { showToast } from '../../store/toast.store'
import { groupSongs, FolderFilter } from '../../utils/songGroups'
import LyricsHoverCard from './LyricsHoverCard'
import SectionList from './SectionList'

const HOVER_DELAY_MS = 400

export default function SetlistPage() {
  const { songs, fetchSongs } = useSongsStore()
  const { isLive, startLive, stopLive, changeSong, currentSong } = useLiveStore()
  const { setlists, fetchSetlists, saveSetlist, deleteSetlist } = useSetlistsStore()
  const { folders, fetchFolders } = useFoldersStore()
  const {
    setlistId, name: setlistName, serviceDate, notes, items: setlistSongs, dirty,
    addSong, removeItem, moveItem, setName, setServiceDate, setNotes, loadSaved, reset, markSaved, syncWithCatalog,
    forgetSavedSetlist
  } = useServiceDraftStore()

  const [searchQuery, setSearchQuery] = useState('')
  const [folderFilter, setFolderFilter] = useState<FolderFilter>('all')
  const [showSaved, setShowSaved] = useState(false)
  const [saving, setSaving] = useState(false)
  const [showExport, setShowExport] = useState(false)
  const [hover, setHover] = useState<{ song: Song; rect: DOMRect } | null>(null)
  const hoverTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    // Unfiltered fetch, then refresh the draft's song snapshots (and drop deleted songs).
    fetchSongs().then(() => syncWithCatalog(useSongsStore.getState().songs))
    fetchSetlists()
    fetchFolders()
  }, [])

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  const groups = groupSongs(songs, folders, folderFilter, searchQuery)
  const hasLoose = songs.some(s => s.folder_id == null || !folders.some(f => f.id === s.folder_id))
  const inSetlist = new Set(setlistSongs.map(s => s.song.id))

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (over && active.id !== over.id) moveItem(String(active.id), String(over.id))
  }

  async function handlePresent() {
    if (setlistSongs.length === 0) return
    await startLive(setlistSongs.map(s => s.song))
  }

  /** Asks before discarding unsaved changes in the draft. */
  async function canDiscardDraft(message: string): Promise<boolean> {
    return !dirty || confirmDialog(message, { title: 'Cambios sin guardar', confirmLabel: 'Continuar', danger: true })
  }

  async function handleSave() {
    if (setlistSongs.length === 0 || saving) return
    setSaving(true)
    try {
      const id = await saveSetlist({
        id: setlistId ?? undefined,
        name: setlistName.trim() || defaultServiceName(serviceDate),
        service_date: serviceDate,
        notes: notes.trim() || null,
        songs: setlistSongs.map((s, i) => ({ song: s.song, position: i, custom_video: s.custom_video }))
      })
      markSaved(id)
      showToast('Servicio guardado')
    } catch (e) {
      console.error('No se pudo guardar el servicio', e)
      showToast('No se pudo guardar el servicio', 'error')
    } finally {
      setSaving(false)
    }
  }

  async function handleExportAlado() {
    setShowExport(false)
    try {
      const res = await window.api.setlistExport({
        name: setlistName.trim() || defaultServiceName(serviceDate), service_date: serviceDate,
        notes: notes.trim() || null, songIds: setlistSongs.map(s => s.song.id!), customVideos: setlistSongs.map(s => s.custom_video)
      })
      if (res) showToast('Servicio exportado')
    } catch (e) {
      await alertDialog(ipcErrorMessage(e), 'No se pudo exportar')
    }
  }

  async function handleExportPptx() {
    setShowExport(false)
    showToast('Generando PowerPoint…')
    try {
      const res = await exportServicePptx(setlistName, setlistSongs.map(s => s.song))
      if (res) showToast('PowerPoint exportado')
    } catch (e) {
      await alertDialog(ipcErrorMessage(e), 'No se pudo exportar el PowerPoint')
    }
  }

  async function handleImport() {
    if (!(await canDiscardDraft('Hay cambios sin guardar. ¿Importar otro servicio de todos modos?'))) return
    try {
      const info = await window.api.setlistImportInspect()
      if (!info) return
      let mode: 'new' | 'replace' = 'new'
      if (info.duplicateOf) {
        const choice = await ask({
          title: 'Este servicio ya existe',
          message: `Ya hay un servicio guardado "${info.name}"${info.service_date ? ` del ${info.service_date}` : ''}. ¿Qué quieres hacer?`,
          actions: [
            { label: 'Cancelar', value: 'cancel', variant: 'neutral' },
            { label: 'Crear copia', value: 'new', variant: 'neutral' },
            { label: 'Reemplazar', value: 'replace', variant: 'primary' }
          ]
        })
        if (choice !== 'new' && choice !== 'replace') return
        mode = choice
      }
      const summary = await window.api.setlistImportApply({ path: info.path, mode, replaceId: info.duplicateOf ?? undefined })
      await fetchSetlists()
      await fetchSongs()
      const saved = useSetlistsStore.getState().setlists.find(sl => sl.id === summary.setlistId)
      if (saved) loadSaved(saved)
      await alertDialog(importSummaryText(summary), 'Servicio importado')
    } catch (e) {
      await alertDialog(ipcErrorMessage(e), 'No se pudo importar')
    }
  }

  async function handleDeleteSaved(sl: SavedSetlist) {
    const when = sl.service_date ? ` del ${formatServiceDate(sl.service_date)}` : ''
    const ok = await confirmDialog(`Se borrará "${sl.name}"${when}. Las canciones no se borran.`,
      { title: 'Borrar servicio guardado', confirmLabel: 'Borrar', danger: true })
    if (!ok || sl.id == null) return
    try {
      await deleteSetlist(sl.id)
      forgetSavedSetlist(sl.id)
      showToast('Servicio borrado')
    } catch (e) {
      await alertDialog(ipcErrorMessage(e), 'No se pudo borrar')
    }
  }

  async function handleNew() {
    if (!(await canDiscardDraft('Hay cambios sin guardar. ¿Empezar un servicio nuevo?'))) return
    reset()
  }

  async function loadSetlist(saved: SavedSetlist) {
    if (!saved.songs) return
    setShowSaved(false)
    if (!(await canDiscardDraft(`Hay cambios sin guardar. ¿Cargar "${saved.name}" de todos modos?`))) return
    loadSaved(saved)
  }

  function handleSongClick(song: Song) {
    if (isLive) changeSong(song)
  }

  function scheduleHover(song: Song, el: HTMLElement) {
    if (hoverTimer.current) clearTimeout(hoverTimer.current)
    hoverTimer.current = setTimeout(() => setHover({ song, rect: el.getBoundingClientRect() }), HOVER_DELAY_MS)
  }

  function hideHover() {
    if (hoverTimer.current) clearTimeout(hoverTimer.current)
    hoverTimer.current = null
    setHover(null)
  }

  return (
    <div className="flex h-full">
      {hover && <LyricsHoverCard song={hover.song} anchorRect={hover.rect} />}
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
        {folders.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-3">
            <FolderChip active={folderFilter === 'all'} onClick={() => setFolderFilter('all')}>Todas</FolderChip>
            {folders.map(f => (
              <FolderChip key={f.id} active={folderFilter === f.id} onClick={() => setFolderFilter(f.id!)}>{f.name}</FolderChip>
            ))}
            {hasLoose && (
              <FolderChip active={folderFilter === null} onClick={() => setFolderFilter(null)}>Sin carpeta</FolderChip>
            )}
          </div>
        )}
        <div className="flex-1 overflow-y-auto flex flex-col gap-1" onScroll={hideHover}>
          {groups.map(group => (
            <div key={group.key} className="flex flex-col gap-1">
              {(folders.length > 0) && (
                <p className="sticky top-0 z-[1] bg-slate-950 text-[11px] font-semibold text-slate-500 uppercase tracking-wide px-1 pt-2 pb-1">
                  {group.name} · {group.songs.length}
                </p>
              )}
              {group.songs.map(song => (
                <button
                  key={song.id}
                  onClick={() => addSong(song)}
                  onMouseEnter={e => scheduleHover(song, e.currentTarget)}
                  onMouseLeave={hideHover}
                  className="text-left px-3 py-2.5 rounded-xl hover:bg-slate-800 transition-all duration-150 group border border-transparent hover:border-slate-700"
                >
                  <p className={`text-sm font-medium truncate ${inSetlist.has(song.id) ? 'text-slate-500' : 'text-white'}`}>
                    {inSetlist.has(song.id) && <span className="text-emerald-500 mr-1">✓</span>}
                    {song.title}
                  </p>
                  {song.artist && <p className="text-xs text-slate-500 truncate">{song.artist}</p>}
                </button>
              ))}
            </div>
          ))}
          {groups.length === 0 && (
            <p className="text-xs text-slate-600 text-center py-4">Sin resultados</p>
          )}
        </div>
      </div>

      {/* Right: Setlist */}
      <div className="flex-1 p-6 flex flex-col">
        {/* Header row */}
        <div className="flex flex-wrap items-center gap-3 mb-5">
          <div className="flex-1 min-w-[13rem] flex flex-col gap-1">
            <label className="flex items-center gap-2 border-b border-slate-700 hover:border-slate-500 focus-within:border-indigo-500 transition-colors pb-1">
              <input
                value={setlistName}
                onChange={e => setName(e.target.value)}
                placeholder={defaultServiceName(serviceDate)}
                aria-label="Nombre del servicio"
                className="flex-1 min-w-0 bg-transparent text-xl font-bold text-white placeholder-slate-500 outline-none"
              />
              <span className="text-slate-400 text-sm" aria-hidden="true" title="Puedes cambiar el nombre">✎</span>
            </label>
            <input
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Descripción (opcional)"
              aria-label="Descripción del servicio"
              maxLength={200}
              className="bg-transparent text-sm text-slate-300 placeholder-slate-500 outline-none border-b border-transparent hover:border-slate-700 focus:border-indigo-500 transition-colors pb-0.5"
            />
            <div className="flex items-center gap-3 text-xs">
              <input
                type="date"
                value={serviceDate}
                onChange={e => e.target.value && setServiceDate(e.target.value)}
                aria-label="Fecha del servicio"
                className="bg-slate-800 border border-slate-700 rounded-lg px-2 py-1 text-slate-300 outline-none focus:border-indigo-500 [color-scheme:dark]"
              />
              {dirty && <span className="text-amber-400">• sin guardar</span>}
            </div>
          </div>

          {/* Actions: stay on one line; the group wraps under the name on narrow windows. */}
          <div className="flex flex-wrap items-center justify-end gap-3 ml-auto whitespace-nowrap">
            <button
              onClick={handleNew}
              className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm transition-colors border border-slate-700"
              title="Empezar un servicio nuevo"
            >
              ＋ Nuevo
            </button>

            {/* Saved setlists button */}
            <div className="relative">
              <button
                onClick={() => setShowSaved(!showSaved)}
                className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm transition-colors border border-slate-700"
                title="Abrir un servicio guardado o importarlo de un archivo"
              >
                📂 Abrir ▾
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
                        <div key={sl.id} className="flex items-stretch border-b border-slate-700/50 last:border-0">
                          <button
                            onClick={() => loadSetlist(sl)}
                            className="flex-1 min-w-0 text-left px-4 py-3 hover:bg-slate-700 transition-colors"
                          >
                            <p className="text-sm font-medium text-white truncate">{sl.name}</p>
                            {sl.notes && <p className="text-xs text-slate-300 truncate">{sl.notes}</p>}
                            <p className="text-xs text-slate-400">
                              {sl.service_date ? `${formatServiceDate(sl.service_date)} · ` : ''}{sl.songs?.length ?? 0} canciones
                            </p>
                          </button>
                          <button
                            onClick={() => handleDeleteSaved(sl)}
                            title="Borrar este servicio guardado"
                            aria-label={`Borrar ${sl.name}`}
                            className="px-3 text-slate-500 hover:text-red-400 hover:bg-slate-700 transition-colors"
                          >
                            🗑
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                  <button
                    onClick={() => { setShowSaved(false); handleImport() }}
                    className="w-full text-left px-4 py-3 hover:bg-slate-700 transition-colors border-t border-slate-700"
                  >
                    <p className="text-sm font-medium text-white">📥 Importar archivo .alado…</p>
                    <p className="text-xs text-slate-400">Un servicio exportado desde otra compu</p>
                  </button>
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

            <div className="relative">
              <button
                onClick={() => setShowExport(v => !v)}
                disabled={setlistSongs.length === 0}
                className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-300 text-sm transition-colors border border-slate-700"
                title="Exportar este servicio"
              >
                📤 Exportar ▾
              </button>
              {showExport && (
                <div className="absolute right-0 top-full mt-1 w-60 bg-slate-800 border border-slate-700 rounded-2xl shadow-xl z-10 overflow-hidden">
                  <button onClick={handleExportAlado} className="w-full text-left px-4 py-3 hover:bg-slate-700 transition-colors border-b border-slate-700/50">
                    <p className="text-sm font-medium text-white">Archivo .alado</p>
                    <p className="text-xs text-slate-400">Para abrirlo en otra compu con ALADO</p>
                  </button>
                  <button onClick={handleExportPptx} className="w-full text-left px-4 py-3 hover:bg-slate-700 transition-colors">
                    <p className="text-sm font-medium text-white">PowerPoint</p>
                    <p className="text-xs text-slate-400">Respaldo para presentar sin ALADO</p>
                  </button>
                </div>
              )}
            </div>

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
            <SortableContext items={setlistSongs.map(s => s.key)} strategy={verticalListSortingStrategy}>
              <div className="flex flex-col gap-2 overflow-y-auto">
                {setlistSongs.map((item, index) => {
                  const isCurrentSong = isLive && currentSong?.id === item.song.id
                  return (
                    <SortableSetlistItem
                      key={item.key}
                      id={item.key}
                      song={item.song}
                      index={index}
                      isLive={isLive}
                      isCurrentSong={isCurrentSong}
                      onRemove={() => removeItem(item.key)}
                      onClick={() => handleSongClick(item.song)}
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

function FolderChip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors
        ${active
          ? 'bg-indigo-600 border-indigo-500 text-white'
          : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-white hover:bg-slate-700'}`}
    >
      {children}
    </button>
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
  const [expanded, setExpanded] = useState(false)

  return (
    <div
      ref={setNodeRef}
      style={style}
      onClick={isLive ? onClick : undefined}
      className={`rounded-2xl px-4 py-3 group border transition-all duration-150
        ${isCurrentSong
          ? 'bg-indigo-950 border-indigo-500 border-l-4'
          : isLive
            ? 'bg-slate-800 border-slate-700 hover:border-indigo-400 hover:bg-slate-750 cursor-pointer'
            : 'bg-slate-800 border-slate-700'
        }`}
    >
      <div className="flex items-center gap-3">
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
        <div className="flex-1 min-w-0">
          <p className={`font-medium truncate ${isCurrentSong ? 'text-indigo-100' : 'text-white'}`}>
            {song.title}
          </p>
          {song.artist && (
            <p className="text-xs text-slate-500 truncate">{song.artist}</p>
          )}
        </div>
        <button
          onPointerDown={e => e.stopPropagation()}
          onClick={e => { e.stopPropagation(); setExpanded(v => !v) }}
          aria-expanded={expanded}
          title={expanded ? 'Ocultar letra' : 'Ver letra'}
          className="text-slate-400 hover:text-white px-2 py-1 rounded-lg hover:bg-slate-700 transition-colors text-sm"
        >
          {expanded ? '▾' : '▸'} Letra
        </button>
        <button
          onClick={e => { e.stopPropagation(); onRemove() }}
          title="Quitar del servicio"
          className="opacity-0 group-hover:opacity-100 text-slate-500 hover:text-red-400 transition-all px-1"
        >
          ✕
        </button>
      </div>
      {expanded && (
        <div className="mt-3 ml-14 pl-3 border-l border-slate-700 cursor-default" onClick={e => e.stopPropagation()}>
          <SectionList song={song} />
        </div>
      )}
    </div>
  )
}
