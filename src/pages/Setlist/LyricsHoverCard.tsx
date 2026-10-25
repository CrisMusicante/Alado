import type { Song } from '../../store/songs.store'
import { previewSections } from '../../utils/sectionPreview'

const CARD_WIDTH = 288
const CARD_MAX_HEIGHT = 260
const GAP = 8

/**
 * Floating preview of a song's opening lyrics, shown next to a library row on sustained hover.
 * pointer-events: none so it never steals the click that adds the song.
 */
export default function LyricsHoverCard({ song, anchorRect }: { song: Song; anchorRect: DOMRect }) {
  const preview = previewSections(song)
  const top = Math.max(GAP, Math.min(anchorRect.top, window.innerHeight - CARD_MAX_HEIGHT - GAP))
  const left = Math.min(anchorRect.right + GAP, window.innerWidth - CARD_WIDTH - GAP)

  return (
    <div
      className="fixed z-50 pointer-events-none bg-slate-800 border border-indigo-500/70 rounded-2xl shadow-2xl p-4 overflow-hidden"
      style={{ top, left, width: CARD_WIDTH, maxHeight: CARD_MAX_HEIGHT }}
    >
      <p className="font-semibold text-white truncate">{song.title}</p>
      {song.artist && <p className="text-xs text-slate-400 truncate mb-2">{song.artist}</p>}
      {preview.length === 0 ? (
        <p className="text-sm text-slate-400 mt-2">Sin letra</p>
      ) : (
        <div className="flex flex-col gap-2 mt-2">
          {preview.map((s, i) => (
            <div key={i}>
              <p className="text-[11px] font-bold uppercase tracking-wide text-indigo-300">{s.label}</p>
              {s.lines.map((l, j) => <p key={j} className="text-sm text-slate-200 leading-snug">{l}</p>)}
              {s.truncated && <p className="text-sm text-slate-400">…</p>}
            </div>
          ))}
        </div>
      )}
      {song.sections.length > preview.length && (
        <p className="text-xs text-slate-400 mt-2">{song.sections.length} secciones en total</p>
      )}
    </div>
  )
}
