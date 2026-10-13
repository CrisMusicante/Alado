import { usePlaybackStore, getFollower } from '../../audio/playback.store'
import { useLiveStore } from '../../store/live.store'

const fmt = (t: number) => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`

export default function AudioTransport() {
  const { status, playing, time, duration, volumes, manual, toggle, seek, setVolume, resumeAuto } = usePlaybackStore()
  if (status === 'idle') return null
  if (status === 'loading') return <span className="text-xs text-slate-400">Cargando audio…</span>
  if (status === 'error') return <span className="text-xs text-red-400">No se pudo cargar el audio</span>

  function onSeek(t: number) {
    seek(t)
    if (usePlaybackStore.getState().recording) return
    const idx = getFollower()?.seek(t)
    if (idx !== null && idx !== undefined) void useLiveStore.getState().goToSection(idx)
  }

  return (
    <div className="flex items-center gap-3 bg-slate-900 rounded-xl px-3 py-2 border border-slate-800">
      <button onClick={toggle} title={playing ? 'Pausar' : 'Reproducir'}
        className="w-9 h-9 rounded-full bg-indigo-600 hover:bg-indigo-500 text-white text-sm shrink-0">
        {playing ? '❚❚' : '▶'}
      </button>
      <span className="text-xs text-slate-400 tabular-nums w-20">{fmt(time)} / {fmt(duration)}</span>
      <input type="range" min={0} max={duration || 0} step={0.1} value={time} aria-label="Posición"
        onChange={e => onSeek(Number(e.target.value))} className="w-40 accent-indigo-500" />
      <Vol label="Inst." value={volumes.instrumental} onChange={v => setVolume('instrumental', v)} />
      <Vol label="Voz" value={volumes.vocals} onChange={v => setVolume('vocals', v)} />
      {getFollower() && (manual
        ? <button onClick={resumeAuto} className="text-xs px-2 py-1 rounded-lg bg-amber-600 text-white">Manual · volver a auto</button>
        : <span className="text-xs px-2 py-1 rounded-lg bg-emerald-700 text-white">Automático</span>)}
    </div>
  )
}

function Vol({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <label className="flex items-center gap-1.5 text-xs text-slate-400">
      {label}
      <input type="range" min={0} max={1} step={0.05} value={value}
        onChange={e => onChange(Number(e.target.value))} className="w-20 accent-indigo-500" />
    </label>
  )
}
