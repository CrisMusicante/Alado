import { useEffect } from 'react'
import { usePlaybackStore } from '../../audio/playback.store'
import { useLiveStore } from '../../store/live.store'
import AudioTransport from '../LiveControls/AudioTransport'
import { Btn } from './AudioPanel'

export default function StemMixer({ songId }: { songId: number }) {
  const { songId: loaded, loadSong, unload } = usePlaybackStore()
  const isLive = useLiveStore(s => s.isLive)

  useEffect(() => () => { if (!useLiveStore.getState().isLive) unload() }, [])

  if (isLive) {
    return <p className="text-sm text-slate-400">Hay un servicio en vivo. Termínalo para escuchar o marcar cues aquí.</p>
  }
  if (loaded !== songId) return <div><Btn onClick={() => loadSong(songId)}>Escuchar / mezclar</Btn></div>
  return <AudioTransport />
}
