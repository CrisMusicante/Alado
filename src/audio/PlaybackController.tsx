import { useEffect, useRef } from 'react'
import { useLiveStore } from '../store/live.store'
import { useAudioStore } from '../store/audio.store'
import { usePlaybackStore, getPlayer, getFollower, setFollowerCues } from './playback.store'
import { cuesAreStale } from './cues'

/**
 * No UI. Loads the live song's stems, advances lyrics on cues, and notices when the
 * operator changes section by hand (manual mode until the next cue).
 */
export default function PlaybackController() {
  const currentSong = useLiveStore(s => s.currentSong)
  const isLive = useLiveStore(s => s.isLive)
  const pendingAuto = useRef<number | null>(null)

  // Load audio + cues whenever the live song changes.
  useEffect(() => {
    if (!isLive || !currentSong?.id) {
      const pb = usePlaybackStore.getState()
      if (pb.songId !== null && !pb.recording) pb.unload()
      return
    }
    const id = currentSong.id
    let cancelled = false
    void (async () => {
      const audio = await useAudioStore.getState().load(id)
      if (cancelled) return
      if (audio?.status !== 'ready') { usePlaybackStore.getState().unload(); return }
      setFollowerCues(null) // never let the previous song's cues drive this one while it loads
      await usePlaybackStore.getState().loadSong(id)
      if (cancelled || usePlaybackStore.getState().songId !== id) return
      const stale = cuesAreStale(audio.cues, audio.cues_sections_sig, currentSong.sections)
      setFollowerCues(stale ? null : audio.cues)
    })()
    return () => { cancelled = true }
  }, [isLive, currentSong?.id])

  // Operator pressed a section by hand → manual mode until the next cue.
  useEffect(() => useLiveStore.subscribe((state, prev) => {
    if (state.currentSectionIndex === prev.currentSectionIndex) return
    if (pendingAuto.current === state.currentSectionIndex) { pendingAuto.current = null; return }
    const f = getFollower()
    if (f && usePlaybackStore.getState().playing) {
      f.markManual()
      usePlaybackStore.setState({ manual: true })
    }
  }), [])

  // Clock loop: publish time and fire cues. A timer, not requestAnimationFrame: rAF stops while the
  // main window is minimized or hidden, and the projected lyrics must keep following the audio.
  useEffect(() => {
    let lastPublished = 0
    const timer = setInterval(() => {
      const pb = usePlaybackStore.getState()
      if (pb.status !== 'ready') return
      const p = getPlayer()
      const t = p.currentTime
      if (Math.abs(t - lastPublished) > 0.1 || p.playing !== pb.playing) {
        lastPublished = t
        usePlaybackStore.setState({ time: t, playing: p.playing })
      }
      const f = getFollower()
      if (f && p.playing && !pb.recording) fire(f.update(t))
    }, 50)
    return () => clearInterval(timer)
  }, [])

  // "Volver a automático" re-syncs the lyrics to the current time.
  useEffect(() => usePlaybackStore.subscribe((state, prev) => {
    const f = getFollower()
    if (!f || state.recording) return
    if (prev.manual && !state.manual && f.isManual) fire(f.resumeAuto(getPlayer().currentTime))
  }), [])

  function fire(sectionIndex: number | null) {
    if (sectionIndex === null) return
    if (usePlaybackStore.getState().manual) usePlaybackStore.setState({ manual: false })
    const live = useLiveStore.getState()
    if (sectionIndex === live.currentSectionIndex) return
    pendingAuto.current = sectionIndex
    void live.goToSection(sectionIndex)
  }

  return null
}
