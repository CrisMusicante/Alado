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
  // System
  getDisplays: () => electron.ipcRenderer.invoke("system:get-displays"),
  openFileDialog: (filters) => electron.ipcRenderer.invoke("system:open-file-dialog", filters),
  // Events from main → renderer
  on: (channel, cb) => {
    const allowed = ["live:show-section", "live:set-video", "live:blackout", "live:whiteout", "live:transition", "live:closed"];
    if (allowed.includes(channel)) electron.ipcRenderer.on(channel, (_e, ...args) => cb(...args));
  },
  off: (channel, cb) => {
    electron.ipcRenderer.removeListener(channel, cb);
  },
  // Signal from live renderer → main that it is mounted and ready to receive IPC
  signalReady: () => electron.ipcRenderer.send("live:renderer-ready")
});
