import { useState } from 'react'
import SongsPage from './pages/Songs/SongsPage'
import SetlistPage from './pages/Setlist/SetlistPage'
import SettingsPage from './pages/Settings/SettingsPage'
import LiveControlsPanel from './components/LiveControls/LiveControlsPanel'
import { useLiveStore } from './store/live.store'

type Page = 'songs' | 'setlist' | 'settings'

export default function App() {
  const [page, setPage] = useState<Page>('songs')
  const isLive = useLiveStore(s => s.isLive)

  return (
    <div className="flex h-screen bg-slate-900 text-white overflow-hidden">
      {/* Sidebar */}
      <aside className="w-16 flex flex-col items-center py-6 gap-4 bg-slate-950 border-r border-slate-800">
        <NavBtn icon="🎵" label="Canciones" active={page === 'songs'} onClick={() => setPage('songs')} />
        <NavBtn icon="📋" label="Servicio" active={page === 'setlist'} onClick={() => setPage('setlist')} />
        <NavBtn icon="⚙️" label="Ajustes" active={page === 'settings'} onClick={() => setPage('settings')} />
        {isLive && (
          <div className="mt-auto mb-2 w-3 h-3 rounded-full bg-red-500 animate-pulse" title="En vivo" />
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

function NavBtn({ icon, label, active, onClick }: { icon: string; label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      title={label}
      className={`w-12 h-12 rounded-xl flex items-center justify-center text-xl transition-colors
        ${active ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}
    >
      {icon}
    </button>
  )
}
