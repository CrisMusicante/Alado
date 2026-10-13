import { contextBridge, ipcRenderer } from 'electron'

// Expose a safe, minimal API to the renderer process
contextBridge.exposeInMainWorld('api', {
  // Songs
  getSongs: (query?: string) => ipcRenderer.invoke('db:get-songs', query),
  saveSong: (song: unknown) => ipcRenderer.invoke('db:save-song', song),
  deleteSong: (id: number) => ipcRenderer.invoke('db:delete-song', id),

  // Setlists
  getSetlists: () => ipcRenderer.invoke('db:get-setlists'),
  saveSetlist: (setlist: unknown) => ipcRenderer.invoke('db:save-setlist', setlist),
  deleteSetlist: (id: number) => ipcRenderer.invoke('db:delete-setlist', id),

  // Live window
  openLive: () => ipcRenderer.invoke('live:open'),
  closeLive: () => ipcRenderer.invoke('live:close'),
  showSection: (payload: unknown) => ipcRenderer.invoke('live:show-section', payload),
  setVideo: (payload: unknown) => ipcRenderer.invoke('live:set-video', payload),
  setBlackout: (active: boolean) => ipcRenderer.invoke('live:blackout', { active }),
  setWhiteout: (active: boolean) => ipcRenderer.invoke('live:whiteout', { active }),
  setTransition: (payload: unknown) => ipcRenderer.invoke('live:transition', payload),

  // Folders
  getFolders: () => ipcRenderer.invoke('db:get-folders'),
  createFolder: (name: string) => ipcRenderer.invoke('db:create-folder', name),
  renameFolder: (id: number, name: string) => ipcRenderer.invoke('db:rename-folder', { id, name }),
  deleteFolder: (id: number) => ipcRenderer.invoke('db:delete-folder', id),
  getSongsInFolder: (folderId: number | null) => ipcRenderer.invoke('db:get-songs-in-folder', folderId),
  moveSongToFolder: (songId: number, folderId: number | null) => ipcRenderer.invoke('db:move-song-to-folder', { songId, folderId }),

  // Lyrics import
  fetchLyricsUrl: (url: string) => ipcRenderer.invoke('lyrics:fetch-url', url),
  fetchLyricsAI: (payload: unknown) => ipcRenderer.invoke('lyrics:fetch-ai', payload),

  // System
  getDisplays: () => ipcRenderer.invoke('system:get-displays'),
  openFileDialog: (filters: unknown) => ipcRenderer.invoke('system:open-file-dialog', filters),

  // Events from main → renderer
  on: (channel: string, cb: (...args: unknown[]) => void) => {
    const allowed = ['live:show-section', 'live:set-video', 'live:blackout', 'live:whiteout', 'live:transition', 'live:closed']
    if (allowed.includes(channel)) ipcRenderer.on(channel, (_e, ...args) => cb(...args))
  },
  off: (channel: string, cb: (...args: unknown[]) => void) => {
    ipcRenderer.removeListener(channel, cb as any)
  },

  // Signal from live renderer → main that it is mounted and ready to receive IPC
  signalReady: () => ipcRenderer.send('live:renderer-ready')
})
