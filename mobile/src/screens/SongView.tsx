import { useState } from 'react'
import KeyBadge from '@/components/KeyBadge'
import { useStore } from '../store'
import { Button, Page } from '../ui'
import SongEdit from './SongEdit'

/** A song's lyrics, section by section, with its key. Leaders and editors can edit from here. */
export default function SongView({ uid, onClose }: { uid: string; onClose: () => void }) {
  const { state } = useStore()
  const [editing, setEditing] = useState(false)
  const song = state.catalog.songs[uid]
  const canEdit = state.me?.role === 'leader' || state.me?.role === 'editor'

  if (!song) return <Page title="Canción" onBack={onClose}><p className="text-slate-400">Esta canción ya no está en el catálogo.</p></Page>
  if (editing) return <SongEdit uid={uid} onClose={() => setEditing(false)} />

  const f = song.fields
  const pending = state.pendingProposals.some(p => p.song_uid === uid)
  return (
    <Page title={f.title} onBack={onClose} action={canEdit && <Button variant="secondary" onClick={() => setEditing(true)}>Editar</Button>}>
      <div className="flex items-center gap-2 mb-1 flex-wrap">
        <KeyBadge songKey={f.song_key} className="!text-sm !px-2 !py-1" />
        {f.artist && <span className="text-slate-400 text-sm">{f.artist}</span>}
      </div>
      {f.video_file && <p className="text-xs text-slate-500 mb-3">🎬 {f.video_file}</p>}
      {pending && <p className="text-sm text-amber-300 mb-3">Tienes una propuesta para esta canción esperando al líder.</p>}
      <div className="grid gap-5 mt-4">
        {f.sections.map((s, i) => (
          <section key={i}>
            <h2 className="text-xs font-semibold uppercase tracking-widest text-indigo-300 mb-1.5">
              {s.label}{(s.repeat ?? 1) > 1 && <span className="text-slate-400"> ×{s.repeat}</span>}
            </h2>
            <p className="text-lg leading-relaxed whitespace-pre-line">{s.lines.join('\n')}</p>
          </section>
        ))}
        {f.sections.length === 0 && <p className="text-slate-400">Sin letra todavía.</p>}
      </div>
    </Page>
  )
}
