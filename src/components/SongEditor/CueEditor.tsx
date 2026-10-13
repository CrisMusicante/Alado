import { useEffect, useRef, useState } from 'react'
import { CueRecorder, Cue, nudgeCue, removeCue, upsertCueAt, sectionsSignature, cuesAreStale } from '../../audio/cues'
import { usePlaybackStore, getPlayer } from '../../audio/playback.store'
import { useAudioStore } from '../../store/audio.store'
import type { Section } from '../../store/songs.store'
import { Btn } from './AudioPanel'

const fmt = (t: number) => `${Math.floor(t / 60)}:${(t % 60).toFixed(1).padStart(4, '0')}`

export default function CueEditor({ songId, sections }: { songId: number; sections: Section[] }) {
  const audio = useAudioStore(s => s.byId[songId])
  const update = useAudioStore(s => s.update)
  const { songId: loaded, recording, setRecording, seek, toggle } = usePlaybackStore()
  const recorder = useRef<CueRecorder | null>(null)
  const [draft, setDraft] = useState<Cue[]>([])
  const [selected, setSelected] = useState(0)

  const cues = recording ? draft : (audio?.cues ?? [])
  const stale = audio ? cuesAreStale(audio.cues, audio.cues_sections_sig, sections) : false
  const save = (next: Cue[]) => update(songId, { cues: next, cues_sections_sig: sectionsSignature(sections) })

  useEffect(() => {
    if (!recording) return
    function onKey(e: KeyboardEvent) {
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement).tagName)) return
      const t = getPlayer().currentTime
      if (e.key === ' ') {
        e.preventDefault()
        ;(document.activeElement as HTMLElement | null)?.blur() // don't also "click" a focused button
        recorder.current?.tap(t)
      } else if (e.key === 'r' || e.key === 'R') recorder.current?.repeat(t)
      else return
      setDraft(recorder.current!.result)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [recording])

  // Leaving the editor mid-recording must not leave the playback store stuck in recording mode.
  useEffect(() => () => { if (usePlaybackStore.getState().recording) setRecording(false) }, [])

  if (loaded !== songId || sections.length === 0) return null

  function start() {
    recorder.current = new CueRecorder(sections.length)
    setDraft([])
    setRecording(true)
    seek(0)
    if (!getPlayer().playing) toggle()
  }

  async function finish() {
    if (getPlayer().playing) toggle()
    setRecording(false)
    await save(recorder.current?.result ?? [])
    recorder.current = null
  }

  function markSection(i: number) {
    if (!recording || !recorder.current) return
    recorder.current.mark(i, getPlayer().currentTime)
    setDraft(recorder.current.result)
  }

  const next = recorder.current?.nextSection ?? null

  return (
    <div className="mt-2 border-t border-slate-700 pt-4">
      <div className="flex items-center gap-3 mb-3">
        <h3 className="text-sm font-semibold flex-1">Cues ({cues.length})</h3>
        {!recording && <Btn onClick={start}>{cues.length ? 'Volver a marcar' : 'Marcar cues'}</Btn>}
        {recording && <Btn onClick={finish}>Terminar y guardar</Btn>}
      </div>

      {stale && !recording && (
        <p className="text-sm text-amber-400 mb-3">
          Las secciones cambiaron después de marcar los cues. No se usarán en vivo hasta que los vuelvas a marcar.
        </p>
      )}

      {recording && (
        <p className="text-sm text-slate-300 mb-3">
          <b>Espacio</b>: siguiente sección{next !== null ? ` (${sections[next].label})` : ' (no quedan)'} ·
          <b> R</b>: repetir la actual · <b>clic</b> en una sección: marcarla ahora
        </p>
      )}

      {recording && (
        <div className="flex gap-1 flex-wrap mb-3">
          {sections.map((s, i) => (
            <button key={i} onClick={() => markSection(i)}
              className={`px-2.5 py-1 rounded-lg text-xs border ${i === next ? 'bg-indigo-600 border-indigo-500 text-white' : 'bg-slate-700 border-slate-600 text-slate-300'}`}>
              {s.label}
            </button>
          ))}
        </div>
      )}

      <ol className="flex flex-col gap-1">
        {cues.map((c, i) => (
          <li key={`${c.sectionIndex}-${c.time}-${i}`}
            className={`flex items-center gap-2 text-sm rounded-lg px-2 py-1 ${i === selected && !recording ? 'bg-slate-700' : ''}`}
            onClick={() => setSelected(i)}>
            <span className="tabular-nums text-slate-400 w-16">{fmt(c.time)}</span>
            <span className="flex-1">{sections[c.sectionIndex]?.label ?? `Sección ${c.sectionIndex + 1}`}</span>
            {!recording && <>
              <SmallBtn onClick={() => save(nudgeCue(cues, i, -0.1))}>−0.1</SmallBtn>
              <SmallBtn onClick={() => save(nudgeCue(cues, i, 0.1))}>+0.1</SmallBtn>
              <SmallBtn onClick={() => { seek(Math.max(0, c.time - 2)); if (!getPlayer().playing) toggle() }}>▶</SmallBtn>
              <SmallBtn onClick={() => save(upsertCueAt(cues, c.sectionIndex, getPlayer().currentTime))}>Marcar aquí</SmallBtn>
              <SmallBtn onClick={() => save(removeCue(cues, i))}>✕</SmallBtn>
            </>}
          </li>
        ))}
      </ol>
    </div>
  )
}

function SmallBtn({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={e => { e.stopPropagation(); onClick() }}
      className="text-xs px-2 py-0.5 rounded-md bg-slate-700 hover:bg-slate-600 border border-slate-600">
      {children}
    </button>
  )
}
