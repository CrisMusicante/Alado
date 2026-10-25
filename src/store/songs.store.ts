import { create } from 'zustand'
import type { SongAudio, EngineStatus, QueueItem, Stem, SongAudioPatch } from '../audio/types'

export interface Section {
  type: 'verse' | 'chorus' | 'estribillo' | 'pre-chorus' | 'bridge' | 'outro' | 'intro' | 'custom'
  label: string
  lines: string[]
  repeat?: number
}

export interface TextStyle {
  font: 'sans' | 'rounded' | 'bold-condensed'
  size: 'sm' | 'md' | 'lg' | 'xl'
  color: string
  position: 'top' | 'center' | 'bottom'
  shadow: boolean
  stroke: boolean
}

export interface Song {
  id?: number
  title: string
  artist?: string
  sections: Section[]
  video_path?: string
  text_style: Partial<TextStyle>
  folder_id?: number | null
  created_at?: string
  updated_at?: string
}

/** Result of importing a .alado service (mirrors electron/ipc/setlist.handlers.ts). */
export interface ImportSummary {
  setlistId: number
  reused: number
  created: string[]
  differing: string[]
  missingVideo: string[]
  missingAudio: string[]
}

export interface Folder {
  id?: number
  name: string
  created_at?: string
}

interface SongsState {
  songs: Song[]
  loading: boolean
  searchQuery: string
  setSearchQuery: (q: string) => void
  fetchSongs: (query?: string) => Promise<void>
  saveSong: (song: Song) => Promise<number>
  deleteSong: (id: number) => Promise<void>
}

declare global {
  interface Window {
    api: {
      getSongs: (q?: string) => Promise<Song[]>
      saveSong: (s: Song) => Promise<number>
      deleteSong: (id: number) => Promise<void>
      getSetlists: () => Promise<any[]>
      saveSetlist: (s: any) => Promise<number>
      deleteSetlist: (id: number) => Promise<void>
      setlistExport: (p: { name: string; service_date: string; songIds: number[] }) => Promise<{ path: string } | null>
      setlistSavePptx: (p: { bytes: Uint8Array; defaultName: string }) => Promise<{ path: string } | null>
      setlistImportInspect: () => Promise<{ path: string; name: string; service_date: string | null; songCount: number; duplicateOf: number | null } | null>
      setlistImportApply: (p: { path: string; mode: 'new' | 'replace'; replaceId?: number }) => Promise<ImportSummary>
      openLive: () => Promise<void>
      closeLive: () => Promise<void>
      showSection: (p: any) => Promise<void>
      setVideo: (p: any) => Promise<void>
      setBlackout: (active: boolean) => Promise<void>
      setWhiteout: (active: boolean) => Promise<void>
      setTransition: (p: any) => Promise<void>
      getDisplays: () => Promise<any[]>
      openFileDialog: (filters: any) => Promise<string | null>
      fetchLyricsUrl: (url: string) => Promise<{ success: boolean; rawText?: string; site?: string; error?: string }>
      fetchLyricsAI: (payload: any) => Promise<{ success: boolean; rawText?: string; error?: string }>
      getFolders: () => Promise<Folder[]>
      createFolder: (name: string) => Promise<number>
      renameFolder: (id: number, name: string) => Promise<void>
      deleteFolder: (id: number) => Promise<void>
      getSongsInFolder: (folderId: number | null) => Promise<Song[]>
      moveSongToFolder: (songId: number, folderId: number | null) => Promise<void>
      audioEngineStatus: () => Promise<EngineStatus>
      audioInstallEngine: () => Promise<{ ok: boolean; error?: string }>
      audioCancelInstall: () => Promise<void>
      audioImportTrack: (songId: number, filePath: string) => Promise<SongAudio>
      audioReprocess: (songId: number) => Promise<SongAudio>
      audioCancel: (songId: number) => Promise<void>
      audioGetQueue: () => Promise<QueueItem[]>
      audioGetSongAudio: (songId: number) => Promise<SongAudio | null>
      audioReadStem: (songId: number, stem: Stem) => Promise<Uint8Array>
      audioUpdate: (songId: number, patch: SongAudioPatch) => Promise<SongAudio>
      packExport: (songId: number) => Promise<{ path: string } | null>
      packInspect: () => Promise<{ path: string; title: string; artist?: string; duplicateOf: number | null } | null>
      packImport: (path: string, mode: 'copy' | 'replace') => Promise<number>
      on: (channel: string, cb: (...args: any[]) => void) => void
      off: (channel: string, cb: (...args: any[]) => void) => void
      signalReady: () => void
    }
  }
}

export const useSongsStore = create<SongsState>((set) => ({
  songs: [],
  loading: false,
  searchQuery: '',

  setSearchQuery: (q) => set({ searchQuery: q }),

  fetchSongs: async (query) => {
    set({ loading: true })
    const songs = await window.api.getSongs(query)
    set({ songs, loading: false })
  },

  saveSong: async (song) => {
    const id = await window.api.saveSong(song)
    // Refresh list
    const songs = await window.api.getSongs()
    set({ songs })
    return id
  },

  deleteSong: async (id) => {
    await window.api.deleteSong(id)
    const songs = await window.api.getSongs()
    set({ songs })
  }
}))
