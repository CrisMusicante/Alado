import { useCallback, useEffect, useState } from 'react'
import KeyBadge from '@/components/KeyBadge'
import { useStore } from '../store'
import { call } from '../api'
import { diffSections } from '../../../shared/lyricsDiff'
import type { ProposalView, SongFields } from '../core/types'
import { Button, Card, Empty, Input, Page } from '../ui'

const STATUS: Record<string, string> = { pending: 'Pendiente', approved: 'Aprobada', rejected: 'Rechazada', withdrawn: 'Retirada' }
const FIELD: Partial<Record<keyof SongFields, string>> = { title: 'Título', artist: 'Artista', song_key: 'Tono', video_file: 'Video' }

/** What a proposal changes: simple fields "antes → después" and the lyrics as a line diff. */
function Changes({ p }: { p: ProposalView }) {
  const cur = p.current
  return (
    <div className="grid gap-2 mt-2">
      {!cur && <p className="text-sm text-emerald-300">Canción nueva</p>}
      {(Object.keys(FIELD) as (keyof SongFields)[]).filter(f => f in p.fields).map(f => (
        <p key={f} className="text-sm">
          <span className="text-slate-400">{FIELD[f]}: </span>
          {cur && <><span className="line-through text-slate-500">{String(cur[f] ?? '—')}</span> → </>}
          {f === 'song_key' ? <KeyBadge songKey={String(p.fields[f] ?? '')} /> : <span>{String(p.fields[f] ?? '—')}</span>}
        </p>
      ))}
      {p.fields.sections && (
        <div className="grid grid-cols-1 gap-2">
          {diffSections(cur?.sections ?? [], p.fields.sections).filter(s => s.lines.some(l => l.kind !== 'same') || !cur).map((s, i) => (
            <div key={i} className="rounded-xl bg-slate-900 p-3">
              <p className="text-xs uppercase tracking-widest text-indigo-300 mb-1">{s.label}</p>
              {s.lines.map((l, k) => (
                <p key={k} className={`text-sm ${l.kind === 'added' ? 'text-emerald-300' : l.kind === 'removed' ? 'text-red-300 line-through' : 'text-slate-400'}`}>
                  {l.kind === 'added' ? '+ ' : l.kind === 'removed' ? '− ' : '  '}{l.text || ' '}
                </p>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default function Pending() {
  const { state, sync, showToast } = useStore()
  const isLeader = state.me?.role === 'leader'
  const token = state.session?.token ?? null
  const [list, setList] = useState<ProposalView[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [rejecting, setRejecting] = useState<string | null>(null)
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    const r = await call<{ proposals: ProposalView[] }>(token, 'GET', isLeader ? '/api/proposals?status=pending' : '/api/proposals')
    if (r.ok) { setList(r.data.proposals); setError(null) } else setError(r.error)
  }, [token, isLeader])
  useEffect(() => { void load() }, [load])

  async function decide(p: ProposalView, action: 'approve' | 'reject') {
    setBusy(true)
    try {
      // The versions this phone has seen: if the song changed since, the cloud answers 409.
      const seen = p.song_uid ? state.catalog.songs[p.song_uid]?.versions : undefined
      const r = await call(token, 'POST', `/api/proposals/${p.id}/decide`, { action, note: action === 'reject' ? note.trim() || null : null, seen })
      if (!r.ok) {
        showToast(r.status === 409 ? `${r.error} Se actualizó la lista.` : r.error, 'error')
        await sync()
      } else {
        showToast(action === 'approve' ? 'Aprobada: el cambio ya está en la canción' : 'Propuesta rechazada')
        setRejecting(null); setNote('')
        await sync()
      }
      await load()
    } finally { setBusy(false) }
  }

  async function withdraw(p: ProposalView) {
    const r = await call(token, 'POST', `/api/proposals/${p.id}/withdraw`)
    if (!r.ok) showToast(r.error, 'error')
    await load()
  }

  const titleOf = (p: ProposalView) => p.current?.title ?? p.fields.title ?? 'Canción'
  const queued = state.pendingProposals

  return (
    <Page title={isLeader ? 'Pendientes' : 'Mis propuestas'} action={<Button variant="ghost" onClick={() => void load()} aria-label="Recargar">↻</Button>}>
      {!isLeader && queued.length > 0 && (
        <div className="mb-4 grid gap-2">
          {queued.map(q => (
            <Card key={q.id}><p className="font-medium">{(q.song_uid && state.catalog.songs[q.song_uid]?.fields.title) || q.fields.title || 'Canción nueva'}</p>
              <p className="text-xs text-amber-300 mt-1">Por enviar (sin conexión)</p></Card>
          ))}
        </div>
      )}
      {error && <p className="text-sm text-amber-300 mb-3">{error}</p>}
      {list === null && !error && <p className="text-slate-400">Cargando…</p>}
      {list?.length === 0 && <Empty>{isLeader ? 'No hay propuestas pendientes. 🙌' : 'Todavía no has propuesto cambios.'}</Empty>}
      <div className="grid grid-cols-1 gap-3">
        {list?.map(p => (
          <Card key={p.id}>
            <div className="flex items-baseline gap-2">
              <p className="font-semibold flex-1 truncate">{titleOf(p)}</p>
              {!isLeader && <span className="text-xs text-slate-400">{STATUS[p.status]}</span>}
            </div>
            <p className="text-xs text-slate-400">{isLeader ? `${p.author_name} · ` : ''}{new Date(p.created_at).toLocaleString('es-MX', { dateStyle: 'medium', timeStyle: 'short' })}</p>
            {p.stale && p.status === 'pending' && <p className="text-sm text-amber-300 mt-2">⚠️ La canción cambió después de esta propuesta. Revisa la versión actual.</p>}
            <Changes p={p} />
            {p.note && <p className="text-sm text-slate-300 mt-2">Nota del líder: {p.note}</p>}
            {isLeader && p.status === 'pending' && (rejecting === p.id ? (
              <div className="mt-3 grid gap-2">
                <Input placeholder="Nota para quien propuso (opcional)" value={note} onChange={e => setNote(e.target.value)} />
                <div className="flex gap-2">
                  <Button variant="danger" className="flex-1" disabled={busy} onClick={() => void decide(p, 'reject')}>Rechazar</Button>
                  <Button variant="secondary" onClick={() => setRejecting(null)}>Cancelar</Button>
                </div>
              </div>
            ) : (
              <div className="mt-3 flex gap-2">
                <Button className="flex-1" disabled={busy} onClick={() => void decide(p, 'approve')}>Aprobar</Button>
                <Button variant="secondary" className="flex-1" onClick={() => { setRejecting(p.id); setNote('') }}>Rechazar…</Button>
              </div>
            ))}
            {!isLeader && p.status === 'pending' && <Button variant="ghost" className="mt-2" onClick={() => void withdraw(p)}>Retirar</Button>}
          </Card>
        ))}
      </div>
    </Page>
  )
}
