import { useState } from 'react'
import { MAJOR_KEYS, MINOR_KEYS } from '@/utils/songKeys'
import { useStore } from '../store'
import { saveSong, validateSong } from '../core/sync'
import { videoNames } from '../core/catalog'
import { EMPTY_SONG, type SongFields, type SyncSection } from '../core/types'
import { Button, Input, Label, Page, Select, TextArea } from '../ui'

interface DraftSection { type: string; label: string; text: string; repeat?: number }

const toDraft = (s: SyncSection): DraftSection => ({ type: s.type, label: s.label, text: s.lines.join('\n'), repeat: s.repeat })
const fromDraft = (d: DraftSection): SyncSection => ({
  type: d.type, label: d.label.trim() || 'Sección',
  lines: d.text.split('\n').map(l => l.trimEnd()).filter((l, i, all) => l !== '' || (i > 0 && i < all.length - 1)),
  ...(d.repeat && d.repeat > 1 ? { repeat: d.repeat } : {}),
})
const same = (a: unknown, b: unknown) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null)

/**
 * Edit title, artist, key, video and lyrics. A leader's save applies (and syncs); an editor's
 * becomes a proposal the leader approves. `uid` null = new song.
 */
export default function SongEdit({ uid, onClose }: { uid: string | null; onClose: () => void }) {
  const { state, update, showToast } = useStore()
  const isLeader = state.me?.role === 'leader'
  // What the user opened: changes and `seen` are measured against this, not against whatever a
  // background sync brings in while the screen is open (that would silently revert others' edits).
  const [opened] = useState(() => ({
    fields: (uid && state.catalog.songs[uid]?.fields) || EMPTY_SONG,
    versions: (uid && state.base.songs[uid]?.versions) || {},
  }))
  const current: SongFields = opened.fields
  const [title, setTitle] = useState(current.title)
  const [artist, setArtist] = useState(current.artist ?? '')
  const [key, setKey] = useState(current.song_key ?? '')
  const [video, setVideo] = useState(current.video_file ?? '')
  const [sections, setSections] = useState<DraftSection[]>(
    current.sections.length ? current.sections.map(toDraft) : [{ type: 'verse', label: 'Verso 1', text: '' }])
  const videos = videoNames(state.catalog)

  function save() {
    const next: Partial<SongFields> = {
      title: title.trim(), artist: artist.trim() || null, song_key: key || null, video_file: video || null,
      sections: sections.map(fromDraft).filter(s => s.lines.length > 0),
    }
    const changed: Partial<SongFields> = {}
    for (const [k, v] of Object.entries(next) as [keyof SongFields, unknown][]) {
      if (!uid || !same(v, current[k])) (changed as Record<string, unknown>)[k] = v
    }
    if (!Object.keys(changed).length) { onClose(); return }
    const problem = validateSong(changed)
    if (problem) { showToast(problem, 'error'); return }
    update(s => saveSong(s, uid, changed, opened.versions))
    showToast(isLeader ? 'Canción guardada' : 'Propuesta enviada: queda pendiente hasta que el líder la apruebe')
    onClose()
  }

  const setSection = (i: number, patch: Partial<DraftSection>) => setSections(sections.map((s, k) => (k === i ? { ...s, ...patch } : s)))
  const move = (i: number, d: -1 | 1) => {
    const next = [...sections]
    const [s] = next.splice(i, 1)
    next.splice(i + d, 0, s)
    setSections(next)
  }

  return (
    <Page title={uid ? (isLeader ? 'Editar canción' : 'Proponer cambio') : (isLeader ? 'Nueva canción' : 'Proponer canción')} onBack={onClose}
      action={<Button onClick={save} disabled={!title.trim()}>{isLeader ? 'Guardar' : 'Proponer'}</Button>}>
      {!isLeader && <p className="text-sm text-amber-300 mb-4">Tu cambio queda pendiente hasta que el líder lo apruebe.</p>}
      <div className="grid grid-cols-1 gap-4">
        <label><Label>Título</Label><Input value={title} onChange={e => setTitle(e.target.value)} /></label>
        <label><Label hint="opcional">Artista</Label><Input value={artist} onChange={e => setArtist(e.target.value)} /></label>
        <div className="grid grid-cols-2 gap-3">
          <label>
            <Label>Tono</Label>
            <Select value={key} onChange={e => setKey(e.target.value)}>
              <option value="">—</option>
              <optgroup label="Mayor">{MAJOR_KEYS.map(k => <option key={k} value={k}>{k}</option>)}</optgroup>
              <optgroup label="Menor">{MINOR_KEYS.map(k => <option key={k} value={k}>{k}</option>)}</optgroup>
            </Select>
          </label>
          <label>
            <Label>Video</Label>
            <Select value={video} onChange={e => setVideo(e.target.value)}>
              <option value="">Sin video</option>
              {[...new Set([...(video ? [video] : []), ...videos])].map(v => <option key={v} value={v}>{v.replace(/\.(mp4|webm|mov)$/i, '')}</option>)}
            </Select>
          </label>
        </div>

        <div>
          <Label>Letra</Label>
          <div className="grid grid-cols-1 gap-3">
            {sections.map((s, i) => (
              <div key={i} className="rounded-2xl bg-slate-800 border border-slate-700 p-3">
                <div className="flex gap-1 mb-2">
                  <Input value={s.label} onChange={e => setSection(i, { label: e.target.value })} className="!min-h-10 !py-1.5 text-sm font-semibold" aria-label="Nombre de la sección" />
                  <button aria-label="Subir sección" className="min-w-10 text-slate-300 disabled:opacity-30" disabled={i === 0} onClick={() => move(i, -1)}>↑</button>
                  <button aria-label="Bajar sección" className="min-w-10 text-slate-300 disabled:opacity-30" disabled={i === sections.length - 1} onClick={() => move(i, 1)}>↓</button>
                  <button aria-label="Quitar sección" className="min-w-10 text-red-400" onClick={() => setSections(sections.filter((_, k) => k !== i))}>✕</button>
                </div>
                <TextArea rows={Math.max(3, s.text.split('\n').length)} value={s.text} onChange={e => setSection(i, { text: e.target.value })}
                  placeholder="Una línea por renglón" aria-label={`Letra de ${s.label}`} />
              </div>
            ))}
          </div>
          <Button variant="secondary" className="w-full mt-3"
            onClick={() => setSections([...sections, { type: 'verse', label: `Sección ${sections.length + 1}`, text: '' }])}>
            + Agregar sección
          </Button>
        </div>
      </div>
    </Page>
  )
}
