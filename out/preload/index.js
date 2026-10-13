"use strict";
const electron = require("electron");
electron.contextBridge.exposeInMainWorld("api", {
  // Songs
  getSongs: (query) => electron.ipcRenderer.invoke("db:get-songs", query),
  saveSong: (song) => electron.ipcRenderer.invoke("db:save-song", song),
  deleteSong: (id) => electron.ipcRenderer.invoke("db:delete-song", id),
  // Setlists
  getSetlists: () => electron.ipcRenderer.invoke("db:get-setlists"),
  saveSetlist: (setlist) => electron.ipcRenderer.invoke("db:save-setlist", setlist),
  deleteSetlist: (id) => electron.ipcRenderer.invoke("db:delete-setlist", id),
  // Live window
  openLive: () => electron.ipcRenderer.invoke("live:open"),
  closeLive: () => electron.ipcRenderer.invoke("live:close"),
  showSection: (payload) => electron.ipcRenderer.invoke("live:show-section", payload),
  setVideo: (payload) => electron.ipcRenderer.invoke("live:set-video", payload),
  setBlackout: (active) => electron.ipcRenderer.invoke("live:blackout", { active }),
  setWhiteout: (active) => electron.ipcRenderer.invoke("live:whiteout", { active }),
  setTransition: (payload) => electron.ipcRenderer.invoke("live:transition", payload),
  // Folders
  getFolders: () => electron.ipcRenderer.invoke("db:get-folders"),
  createFolder: (name) => electron.ipcRenderer.invoke("db:create-folder", name),
  renameFolder: (id, name) => electron.ipcRenderer.invoke("db:rename-folder", { id, name }),
  deleteFolder: (id) => electron.ipcRenderer.invoke("db:delete-folder", id),
  getSongsInFolder: (folderId) => electron.ipcRenderer.invoke("db:get-songs-in-folder", folderId),
  moveSongToFolder: (songId, folderId) => electron.ipcRenderer.invoke("db:move-song-to-folder", { songId, folderId }),
  // Lyrics import
  fetchLyricsUrl: (url) => electron.ipcRenderer.invoke("lyrics:fetch-url", url),
  fetchLyricsAI: (payload) => electron.ipcRenderer.invoke("lyrics:fetch-ai", payload),
  // Audio (stems, engine, cues)
  audioEngineStatus: () => electron.ipcRenderer.invoke("audio:engine-status"),
  audioInstallEngine: () => electron.ipcRenderer.invoke("audio:install-engine"),
  audioCancelInstall: () => electron.ipcRenderer.invoke("audio:cancel-install"),
  audioImportTrack: (songId, filePath) => electron.ipcRenderer.invoke("audio:import-track", { songId, filePath }),
  audioReprocess: (songId) => electron.ipcRenderer.invoke("audio:reprocess", songId),
  audioCancel: (songId) => electron.ipcRenderer.invoke("audio:cancel", songId),
  audioGetQueue: () => electron.ipcRenderer.invoke("audio:get-queue"),
  audioGetSongAudio: (songId) => electron.ipcRenderer.invoke("audio:get-song-audio", songId),
  audioReadStem: (songId, stem) => electron.ipcRenderer.invoke("audio:read-stem", { songId, stem }),
  audioUpdate: (songId, patch) => electron.ipcRenderer.invoke("audio:update", { songId, patch }),
  packExport: (songId) => electron.ipcRenderer.invoke("pack:export", songId),
  packInspect: () => electron.ipcRenderer.invoke("pack:inspect"),
  packImport: (path, mode) => electron.ipcRenderer.invoke("pack:import", { path, mode }),
  // System
  getDisplays: () => electron.ipcRenderer.invoke("system:get-displays"),
  openFileDialog: (filters) => electron.ipcRenderer.invoke("system:open-file-dialog", filters),
  // Events from main → renderer
  on: (channel, cb) => {
    const allowed = [
      "live:show-section",
      "live:set-video",
      "live:blackout",
      "live:whiteout",
      "live:transition",
      "live:closed",
      "audio:progress",
      "audio:status-changed",
      "audio:engine-progress"
    ];
    if (allowed.includes(channel)) electron.ipcRenderer.on(channel, (_e, ...args) => cb(...args));
  },
  off: (channel, cb) => {
    electron.ipcRenderer.removeListener(channel, cb);
  },
  // Signal from live renderer → main that it is mounted and ready to receive IPC
  signalReady: () => electron.ipcRenderer.send("live:renderer-ready")
});
