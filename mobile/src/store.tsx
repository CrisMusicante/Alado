import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { emptyState, type Change, type LocalState, type Me, type Session } from './core/types'
import { mergeSyncResult, normalizeState, syncOnce } from './core/sync'
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
  'missing-title': 'falta el título',
}

function describeFailure(change: Change, error: string): string {
  const what = change.kind === 'setlist' ? `el servicio «${change.data.name}»` : change.kind === 'song' ? 'un cambio de canción' : 'un cambio'
  return `No se pudo subir ${what}: ${FAIL_TEXT[error] ?? error}. Se descartó.`
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<LocalState | null>(null)
  const [syncing, setSyncing] = useState(false)
  const [offline, setOffline] = useState(!navigator.onLine)
  const [toast, setToast] = useState<Toast>(null)
  const ref = useRef<LocalState | null>(null)
  const syncingRef = useRef(false)
  const again = useRef(false)
  const timer = useRef<ReturnType<typeof setTimeout>>()

  const showToast = useCallback((text: string, kind: 'ok' | 'error' = 'ok') => {
    setToast({ text, kind })
    setTimeout(() => setToast(t => (t?.text === text ? null : t)), kind === 'error' ? 7000 : 2500)
  }, [])

  const commit = useCallback((next: LocalState) => {
    ref.current = next
    setState(next)
    idbSet('state', next).catch(() =>
      showToast('No se pudo guardar en este celular (¿modo privado o sin espacio?). Tus cambios podrían perderse al cerrar.', 'error'))
  }, [showToast])

  const sync = useCallback(async () => {
    const current = ref.current
    if (!current?.session) return
    if (syncingRef.current) { again.current = true; return }
    syncingRef.current = true
    setSyncing(true)
    try {
      const r = await syncOnce(current, makeApi(current.session.token))
      // Fold into whatever the state is now (edits made meanwhile survive; a sign-out wins).
      commit(mergeSyncResult(ref.current!, r))
      setOffline(r.offline)
      if (r.unauthorized) showToast('Tu sesión terminó. Vuelve a entrar; tus cambios pendientes se conservan.', 'error')
      const messages = [...r.notices, ...r.failed.map(f => describeFailure(f.change, f.error))]
      if (messages.length) showToast(messages.join(' '), 'error')
    } finally {
      syncingRef.current = false
      setSyncing(false)
      if (again.current) { again.current = false; setTimeout(() => void sync(), 0) }
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
    // Same person in the same church: keep the catalog and anything still queued. Anyone else
    // starts clean (another person's queue must never go up under this identity).
    const same = prev.owner && prev.owner.churchId === me.churchId && prev.owner.actor === me.actor
    if (!same && prev.owner && (prev.outbox.length || prev.pendingProposals.length)) {
      showToast('Se descartaron cambios pendientes de otra cuenta en este celular.', 'error')
    }
    const base = same ? prev : emptyState()
    commit({ ...base, session, me, owner: { churchId: me.churchId, actor: me.actor } })
    setTimeout(() => void sync(), 0)
  }, [commit, sync, showToast])

  const signOut = useCallback(async () => {
    const token = ref.current?.session?.token ?? null
    commit(emptyState())
    const r = await call(token, 'POST', '/api/logout')
    if (!r.ok && r.status === 0) showToast('Saliste en este celular. Sin conexión, la sesión seguirá válida en la nube hasta que el líder la quite.', 'error')
  }, [commit, showToast])

  useEffect(() => {
    let alive = true
    idbGet<LocalState>('state').then(saved => {
      if (!alive) return
      const s = saved ? normalizeState(saved) : emptyState()
      ref.current = s
      setState(s)
      void sync()
    }).catch(() => { ref.current = emptyState(); setState(emptyState()) })
    // Ask the browser not to evict the outbox (Safari clears site data after a week unused).
    void navigator.storage?.persist?.().catch(() => {})
    const onOnline = () => { setOffline(false); void sync() }
    const onOffline = () => setOffline(true)
    const onVisible = () => { if (document.visibilityState === 'visible') void sync() }
    window.addEventListener('online', onOnline)
    window.addEventListener('offline', onOffline)
    document.addEventListener('visibilitychange', onVisible)
    const every = setInterval(() => void sync(), SYNC_EVERY_MS)
    return () => {
      alive = false
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
