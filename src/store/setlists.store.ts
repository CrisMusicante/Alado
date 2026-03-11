import { create } from 'zustand'
import { Song } from './songs.store'

export interface SavedSetlist {
  id?: number
  name: string
  service_date?: string
  notes?: string
  songs?: Array<{ song: Song; position: number; custom_video?: string }>
}

interface SetlistsState {
  setlists: SavedSetlist[]
  loading: boolean
  fetchSetlists: () => Promise<void>
  saveSetlist: (setlist: SavedSetlist) => Promise<number>
  deleteSetlist: (id: number) => Promise<void>
}

export const useSetlistsStore = create<SetlistsState>((set) => ({
  setlists: [],
  loading: false,

  fetchSetlists: async () => {
    set({ loading: true })
    const setlists = await window.api.getSetlists()
    set({ setlists, loading: false })
  },

  saveSetlist: async (setlist) => {
    const id = await window.api.saveSetlist(setlist)
    const setlists = await window.api.getSetlists()
    set({ setlists })
    return id
  },

  deleteSetlist: async (id) => {
    await window.api.deleteSetlist(id)
    const setlists = await window.api.getSetlists()
    set({ setlists })
  }
}))
