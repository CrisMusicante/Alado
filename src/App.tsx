import { useState } from 'react'
import SongsPage from './pages/Songs/SongsPage'
import SetlistPage from './pages/Setlist/SetlistPage'
import SettingsPage from './pages/Settings/SettingsPage'
import LiveControlsPanel from './components/LiveControls/LiveControlsPanel'
import { useLiveStore } from './store/live.store'
import PlaybackController from './audio/PlaybackController'

type Page = 'songs' | 'setlist' | 'settings'

export default function App() {
  const [page, setPage] = useState<Page>('songs')
  const isLive = useLiveStore(s => s.isLive)

  return (
    <div className="flex h-screen bg-slate-900 text-white overflow-hidden">
      <PlaybackController />
      {/* Sidebar */}
      <aside className="w-20 flex flex-col items-center py-6 gap-1 bg-slate-950 border-r border-slate-800">
        <NavBtn icon="🎵" label="Canciones" active={page === 'songs'} onClick={() => setPage('songs')} />
        <NavBtn icon="📋" label="Servicio" active={page === 'setlist'} onClick={() => setPage('setlist')} />
        <NavBtn icon="⚙️" label="Ajustes" active={page === 'settings'} onClick={() => setPage('settings')} />
        {isLive && (
          <div className="mt-auto mb-2 flex flex-col items-center gap-1">
            <div className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse" />
            <span className="text-[9px] font-bold text-red-400 tracking-widest uppercase">Live</span>
          </div>
        )}
      </aside>

      {/* Main content */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {isLive && <LiveControlsPanel />}
        <div className="flex-1 overflow-y-auto">
          {page === 'songs' && <SongsPage />}
          {page === 'setlist' && <SetlistPage />}
          {page === 'settings' && <SettingsPage />}
        </div>
      </main>
    </div>
  )
}

function NavBtn({ icon, label, active, onClick }: {
  icon: string; label: string; active: boolean; onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      title={label}
      className={`w-14 flex flex-col items-center gap-1 py-2.5 rounded-xl transition-all duration-200
        ${active ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}
    >
      <span className="text-xl leading-none">{icon}</span>
      <span className="text-[10px] font-medium leading-none">{label}</span>
    </button>
  )
}
