import { useEffect, useState } from 'react'
import { useAudioStore } from '../../store/audio.store'
import type { Section } from '../../store/songs.store'

const STEP_LABEL = { download: 'Descargando', extract: 'Extrayendo', pip: 'Instalando librerías', ffmpeg: 'Preparando ffmpeg', selftest: 'Probando el motor' }
const gb = (b: number) => (b / 1024 ** 3).toFixed(1)

export default function AudioPanel({ songId, sections }: { songId?: number; sections: Section[] }) {
  const { engine, engineProgress, installing, byId, progress, init, installEngine, load, importTrack, reprocess, cancel } = useAudioStore()
  const [error, setError] = useState<string | null>(null)
  const audio = songId ? byId[songId] : undefined

  useEffect(() => { init() }, [])
  useEffect(() => { if (songId) void load(songId) }, [songId])

  if (!songId) {
    return <Box><p className="text-sm text-slate-400">Guarda la canción primero para poder agregarle audio.</p></Box>
  }

  async function pickAndImport() {
    setError(null)
    const file = await window.api.openFileDialog([{ name: 'Audio', extensions: ['mp3', 'wav', 'flac', 'm4a'] }])
    if (!file) return
    try { await importTrack(songId!, file) } catch (e) { setError((e as Error).message) }
  }

  async function install() {
    setError(null)
    const err = await installEngine()
    if (err) setError(err)
  }

  const needsEngine = engine && !engine.installed

  return (
    <Box>
      {error && <p className="text-sm text-red-400 mb-3">{error}</p>}

      {needsEngine && !engine.platformSupported && (
        <p className="text-sm text-amber-400">Esta computadora no es compatible con el motor de separación.</p>
      )}

      {needsEngine && engine.platformSupported && !installing && (
        <div className="flex items-center gap-3">
          <p className="text-sm text-slate-300 flex-1">
            Para separar la voz hay que preparar el motor de audio una sola vez
            (~{gb(engine.estimatedInstallBytes)} GB de descarga y espacio en disco).
          </p>
          <Btn onClick={install}>Preparar motor de audio</Btn>
        </div>
      )}

      {installing && (
        <div className="flex items-center gap-3">
          <Progress pct={engineProgress?.pct ?? 0} label={engineProgress ? STEP_LABEL[engineProgress.step] : 'Iniciando'} />
          <Btn onClick={() => window.api.audioCancelInstall()}>Cancelar</Btn>
        </div>
      )}

      {engine?.installed && !audio && <Btn onClick={pickAndImport}>Importar pista</Btn>}

      {audio && (audio.status === 'pending' || audio.status === 'processing') && (
        <div className="flex items-center gap-3">
          <Progress pct={progress[songId] ?? 0} label={audio.status === 'pending' ? 'En espera' : 'Separando voz e instrumental (tarda ≈2–3× la duración de la canción)'} />
          <Btn onClick={() => cancel(songId)}>Cancelar</Btn>
        </div>
      )}

      {audio && (audio.status === 'failed' || audio.status === 'cancelled') && (
        <div className="flex items-center gap-3">
          <p className="text-sm text-red-400 flex-1">
            {audio.status === 'cancelled' ? 'Separación cancelada.' : `Falló la separación: ${audio.error ?? ''}`}
          </p>
          {engine?.installed && <Btn onClick={() => reprocess(songId)}>Reintentar</Btn>}
          {engine?.installed && <Btn onClick={pickAndImport}>Otra pista</Btn>}
        </div>
      )}

      {audio?.status === 'ready' && (
        <div className="flex items-center gap-3">
          <p className="text-sm text-emerald-400 flex-1">Pista lista: instrumental y voz separadas.</p>
          {engine?.installed && <Btn onClick={pickAndImport}>Reemplazar pista</Btn>}
          {/* Task 7: <StemMixer/> · Task 8: <CueEditor/> · Task 10: export */}
        </div>
      )}
    </Box>
  )
}

function Box({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-5 bg-slate-800 rounded-2xl p-4 border border-slate-700">
      <h2 className="text-xs font-semibold text-slate-400 mb-4 uppercase tracking-widest">Audio</h2>
      {children}
    </div>
  )
}

export function Btn({ onClick, children, disabled }: { onClick: () => void; children: React.ReactNode; disabled?: boolean }) {
  return (
    <button onClick={onClick} disabled={disabled}
      className="bg-slate-700 hover:bg-slate-600 disabled:opacity-50 text-white px-4 py-2 rounded-xl text-sm transition-colors border border-slate-600 shrink-0">
      {children}
    </button>
  )
}

function Progress({ pct, label }: { pct: number; label: string }) {
  return (
    <div className="flex-1">
      <div className="flex justify-between text-xs text-slate-400 mb-1"><span>{label}</span><span>{pct}%</span></div>
      <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
        <div className="h-full bg-indigo-500 transition-all" style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}
