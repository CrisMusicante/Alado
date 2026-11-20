import { useMemo, useState } from 'react'
import KeyBadge from '@/components/KeyBadge'
import { useStore } from '../store'
import { saveSetlistChange, newId } from '../core/sync'
import { searchSongs } from '../core/catalog'
import type { SetlistItem, SyncSetlist } from '../core/types'
import { Button, Card, Empty, Input, Label, Page, TextArea, shortDate } from '../ui'
import SongView from './SongView'

/** Local date (not UTC: after 6 p.m. in Mexico UTC is already tomorrow). */
const today = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** Upcoming services first (soonest first), then past ones (most recent first), then undated. */
function ordered(list: SyncSetlist[]): SyncSetlist[] {
  const t = today()
  const upcoming = list.filter(s => s.service_date && s.service_date >= t).sort((a, b) => a.service_date!.localeCompare(b.service_date!))
  const past = list.filter(s => s.service_date && s.service_date < t).sort((a, b) => b.service_date!.localeCompare(a.service_date!))
  const undated = list.filter(s => !s.service_date).sort((a, b) => a.name.localeCompare(b.name, 'es'))
  return [...upcoming, ...undated, ...past]
}

export default function Services() {
  const { state } = useStore()
  const [open, setOpen] = useState<string | 'new' | null>(null)
  const canEdit = state.me?.role === 'leader' || state.me?.role === 'editor'
  const list = useMemo(() => ordered(Object.values(state.catalog.setlists)), [state.catalog.setlists])

  if (open) {
    const setlist = open === 'new' ? null : state.catalog.setlists[open] ?? null
    if (open !== 'new' && !setlist) {
      // Deleted (here or in the cloud) while open.
      setTimeout(() => setOpen(null), 0)
      return null
    }
    return canEdit
      ? <ServiceEditor setlist={setlist} onClose={() => setOpen(null)} />
      : <ServiceView setlist={setlist!} onClose={() => setOpen(null)} />
  }

  return (
    <Page title="Servicios" action={canEdit && <Button onClick={() => setOpen('new')}>+ Nuevo</Button>}>
      {list.length === 0 ? <Empty>Todavía no hay servicios.{canEdit ? ' Crea el del domingo con “+ Nuevo”.' : ''}</Empty> : (
        <div className="grid grid-cols-1 gap-3">
          {list.map(s => (
            <Card key={s.uid} onClick={() => setOpen(s.uid)}>
              <div className="flex items-baseline gap-3">
                <p className="font-semibold flex-1 truncate">{s.name}</p>
                <p className="text-sm text-slate-400 shrink-0">{shortDate(s.service_date)}</p>
              </div>
              <p className="text-sm text-slate-400 mt-1 truncate">
                {s.items.length} {s.items.length === 1 ? 'canción' : 'canciones'}
                {s.items.length > 0 && ' · ' + s.items.slice(0, 3).map(i => state.catalog.songs[i.song_uid]?.fields.title ?? '¿?').join(', ')}
                {s.items.length > 3 && '…'}
              </p>
            </Card>
          ))}
        </div>
      )}
    </Page>
  )
}

function ServiceView({ setlist, onClose }: { setlist: SyncSetlist; onClose: () => void }) {
  const { state } = useStore()
  const [song, setSong] = useState<string | null>(null)
  if (song) return <SongView uid={song} onClose={() => setSong(null)} />
  return (
    <Page title={setlist.name} onBack={onClose}>
      <p className="text-sm text-slate-400 mb-4">{shortDate(setlist.service_date)}{setlist.notes ? ` · ${setlist.notes}` : ''}</p>
      <ol className="grid grid-cols-1 gap-2">
        {setlist.items.map((it, i) => {
          const s = state.catalog.songs[it.song_uid]
          return (
            <li key={i}>
              <Card onClick={() => s && setSong(it.song_uid)} className="flex items-center gap-3 !py-3">
                <span className="text-slate-500 w-5 text-right">{i + 1}</span>
                <span className="flex-1 truncate">{s?.fields.title ?? 'Canción no disponible'}</span>
                <KeyBadge songKey={s?.fields.song_key} />
              </Card>
            </li>
          )
        })}
      </ol>
    </Page>
  )
}

function ServiceEditor({ setlist, onClose }: { setlist: SyncSetlist | null; onClose: () => void }) {
  const { state, update, showToast } = useStore()
  const [name, setName] = useState(setlist?.name ?? 'Domingo')
  const [date, setDate] = useState(setlist?.service_date ?? '')
  const [notes, setNotes] = useState(setlist?.notes ?? '')
  const [items, setItems] = useState<SetlistItem[]>(setlist?.items ?? [])
  const [adding, setAdding] = useState(false)
  const [viewing, setViewing] = useState<string | null>(null)
  // Fixed when the editor opens: the uid (a new service keeps one) and the version it was based on.
  const [uid] = useState(() => setlist?.uid ?? newId())
  const [seenSeq] = useState(() => (setlist ? state.base.setlists[setlist.uid]?.seq ?? 0 : 0))

  if (viewing) return <SongView uid={viewing} onClose={() => setViewing(null)} />
  if (adding) {
    return <SongPicker exclude={items.map(i => i.song_uid)} onPick={u => { setItems([...items, { song_uid: u, custom_video_file: null }]); setAdding(false) }} onClose={() => setAdding(false)} />
  }

  const move = (i: number, d: -1 | 1) => {
    const next = [...items]
    const [it] = next.splice(i, 1)
    next.splice(i + d, 0, it)
    setItems(next)
  }

  function save() {
    update(s => saveSetlistChange(s, { kind: 'setlist', uid, seenSeq,
      data: { name: name.trim(), service_date: date || null, notes: notes.trim() || null, items } }))
    showToast('Servicio guardado')
    onClose()
  }

  function remove() {
    if (!setlist || !confirm(`¿Borrar el servicio «${setlist.name}»?`)) return
    update(s => saveSetlistChange(s, { kind: 'setlist-delete', uid: setlist.uid }))
    showToast('Servicio borrado')
    onClose()
  }

  return (
    <Page title={setlist ? 'Editar servicio' : 'Nuevo servicio'} onBack={onClose}
      action={<Button onClick={save} disabled={!name.trim()}>Guardar</Button>}>
      <div className="grid grid-cols-1 gap-4">
        <label><Label>Nombre</Label><Input value={name} onChange={e => setName(e.target.value)} /></label>
        <label><Label>Fecha</Label><Input type="date" value={date} onChange={e => setDate(e.target.value)} /></label>
        <label><Label hint="opcional">Notas</Label><TextArea rows={2} value={notes} onChange={e => setNotes(e.target.value)} /></label>

        <div>
          <Label>Canciones ({items.length})</Label>
          <ol className="grid grid-cols-1 gap-2">
            {items.map((it, i) => {
              const s = state.catalog.songs[it.song_uid]
              return (
                <li key={`${it.song_uid}-${i}`} className="flex items-center gap-1 rounded-xl bg-slate-800 border border-slate-700 pl-3">
                  <span className="text-slate-500 w-5 text-right text-sm">{i + 1}</span>
                  <button className="flex-1 min-h-12 text-left truncate px-2" onClick={() => s && setViewing(it.song_uid)}>
                    {s?.fields.title ?? 'Canción no disponible'}
                  </button>
                  <KeyBadge songKey={s?.fields.song_key} />
                  <button aria-label="Subir" className="min-w-10 min-h-12 text-slate-300 disabled:opacity-30" disabled={i === 0} onClick={() => move(i, -1)}>↑</button>
                  <button aria-label="Bajar" className="min-w-10 min-h-12 text-slate-300 disabled:opacity-30" disabled={i === items.length - 1} onClick={() => move(i, 1)}>↓</button>
                  <button aria-label="Quitar" className="min-w-10 min-h-12 text-red-400" onClick={() => setItems(items.filter((_, k) => k !== i))}>✕</button>
                </li>
              )
            })}
          </ol>
          <Button variant="secondary" className="w-full mt-3" onClick={() => setAdding(true)}>+ Agregar canción</Button>
        </div>

        {setlist && <Button variant="ghost" className="text-red-400" onClick={remove}>Borrar servicio</Button>}
      </div>
    </Page>
  )
}

function SongPicker({ exclude, onPick, onClose }: { exclude: string[]; onPick: (uid: string) => void; onClose: () => void }) {
  const { state } = useStore()
  const [q, setQ] = useState('')
  const results = searchSongs(state.catalog, q)
  return (
    <Page title="Agregar canción" onBack={onClose}>
      <Input autoFocus placeholder="Buscar por título o artista…" value={q} onChange={e => setQ(e.target.value)} className="mb-3" />
      <div className="grid grid-cols-1 gap-2">
        {results.map(s => (
          <Card key={s.uid} onClick={() => onPick(s.uid)} className="flex items-center gap-3 !py-3">
            <span className="flex-1 min-w-0">
              <span className="block truncate">{s.fields.title}</span>
              {s.fields.artist && <span className="block text-xs text-slate-400 truncate">{s.fields.artist}</span>}
            </span>
            {exclude.includes(s.uid) && <span className="text-xs text-slate-500">ya está</span>}
            <KeyBadge songKey={s.fields.song_key} />
          </Card>
        ))}
        {results.length === 0 && <Empty>No hay canciones con “{q}”.</Empty>}
      </div>
    </Page>
  )
}
