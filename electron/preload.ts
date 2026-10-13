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

  // Audio (stems, engine, cues)
  audioEngineStatus: () => ipcRenderer.invoke('audio:engine-status'),
  audioInstallEngine: () => ipcRenderer.invoke('audio:install-engine'),
  audioCancelInstall: () => ipcRenderer.invoke('audio:cancel-install'),
  audioImportTrack: (songId: number, filePath: string) => ipcRenderer.invoke('audio:import-track', { songId, filePath }),
  audioReprocess: (songId: number) => ipcRenderer.invoke('audio:reprocess', songId),
  audioCancel: (songId: number) => ipcRenderer.invoke('audio:cancel', songId),
  audioGetQueue: () => ipcRenderer.invoke('audio:get-queue'),
  audioGetSongAudio: (songId: number) => ipcRenderer.invoke('audio:get-song-audio', songId),
  audioReadStem: (songId: number, stem: string) => ipcRenderer.invoke('audio:read-stem', { songId, stem }),
  audioUpdate: (songId: number, patch: unknown) => ipcRenderer.invoke('audio:update', { songId, patch }),
  packExport: (songId: number) => ipcRenderer.invoke('pack:export', songId),
  packInspect: () => ipcRenderer.invoke('pack:inspect'),
  packImport: (path: string, mode: 'copy' | 'replace') => ipcRenderer.invoke('pack:import', { path, mode }),

  // System
  getDisplays: () => ipcRenderer.invoke('system:get-displays'),
  openFileDialog: (filters: unknown) => ipcRenderer.invoke('system:open-file-dialog', filters),

  // Events from main → renderer
  on: (channel: string, cb: (...args: unknown[]) => void) => {
    const allowed = ['live:show-section', 'live:set-video', 'live:blackout', 'live:whiteout', 'live:transition', 'live:closed',
      'audio:progress', 'audio:status-changed', 'audio:engine-progress']
    if (allowed.includes(channel)) ipcRenderer.on(channel, (_e, ...args) => cb(...args))
  },
  off: (channel: string, cb: (...args: unknown[]) => void) => {
    ipcRenderer.removeListener(channel, cb as any)
  },

  // Signal from live renderer → main that it is mounted and ready to receive IPC
  signalReady: () => ipcRenderer.send('live:renderer-ready')
})
