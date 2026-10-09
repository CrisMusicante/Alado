"use strict";
const electron = require("electron");
const path = require("path");
const Database = require("better-sqlite3");
const fs = require("fs");
const https = require("https");
const http = require("http");
const cheerio = require("cheerio");
function createMainWindow() {
  const win = new electron.BrowserWindow({
    title: "Alado",
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    backgroundColor: "#0f172a",
    icon: path.join(__dirname, "../../assets/icons/icon.ico"),
    webPreferences: {
      preload: path.join(__dirname, "../preload/index.js"),
      contextIsolation: true,
      nodeIntegration: false
    }
  });
  if (process.env.NODE_ENV === "development") {
    const rendererUrl = process.env["ELECTRON_RENDERER_URL"] ?? "http://localhost:5173";
    win.loadURL(rendererUrl);
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
      nodeIntegration: false,
      // Required so the renderer (loaded from http:// in dev, file:// in prod)
      // can load local video files via file:/// URIs.
      webSecurity: false
    }
  });
  if (process.env.NODE_ENV === "development") {
    const rendererUrl = process.env["ELECTRON_RENDERER_URL"] ?? "http://localhost:5173";
    win.loadURL(`${rendererUrl}/src/live/live.html`);
    win.webContents.openDevTools({ mode: "detach" });
  } else {
    win.loadFile(path.join(__dirname, "../renderer/live.html"));
  }
  return win;
}
let db;
const SCHEMA = `
CREATE TABLE IF NOT EXISTS folders (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  name       TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS songs (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  title       TEXT NOT NULL,
  artist      TEXT,
  sections    TEXT NOT NULL DEFAULT '[]',
  video_path  TEXT,
  text_style  TEXT NOT NULL DEFAULT '{}',
  folder_id   INTEGER REFERENCES folders(id) ON DELETE SET NULL,
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
    runMigrations(db);
    scheduleBackup(userDataPath);
  }
  return db;
}
function runMigrations(database) {
  const version = database.pragma("user_version", { simple: true });
  if (version < 2) {
    database.transaction(() => {
      try {
        database.exec(`
          CREATE TABLE IF NOT EXISTS folders (
            id         INTEGER PRIMARY KEY AUTOINCREMENT,
            name       TEXT NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
          );
          ALTER TABLE songs ADD COLUMN folder_id INTEGER REFERENCES folders(id) ON DELETE SET NULL;
        `);
      } catch (e) {
        if (!String(e?.message).includes("duplicate column name")) throw e;
      }
      database.pragma("user_version = 2");
    })();
  }
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
  electron.ipcMain.handle("db:get-folders", () => {
    return getDb().prepare("SELECT * FROM folders ORDER BY name COLLATE NOCASE").all();
  });
  electron.ipcMain.handle("db:create-folder", (_e, name) => {
    const result = getDb().prepare("INSERT INTO folders (name) VALUES (?)").run(name);
    return result.lastInsertRowid;
  });
  electron.ipcMain.handle("db:rename-folder", (_e, { id, name }) => {
    getDb().prepare("UPDATE folders SET name = ? WHERE id = ?").run(name, id);
  });
  electron.ipcMain.handle("db:delete-folder", (_e, id) => {
    getDb().prepare("DELETE FROM folders WHERE id = ?").run(id);
  });
  electron.ipcMain.handle("db:get-songs-in-folder", (_e, folderId) => {
    const db2 = getDb();
    const rows = folderId === null ? db2.prepare("SELECT * FROM songs WHERE folder_id IS NULL ORDER BY title COLLATE NOCASE").all() : db2.prepare("SELECT * FROM songs WHERE folder_id = ? ORDER BY title COLLATE NOCASE").all(folderId);
    return rows.map(deserializeSong);
  });
  electron.ipcMain.handle("db:move-song-to-folder", (_e, { songId, folderId }) => {
    getDb().prepare("UPDATE songs SET folder_id = ? WHERE id = ?").run(folderId ?? null, songId);
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
function fetchHtml(url, redirectCount = 0) {
  if (redirectCount > 5) return Promise.reject(new Error("Demasiadas redirecciones"));
  return new Promise((resolve, reject) => {
    const client = url.startsWith("https") ? https : http;
    const req = client.get(
      url,
      {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "Accept-Language": "es-ES,es;q=0.9,en-US;q=0.8,en;q=0.7"
        }
      },
      (res) => {
        if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          const loc = res.headers.location;
          const redirectUrl = loc.startsWith("http") ? loc : new URL(loc, url).href;
          res.resume();
          fetchHtml(redirectUrl, redirectCount + 1).then(resolve).catch(reject);
          return;
        }
        if (res.statusCode && res.statusCode >= 400) {
          res.resume();
          reject(new Error(`HTTP ${res.statusCode}`));
          return;
        }
        const chunks = [];
        res.on("data", (c) => chunks.push(c));
        res.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
      }
    );
    req.on("error", reject);
    req.setTimeout(15e3, () => {
      req.destroy();
      reject(new Error("Timeout al conectar"));
    });
  });
}
function extractLetras($) {
  const container = $(".cnt-letra, .lyric-original, #letra-content").first();
  if (!container.length) return null;
  container.find("br").replaceWith("\n");
  container.find("p").each((_, el) => {
    $(el).after("\n\n");
  });
  return container.text().trim() || null;
}
function extractGenius($) {
  const containers = $('[data-lyrics-container="true"]');
  if (!containers.length) return null;
  let text = "";
  containers.each((_, el) => {
    $(el).find("br").replaceWith("\n");
    $('[class*="InlineComment"]', el).remove();
    text += $(el).text().trim() + "\n\n";
  });
  return text.trim() || null;
}
function extractMusica($) {
  const container = $("#lyrics_espace, .lyrics-body, .song-text").first();
  if (!container.length) return null;
  container.find("br").replaceWith("\n");
  return container.text().trim() || null;
}
function extractGeneric($) {
  $('script, style, nav, header, footer, aside, [class*="ad-"], [id*="ad-"], [class*="banner"]').remove();
  const selectors = [
    '[class*="lyric"]',
    '[class*="letra"]',
    '[id*="lyric"]',
    '[id*="letra"]',
    '[class*="song-text"]',
    "article",
    "main"
  ];
  for (const sel of selectors) {
    const el = $(sel).first();
    if (!el.length) continue;
    el.find("br").replaceWith("\n");
    const text = el.text().trim();
    const lines = text.split("\n").filter((l) => l.trim().length > 2);
    if (lines.length >= 4) return text;
  }
  return null;
}
function detectSite(url) {
  try {
    const h = new URL(url).hostname.toLowerCase();
    if (h.includes("letras.com")) return "letras";
    if (h.includes("genius.com")) return "genius";
    if (h.includes("musica.com")) return "musica";
    return "generic";
  } catch {
    return "generic";
  }
}
function cleanText(raw) {
  return raw.replace(/\r\n/g, "\n").replace(/\r/g, "\n").replace(/\n{3,}/g, "\n\n").split("\n").filter((line) => !line.match(/^(Composer|Lyricist|Copyright|Writer|Contributor|℗|©|Embed|[0-9]+\s*Embed)/i)).join("\n").trim();
}
function registerLyricsHandlers() {
  electron.ipcMain.handle("lyrics:fetch-url", async (_e, url) => {
    let parsedUrl;
    try {
      parsedUrl = new URL(url);
    } catch {
      return { success: false, error: "URL inválida. Asegúrate de incluir https://" };
    }
    if (!["http:", "https:"].includes(parsedUrl.protocol)) {
      return { success: false, error: "Solo se admiten URLs http:// o https://" };
    }
    try {
      const html = await fetchHtml(url);
      const $ = cheerio.load(html);
      const site = detectSite(url);
      let rawText = null;
      if (site === "letras") rawText = extractLetras($);
      else if (site === "genius") rawText = extractGenius($);
      else if (site === "musica") rawText = extractMusica($);
      if (!rawText) rawText = extractGeneric($);
      if (!rawText || rawText.length < 50) {
        return {
          success: false,
          error: 'No se encontró letra en esta página. Intenta copiar la letra manualmente usando la pestaña "Pegar letra".'
        };
      }
      return { success: true, rawText: cleanText(rawText), site };
    } catch (err) {
      const msg = err?.message ?? "Error desconocido";
      const friendly = msg.includes("Timeout") ? "La página tardó demasiado. Verifica tu conexión." : msg.includes("ENOTFOUND") || msg.includes("ECONNREFUSED") ? "No se pudo conectar. Verifica tu conexión a internet." : `Error al acceder a la página: ${msg}`;
      return { success: false, error: friendly };
    }
  });
  electron.ipcMain.handle("lyrics:fetch-ai", async (_e, _payload) => {
    return { success: false, error: "AI_NOT_CONFIGURED" };
  });
}
if (process.env.NODE_ENV === "development") {
  process.env["ELECTRON_DISABLE_SECURITY_WARNINGS"] = "true";
}
let mainWindow = null;
let liveWindow = null;
electron.app.whenReady().then(() => {
  registerDbHandlers();
  registerLiveHandlers();
  registerSystemHandlers();
  registerLyricsHandlers();
  mainWindow = createMainWindow();
  electron.ipcMain.handle("live:open", async () => {
    if (!liveWindow || liveWindow.isDestroyed()) {
      liveWindow = createLiveWindow();
      setLiveWindow(liveWindow);
      liveWindow.on("closed", () => {
        liveWindow = null;
        setLiveWindow(null);
        mainWindow?.webContents.send("live:closed");
      });
      await new Promise((resolve) => {
        const timeout = setTimeout(resolve, 5e3);
        liveWindow.webContents.ipc.once("live:renderer-ready", () => {
          clearTimeout(timeout);
          resolve();
        });
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
