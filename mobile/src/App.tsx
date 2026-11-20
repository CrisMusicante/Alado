import { useState } from 'react'
import { useStore } from './store'
import Login from './screens/Login'
import Services from './screens/Services'
import Songs from './screens/Songs'
import Pending from './screens/Pending'
import Settings from './screens/Settings'

type Tab = 'services' | 'songs' | 'pending' | 'settings'

/** Sync status line under every screen: always visible, as the spec asks. */
function SyncLine() {
  const { state, syncing, offline } = useStore()
  const queued = state.outbox.length + state.pendingProposals.length
  const text = syncing ? 'Sincronizando…'
    : offline ? `Sin conexión${queued ? ` · ${queued} cambio${queued === 1 ? '' : 's'} por subir` : ''}`
    : queued ? `${queued} cambio${queued === 1 ? '' : 's'} por subir`
    : 'Al día'
  const tone = offline ? 'text-amber-300' : queued || syncing ? 'text-slate-300' : 'text-emerald-400'
  return <p className={`text-center text-xs py-1 ${tone}`} aria-live="polite">{offline ? '⚠️ ' : syncing ? '' : queued ? '⏳ ' : '✅ '}{text}</p>
}

export default function App() {
  const { state, toast } = useStore()
  const [tab, setTab] = useState<Tab>('services')

  if (!state.session || !state.me) return <><Login />{toast && <ToastView />}</>
  const role = state.me.role
  const tabs: { id: Tab; icon: string; label: string; badge?: number }[] = [
    { id: 'services', icon: '📋', label: 'Servicios' },
    { id: 'songs', icon: '🎵', label: 'Canciones' },
    ...(role === 'leader' ? [{ id: 'pending' as const, icon: '✅', label: 'Pendientes', badge: state.me.pending }]
      : role === 'editor' ? [{ id: 'pending' as const, icon: '📝', label: 'Propuestas' }] : []),
    { id: 'settings', icon: '⚙️', label: 'Ajustes' },
  ]

  return (
    <div className="h-full flex flex-col">
      <main className="flex-1 overflow-y-auto">
        {tab === 'services' && <Services />}
        {tab === 'songs' && <Songs />}
        {tab === 'pending' && <Pending />}
        {tab === 'settings' && <Settings />}
      </main>
      <footer className="border-t border-slate-800 bg-slate-950 safe-bottom">
        <SyncLine />
        <nav className="flex">
          {tabs.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)} aria-current={tab === t.id}
              className={`flex-1 min-h-14 flex flex-col items-center justify-center gap-0.5 text-[11px] relative ${tab === t.id ? 'text-indigo-400' : 'text-slate-400'}`}>
              <span className="text-xl leading-none">{t.icon}</span>
              {t.label}
              {!!t.badge && <span className="absolute top-1.5 left-1/2 ml-2 min-w-5 h-5 px-1 rounded-full bg-amber-500 text-slate-950 text-[11px] font-bold grid place-items-center">{t.badge}</span>}
            </button>
          ))}
        </nav>
      </footer>
      {toast && <ToastView />}
    </div>
  )
}

function ToastView() {
  const { toast } = useStore()
  if (!toast) return null
  return (
    <div role="status" className={`fixed left-4 right-4 bottom-28 z-50 rounded-xl px-4 py-3 text-sm shadow-xl ${toast.kind === 'error' ? 'bg-amber-500 text-slate-950' : 'bg-emerald-600 text-white'}`}>
      {toast.text}
    </div>
  )
}
