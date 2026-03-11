"use strict";
const electron = require("electron");
const path = require("path");
const Database = require("better-sqlite3");
const fs = require("fs");
function createMainWindow() {
  const win = new electron.BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    backgroundColor: "#0f172a",
    webPreferences: {
      preload: path.join(__dirname, "../preload/index.js"),
      contextIsolation: true,
      nodeIntegration: false
    }
  });
  if (process.env.NODE_ENV === "development" && process.env["ELECTRON_RENDERER_URL"]) {
    win.loadURL(process.env["ELECTRON_RENDERER_URL"]);
    win.webContents.openDevTools();
  } else {
    win.loadFile(path.join(__dirname, "../renderer/index.html"));
  }
  return win;
}
function createLiveWindow() {
  const displays = electron.screen.getAllDisplays();
  const externalDisplay = displays.find((d) => d.id !== electron.screen.getPrimaryDisplay().id);
  const targetDisplay = externalDisplay ?? electron.screen.getPrimaryDisplay();
  const { x, y, width, height } = targetDisplay.bounds;
  const win = new electron.BrowserWindow({
    x,
    y,
    width,
    height,
    fullscreen: !!externalDisplay,
    frame: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    backgroundColor: "#000000",
    webPreferences: {
      preload: path.join(__dirname, "../preload/index.js"),
      contextIsolation: true,
      nodeIntegration: false
    }
  });
  if (process.env.NODE_ENV === "development" && process.env["ELECTRON_RENDERER_URL"]) {
    win.loadURL(`${process.env["ELECTRON_RENDERER_URL"]}/live.html`);
  } else {
    win.loadFile(path.join(__dirname, "../renderer/live.html"));
  }
  return win;
}
let db;
const SCHEMA = `
CREATE TABLE IF NOT EXISTS songs (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  title       TEXT NOT NULL,
  artist      TEXT,
  sections    TEXT NOT NULL DEFAULT '[]',
  video_path  TEXT,
  text_style  TEXT NOT NULL DEFAULT '{}',
  created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at  DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS setlists (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  name         TEXT NOT NULL,
  service_date TEXT,
  notes        TEXT,
  created_at   DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS setlist_items (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  setlist_id   INTEGER NOT NULL REFERENCES setlists(id) ON DELETE CASCADE,
  song_id      INTEGER NOT NULL REFERENCES songs(id) ON DELETE RESTRICT,
  position     INTEGER NOT NULL,
  custom_video TEXT
);

CREATE TABLE IF NOT EXISTS app_settings (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_songs_title ON songs(title COLLATE NOCASE);

CREATE VIRTUAL TABLE IF NOT EXISTS songs_fts
  USING fts5(title, artist, sections, content='songs', content_rowid='id');

CREATE TRIGGER IF NOT EXISTS songs_updated_at
  AFTER UPDATE ON songs
  BEGIN
    UPDATE songs SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
  END;
`;
function getDb() {
  if (!db) {
    const userDataPath = electron.app.getPath("userData");
    const dbPath = path.join(userDataPath, "worshipflow.db");
    db = new Database(dbPath);
    db.pragma("journal_mode = WAL");
    db.pragma("foreign_keys = ON");
    db.exec(SCHEMA);
    scheduleBackup(userDataPath);
  }
  return db;
}
function scheduleBackup(userDataPath, dbPath) {
  const backupDir = path.join(userDataPath, "backups");
  fs.mkdirSync(backupDir, { recursive: true });
  const settingsRow = db.prepare("SELECT value FROM app_settings WHERE key = 'last_backup'").get();
  const lastBackup = settingsRow ? new Date(settingsRow.value) : null;
  const daysSince = lastBackup ? (Date.now() - lastBackup.getTime()) / 864e5 : 99;
  if (daysSince >= 7) {
    const date = (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
    const dest = path.join(backupDir, `worshipflow_${date}.db`);
    db.backup(dest).then(() => {
      db.prepare("INSERT OR REPLACE INTO app_settings (key, value) VALUES ('last_backup', ?)").run((/* @__PURE__ */ new Date()).toISOString());
      const backups = fs.readdirSync(backupDir).filter((f) => f.startsWith("worshipflow_") && f.endsWith(".db")).sort();
      backups.slice(0, -5).forEach((f) => fs.unlinkSync(path.join(backupDir, f)));
    }).catch(console.error);
  }
}
function registerDbHandlers() {
  electron.ipcMain.handle("db:get-songs", (_e, query) => {
    const db2 = getDb();
    if (query) {
      return db2.prepare(
        `SELECT * FROM songs WHERE title LIKE ? OR artist LIKE ? ORDER BY title COLLATE NOCASE`
      ).all(`%${query}%`, `%${query}%`).map(deserializeSong);
    }
    return db2.prepare("SELECT * FROM songs ORDER BY title COLLATE NOCASE").all().map(deserializeSong);
  });
  electron.ipcMain.handle("db:save-song", (_e, song) => {
    const db2 = getDb();
    const sections = JSON.stringify(song.sections);
    const textStyle = JSON.stringify(song.text_style);
    if (song.id) {
      db2.prepare(
        `UPDATE songs SET title=?, artist=?, sections=?, video_path=?, text_style=? WHERE id=?`
      ).run(song.title, song.artist ?? null, sections, song.video_path ?? null, textStyle, song.id);
      return song.id;
    } else {
      const result = db2.prepare(
        `INSERT INTO songs (title, artist, sections, video_path, text_style) VALUES (?,?,?,?,?)`
      ).run(song.title, song.artist ?? null, sections, song.video_path ?? null, textStyle);
      return result.lastInsertRowid;
    }
  });
  electron.ipcMain.handle("db:delete-song", (_e, id) => {
    getDb().prepare("DELETE FROM songs WHERE id = ?").run(id);
  });
  electron.ipcMain.handle("db:get-setlists", () => {
    const db2 = getDb();
    const setlists = db2.prepare("SELECT * FROM setlists ORDER BY created_at DESC").all();
    return setlists.map((sl) => ({
      ...sl,
      songs: db2.prepare(
        `SELECT si.*, s.title, s.artist, s.sections, s.video_path, s.text_style
         FROM setlist_items si JOIN songs s ON s.id = si.song_id
         WHERE si.setlist_id = ? ORDER BY si.position`
      ).all(sl.id).map((row) => ({ ...row, ...deserializeSong(row) }))
    }));
  });
  electron.ipcMain.handle("db:save-setlist", (_e, setlist) => {
    const db2 = getDb();
    let setlistId = setlist.id;
    if (setlistId) {
      db2.prepare("UPDATE setlists SET name=?, service_date=?, notes=? WHERE id=?").run(setlist.name, setlist.service_date ?? null, setlist.notes ?? null, setlistId);
    } else {
      const result = db2.prepare(
        "INSERT INTO setlists (name, service_date, notes) VALUES (?,?,?)"
      ).run(setlist.name, setlist.service_date ?? null, setlist.notes ?? null);
      setlistId = result.lastInsertRowid;
    }
    db2.prepare("DELETE FROM setlist_items WHERE setlist_id = ?").run(setlistId);
    const insertItem = db2.prepare(
      "INSERT INTO setlist_items (setlist_id, song_id, position, custom_video) VALUES (?,?,?,?)"
    );
    setlist.songs?.forEach((item, i) => {
      insertItem.run(setlistId, item.song.id, i, item.custom_video ?? null);
    });
    return setlistId;
  });
  electron.ipcMain.handle("db:delete-setlist", (_e, id) => {
    getDb().prepare("DELETE FROM setlists WHERE id = ?").run(id);
  });
}
function deserializeSong(row) {
  return {
    ...row,
    sections: JSON.parse(row.sections || "[]"),
    text_style: JSON.parse(row.text_style || "{}")
  };
}
let liveWindow$1 = null;
function setLiveWindow(win) {
  liveWindow$1 = win;
}
function registerLiveHandlers() {
  electron.ipcMain.handle("live:show-section", (_e, payload) => {
    liveWindow$1?.webContents.send("live:show-section", payload);
  });
  electron.ipcMain.handle("live:set-video", (_e, payload) => {
    liveWindow$1?.webContents.send("live:set-video", payload);
  });
  electron.ipcMain.handle("live:blackout", (_e, payload) => {
    liveWindow$1?.webContents.send("live:blackout", payload);
  });
  electron.ipcMain.handle("live:whiteout", (_e, payload) => {
    liveWindow$1?.webContents.send("live:whiteout", payload);
  });
  electron.ipcMain.handle("live:transition", (_e, payload) => {
    liveWindow$1?.webContents.send("live:transition", payload);
  });
}
function registerSystemHandlers() {
  electron.ipcMain.handle("system:get-displays", () => {
    return electron.screen.getAllDisplays().map((d) => ({
      id: d.id,
      label: d.label,
      bounds: d.bounds,
      isPrimary: d.id === electron.screen.getPrimaryDisplay().id
    }));
  });
  electron.ipcMain.handle("system:open-file-dialog", async (_e, filters) => {
    const result = await electron.dialog.showOpenDialog({ properties: ["openFile"], filters });
    return result.canceled ? null : result.filePaths[0];
  });
}
let mainWindow = null;
let liveWindow = null;
electron.app.whenReady().then(() => {
  registerDbHandlers();
  registerLiveHandlers();
  registerSystemHandlers();
  mainWindow = createMainWindow();
  electron.ipcMain.handle("live:open", () => {
    if (!liveWindow || liveWindow.isDestroyed()) {
      liveWindow = createLiveWindow();
      setLiveWindow(liveWindow);
      liveWindow.on("closed", () => {
        liveWindow = null;
        setLiveWindow(null);
        mainWindow?.webContents.send("live:closed");
      });
    }
    liveWindow.show();
  });
  electron.ipcMain.handle("live:close", () => {
    liveWindow?.close();
  });
  electron.app.on("activate", () => {
    if (electron.BrowserWindow.getAllWindows().length === 0) {
      mainWindow = createMainWindow();
    }
  });
});
electron.app.on("window-all-closed", () => {
  if (process.platform !== "darwin") electron.app.quit();
});
