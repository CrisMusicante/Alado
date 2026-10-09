import { create } from 'zustand'
import { Folder, Song } from './songs.store'

interface FoldersState {
  folders: Folder[]
  currentFolderId: number | null
  songsInView: Song[]
  loading: boolean
  fetchFolders: () => Promise<void>
  createFolder: (name: string) => Promise<void>
  renameFolder: (id: number, name: string) => Promise<void>
  deleteFolder: (id: number) => Promise<void>
  enterFolder: (folderId: number | null) => Promise<void>
  moveSongToFolder: (songId: number, folderId: number | null) => Promise<void>
  refreshSongsInView: () => Promise<void>
}

export const useFoldersStore = create<FoldersState>((set, get) => ({
  folders: [],
  currentFolderId: null,
  songsInView: [],
  loading: false,

  fetchFolders: async () => {
    const folders = await window.api.getFolders()
    set({ folders })
  },

  createFolder: async (name) => {
    await window.api.createFolder(name)
    const folders = await window.api.getFolders()
    set({ folders })
  },

  renameFolder: async (id, name) => {
    await window.api.renameFolder(id, name)
    const folders = await window.api.getFolders()
    set({ folders })
  },

  deleteFolder: async (id) => {
    await window.api.deleteFolder(id)
    const folders = await window.api.getFolders()
    // If we were inside the deleted folder, go back to root
    const { currentFolderId } = get()
    if (currentFolderId === id) {
      const songsInView = await window.api.getSongsInFolder(null)
      set({ folders, currentFolderId: null, songsInView })
    } else {
      set({ folders })
    }
  },

  enterFolder: async (folderId) => {
    set({ loading: true })
    const songsInView = await window.api.getSongsInFolder(folderId)
    set({ currentFolderId: folderId, songsInView, loading: false })
  },

  moveSongToFolder: async (songId, folderId) => {
    await window.api.moveSongToFolder(songId, folderId)
    // Refresh current view — moved song should disappear
    const { currentFolderId } = get()
    const songsInView = await window.api.getSongsInFolder(currentFolderId)
    set({ songsInView })
  },

  refreshSongsInView: async () => {
    const { currentFolderId } = get()
    const songsInView = await window.api.getSongsInFolder(currentFolderId)
    set({ songsInView })
  }
}))
