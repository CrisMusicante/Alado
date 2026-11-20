import { useEffect, useState } from 'react'
import type { VideoEntry } from '../../store/songs.store'
import { grabVideoFrame } from '../../setlist/pptxExport'
import { filterVideos } from '../../utils/videoFilter'
import { showToast } from '../../store/toast.store'

// Thumbnails survive closing the picker, so reopening it is instant.
const thumbs = new Map<string, string | null>()
const THUMB = { darken: false, maxWidth: 320, maxHeight: 180 }

/** Loads missing thumbnails one at a time (decoding dozens of videos at once stalls the app). */
async function loadThumbs(list: VideoEntry[], onEach: () => void, cancelled: () => boolean) {
  for (const v of list) {
    if (cancelled()) return
    if (thumbs.has(v.path)) continue
    thumbs.set(v.path, await grabVideoFrame(v.path, THUMB))
    onEach()
  }
}

function Thumb({ src, className }: { src: string | null | undefined; className: string }) {
  return src
    ? <img src={src} alt="" className={`object-cover bg-slate-800 ${className}`} />
    : <div className={`flex items-center justify-center bg-slate-800 text-2xl ${className}`}>🎬</div>
}

/** Small still of one video (the editor's current background). */
export function VideoThumb({ path, className = '' }: { path: string; className?: string }) {
  const [src, setSrc] = useState<string | null | undefined>(thumbs.get(path))
  useEffect(() => {
    let alive = true
    if (thumbs.has(path)) setSrc(thumbs.get(path))
    else grabVideoFrame(path, THUMB).then(t => {
      thumbs.set(path, t)
      if (alive) setSrc(t)
    })
    return () => { alive = false }
  }, [path])
  return <Thumb src={src} className={className} />
}

export default function VideoPicker({ open, current, onPick, onClose }: {
  open: boolean
  current: string
  onPick: (path: string) => void
  onClose: () => void
}) {
  const [videos, setVideos] = useState<VideoEntry[] | null>(null)
  const [query, setQuery] = useState('')
  const [, setTick] = useState(0)
  const [importing, setImporting] = useState(false)

  useEffect(() => {
    if (!open) return
    let cancelled = false
    window.api.listVideos().then(list => {
      if (cancelled) return
      setVideos(list)
      loadThumbs(list, () => setTick(t => t + 1), () => cancelled)
    })
    return () => { cancelled = true }
  }, [open])

  if (!open) return null

  function pick(path: string) {
    onPick(path)
    onClose()
  }

  async function browse() {
    setImporting(true)
    try {
      const entry = await window.api.importVideo()
      if (entry) pick(entry.path)
    } catch {
      showToast('No se pudo copiar el video.', 'error')
    } finally {
      setImporting(false)
    }
  }

  const shown = filterVideos(videos ?? [], query)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl w-full max-w-4xl mx-4 max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex items-center gap-3 px-6 pt-5 pb-4 border-b border-slate-700 shrink-0">
          <h2 className="text-lg font-bold mr-auto">Elegir video de fondo</h2>
          <input
            autoFocus
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Buscar por nombre..."
            className="bg-slate-800 text-white rounded-xl px-4 py-2 outline-none focus:ring-2 focus:ring-indigo-500 border border-slate-700 text-sm w-64"
          />
          <button onClick={browse} disabled={importing} className="bg-slate-700 hover:bg-slate-600 disabled:opacity-60 text-white px-4 py-2 rounded-xl text-sm transition-colors border border-slate-600">
            {importing ? 'Copiando video…' : 'Explorar...'}
          </button>
          <button onClick={onClose} className="text-slate-400 hover:text-white text-xl px-2" aria-label="Cerrar">✕</button>
        </div>

        <div className="overflow-y-auto p-6">
          {videos === null ? (
            <p className="text-slate-400 text-sm">Cargando videos...</p>
          ) : videos.length === 0 ? (
            <p className="text-slate-400 text-sm">No hay videos todavía. Usa "Explorar..." para agregar uno.</p>
          ) : shown.length === 0 ? (
            <p className="text-slate-400 text-sm">Ningún video coincide con "{query.trim()}".</p>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
              {shown.map(v => (
                <button
                  key={v.path}
                  onClick={() => pick(v.path)}
                  className={`text-left rounded-xl overflow-hidden border transition-colors ${v.path === current ? 'border-indigo-500 ring-2 ring-indigo-500' : 'border-slate-700 hover:border-slate-500'}`}
                >
                  <Thumb src={thumbs.get(v.path)} className="w-full aspect-video" />
                  <div className="px-3 py-2 text-xs text-slate-300 truncate" title={v.name}>{v.name}</div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
