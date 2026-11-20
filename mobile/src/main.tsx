import { Component, StrictMode, type ReactNode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App'
import { StoreProvider } from './store'

/** Any screen error shows a way back instead of a white screen (queued work is in IndexedDB). */
class ErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() { return { failed: true } }
  render() {
    if (!this.state.failed) return this.props.children
    return (
      <div className="min-h-screen grid place-items-center p-8 text-center">
        <div>
          <p className="text-lg font-semibold mb-2">Algo salió mal en esta pantalla.</p>
          <p className="text-slate-400 text-sm mb-6">Tus cambios guardados siguen en el celular.</p>
          <button className="min-h-11 px-5 rounded-xl bg-indigo-600 text-white" onClick={() => location.reload()}>Volver a abrir</button>
        </div>
      </div>
    )
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <StoreProvider>
        <App />
      </StoreProvider>
    </ErrorBoundary>
  </StrictMode>
)

if ('serviceWorker' in navigator && location.protocol === 'https:') {
  navigator.serviceWorker.register('/sw.js').then(() => navigator.serviceWorker.ready).then(reg => {
    // The JS/CSS of this first load came before the worker existed: hand them over to be cached.
    const urls = performance.getEntriesByType('resource').map(e => e.name).filter(u => new URL(u).pathname.startsWith('/assets/'))
    reg.active?.postMessage({ type: 'precache', urls })
  }).catch(() => { /* app still works online */ })
}
