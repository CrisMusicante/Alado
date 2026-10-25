"use strict";
const electron = require("electron");
const path = require("path");
const Database = require("better-sqlite3");
const fs = require("fs");
const child_process = require("child_process");
const fs$1 = require("fs/promises");
const tar = require("tar");
const crypto = require("crypto");
const stream = require("stream");
const promises = require("stream/promises");
const https = require("https");
const http = require("http");
const cheerio = require("cheerio");
const os = require("os");
const fflate = require("fflate");
const url = require("url");
function _interopNamespaceDefault(e) {
  const n = Object.create(null, { [Symbol.toStringTag]: { value: "Module" } });
  if (e) {
    for (const k in e) {
      if (k !== "default") {
        const d = Object.getOwnPropertyDescriptor(e, k);
        Object.defineProperty(n, k, d.get ? d : {
          enumerable: true,
          get: () => e[k]
        });
      }
    }
  }
  n.default = e;
  return Object.freeze(n);
}
const tar__namespace = /* @__PURE__ */ _interopNamespaceDefault(tar);
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
      nodeIntegration: false,
      // The cue clock lives in this window; throttled timers would freeze the live lyrics when minimized.
      backgroundThrottling: false
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
    win.loadFile(path.join(__dirname, "../renderer/src/live/live.html"));
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
    const isFirstRun = !fs.existsSync(dbPath);
    if (isFirstRun) installSeed(userDataPath, dbPath);
    db = new Database(dbPath);
    db.pragma("journal_mode = WAL");
    db.pragma("foreign_keys = ON");
    db.exec(SCHEMA);
    runMigrations(db);
    scheduleBackup(userDataPath);
  }
  return db;
}
function installSeed(userDataPath, dbPath) {
  const seedDir = path.join(process.resourcesPath, "seed");
  const seedDb = path.join(seedDir, "worshipflow.seed.db");
  if (!fs.existsSync(seedDb)) return;
  const videosDest = path.join(userDataPath, "videos");
  const videosSrc = path.join(seedDir, "videos");
  if (fs.existsSync(videosSrc)) fs.cpSync(videosSrc, videosDest, { recursive: true });
  const tmp = dbPath + ".seeding";
  fs.copyFileSync(seedDb, tmp);
  const seeded = new Database(tmp);
  try {
    const rows = seeded.prepare("SELECT id, video_path FROM songs WHERE video_path IS NOT NULL AND video_path != ''").all();
    const update = seeded.prepare("UPDATE songs SET video_path = ? WHERE id = ?");
    seeded.transaction(() => {
      for (const r of rows) {
        const name = r.video_path.split(/[\\/]/).pop();
        update.run(path.join(videosDest, name), r.id);
      }
    })();
    seeded.pragma("journal_mode = DELETE");
  } finally {
    seeded.close();
  }
  fs.renameSync(tmp, dbPath);
}
function runMigrations(database) {
  const version2 = database.pragma("user_version", { simple: true });
  if (version2 < 2) {
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
  if (version2 < 3) {
    database.transaction(() => {
      database.exec(`
        CREATE TABLE IF NOT EXISTS song_audio (
          song_id           INTEGER PRIMARY KEY REFERENCES songs(id) ON DELETE CASCADE,
          status            TEXT NOT NULL DEFAULT 'pending',
          error             TEXT,
          original_hash     TEXT,
          duration_sec      REAL,
          vol_instrumental  REAL NOT NULL DEFAULT 1,
          vol_vocals        REAL NOT NULL DEFAULT 0,
          cues              TEXT NOT NULL DEFAULT '[]',
          cues_sections_sig TEXT,
          created_at        DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at        DATETIME DEFAULT CURRENT_TIMESTAMP
        );
      `);
      database.pragma("user_version = 3");
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
class SeparationQueue {
  constructor(run2, events) {
    this.run = run2;
    this.events = events;
  }
  entries = [];
  current = null;
  running = false;
  enqueue(job) {
    const active = this.entries.some((e) => e.job.songId === job.songId && (e.status === "pending" || e.status === "processing"));
    if (active) return;
    this.entries = this.entries.filter((e) => e.job.songId !== job.songId);
    this.entries.push({ job, status: "pending", progress: 0 });
    this.events.onStatus(job.songId, "pending");
    void this.drain();
  }
  /** Resolves once the job no longer runs, so callers can safely delete its files afterwards. */
  async cancel(songId) {
    const entry = this.entries.find((e) => e.job.songId === songId);
    if (!entry) return;
    if (entry.status === "pending") {
      entry.status = "cancelled";
      this.events.onStatus(songId, "cancelled");
    } else if (entry.status === "processing" && this.current?.songId === songId) {
      const { abort, settled } = this.current;
      abort.abort();
      await settled;
    }
  }
  snapshot() {
    return this.entries.map((e) => ({ songId: e.job.songId, status: e.status, progress: e.progress }));
  }
  async drain() {
    if (this.running) return;
    this.running = true;
    try {
      for (; ; ) {
        const entry = this.entries.find((e) => e.status === "pending");
        if (!entry) break;
        const { songId } = entry.job;
        const abort = new AbortController();
        let markSettled;
        const settled = new Promise((r) => {
          markSettled = r;
        });
        this.current = { songId, abort, settled };
        entry.status = "processing";
        this.events.onStatus(songId, "processing");
        try {
          await this.run(entry.job, (pct) => {
            entry.progress = pct;
            this.events.onProgress(songId, pct);
          }, abort.signal);
          entry.status = "ready";
          entry.progress = 100;
          this.events.onStatus(songId, "ready");
        } catch (e) {
          if (abort.signal.aborted) {
            entry.status = "cancelled";
            this.events.onStatus(songId, "cancelled");
          } else {
            entry.status = "failed";
            this.events.onStatus(songId, "failed", e instanceof Error ? e.message : String(e));
          }
        } finally {
          this.current = null;
          markSettled();
        }
      }
    } finally {
      this.running = false;
    }
  }
}
function parseDemucsProgress(chunk) {
  const matches = [...chunk.matchAll(/(\d{1,3})%\|/g)];
  if (matches.length === 0) return null;
  return Math.min(100, Number(matches[matches.length - 1][1]));
}
function buildDemucsArgs(input, outRoot) {
  return ["--two-stems=vocals", "-n", "htdemucs", "-o", outRoot, input];
}
const cancelled = () => new Error("Trabajo cancelado");
function run(cmd, args, signal, onStderr, describeFailure) {
  if (signal.aborted) return Promise.reject(cancelled());
  return new Promise((resolve, reject) => {
    const child = child_process.spawn(cmd.file, [...cmd.baseArgs, ...args], { env: { ...process.env, ...cmd.env }, windowsHide: true });
    let tail = "";
    child.stderr.on("data", (d) => {
      const s = d.toString();
      tail = (tail + s).slice(-4e3);
      onStderr(s);
    });
    const onAbort = () => child.kill();
    signal.addEventListener("abort", onAbort, { once: true });
    child.on("error", reject);
    child.on("close", (code) => {
      signal.removeEventListener("abort", onAbort);
      if (code === 0) return resolve();
      if (signal.aborted) return reject(cancelled());
      const lastLines = tail.split(/[\r\n]+/).map((l) => l.trim()).filter(Boolean).slice(-3).join(" | ");
      reject(new Error(describeFailure(code, lastLines)));
    });
  });
}
async function runDemucs(cmd, job, onProgress, signal) {
  if (signal.aborted) throw cancelled();
  const outRoot = path.join(job.outDir, ".tmp-demucs");
  try {
    await fs$1.rm(outRoot, { recursive: true, force: true });
    await fs$1.mkdir(outRoot, { recursive: true });
    let input = job.inputPath;
    if (cmd.ffmpeg && path.extname(input).toLowerCase() !== ".wav") {
      const wav = path.join(outRoot, "input.wav");
      await run(
        cmd.ffmpeg,
        ["-y", "-loglevel", "error", "-i", input, "-vn", "-ac", "2", "-ar", "44100", wav],
        signal,
        () => {
        },
        (_code, lastLines) => `No se pudo leer el audio (¿archivo dañado o formato no soportado?): ${lastLines}`
      );
      input = wav;
    }
    await run(cmd, buildDemucsArgs(input, outRoot), signal, (s) => {
      const pct = parseDemucsProgress(s);
      if (pct !== null) onProgress(pct);
    }, (code, lastLines) => `Demucs terminó con código ${code}: ${lastLines}`);
    const produced = path.join(outRoot, "htdemucs", path.parse(input).name);
    await fs$1.rename(path.join(produced, "no_vocals.wav"), path.join(job.outDir, "instrumental.wav"));
    await fs$1.rename(path.join(produced, "vocals.wav"), path.join(job.outDir, "vocals.wav"));
  } finally {
    await fs$1.rm(outRoot, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
  }
}
const version = "1";
const python = { "win32-x64": { "url": "https://github.com/astral-sh/python-build-standalone/releases/download/20261009/cpython-3.11.17%2B20261009-x86_64-pc-windows-msvc-install_only.tar.gz", "sha256": "4d307648d2fe5f8d927e10380cc33eb7afd8a34a7efe0ed786b5860b5f2d3408", "sizeBytes": 48233938 }, "darwin-arm64": { "url": "https://github.com/astral-sh/python-build-standalone/releases/download/20261009/cpython-3.11.17%2B20261009-aarch64-apple-darwin-install_only.tar.gz", "sha256": "7b6068989d9b6a0e2a883352b7d0d141ce8670a61360bf4ddabac0e046a08e10", "sizeBytes": 27105320 } };
const torchIndexUrl = "https://download.pytorch.org/whl/cpu";
const pipRequirements = ["torch==2.5.1", "torchaudio==2.5.1", "demucs==4.1.0", "numpy==2.4.6", "imageio-ffmpeg==0.6.0", "soundfile==0.14.0"];
const estimatedInstallBytes = 2684354560;
const manifest = {
  version,
  python,
  torchIndexUrl,
  pipRequirements,
  estimatedInstallBytes
};
function sha256File(file) {
  return new Promise((resolve, reject) => {
    const h = crypto.createHash("sha256");
    fs.createReadStream(file).on("data", (d) => h.update(d)).on("error", reject).on("end", () => resolve(h.digest("hex")));
  });
}
async function downloadWithResume(url2, dest, expectedSha256, onProgress, signal) {
  const part = dest + ".part";
  const already = fs.existsSync(part) ? fs.statSync(part).size : 0;
  const res = await fetch(url2, { headers: already ? { Range: `bytes=${already}-` } : {}, signal });
  if (!res.ok || !res.body) throw new Error(`Descarga falló: HTTP ${res.status}`);
  const resumed = res.status === 206;
  const start = resumed ? already : 0;
  const total = start + Number(res.headers.get("content-length") ?? 0);
  let received = start;
  const body = stream.Readable.fromWeb(res.body);
  body.on("data", (chunk) => {
    received += chunk.length;
    if (total > 0) onProgress(Math.round(received / total * 100));
  });
  await promises.pipeline(body, fs.createWriteStream(part, { flags: resumed ? "a" : "w" }));
  const actual = await sha256File(part);
  if (actual !== expectedSha256) {
    fs.rmSync(part, { force: true });
    throw new Error(`Checksum inválido: se esperaba ${expectedSha256} y se obtuvo ${actual}`);
  }
  fs.renameSync(part, dest);
}
const platformKey = () => {
  const key = `${process.platform}-${process.arch}`;
  return key in manifest.python ? key : null;
};
const engineDir = () => path.join(electron.app.getPath("userData"), "audio-engine");
const markerFile = () => path.join(engineDir(), "engine.json");
const pythonPath = () => process.platform === "win32" ? path.join(engineDir(), "python", "python.exe") : path.join(engineDir(), "python", "bin", "python3");
const binDir = () => path.join(engineDir(), "bin");
const ffmpegBin = () => path.join(binDir(), process.platform === "win32" ? "ffmpeg.exe" : "ffmpeg");
async function getEngineStatus() {
  const base = { platformSupported: platformKey() !== null, estimatedInstallBytes: manifest.estimatedInstallBytes };
  try {
    const marker = JSON.parse(fs.readFileSync(markerFile(), "utf8"));
    return { ...base, installed: marker.version === manifest.version, version: marker.version };
  } catch {
    return { ...base, installed: false };
  }
}
function getFfmpegPath() {
  return fs.existsSync(ffmpegBin()) ? ffmpegBin() : null;
}
function getDemucsCommand() {
  return {
    file: pythonPath(),
    baseArgs: ["-m", "demucs"],
    ffmpeg: { file: ffmpegBin(), baseArgs: [] },
    env: {
      // Without this, Python on Windows writes stdout/paths in the ANSI code page and breaks on users like "José".
      PYTHONUTF8: "1",
      // demucs 4.1 fetches weights through huggingface_hub; keep them inside the engine folder.
      HF_HOME: path.join(engineDir(), "models", "hf"),
      TORCH_HOME: path.join(engineDir(), "models"),
      PIP_NO_CACHE_DIR: "1",
      PATH: `${binDir()}${path.delimiter}${process.env.PATH ?? ""}`
    }
  };
}
function runPython(args, onLine, signal) {
  return new Promise((resolve, reject) => {
    const child = child_process.spawn(pythonPath(), args, { windowsHide: true, env: { ...process.env, ...getDemucsCommand().env } });
    let tail = "";
    const feed = (d) => {
      const s = d.toString();
      tail = (tail + s).slice(-4e3);
      s.split(/[\r\n]+/).filter(Boolean).forEach(onLine);
    };
    child.stdout.on("data", feed);
    child.stderr.on("data", feed);
    signal.addEventListener("abort", () => child.kill(), { once: true });
    child.on("error", reject);
    child.on("close", (code) => code === 0 ? resolve() : reject(new Error(`python ${args.join(" ")} → código ${code}: ${tail.slice(-500)}`)));
  });
}
async function installEngine(onProgress, signal) {
  const key = platformKey();
  if (!key) throw new Error(`Plataforma no soportada: ${process.platform}-${process.arch}`);
  const dir = engineDir();
  fs.mkdirSync(dir, { recursive: true });
  const { bavail, bsize } = fs.statfsSync(dir);
  if (bavail * bsize < manifest.estimatedInstallBytes) {
    const gb = (n) => (n / 1024 ** 3).toFixed(1);
    throw new Error(`Espacio insuficiente: se necesitan ~${gb(manifest.estimatedInstallBytes)} GB y hay ${gb(bavail * bsize)} GB libres`);
  }
  fs.rmSync(markerFile(), { force: true });
  const archive = path.join(dir, "python.tar.gz");
  const py = manifest.python[key];
  if (!fs.existsSync(pythonPath())) {
    await downloadWithResume(py.url, archive, py.sha256, (pct) => onProgress({ step: "download", pct }), signal);
    onProgress({ step: "extract", pct: 0 });
    fs.rmSync(path.join(dir, "python"), { recursive: true, force: true });
    await tar__namespace.x({ file: archive, cwd: dir });
    fs.rmSync(archive, { force: true });
    onProgress({ step: "extract", pct: 100 });
  }
  let pipLines = 0;
  await runPython(
    ["-m", "pip", "install", "--disable-pip-version-check", "--extra-index-url", manifest.torchIndexUrl, ...manifest.pipRequirements],
    (line) => onProgress({ step: "pip", pct: Math.min(95, ++pipLines), message: line.slice(0, 120) }),
    signal
  );
  onProgress({ step: "ffmpeg", pct: 0 });
  fs.mkdirSync(binDir(), { recursive: true });
  await runPython(
    ["-c", "import imageio_ffmpeg, shutil, sys; shutil.copyfile(imageio_ffmpeg.get_ffmpeg_exe(), sys.argv[1])", ffmpegBin()],
    () => {
    },
    signal
  );
  if (process.platform !== "win32") fs.chmodSync(ffmpegBin(), 493);
  onProgress({ step: "ffmpeg", pct: 100 });
  onProgress({ step: "selftest", pct: 0 });
  const testDir = path.join(dir, "selftest");
  fs.rmSync(testDir, { recursive: true, force: true });
  fs.mkdirSync(testDir, { recursive: true });
  const silence = path.join(testDir, "silence.wav");
  await runPython([
    "-c",
    'import sys, numpy as np, soundfile as sf; sf.write(sys.argv[1], np.zeros((44100, 2), dtype="float32"), 44100)',
    silence
  ], () => {
  }, signal);
  await runPython(["-m", "demucs", "--two-stems=vocals", "-n", "htdemucs", "-o", testDir, silence], () => {
  }, signal);
  if (!fs.existsSync(path.join(testDir, "htdemucs", "silence", "vocals.wav"))) {
    throw new Error("La prueba del motor no produjo archivos de salida");
  }
  fs.rmSync(testDir, { recursive: true, force: true });
  fs.writeFileSync(markerFile(), JSON.stringify({ version: manifest.version, installedAt: (/* @__PURE__ */ new Date()).toISOString() }));
  onProgress({ step: "selftest", pct: 100 });
}
function deserialize(row) {
  return { ...row, cues: JSON.parse(row.cues || "[]") };
}
function getSongAudio(songId) {
  const row = getDb().prepare("SELECT * FROM song_audio WHERE song_id = ?").get(songId);
  return row ? deserialize(row) : null;
}
const COLUMNS = ["status", "error", "original_hash", "duration_sec", "vol_instrumental", "vol_vocals", "cues", "cues_sections_sig"];
function upsertSongAudio(songId, patch) {
  const db2 = getDb();
  db2.prepare("INSERT OR IGNORE INTO song_audio (song_id) VALUES (?)").run(songId);
  const keys = COLUMNS.filter((k) => k in patch);
  if (keys.length > 0) {
    const values = keys.map((k) => k === "cues" ? JSON.stringify(patch.cues) : patch[k]);
    db2.prepare(`UPDATE song_audio SET ${keys.map((k) => `${k} = ?`).join(", ")}, updated_at = CURRENT_TIMESTAMP WHERE song_id = ?`).run(...values, songId);
  }
  return getSongAudio(songId);
}
function markInterruptedJobs() {
  getDb().prepare(
    `UPDATE song_audio SET status = 'failed', error = 'Interrumpida al cerrar la app' WHERE status IN ('pending', 'processing')`
  ).run();
}
function assertSongId(value) {
  if (typeof value !== "number" || !Number.isInteger(value) || value <= 0) {
    throw new Error(`Id de canción inválido: ${String(value)}`);
  }
  return value;
}
function assertStem(value) {
  if (value !== "instrumental" && value !== "vocals") {
    throw new Error(`Nombre de pista inválida: ${String(value)}`);
  }
  return value;
}
const stemsRoot = () => path.join(electron.app.getPath("userData"), "stems");
const stemsDir = (songId) => path.join(stemsRoot(), String(assertSongId(songId)));
function findStem(songId, stem) {
  for (const ext of ["wav", "flac"]) {
    const p = path.join(stemsDir(songId), `${assertStem(stem)}.${ext}`);
    if (fs.existsSync(p)) return p;
  }
  return null;
}
function findOriginal(songId) {
  const dir = stemsDir(songId);
  if (!fs.existsSync(dir)) return null;
  const f = fs.readdirSync(dir).find((n) => n.startsWith("original."));
  return f ? path.join(dir, f) : null;
}
const SUPPORTED = [".mp3", ".wav", ".flac", ".m4a"];
let queue;
let installAbort = null;
function registerAudioHandlers(getWindow) {
  const send = (channel, payload) => getWindow()?.webContents.send(channel, payload);
  markInterruptedJobs();
  queue = new SeparationQueue(
    (job, onProgress, signal) => runDemucs(getDemucsCommand(), job, onProgress, signal),
    {
      onStatus: (songId, status, error) => {
        if (!getSongAudio(songId)) return;
        upsertSongAudio(songId, { status, error: error ?? null });
        send("audio:status-changed", { songId, status, error });
      },
      onProgress: (songId, pct) => send("audio:progress", { songId, pct })
    }
  );
  electron.ipcMain.handle("audio:engine-status", () => getEngineStatus());
  electron.ipcMain.handle("audio:install-engine", async () => {
    installAbort = new AbortController();
    try {
      await installEngine((p) => send("audio:engine-progress", p), installAbort.signal);
      return { ok: true };
    } catch (e) {
      return { ok: false, error: installAbort.signal.aborted ? "Instalación cancelada" : e.message };
    } finally {
      installAbort = null;
    }
  });
  electron.ipcMain.handle("audio:cancel-install", () => installAbort?.abort());
  electron.ipcMain.handle("audio:import-track", async (_e, { songId: rawId, filePath }) => {
    const songId = assertSongId(rawId);
    const ext = path.extname(filePath).toLowerCase();
    if (!SUPPORTED.includes(ext)) throw new Error(`Formato no soportado: ${ext}. Usa mp3, wav, flac o m4a.`);
    const { bavail, bsize } = fs.statfsSync(path.dirname(stemsRoot()));
    if (bavail * bsize < 300 * 1024 ** 2) throw new Error("Espacio insuficiente en disco: libera al menos 300 MB e inténtalo de nuevo.");
    const hash = await sha256File(filePath);
    const existing = getSongAudio(songId);
    if (existing?.original_hash === hash && existing.status === "ready") return existing;
    const dir = stemsDir(songId);
    fs.rmSync(dir, { recursive: true, force: true });
    fs.mkdirSync(dir, { recursive: true });
    const original = path.join(dir, `original${ext}`);
    fs.copyFileSync(filePath, original);
    const row = upsertSongAudio(songId, { status: "pending", error: null, original_hash: hash, cues: [], cues_sections_sig: null });
    queue.enqueue({ songId, inputPath: original, outDir: dir });
    return row;
  });
  electron.ipcMain.handle("audio:reprocess", (_e, rawId) => {
    const songId = assertSongId(rawId);
    const original = findOriginal(songId);
    if (!original) throw new Error("No se encontró el audio original; vuelve a importarlo.");
    const row = upsertSongAudio(songId, { status: "pending", error: null });
    queue.enqueue({ songId, inputPath: original, outDir: stemsDir(songId) });
    return row;
  });
  electron.ipcMain.handle("audio:cancel", (_e, songId) => queue.cancel(assertSongId(songId)));
  electron.ipcMain.handle("audio:get-queue", () => queue.snapshot());
  electron.ipcMain.handle("audio:get-song-audio", (_e, songId) => getSongAudio(assertSongId(songId)));
  electron.ipcMain.handle("audio:read-stem", (_e, { songId, stem }) => {
    const p = findStem(assertSongId(songId), assertStem(stem));
    if (!p) throw new Error(`No existe la pista ${stem} de la canción ${songId}`);
    return new Uint8Array(fs.readFileSync(p));
  });
  electron.ipcMain.handle("audio:update", (_e, { songId, patch }) => upsertSongAudio(assertSongId(songId), patch));
}
async function purgeSongAudio(songId) {
  await queue?.cancel(songId);
  fs.rmSync(stemsDir(songId), { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
}
function toSetlistItem(row) {
  return {
    position: row.position,
    custom_video: row.custom_video ?? null,
    song: {
      id: row.song_id,
      title: row.title,
      artist: row.artist,
      video_path: row.video_path,
      sections: JSON.parse(row.sections || "[]"),
      text_style: JSON.parse(row.text_style || "{}")
    }
  };
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
  electron.ipcMain.handle("db:delete-song", async (_e, id) => {
    getDb().prepare("DELETE FROM songs WHERE id = ?").run(id);
    await purgeSongAudio(id).catch((e) => console.error("No se pudieron borrar los stems de la canción", id, e));
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
      ).all(sl.id).map(toSetlistItem)
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
function fetchHtml(url2, redirectCount = 0) {
  if (redirectCount > 5) return Promise.reject(new Error("Demasiadas redirecciones"));
  return new Promise((resolve, reject) => {
    const client = url2.startsWith("https") ? https : http;
    const req = client.get(
      url2,
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
          const redirectUrl = loc.startsWith("http") ? loc : new URL(loc, url2).href;
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
function detectSite(url2) {
  try {
    const h = new URL(url2).hostname.toLowerCase();
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
  electron.ipcMain.handle("lyrics:fetch-url", async (_e, url2) => {
    let parsedUrl;
    try {
      parsedUrl = new URL(url2);
    } catch {
      return { success: false, error: "URL inválida. Asegúrate de incluir https://" };
    }
    if (!["http:", "https:"].includes(parsedUrl.protocol)) {
      return { success: false, error: "Solo se admiten URLs http:// o https://" };
    }
    try {
      const html = await fetchHtml(url2);
      const $ = cheerio.load(html);
      const site = detectSite(url2);
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
const PACK_VERSION = 1;
const AUDIO_ENTRY = /^audio\/(instrumental|vocals)\.(flac|wav)$/;
const VIDEO_ENTRY = /^video\/[^/\\]+\.(mp4|webm|mov)$/i;
function isAllowedEntry(name) {
  if (name.includes("\\") || name.includes("..") || name.startsWith("/") || /^[a-zA-Z]:/.test(name)) return false;
  return name === "manifest.json" || name === "song.json" || AUDIO_ENTRY.test(name) || VIDEO_ENTRY.test(name);
}
function buildPack(contents) {
  const entries = {
    "manifest.json": fflate.strToU8(JSON.stringify(contents.manifest, null, 2)),
    "song.json": fflate.strToU8(JSON.stringify(contents.song, null, 2))
  };
  for (const [name, data] of Object.entries(contents.files)) {
    if (!isAllowedEntry(name)) throw new Error(`Archivo no permitido en el paquete: ${name}`);
    entries[name] = [data, { level: 0 }];
  }
  return fflate.zipSync(entries);
}
function parsePack(data) {
  let raw;
  try {
    raw = fflate.unzipSync(data);
  } catch {
    throw new Error("El archivo no es un paquete .wfpack válido");
  }
  for (const name of Object.keys(raw)) {
    if (name.endsWith("/")) continue;
    if (!isAllowedEntry(name)) throw new Error(`Archivo no permitido en el paquete: ${name}`);
  }
  const manifest2 = readJson(raw, "manifest.json");
  if (manifest2.packVersion !== PACK_VERSION) {
    throw new Error(`Este paquete usa la versión ${manifest2.packVersion} del formato; esta app solo entiende la versión ${PACK_VERSION}. Actualiza WorshipFlow.`);
  }
  if (manifest2.kind !== "song") throw new Error(`Tipo de paquete no soportado: ${manifest2.kind}`);
  const song = readJson(raw, "song.json");
  if (typeof song.title !== "string" || !song.title.trim()) throw new Error("El paquete no tiene título de canción");
  if (!Array.isArray(song.sections)) throw new Error("El paquete no tiene secciones válidas");
  const files = {};
  for (const [name, bytes] of Object.entries(raw)) {
    if (name.startsWith("audio/") || name.startsWith("video/")) files[name] = bytes;
  }
  for (const stem of ["instrumental", "vocals"]) {
    if (!Object.keys(files).some((n) => n.startsWith(`audio/${stem}.`))) throw new Error(`Al paquete le falta la pista ${stem}`);
  }
  return { manifest: manifest2, song: { ...song, cues: Array.isArray(song.cues) ? song.cues : [] }, files };
}
function readJson(raw, name) {
  if (!raw[name]) throw new Error(`Al paquete le falta ${name}`);
  try {
    return JSON.parse(fflate.strFromU8(raw[name]));
  } catch {
    throw new Error(`${name} está dañado`);
  }
}
function toFlac(wav) {
  const ffmpeg = getFfmpegPath();
  if (!ffmpeg) return Promise.resolve(new Uint8Array(fs.readFileSync(wav)));
  const out = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "wfpack-")), "out.flac");
  return new Promise((resolve, reject) => {
    const child = child_process.spawn(ffmpeg, ["-y", "-loglevel", "error", "-i", wav, "-c:a", "flac", out], { windowsHide: true });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code !== 0) return reject(new Error(`ffmpeg falló al comprimir (${code})`));
      const data = new Uint8Array(fs.readFileSync(out));
      fs.rmSync(path.dirname(out), { recursive: true, force: true });
      resolve(data);
    });
  });
}
async function stemEntry(songId, stem) {
  const p = findStem(songId, stem);
  if (!p) throw new Error(`Falta la pista ${stem}`);
  if (p.endsWith(".flac")) return [`audio/${stem}.flac`, new Uint8Array(fs.readFileSync(p))];
  const data = await toFlac(p);
  const isFlac = getFfmpegPath() !== null;
  return [`audio/${stem}.${isFlac ? "flac" : "wav"}`, data];
}
const findDuplicate = (title, artist) => getDb().prepare(
  `SELECT id FROM songs WHERE title = ? COLLATE NOCASE AND IFNULL(artist, '') = IFNULL(?, '') COLLATE NOCASE LIMIT 1`
).get(title, artist ?? null);
function registerPackHandlers() {
  electron.ipcMain.handle("pack:export", async (_e, rawId) => {
    const songId = assertSongId(rawId);
    const song = getDb().prepare("SELECT * FROM songs WHERE id = ?").get(songId);
    const audio = getSongAudio(songId);
    if (!song || audio?.status !== "ready") throw new Error("La canción no tiene audio listo para exportar");
    const safeName = song.title.replace(/[<>:"/\\|?*]/g, "").trim() || "cancion";
    const { canceled, filePath } = await electron.dialog.showSaveDialog({
      defaultPath: `${safeName}.wfpack`,
      filters: [{ name: "Paquete WorshipFlow", extensions: ["wfpack"] }]
    });
    if (canceled || !filePath) return null;
    const files = Object.fromEntries(
      await Promise.all([stemEntry(songId, "instrumental"), stemEntry(songId, "vocals")])
    );
    let video;
    if (song.video_path && fs.existsSync(song.video_path)) {
      video = path.basename(song.video_path);
      files[`video/${video}`] = new Uint8Array(fs.readFileSync(song.video_path));
    }
    const packSong = {
      title: song.title,
      artist: song.artist ?? void 0,
      sections: JSON.parse(song.sections),
      text_style: JSON.parse(song.text_style),
      cues: audio.cues,
      cues_sections_sig: audio.cues_sections_sig,
      vol_instrumental: audio.vol_instrumental,
      vol_vocals: audio.vol_vocals,
      video
    };
    const data = buildPack({
      manifest: { packVersion: PACK_VERSION, kind: "song", appVersion: electron.app.getVersion(), id: crypto.randomUUID() },
      song: packSong,
      files
    });
    fs.writeFileSync(filePath, data);
    return { path: filePath };
  });
  electron.ipcMain.handle("pack:inspect", async () => {
    const { canceled, filePaths } = await electron.dialog.showOpenDialog({
      properties: ["openFile"],
      filters: [{ name: "Paquete WorshipFlow", extensions: ["wfpack"] }]
    });
    if (canceled || !filePaths[0]) return null;
    const { song } = parsePack(new Uint8Array(fs.readFileSync(filePaths[0])));
    const dup = findDuplicate(song.title, song.artist);
    return { path: filePaths[0], title: song.title, artist: song.artist, duplicateOf: dup?.id ?? null };
  });
  electron.ipcMain.handle("pack:import", async (_e, { path: packPath, mode }) => {
    if (mode !== "copy" && mode !== "replace") throw new Error(`Modo de importación inválido: ${String(mode)}`);
    if (typeof packPath !== "string" || !packPath.toLowerCase().endsWith(".wfpack")) throw new Error("Solo se pueden importar archivos .wfpack");
    const { song, files } = parsePack(new Uint8Array(fs.readFileSync(packPath)));
    const db2 = getDb();
    let songId;
    const dup = findDuplicate(song.title, song.artist);
    if (mode === "replace" && dup) {
      songId = dup.id;
      await purgeSongAudio(songId);
      db2.prepare("UPDATE songs SET sections = ?, text_style = ? WHERE id = ?").run(JSON.stringify(song.sections), JSON.stringify(song.text_style), songId);
    } else {
      const title = dup ? `${song.title} (importada)` : song.title;
      songId = Number(db2.prepare("INSERT INTO songs (title, artist, sections, text_style) VALUES (?,?,?,?)").run(title, song.artist ?? null, JSON.stringify(song.sections), JSON.stringify(song.text_style)).lastInsertRowid);
    }
    const dir = stemsDir(songId);
    fs.mkdirSync(dir, { recursive: true });
    for (const [name, bytes] of Object.entries(files)) {
      if (name.startsWith("audio/")) fs.writeFileSync(path.join(dir, path.basename(name)), bytes);
    }
    if (song.video && files[`video/${song.video}`]) {
      const mediaDir = path.join(electron.app.getPath("userData"), "media", String(songId));
      fs.mkdirSync(mediaDir, { recursive: true });
      const videoPath = path.join(mediaDir, path.basename(song.video));
      fs.writeFileSync(videoPath, files[`video/${song.video}`]);
      db2.prepare("UPDATE songs SET video_path = ? WHERE id = ?").run(videoPath, songId);
    }
    upsertSongAudio(songId, {
      status: "ready",
      error: null,
      original_hash: null,
      cues: song.cues,
      cues_sections_sig: song.cues_sections_sig,
      vol_instrumental: song.vol_instrumental,
      vol_vocals: song.vol_vocals
    });
    return songId;
  });
}
const ALADO_FORMAT = "alado-setlist";
const ALADO_VERSION = 1;
const fileName = (p) => p ? p.split(/[\\/]/).pop() || null : null;
function buildAladoFile(setlist, songs, now) {
  return {
    format: ALADO_FORMAT,
    version: ALADO_VERSION,
    exported_at: now.toISOString(),
    setlist,
    items: songs.map((s, position) => ({
      position,
      song: {
        title: s.title,
        artist: s.artist ?? null,
        sections: s.sections,
        text_style: s.text_style,
        video_file: fileName(s.video_path)
      },
      custom_video_file: fileName(s.custom_video)
    }))
  };
}
const NOT_ALADO = "El archivo no es un servicio de ALADO.";
const isObj = (v) => typeof v === "object" && v !== null && !Array.isArray(v);
function assertSections(v, title) {
  const ok = Array.isArray(v) && v.every((s) => isObj(s) && typeof s.label === "string" && Array.isArray(s.lines) && s.lines.every((l) => typeof l === "string"));
  if (!ok) throw new Error(`El archivo está dañado: la letra de "${title}" no es válida.`);
}
function parseAladoFile(text) {
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error(NOT_ALADO);
  }
  if (!isObj(data) || data.format !== ALADO_FORMAT || typeof data.version !== "number") throw new Error(NOT_ALADO);
  if (data.version > ALADO_VERSION) {
    throw new Error("El servicio se exportó con una versión más nueva de ALADO. Actualiza la app para importarlo.");
  }
  if (!isObj(data.setlist) || typeof data.setlist.name !== "string" || !Array.isArray(data.items)) {
    throw new Error("El archivo está dañado: faltan los datos del servicio.");
  }
  data.items.forEach((item, i) => {
    if (!isObj(item) || !isObj(item.song) || typeof item.song.title !== "string" || !item.song.title.trim()) {
      throw new Error(`El archivo está dañado: la canción ${i + 1} no tiene título.`);
    }
    assertSections(item.song.sections, item.song.title);
  });
  return data;
}
function normalizeTitle(t) {
  return t.normalize("NFD").replace(new RegExp("\\p{Diacritic}", "gu"), "").toLowerCase().replace(/\s+/g, " ").trim();
}
function pickMatch(song, local) {
  const key = normalizeTitle(song.title);
  const same = local.filter((l) => normalizeTitle(l.title) === key);
  if (same.length === 0) return null;
  const artist = song.artist ? normalizeTitle(song.artist) : "";
  const byArtist = artist ? same.filter((l) => l.artist && normalizeTitle(l.artist) === artist) : [];
  const pool = byArtist.length > 0 ? byArtist : same;
  return pool.reduce((best, l) => (l.updated_at ?? "") > (best.updated_at ?? "") ? l : best);
}
function sectionsDiffer(a, b) {
  if (a.length !== b.length) return true;
  return a.some((s, i) => {
    const o = b[i];
    return s.label !== o.label || s.type !== o.type || (s.repeat ?? 1) !== (o.repeat ?? 1) || s.lines.length !== o.lines.length || s.lines.some((l, j) => l !== o.lines[j]);
  });
}
function planImport(file, local, videosDir2, videoNames2) {
  return file.items.map(({ song }) => {
    const match = pickMatch(song, local);
    if (match) return { kind: "existing", songId: match.id, title: match.title, differs: sectionsDiffer(match.sections, song.sections) };
    const videoPath = song.video_file && videoNames2.has(song.video_file) ? path.join(videosDir2, song.video_file) : null;
    return { kind: "create", song, videoPath };
  });
}
const safeFileName = (name, fallback) => name.replace(/[<>:"/\\|?*]/g, "").trim() || fallback;
const videosDir = () => path.join(electron.app.getPath("userData"), "videos");
function videoNames(dir) {
  try {
    return new Set(fs.readdirSync(dir));
  } catch {
    return /* @__PURE__ */ new Set();
  }
}
function findDuplicateSetlist(name, serviceDate) {
  const row = getDb().prepare(
    `SELECT id FROM setlists WHERE name = ? AND IFNULL(service_date, '') = IFNULL(?, '') ORDER BY id DESC LIMIT 1`
  ).get(name, serviceDate);
  return row?.id ?? null;
}
function registerSetlistHandlers() {
  electron.ipcMain.handle("setlist:export", async (_e, p) => {
    const db2 = getDb();
    const byId = db2.prepare("SELECT * FROM songs WHERE id = ?");
    const songs = p.songIds.map((id) => byId.get(id)).filter(Boolean).map(deserializeSong);
    const file = buildAladoFile({ name: p.name, service_date: p.service_date || null, notes: null }, songs, /* @__PURE__ */ new Date());
    const { canceled, filePath } = await electron.dialog.showSaveDialog({
      defaultPath: `${safeFileName(p.name, "servicio")}.alado`,
      filters: [{ name: "Servicio ALADO", extensions: ["alado"] }]
    });
    if (canceled || !filePath) return null;
    fs.writeFileSync(filePath, JSON.stringify(file, null, 2), "utf-8");
    return { path: filePath };
  });
  electron.ipcMain.handle("setlist:save-pptx", async (_e, p) => {
    const { canceled, filePath } = await electron.dialog.showSaveDialog({
      defaultPath: `${safeFileName(p.defaultName, "servicio")}.pptx`,
      filters: [{ name: "Presentación de PowerPoint", extensions: ["pptx"] }]
    });
    if (canceled || !filePath) return null;
    fs.writeFileSync(filePath, Buffer.from(p.bytes));
    return { path: filePath };
  });
  electron.ipcMain.handle("setlist:import-inspect", async () => {
    const { canceled, filePaths } = await electron.dialog.showOpenDialog({
      properties: ["openFile"],
      filters: [{ name: "Servicio ALADO", extensions: ["alado"] }]
    });
    if (canceled || !filePaths[0]) return null;
    const file = parseAladoFile(fs.readFileSync(filePaths[0], "utf-8"));
    return {
      path: filePaths[0],
      name: file.setlist.name,
      service_date: file.setlist.service_date,
      songCount: file.items.length,
      duplicateOf: findDuplicateSetlist(file.setlist.name, file.setlist.service_date)
    };
  });
  electron.ipcMain.handle("setlist:import-apply", (_e, p) => {
    const file = parseAladoFile(fs.readFileSync(p.path, "utf-8"));
    const db2 = getDb();
    const local = db2.prepare("SELECT id, title, artist, sections, updated_at FROM songs").all().map((r) => ({ ...r, sections: JSON.parse(r.sections || "[]") }));
    const dir = videosDir();
    const names = videoNames(dir);
    const steps = planImport(file, local, dir, names);
    const summary = { reused: 0, created: [], differing: [], missingVideo: [] };
    const insertSong = db2.prepare(
      "INSERT INTO songs (title, artist, sections, video_path, text_style, folder_id) VALUES (?,?,?,?,?,NULL)"
    );
    const insertItem = db2.prepare(
      "INSERT INTO setlist_items (setlist_id, song_id, position, custom_video) VALUES (?,?,?,?)"
    );
    const run2 = db2.transaction(() => {
      const songIds2 = steps.map((step) => {
        if (step.kind === "existing") {
          summary.reused++;
          if (step.differs) summary.differing.push(step.title);
          return step.songId;
        }
        const { song } = step;
        summary.created.push(song.title);
        if (!step.videoPath) summary.missingVideo.push(song.title);
        const r = insertSong.run(
          song.title,
          song.artist ?? null,
          JSON.stringify(song.sections),
          step.videoPath,
          JSON.stringify(song.text_style ?? {})
        );
        return Number(r.lastInsertRowid);
      });
      const { name, service_date, notes } = file.setlist;
      let setlistId2;
      if (p.mode === "replace" && p.replaceId) {
        db2.prepare("UPDATE setlists SET name=?, service_date=?, notes=? WHERE id=?").run(name, service_date, notes, p.replaceId);
        db2.prepare("DELETE FROM setlist_items WHERE setlist_id = ?").run(p.replaceId);
        setlistId2 = p.replaceId;
      } else {
        setlistId2 = Number(db2.prepare("INSERT INTO setlists (name, service_date, notes) VALUES (?,?,?)").run(name, service_date, notes).lastInsertRowid);
      }
      file.items.forEach((item, i) => {
        const custom = item.custom_video_file && names.has(item.custom_video_file) ? path.join(dir, item.custom_video_file) : null;
        insertItem.run(setlistId2, songIds2[i], i, custom);
      });
      return { setlistId: setlistId2, songIds: songIds2 };
    });
    const { setlistId, songIds } = run2();
    const ready = db2.prepare(`SELECT 1 FROM song_audio WHERE song_id = ? AND status = 'ready'`);
    const titles = new Map(db2.prepare("SELECT id, title FROM songs").all().map((r) => [r.id, r.title]));
    const missingAudio = [...new Set(songIds)].filter((id) => !ready.get(id)).map((id) => titles.get(id));
    return { setlistId, ...summary, missingAudio };
  });
}
const MEDIA_SCHEME = "alado-media";
const VIDEO_EXT = /\.(mp4|m4v|webm|mov)$/i;
const ABSOLUTE = /^([A-Za-z]:[\\/]|\/)/;
function mediaPathFromUrl(url2) {
  let parsed;
  try {
    parsed = new URL(url2);
  } catch {
    return null;
  }
  if (parsed.protocol !== `${MEDIA_SCHEME}:` || parsed.hostname !== "video") return null;
  let path2;
  try {
    path2 = decodeURIComponent(parsed.pathname.replace(/^\//, ""));
  } catch {
    return null;
  }
  if (!ABSOLUTE.test(path2) || !VIDEO_EXT.test(path2) || path2.includes("\0")) return null;
  return path2;
}
function registerMediaSchemePrivileges() {
  electron.protocol.registerSchemesAsPrivileged([
    { scheme: MEDIA_SCHEME, privileges: { standard: true, secure: true, stream: true, supportFetchAPI: true, corsEnabled: true } }
  ]);
}
function registerMediaProtocol() {
  electron.protocol.handle(MEDIA_SCHEME, async (request) => {
    const path2 = mediaPathFromUrl(request.url);
    if (!path2 || !fs.existsSync(path2)) return new Response("Not found", { status: 404 });
    const res = await electron.net.fetch(url.pathToFileURL(path2).toString(), { headers: request.headers });
    const headers = new Headers(res.headers);
    headers.set("Access-Control-Allow-Origin", "*");
    return new Response(res.body, { status: res.status, statusText: res.statusText, headers });
  });
}
if (process.env.NODE_ENV === "development") {
  process.env["ELECTRON_DISABLE_SECURITY_WARNINGS"] = "true";
}
registerMediaSchemePrivileges();
let mainWindow = null;
let liveWindow = null;
electron.app.whenReady().then(() => {
  registerMediaProtocol();
  registerDbHandlers();
  registerLiveHandlers();
  registerSystemHandlers();
  registerLyricsHandlers();
  registerAudioHandlers(() => mainWindow);
  registerPackHandlers();
  registerSetlistHandlers();
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
