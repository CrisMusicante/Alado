import { useEffect, useState } from 'react'
import { useSyncStore } from '../store/sync.store'

const DAYS = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb']

/** "hace 2 min" for recent times, "sáb 8:40 p.m." otherwise. */
export function whenText(iso: string | null, now = new Date()): string {
  if (!iso) return 'nunca'
  const d = new Date(iso)
  const min = Math.round((now.getTime() - d.getTime()) / 60_000)
  if (min < 1) return 'hace un momento'
  if (min < 60) return `hace ${min} min`
  const h = d.getHours()
  const time = `${h % 12 || 12}:${String(d.getMinutes()).padStart(2, '0')} ${h < 12 ? 'a.m.' : 'p.m.'}`
  return `${DAYS[d.getDay()]} ${time}`
}

/** Sidebar badge: cloud sync state, with the one action each state needs. Hidden when not linked. */
export default function SyncIndicator() {
  const status = useSyncStore(s => s.status)
  const [, tick] = useState(0)
  useEffect(() => {
    const t = setInterval(() => tick(n => n + 1), 30_000)
    return () => clearInterval(t)
  }, [])

  if (status.state === 'off') return null
  const run = () => { void window.api.syncRun() }

  const view = {
    syncing: { icon: '🔄', text: 'Sincronizando…', tone: 'text-slate-400', action: null },
    ok: { icon: '✅', text: `Sincronizado ${whenText(status.lastOk)}`, tone: 'text-emerald-400', action: null },
    held: { icon: '⏸', text: 'Cambios nuevos en espera', tone: 'text-amber-300', action: { label: 'Actualizar', onClick: run } },
    error: {
      icon: '⚠️',
      text: status.unauthorized ? 'Compu desvinculada' : `Sin sincronizar · último: ${whenText(status.lastOk)}`,
      tone: 'text-amber-400',
      action: status.unauthorized ? null : { label: 'Reintentar', onClick: run },
    },
  }[status.state]

  return (
    <div className="w-16 flex flex-col items-center gap-1 px-1 text-center" title={status.error ?? view.text}>
      <span className="text-base leading-none">{view.icon}</span>
      <span className={`text-[9px] leading-tight ${view.tone}`}>{view.text}</span>
      {view.action && (
        <button
          onClick={view.action.onClick}
          className="mt-0.5 text-[10px] font-medium px-2 py-0.5 rounded-md bg-slate-800 hover:bg-slate-700 text-white border border-slate-700"
        >
          {view.action.label}
        </button>
      )}
    </div>
  )
}
