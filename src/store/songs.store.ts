import { create } from 'zustand'

export interface Section {
  type: 'verse' | 'chorus' | 'bridge' | 'outro' | 'intro' | 'custom'
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
  created_at?: string
  updated_at?: string
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
      openLive: () => Promise<void>
      closeLive: () => Promise<void>
      showSection: (p: any) => Promise<void>
      setVideo: (p: any) => Promise<void>
      setBlackout: (active: boolean) => Promise<void>
      setWhiteout: (active: boolean) => Promise<void>
      setTransition: (p: any) => Promise<void>
      getDisplays: () => Promise<any[]>
      openFileDialog: (filters: any) => Promise<string | null>
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
