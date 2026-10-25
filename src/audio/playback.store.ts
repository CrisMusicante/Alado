import { create } from 'zustand'
import { StemPlayer } from './player'
import { CueFollower, Cue } from './cues'
import type { Stem } from './types'

let player: StemPlayer | null = null
export const getPlayer = (): StemPlayer => (player ??= new StemPlayer())

let follower: CueFollower | null = null
export const getFollower = (): CueFollower | null => follower
export function setFollowerCues(cues: Cue[] | null): void {
  follower = cues && cues.length > 0 ? new CueFollower(cues, usePlaybackStore.getState().lead) : null
}

interface PlaybackState {
  songId: number | null
  status: 'idle' | 'loading' | 'ready' | 'error'
  error: string | null
  playing: boolean
  time: number
  duration: number
  volumes: Record<Stem, number>
  manual: boolean
  recording: boolean
  lead: number
  loadSong: (songId: number) => Promise<void>
  toggle: () => void
  seek: (t: number) => void
  setVolume: (stem: Stem, v: number) => void
  resumeAuto: () => void
  unload: () => void
  setRecording: (r: boolean) => void
}

export const usePlaybackStore = create<PlaybackState>((set, get) => ({
  songId: null,
  status: 'idle',
  error: null,
  playing: false,
  time: 0,
  duration: 0,
  volumes: { instrumental: 1, vocals: 0 },
  manual: false,
  recording: false,
  lead: 0.3,

  loadSong: async (songId) => {
    if (get().songId === songId && get().status === 'ready') return
    const p = getPlayer()
    p.pause()
    set({ songId, status: 'loading', error: null, playing: false, time: 0, manual: false })
    try {
      const [instrumental, vocals, meta] = await Promise.all([
        window.api.audioReadStem(songId, 'instrumental'),
        window.api.audioReadStem(songId, 'vocals'),
        window.api.audioGetSongAudio(songId)
      ])
      if (get().songId !== songId) return // another song was requested meanwhile
      // Copy into fresh ArrayBuffers: decodeAudioData detaches its input.
      const decoded = await p.decode({ instrumental: instrumental.slice().buffer, vocals: vocals.slice().buffer })
      if (get().songId !== songId) return // a newer song finished (or started) while this one decoded
      p.use(decoded)
      const volumes = { instrumental: meta?.vol_instrumental ?? 1, vocals: meta?.vol_vocals ?? 0 }
      p.setVolume('instrumental', volumes.instrumental)
      p.setVolume('vocals', volumes.vocals)
      p.onEnded = () => set({ playing: false, time: 0 })
      set({ status: 'ready', duration: p.duration, volumes })
      if (meta && !meta.duration_sec) void window.api.audioUpdate(songId, { duration_sec: p.duration })
    } catch (e) {
      set({ status: 'error', error: (e as Error).message })
    }
  },

  toggle: () => {
    const p = getPlayer()
    if (get().status !== 'ready') return
    if (p.playing) p.pause(); else p.play()
    set({ playing: p.playing, time: p.currentTime })
  },

  seek: (t) => {
    getPlayer().seek(t)
    set({ time: getPlayer().currentTime })
  },

  setVolume: (stem, v) => {
    getPlayer().setVolume(stem, v)
    const volumes = { ...get().volumes, [stem]: v }
    set({ volumes })
    const id = get().songId
    if (id) void window.api.audioUpdate(id, stem === 'instrumental' ? { vol_instrumental: v } : { vol_vocals: v })
  },

  resumeAuto: () => set({ manual: false }),

  unload: () => {
    getPlayer().pause()
    follower = null
    set({ songId: null, status: 'idle', playing: false, time: 0, duration: 0, manual: false })
  },

  setRecording: (recording) => set({ recording })
}))
