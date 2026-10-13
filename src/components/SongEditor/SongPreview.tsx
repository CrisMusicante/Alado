import { useEffect, useRef, useState } from 'react'
import SlideView from '../../live/SlideView'
import type { Section, TextStyle } from '../../store/songs.store'
import { mediaUrl } from '../../utils/mediaUrl'

// The live window is a full-HD screen; render at that size and scale down so text wraps the same way.
const STAGE_W = 1920
const STAGE_H = 1080

export default function SongPreview({ sections, selected, onSelect, textStyle, videoPath }: {
  sections: Section[]
  selected: number
  onSelect: (index: number) => void
  textStyle: Partial<TextStyle>
  videoPath: string
}) {
  const frameRef = useRef<HTMLDivElement>(null)
  const [scale, setScale] = useState(0)

  useEffect(() => {
    const frame = frameRef.current
    if (!frame) return
    const observer = new ResizeObserver(([entry]) => setScale(entry.contentRect.width / STAGE_W))
    observer.observe(frame)
    return () => observer.disconnect()
  }, [])

  const index = Math.min(selected, sections.length - 1)
  const section = index >= 0 ? sections[index] : undefined
  const lines = (section?.lines ?? []).filter(l => l.trim() !== '')

  return (
    <div className="bg-slate-800 rounded-2xl p-3 border border-slate-700">
      <div className="flex items-center gap-2 mb-2">
        <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-widest flex-1">Vista previa</h2>
        <button
          onClick={() => onSelect(index - 1)}
          disabled={index <= 0}
          className="w-7 h-7 rounded-lg bg-slate-700 hover:bg-slate-600 disabled:opacity-30 text-sm"
          title="Sección anterior"
        >
          ◀
        </button>
        <span className="text-xs text-slate-400 tabular-nums w-14 text-center">
          {sections.length ? `${index + 1} / ${sections.length}` : '—'}
        </span>
        <button
          onClick={() => onSelect(index + 1)}
          disabled={index >= sections.length - 1}
          className="w-7 h-7 rounded-lg bg-slate-700 hover:bg-slate-600 disabled:opacity-30 text-sm"
          title="Sección siguiente"
        >
          ▶
        </button>
      </div>

      <div ref={frameRef} className="relative w-full aspect-video rounded-xl overflow-hidden bg-black">
        {scale > 0 && (
          <div style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: STAGE_W,
            height: STAGE_H,
            transform: `scale(${scale})`,
            transformOrigin: 'top left',
            overflow: 'hidden'
          }}>
            <SlideView lines={lines} textStyle={textStyle} videoSrc={videoPath ? mediaUrl(videoPath) : null} />
          </div>
        )}
        {!section && (
          <p className="absolute inset-0 flex items-center justify-center text-sm text-slate-500">Sin secciones</p>
        )}
      </div>

      {section && <p className="text-xs text-slate-400 mt-2 truncate">{section.label}</p>}
    </div>
  )
}
