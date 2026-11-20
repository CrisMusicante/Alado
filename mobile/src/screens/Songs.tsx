import { useState } from 'react'
import KeyBadge from '@/components/KeyBadge'
import { useStore } from '../store'
import { searchSongs } from '../core/catalog'
import { Button, Card, Empty, Input, Page } from '../ui'
import SongView from './SongView'
import SongEdit from './SongEdit'

export default function Songs() {
  const { state } = useStore()
  const [q, setQ] = useState('')
  const [open, setOpen] = useState<string | 'new' | null>(null)
  const role = state.me?.role

  if (open === 'new') return <SongEdit uid={null} onClose={() => setOpen(null)} />
  if (open) return <SongView uid={open} onClose={() => setOpen(null)} />

  const results = searchSongs(state.catalog, q)
  return (
    <Page title="Canciones" action={(role === 'leader' || role === 'editor') &&
      <Button variant="secondary" onClick={() => setOpen('new')}>{role === 'leader' ? '+ Nueva' : '+ Proponer'}</Button>}>
      <Input placeholder="Buscar por título o artista…" value={q} onChange={e => setQ(e.target.value)} className="mb-3" type="search" />
      <div className="grid grid-cols-1 gap-2">
        {results.map(s => (
          <Card key={s.uid} onClick={() => setOpen(s.uid)} className="flex items-center gap-3 !py-3">
            <span className="flex-1 min-w-0">
              <span className="block truncate">{s.fields.title}</span>
              {s.fields.artist && <span className="block text-xs text-slate-400 truncate">{s.fields.artist}</span>}
            </span>
            <KeyBadge songKey={s.fields.song_key} />
          </Card>
        ))}
        {results.length === 0 && <Empty>{q ? `No hay canciones con “${q}”.` : 'El catálogo está vacío. Se llena cuando la compu de la iglesia se sincroniza.'}</Empty>}
      </div>
    </Page>
  )
}
