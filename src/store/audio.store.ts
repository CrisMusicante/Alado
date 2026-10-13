import { create } from 'zustand'
import type { SongAudio, EngineStatus, EngineProgress, SongAudioPatch, AudioStatus } from '../audio/types'

interface AudioState {
  engine: EngineStatus | null
  engineProgress: EngineProgress | null
  installing: boolean
  byId: Record<number, SongAudio>
  progress: Record<number, number>
  init: () => void
  refreshEngine: () => Promise<void>
  installEngine: () => Promise<string | null>
  load: (songId: number) => Promise<SongAudio | null>
  importTrack: (songId: number, filePath: string) => Promise<void>
  reprocess: (songId: number) => Promise<void>
  cancel: (songId: number) => Promise<void>
  update: (songId: number, patch: SongAudioPatch) => Promise<void>
}

let initialized = false

export const useAudioStore = create<AudioState>((set, get) => ({
  engine: null,
  engineProgress: null,
  installing: false,
  byId: {},
  progress: {},

  init: () => {
    if (initialized) return
    initialized = true
    window.api.on('audio:progress', ({ songId, pct }: { songId: number; pct: number }) =>
      set(s => ({ progress: { ...s.progress, [songId]: pct } })))
    window.api.on('audio:status-changed', ({ songId, status, error }: { songId: number; status: AudioStatus; error?: string }) =>
      set(s => s.byId[songId]
        ? { byId: { ...s.byId, [songId]: { ...s.byId[songId], status, error: error ?? null } } }
        : s))
    window.api.on('audio:engine-progress', (p: EngineProgress) => set({ engineProgress: p }))
    void get().refreshEngine()
  },

  refreshEngine: async () => set({ engine: await window.api.audioEngineStatus() }),

  installEngine: async () => {
    set({ installing: true, engineProgress: null })
    const res = await window.api.audioInstallEngine()
    set({ installing: false })
    await get().refreshEngine()
    return res.ok ? null : (res.error ?? 'Error desconocido')
  },

  load: async (songId) => {
    const row = await window.api.audioGetSongAudio(songId)
    if (row) set(s => ({ byId: { ...s.byId, [songId]: row } }))
    return row
  },

  importTrack: async (songId, filePath) => {
    const row = await window.api.audioImportTrack(songId, filePath)
    set(s => ({ byId: { ...s.byId, [songId]: row }, progress: { ...s.progress, [songId]: 0 } }))
  },

  reprocess: async (songId) => {
    const row = await window.api.audioReprocess(songId)
    set(s => ({ byId: { ...s.byId, [songId]: row }, progress: { ...s.progress, [songId]: 0 } }))
  },

  cancel: async (songId) => window.api.audioCancel(songId),

  update: async (songId, patch) => {
    const row = await window.api.audioUpdate(songId, patch)
    set(s => ({ byId: { ...s.byId, [songId]: row } }))
  }
}))
