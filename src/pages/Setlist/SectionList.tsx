import type { Song } from '../../store/songs.store'
import { sectionLabel } from '../../utils/sectionPreview'

/** Every section of a song, in order — shown when a setlist item is expanded. */
export default function SectionList({ song }: { song: Song }) {
  if (song.sections.length === 0) return <p className="text-sm text-slate-400">Sin letra</p>

  return (
    <div className="flex flex-col gap-3">
      {song.sections.map((s, i) => (
        <div key={i}>
          <p className="text-[11px] font-bold uppercase tracking-wide text-indigo-300">{sectionLabel(s)}</p>
          {s.lines.map((l, j) => <p key={j} className="text-sm text-slate-200 leading-snug">{l}</p>)}
        </div>
      ))}
    </div>
  )
}
