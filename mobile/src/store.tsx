import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { emptyState, type Change, type LocalState, type Me, type Session } from './core/types'
import { syncOnce } from './core/sync'
import { idbGet, idbSet } from './core/idb'
import { call, makeApi } from './api'

const SYNC_EVERY_MS = 2 * 60_000
const SYNC_AFTER_EDIT_MS = 1500

type Toast = { text: string; kind: 'ok' | 'error' } | null

interface Store {
  state: LocalState
  syncing: boolean
  offline: boolean
  toast: Toast
  showToast: (text: string, kind?: 'ok' | 'error') => void
  /** Changes local state (persisted) and schedules a sync. */
  update: (fn: (s: LocalState) => LocalState) => void
  sync: () => Promise<void>
  signIn: (session: Session, me: Me) => void
  signOut: () => Promise<void>
}

const Ctx = createContext<Store | null>(null)

export function useStore(): Store {
  const s = useContext(Ctx)
  if (!s) throw new Error('StoreProvider missing')
  return s
}

const FAIL_TEXT: Record<string, string> = {
  'unknown-song': 'una canción del servicio ya no existe',
  forbidden: 'no tienes permiso',
  invalid: 'datos inválidos',
  'song-in-use': 'está en un servicio',
}

function describeFailure(change: Change, error: string): string {
  const what = change.kind === 'setlist' ? `el servicio «${change.data.name}»` : change.kind === 'song' ? 'un cambio de canción' : 'un cambio'
  return `No se pudo subir ${what}: ${FAIL_TEXT[error] ?? error}.`
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<LocalState | null>(null)
  const [syncing, setSyncing] = useState(false)
  const [offline, setOffline] = useState(!navigator.onLine)
  const [toast, setToast] = useState<Toast>(null)
  const ref = useRef<LocalState | null>(null)
  const syncingRef = useRef(false)
  const timer = useRef<ReturnType<typeof setTimeout>>()

  const commit = useCallback((next: LocalState) => {
    ref.current = next
    setState(next)
    void idbSet('state', next)
  }, [])

  const showToast = useCallback((text: string, kind: 'ok' | 'error' = 'ok') => {
    setToast({ text, kind })
    setTimeout(() => setToast(t => (t?.text === text ? null : t)), kind === 'error' ? 6000 : 2500)
  }, [])

  const sync = useCallback(async () => {
    const current = ref.current
    if (!current?.session || syncingRef.current) return
    syncingRef.current = true
    setSyncing(true)
    try {
      const r = await syncOnce(current, makeApi(current.session.token))
      // Keep anything queued while the sync was running.
      const latest = ref.current!
      const queuedMeanwhile = latest.outbox.slice(current.outbox.length)
      const proposalsMeanwhile = latest.pendingProposals.filter(p => !current.pendingProposals.some(q => q.id === p.id))
      let next: LocalState = { ...r.state, outbox: [...r.state.outbox, ...queuedMeanwhile], pendingProposals: [...r.state.pendingProposals, ...proposalsMeanwhile] }
      if (r.unauthorized) {
        next = { ...next, session: null, me: null }
        showToast('Tu sesión terminó. Vuelve a entrar; tus cambios pendientes se conservan.', 'error')
      }
      commit(next)
      setOffline(r.offline)
      const messages = [...r.notices, ...r.failed.map(f => describeFailure(f.change, f.error))]
      if (messages.length) showToast(messages.join(' '), 'error')
    } finally {
      syncingRef.current = false
      setSyncing(false)
    }
  }, [commit, showToast])

  const update = useCallback((fn: (s: LocalState) => LocalState) => {
    if (!ref.current) return
    commit(fn(ref.current))
    clearTimeout(timer.current)
    timer.current = setTimeout(() => void sync(), SYNC_AFTER_EDIT_MS)
  }, [commit, sync])

  const signIn = useCallback((session: Session, me: Me) => {
    const prev = ref.current ?? emptyState()
    // Same church: keep the catalog and anything still queued; another church: start clean.
    const base = prev.session?.churchCode === session.churchCode || !prev.session ? prev : emptyState()
    commit({ ...base, session, me })
    setTimeout(() => void sync(), 0)
  }, [commit, sync])

  const signOut = useCallback(async () => {
    const token = ref.current?.session?.token ?? null
    await call(token, 'POST', '/api/logout')
    commit({ ...emptyState(), session: null })
  }, [commit])

  useEffect(() => {
    idbGet<LocalState>('state').then(saved => {
      const s = saved ? { ...emptyState(), ...saved } : emptyState()
      ref.current = s
      setState(s)
      void sync()
    }).catch(() => { ref.current = emptyState(); setState(emptyState()) })
    const onOnline = () => { setOffline(false); void sync() }
    const onOffline = () => setOffline(true)
    const onVisible = () => { if (document.visibilityState === 'visible') void sync() }
    window.addEventListener('online', onOnline)
    window.addEventListener('offline', onOffline)
    document.addEventListener('visibilitychange', onVisible)
    const every = setInterval(() => void sync(), SYNC_EVERY_MS)
    return () => {
      window.removeEventListener('online', onOnline)
      window.removeEventListener('offline', onOffline)
      document.removeEventListener('visibilitychange', onVisible)
      clearInterval(every)
    }
  }, [sync])

  if (!state) {
    return <div className="min-h-screen grid place-items-center text-slate-400">Cargando…</div>
  }
  return (
    <Ctx.Provider value={{ state, syncing, offline, toast, showToast, update, sync, signIn, signOut }}>
      {children}
    </Ctx.Provider>
  )
}
