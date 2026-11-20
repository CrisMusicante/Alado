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
function planLiveWindow(displays, primaryId) {
  const external = displays.find((d) => d.id !== primaryId);
  if (external) return { windowed: false, bounds: external.bounds };
  const area = (displays.find((d) => d.id === primaryId) ?? displays[0]).workArea;
  let width = Math.round(area.width / 2);
  let height = Math.round(width * 9 / 16);
  if (height > area.height) {
    height = area.height;
    width = Math.round(height * 16 / 9);
  }
  return {
    windowed: true,
    bounds: {
      x: area.x + Math.round((area.width - width) / 2),
      y: area.y + Math.round((area.height - height) / 2),
      width,
      height
    }
  };
}
function createLiveWindow() {
  const primaryId = electron.screen.getPrimaryDisplay().id;
  const plan = planLiveWindow(
    electron.screen.getAllDisplays().map((d) => ({ id: d.id, bounds: d.bounds, workArea: d.workArea })),
    primaryId
  );
  const { windowed } = plan;
  const win = new electron.BrowserWindow({
    ...plan.bounds,
    fullscreen: !windowed,
    frame: windowed,
    alwaysOnTop: !windowed,
    skipTaskbar: !windowed,
    resizable: windowed,
    title: "ALADO — Proyección",
    // Windowed: open without stealing focus, so the operator keeps the keyboard
    // and sees the "no second display" warning (shown with showInactive in main).
    show: !windowed,
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
  return { win, windowed };
}
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
const SONG_AUDIO_SQL = `
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
`;
const SYNCED_TABLES = ["songs", "setlists", "folders"];
const NEW_UID = "lower(hex(randomblob(16)))";
function hasColumn(db2, table, column) {
  return db2.prepare(`SELECT name FROM pragma_table_info('${table}')`).all().some((c) => c.name === column);
}
function migrateV6(db2) {
  for (const table of SYNCED_TABLES) {
    if (!hasColumn(db2, table, "uid")) db2.exec(`ALTER TABLE ${table} ADD COLUMN uid TEXT`);
    db2.exec(`UPDATE ${table} SET uid = ${NEW_UID} WHERE uid IS NULL`);
    db2.exec(`CREATE UNIQUE INDEX IF NOT EXISTS idx_${table}_uid ON ${table}(uid)`);
    db2.exec(`
      CREATE TRIGGER IF NOT EXISTS ${table}_uid AFTER INSERT ON ${table}
      WHEN NEW.uid IS NULL
      BEGIN
        UPDATE ${table} SET uid = ${NEW_UID} WHERE id = NEW.id;
      END;
    `);
  }
  db2.exec(`
    CREATE TABLE IF NOT EXISTS sync_snapshot (
      kind     TEXT NOT NULL,   -- 'song' | 'setlist' | 'folder'
      uid      TEXT NOT NULL,
      data     TEXT NOT NULL,   -- JSON, same shape as the local view
      versions TEXT NOT NULL DEFAULT '{}',
      seq      INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (kind, uid)
    );
  `);
}
let db;
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
      database.exec(SONG_AUDIO_SQL);
      database.pragma("user_version = 3");
    })();
  }
  if (version2 < 4) {
    database.transaction(() => {
      try {
        database.exec("ALTER TABLE songs ADD COLUMN song_key TEXT");
      } catch (e) {
        if (!String(e?.message).includes("duplicate column name")) throw e;
      }
      database.pragma("user_version = 4");
    })();
  }
  if (version2 < 5) {
    database.transaction(() => {
      try {
        database.exec("ALTER TABLE songs ADD COLUMN sheet_style TEXT");
      } catch (e) {
        if (!String(e?.message).includes("duplicate column name")) throw e;
      }
      database.pragma("user_version = 5");
    })();
  }
  if (version2 < 6) {
    database.transaction(() => {
      migrateV6(database);
      database.pragma("user_version = 6");
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
const COLUMNS$1 = ["status", "error", "original_hash", "duration_sec", "vol_instrumental", "vol_vocals", "cues", "cues_sections_sig"];
function upsertSongAudio(songId, patch) {
  const db2 = getDb();
  db2.prepare("INSERT OR IGNORE INTO song_audio (song_id) VALUES (?)").run(songId);
  const keys = COLUMNS$1.filter((k) => k in patch);
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
      song_key: row.song_key ?? null,
      video_path: row.video_path,
      sections: JSON.parse(row.sections || "[]"),
      text_style: JSON.parse(row.text_style || "{}")
    }
  };
}
const DEFAULT_SHEET_STYLE = { size: "auto", columns: "auto" };
const SIZES = ["auto", "lg", "md", "sm"];
const COLUMNS = ["auto", 1, 2];
function parseSheetStyle(v) {
  if (typeof v === "string") {
    try {
      v = JSON.parse(v);
    } catch {
      return {};
    }
  }
  if (typeof v !== "object" || v === null) return {};
  const o = v;
  return {
    ...SIZES.includes(o.size) ? { size: o.size } : {},
    ...COLUMNS.includes(o.columns) ? { columns: o.columns } : {}
  };
}
function resolveSheetStyle(general, song) {
  return { size: song?.size ?? general.size, columns: song?.columns ?? general.columns };
}
function chooseLayout(style, fits) {
  const FIXED = { lg: 20, md: 16, sm: 12 };
  const MAX = 24;
  const MIN = 14;
  const ONE_COL_MIN = 16;
  const options = style.columns === "auto" ? [1, 2] : [style.columns];
  if (style.size !== "auto") {
    const pt = FIXED[style.size];
    for (const cols of options) if (fits(pt, cols)) return { pt, cols };
    return { pt, cols: options[options.length - 1] };
  }
  const best = (cols) => {
    for (let pt = MAX; pt >= MIN; pt--) if (fits(pt, cols)) return pt;
    return null;
  };
  if (options.length === 1) return { pt: best(options[0]) ?? MIN, cols: options[0] };
  const one = best(1);
  const two = best(2);
  if (one !== null && (one >= ONE_COL_MIN || two === null || one >= two)) return { pt: one, cols: 1 };
  if (two !== null) return { pt: two, cols: 2 };
  return { pt: MIN, cols: 2 };
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
    const sheetStyle = serializeSheetStyle(song.sheet_style);
    if (song.id) {
      db2.prepare(
        `UPDATE songs SET title=?, artist=?, song_key=?, sheet_style=?, sections=?, video_path=?, text_style=? WHERE id=?`
      ).run(song.title, song.artist ?? null, song.song_key || null, sheetStyle, sections, song.video_path ?? null, textStyle, song.id);
      return song.id;
    } else {
      const result = db2.prepare(
        `INSERT INTO songs (title, artist, song_key, sheet_style, sections, video_path, text_style) VALUES (?,?,?,?,?,?,?)`
      ).run(song.title, song.artist ?? null, song.song_key || null, sheetStyle, sections, song.video_path ?? null, textStyle);
      return result.lastInsertRowid;
    }
  });
  electron.ipcMain.handle("db:delete-song", async (_e, id2) => {
    getDb().prepare("DELETE FROM songs WHERE id = ?").run(id2);
    await purgeSongAudio(id2).catch((e) => console.error("No se pudieron borrar los stems de la canción", id2, e));
  });
  electron.ipcMain.handle("db:get-setlists", () => {
    const db2 = getDb();
    const setlists = db2.prepare("SELECT * FROM setlists ORDER BY created_at DESC").all();
    return setlists.map((sl) => ({
      ...sl,
      songs: db2.prepare(
        `SELECT si.*, s.title, s.artist, s.song_key, s.sections, s.video_path, s.text_style
         FROM setlist_items si JOIN songs s ON s.id = si.song_id
         WHERE si.setlist_id = ? ORDER BY si.position`
      ).all(sl.id).map(toSetlistItem)
    }));
  });
  electron.ipcMain.handle("db:save-setlist", (_e, setlist) => {
    const db2 = getDb();
    return db2.transaction(() => {
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
    })();
  });
  electron.ipcMain.handle("db:delete-setlist", (_e, id2) => {
    getDb().prepare("DELETE FROM setlists WHERE id = ?").run(id2);
  });
  electron.ipcMain.handle("db:get-folders", () => {
    return getDb().prepare("SELECT * FROM folders ORDER BY name COLLATE NOCASE").all();
  });
  electron.ipcMain.handle("db:create-folder", (_e, name) => {
    const result = getDb().prepare("INSERT INTO folders (name) VALUES (?)").run(name);
    return result.lastInsertRowid;
  });
  electron.ipcMain.handle("db:rename-folder", (_e, { id: id2, name }) => {
    getDb().prepare("UPDATE folders SET name = ? WHERE id = ?").run(name, id2);
  });
  electron.ipcMain.handle("db:delete-folder", (_e, id2) => {
    getDb().prepare("DELETE FROM folders WHERE id = ?").run(id2);
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
    text_style: JSON.parse(row.text_style || "{}"),
    sheet_style: row.sheet_style ? parseSheetStyle(row.sheet_style) : null
  };
}
function serializeSheetStyle(v) {
  const style = parseSheetStyle(v);
  return Object.keys(style).length > 0 ? JSON.stringify(style) : null;
}
const VIDEO_EXT$1 = /* @__PURE__ */ new Set([".mp4", ".webm", ".mov"]);
function listVideos(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).filter((e) => e.isFile() && VIDEO_EXT$1.has(path.extname(e.name).toLowerCase())).map((e) => {
    const p = path.join(dir, e.name);
    return { name: e.name, path: p, size: fs.statSync(p).size };
  }).sort((a, b) => a.name.localeCompare(b.name, "es"));
}
function sha256(file) {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash("sha256");
    fs.createReadStream(file).on("data", (chunk) => hash.update(chunk)).on("end", () => resolve(hash.digest("hex"))).on("error", reject);
  });
}
async function sameContent(a, b) {
  if (fs.statSync(a).size !== fs.statSync(b).size) return false;
  const [ha, hb] = await Promise.all([sha256(a), sha256(b)]);
  return ha === hb;
}
async function importVideo(srcPath, dir) {
  fs.mkdirSync(dir, { recursive: true });
  const ext = path.extname(srcPath);
  const base = path.basename(srcPath, ext);
  const entry = (p) => ({ name: path.basename(p), path: p, size: fs.statSync(p).size });
  if (path.resolve(path.dirname(srcPath)) === path.resolve(dir)) return entry(srcPath);
  for (let n = 1; ; n++) {
    const candidate = path.join(dir, n === 1 ? `${base}${ext}` : `${base} (${n})${ext}`);
    if (!fs.existsSync(candidate)) {
      try {
        await fs.promises.copyFile(srcPath, candidate);
      } catch (e) {
        fs.rmSync(candidate, { force: true });
        throw e;
      }
      return entry(candidate);
    }
    if (await sameContent(srcPath, candidate)) return entry(candidate);
  }
}
const videosDir$1 = () => path.join(electron.app.getPath("userData"), "videos");
function registerVideosHandlers() {
  electron.ipcMain.handle("videos:list", () => listVideos(videosDir$1()));
  electron.ipcMain.handle("videos:import", async () => {
    const result = await electron.dialog.showOpenDialog({
      properties: ["openFile"],
      filters: [{ name: "Video", extensions: ["mp4", "webm", "mov"] }]
    });
    if (result.canceled || !result.filePaths[0]) return null;
    return importVideo(result.filePaths[0], videosDir$1());
  });
}
const REPLAY_ORDER = ["live:set-video", "live:transition", "live:blackout", "live:whiteout", "live:show-section"];
class LiveStateCache {
  latest = /* @__PURE__ */ new Map();
  record(channel, payload) {
    this.latest.set(channel, payload);
  }
  replay(send) {
    for (const channel of REPLAY_ORDER) {
      if (this.latest.has(channel)) send(channel, this.latest.get(channel));
    }
  }
  clear() {
    this.latest.clear();
  }
}
let liveWindow$1 = null;
const cache = new LiveStateCache();
function setLiveWindow(win) {
  liveWindow$1 = win;
}
function replayLiveState() {
  cache.replay((channel, payload) => liveWindow$1?.webContents.send(channel, payload));
}
function clearLiveState() {
  cache.clear();
}
function forward(channel, payload) {
  cache.record(channel, payload);
  liveWindow$1?.webContents.send(channel, payload);
}
function registerLiveHandlers() {
  electron.ipcMain.handle("live:show-section", (_e, payload) => {
    forward("live:show-section", payload);
  });
  electron.ipcMain.handle("live:set-video", (_e, payload) => {
    forward("live:set-video", payload);
  });
  electron.ipcMain.handle("live:blackout", (_e, payload) => {
    forward("live:blackout", payload);
  });
  electron.ipcMain.handle("live:whiteout", (_e, payload) => {
    forward("live:whiteout", payload);
  });
  electron.ipcMain.handle("live:transition", (_e, payload) => {
    forward("live:transition", payload);
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
    throw new Error(`Este paquete usa la versión ${manifest2.packVersion} del formato; esta app solo entiende la versión ${PACK_VERSION}. Actualiza ALADO.`);
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
const packKey = (k) => typeof k === "string" && k.trim() && k.length <= 8 ? k.trim() : null;
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
      filters: [{ name: "Paquete ALADO", extensions: ["wfpack"] }]
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
      song_key: song.song_key ?? null,
      sheet_style: song.sheet_style ? parseSheetStyle(song.sheet_style) : null,
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
      filters: [{ name: "Paquete ALADO", extensions: ["wfpack"] }]
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
      db2.prepare("UPDATE songs SET sections = ?, text_style = ?, song_key = COALESCE(?, song_key), sheet_style = COALESCE(?, sheet_style) WHERE id = ?").run(JSON.stringify(song.sections), JSON.stringify(song.text_style), packKey(song.song_key), serializeSheetStyle(song.sheet_style), songId);
    } else {
      const title = dup ? `${song.title} (importada)` : song.title;
      songId = Number(db2.prepare("INSERT INTO songs (title, artist, song_key, sheet_style, sections, text_style) VALUES (?,?,?,?,?,?)").run(title, song.artist ?? null, packKey(song.song_key), serializeSheetStyle(song.sheet_style), JSON.stringify(song.sections), JSON.stringify(song.text_style)).lastInsertRowid);
    }
    const dir = stemsDir(songId);
    fs.mkdirSync(dir, { recursive: true });
    for (const [name, bytes] of Object.entries(files)) {
      if (name.startsWith("audio/")) fs.writeFileSync(path.join(dir, path.basename(name)), bytes);
    }
    if (song.video && files[`video/${song.video}`]) {
      const mediaDir = path.join(electron.app.getPath("userData"), "media", String(songId));
      fs.mkdirSync(mediaDir, { recursive: true });
      const videoPath2 = path.join(mediaDir, path.basename(song.video));
      fs.writeFileSync(videoPath2, files[`video/${song.video}`]);
      db2.prepare("UPDATE songs SET video_path = ? WHERE id = ?").run(videoPath2, songId);
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
const fileName$1 = (p) => p ? p.split(/[\\/]/).pop() || null : null;
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
        song_key: s.song_key || null,
        sheet_style: sheetStyleOrNull(s.sheet_style),
        sections: s.sections,
        text_style: s.text_style,
        video_file: fileName$1(s.video_path)
      },
      custom_video_file: fileName$1(s.custom_video)
    }))
  };
}
const NOT_ALADO = "El archivo no es un servicio de ALADO.";
const isObj = (v) => typeof v === "object" && v !== null && !Array.isArray(v);
function assertSections(v, title) {
  const ok = Array.isArray(v) && v.every((s) => isObj(s) && typeof s.label === "string" && Array.isArray(s.lines) && s.lines.every((l) => typeof l === "string"));
  if (!ok) throw new Error(`El archivo está dañado: la letra de "${title}" no es válida.`);
}
const cleanKey = (k) => typeof k === "string" && k.trim() && k.length <= 8 ? k.trim() : null;
const sheetStyleOrNull = (v) => {
  const style = parseSheetStyle(v);
  return Object.keys(style).length > 0 ? style : null;
};
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
    item.song.song_key = cleanKey(item.song.song_key);
    item.song.sheet_style = sheetStyleOrNull(item.song.sheet_style);
  });
  return data;
}
function normalizeTitle(t) {
  return t.normalize("NFD").replace(new RegExp("\\p{Diacritic}", "gu"), "").toLowerCase().replace(/\s+/g, " ").trim();
}
function pickMatch(song, local) {
  const key = normalizeTitle(song.title);
  const same2 = local.filter((l) => normalizeTitle(l.title) === key);
  if (same2.length === 0) return null;
  const artist = song.artist ? normalizeTitle(song.artist) : "";
  const byArtist = artist ? same2.filter((l) => l.artist && normalizeTitle(l.artist) === artist) : [];
  const pool = byArtist.length > 0 ? byArtist : same2;
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
    if (match) {
      return {
        kind: "existing",
        songId: match.id,
        title: match.title,
        differs: sectionsDiffer(match.sections, song.sections),
        fillKey: !match.song_key && song.song_key ? song.song_key : null,
        fillSheetStyle: !sheetStyleOrNull(match.sheet_style) && song.sheet_style ? song.sheet_style : null
      };
    }
    const videoPath2 = song.video_file && videoNames2.has(song.video_file) ? path.join(videosDir2, song.video_file) : null;
    return { kind: "create", song, videoPath: videoPath2 };
  });
}
const PAGE_W = 816;
const PAGE_H = 1056;
const MARGIN_X = 60;
const MARGIN_Y = 53;
const CONTENT_W = PAGE_W - 2 * MARGIN_X;
const CONTENT_H = PAGE_H - 2 * MARGIN_Y;
const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
function longDate(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return "";
  const date = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return date.toLocaleDateString("es-MX", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
}
const STYLE = `
  @page { size: letter; margin: 14mm 16mm; }
  * { box-sizing: border-box; }
  html { background: #fff; }
  body { font-family: "Segoe UI", system-ui, sans-serif; color: #111; margin: 0; width: ${CONTENT_W}px; font-size: 14pt; line-height: 1.3; }
  h1 { font-size: 24pt; margin: 0 0 2pt; }
  .date { color: #555; margin: 0 0 16pt; }
  .date::first-letter { text-transform: uppercase; }
  table { width: 100%; border-collapse: collapse; }
  th { text-align: left; font-size: 10pt; text-transform: uppercase; letter-spacing: .06em; color: #666; border-bottom: 1.5pt solid #111; padding: 4pt 6pt; }
  td { padding: 7pt 6pt; border-bottom: .5pt solid #ccc; vertical-align: top; }
  td.n { width: 26pt; color: #666; }
  td.k, th.k { width: 70pt; text-align: center; font-weight: 700; }
  .artist { color: #666; font-size: 11pt; }
  .song { --pt: 18pt; break-before: page; }
  .head { display: flex; justify-content: space-between; align-items: flex-start; gap: 12pt; border-bottom: 1.5pt solid #111; padding-bottom: 6pt; margin-bottom: 10pt; }
  .head h2 { font-size: max(18pt, calc(var(--pt) * 1.2)); line-height: 1.15; margin: 0; }
  .head .artist { font-size: max(11pt, calc(var(--pt) * 0.65)); }
  .key { border: 1.5pt solid #111; border-radius: 6pt; padding: 3pt 10pt; font-weight: 700; font-size: max(14pt, calc(var(--pt) * 1.1)); white-space: nowrap; }
  .sections { font-size: var(--pt); }
  .song.two .sections { columns: 2; column-gap: 20pt; }
  .section { break-inside: avoid; margin: 0 0 0.6em; }
  .label { font-size: max(9pt, calc(var(--pt) * 0.6)); font-weight: 700; text-transform: uppercase; letter-spacing: .06em; color: #444; margin-bottom: 1pt; }
  .repeat { font-weight: 400; color: #666; }
  .lines { margin: 0; }
`;
const PREVIEW_STYLE = `
  body { width: ${PAGE_W}px; min-height: ${PAGE_H}px; padding: ${MARGIN_Y}px ${MARGIN_X}px; position: relative; }
  .song { break-before: auto; }
  .page-break { position: absolute; left: 0; right: 0; border-top: 2px dashed #f59e0b; }
  .page-break span { position: absolute; right: 8px; top: 2px; font: 600 11px "Segoe UI", sans-serif; color: #b45309; background: #fff; padding: 0 4px; }
`;
function fitScript(preview) {
  return `
(function () {
  var chooseLayout = ${chooseLayout.toString()};
  var H = ${CONTENT_H - 4};
  document.querySelectorAll('.song').forEach(function (el) {
    var apply = function (pt, cols) { el.style.setProperty('--pt', pt + 'pt'); el.classList.toggle('two', cols === 2); };
    var fits = function (pt, cols) { apply(pt, cols); return el.getBoundingClientRect().height <= H; };
    var r = chooseLayout(JSON.parse(el.dataset.style), fits);
    apply(r.pt, r.cols);
    el.dataset.pt = r.pt; el.dataset.cols = r.cols;
  });
  ${preview ? `
  var song = document.querySelector('.song');
  if (song) {
    var pages = Math.max(1, Math.ceil(song.getBoundingClientRect().height / ${CONTENT_H}));
    document.body.style.minHeight = (pages * ${PAGE_H}) + 'px';
    for (var k = 1; k < pages; k++) {
      var mark = document.createElement('div');
      mark.className = 'page-break';
      mark.style.top = (${MARGIN_Y} + k * ${CONTENT_H}) + 'px';
      var label = document.createElement('span');
      label.textContent = 'sigue en la hoja ' + (k + 1);
      mark.appendChild(label);
      document.body.appendChild(mark);
    }
  }` : ""}
})();`;
}
function songPage(song, n, general) {
  const style = resolveSheetStyle(general, parseSheetStyle(song.sheet_style));
  const sections = song.sections.filter((s) => s.lines.some((l) => l.trim())).map((s) => `
      <div class="section">
        <div class="label">${esc(s.label)}${(s.repeat ?? 1) > 1 ? ` <span class="repeat">×${s.repeat}</span>` : ""}</div>
        <p class="lines">${s.lines.map(esc).join("<br>")}</p>
      </div>`).join("");
  return `
    <section class="song" data-style="${esc(JSON.stringify(style))}">
      <div class="head">
        <div>
          <h2>${n !== null ? `${n}. ` : ""}${esc(song.title)}</h2>
          ${song.artist ? `<div class="artist">${esc(song.artist)}</div>` : ""}
        </div>
        ${song.song_key ? `<div class="key">Tono: ${esc(song.song_key)}</div>` : ""}
      </div>
      <div class="sections">${sections}</div>
    </section>`;
}
const CSP = `default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'`;
function page(title, body, preview) {
  return `<!doctype html>
<html lang="es">
<head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="${CSP}"><title>${esc(title)}</title>
<style>${STYLE}${preview ? PREVIEW_STYLE : ""}</style></head>
<body>${body}
<script>${fitScript(preview)}<\/script>
</body>
</html>`;
}
function buildLyricsSheetHtml(service2, songs, opts = {}) {
  const general = opts.general ?? DEFAULT_SHEET_STYLE;
  if (opts.preview) return page(songs[0]?.title ?? "", songs[0] ? songPage(songs[0], null, general) : "", true);
  const date = longDate(service2.service_date);
  const rows = songs.map((s, i) => `
      <tr>
        <td class="n">${i + 1}</td>
        <td>${esc(s.title)}${s.artist ? `<div class="artist">${esc(s.artist)}</div>` : ""}</td>
        <td class="k">${s.song_key ? esc(s.song_key) : "—"}</td>
      </tr>`).join("");
  return page(service2.name, `
  <h1>${esc(service2.name)}</h1>
  ${date ? `<p class="date">${esc(date)}</p>` : ""}
  <table>
    <thead><tr><th></th><th>Canción</th><th class="k">Tono</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>
  ${songs.map((s, i) => songPage(s, i + 1, general)).join("")}`, false);
}
async function withSheetWindow(html, offscreen, fn) {
  const win = new electron.BrowserWindow({
    show: false,
    width: PAGE_W,
    height: PAGE_H,
    useContentSize: true,
    webPreferences: { sandbox: true, contextIsolation: true, nodeIntegration: false, offscreen }
  });
  win.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  win.webContents.on("will-navigate", (e) => e.preventDefault());
  try {
    await win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
    return await fn(win);
  } finally {
    win.destroy();
  }
}
function renderSheetPdf(html) {
  return withSheetWindow(html, false, (win) => win.webContents.printToPDF({ pageSize: "Letter", printBackground: true, preferCSSPageSize: true }));
}
function renderSheetPreview(html) {
  return withSheetWindow(html, true, async (win) => {
    const height = Math.ceil(await win.webContents.executeJavaScript("document.documentElement.scrollHeight"));
    win.setContentSize(PAGE_W, Math.max(PAGE_H, height));
    await new Promise((resolve) => setTimeout(resolve, 150));
    const image = await win.webContents.capturePage();
    return image.toDataURL();
  });
}
const safeFileName = (name, fallback) => name.replace(/[<>:"/\\|?*]/g, "").trim() || fallback;
const generalSheetStyle = (v) => resolveSheetStyle(DEFAULT_SHEET_STYLE, parseSheetStyle(v));
function previewSong(v) {
  const str2 = (x) => typeof x === "string" ? x : "";
  const sections = Array.isArray(v?.sections) ? v.sections : [];
  return {
    title: str2(v?.title),
    artist: str2(v?.artist) || null,
    song_key: str2(v?.song_key) || null,
    sheet_style: v?.sheet_style,
    sections: sections.map((s) => ({
      label: str2(s?.label),
      repeat: Number(s?.repeat) || 1,
      lines: Array.isArray(s?.lines) ? s.lines.map(str2) : []
    }))
  };
}
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
    const songs = p.songIds.map((id2, i) => {
      const row = byId.get(id2);
      return row ? { ...deserializeSong(row), custom_video: p.customVideos?.[i] ?? null } : null;
    }).filter((s) => s !== null);
    const file = buildAladoFile({ name: p.name, service_date: p.service_date || null, notes: p.notes ?? null }, songs, /* @__PURE__ */ new Date());
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
  electron.ipcMain.handle("setlist:export-pdf", async (_e, p) => {
    const { canceled, filePath } = await electron.dialog.showSaveDialog({
      defaultPath: `${safeFileName(p.name, "servicio")} - letras.pdf`,
      filters: [{ name: "PDF", extensions: ["pdf"] }]
    });
    if (canceled || !filePath) return null;
    const byId = getDb().prepare("SELECT * FROM songs WHERE id = ?");
    const songs = p.songIds.map((id2) => byId.get(id2)).filter(Boolean).map(deserializeSong);
    const html = buildLyricsSheetHtml({ name: p.name, service_date: p.service_date || "" }, songs, { general: generalSheetStyle(p.sheetStyle) });
    fs.writeFileSync(filePath, await renderSheetPdf(html));
    return { path: filePath };
  });
  electron.ipcMain.handle("setlist:sheet-preview", (_e, p) => renderSheetPreview(buildLyricsSheetHtml(
    { name: "", service_date: "" },
    [previewSong(p?.song)],
    { general: generalSheetStyle(p?.sheetStyle), preview: true }
  )));
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
    const local = db2.prepare("SELECT id, title, artist, song_key, sheet_style, sections, updated_at FROM songs").all().map((r) => ({ ...r, sections: JSON.parse(r.sections || "[]") }));
    const dir = videosDir();
    const names = videoNames(dir);
    const steps = planImport(file, local, dir, names);
    const summary = { reused: 0, created: [], differing: [], missingVideo: [] };
    const insertSong = db2.prepare(
      "INSERT INTO songs (title, artist, song_key, sheet_style, sections, video_path, text_style, folder_id) VALUES (?,?,?,?,?,?,?,NULL)"
    );
    const fillSheetStyle = db2.prepare("UPDATE songs SET sheet_style = ? WHERE id = ? AND sheet_style IS NULL");
    const fillKey = db2.prepare("UPDATE songs SET song_key = ? WHERE id = ? AND song_key IS NULL");
    const insertItem = db2.prepare(
      "INSERT INTO setlist_items (setlist_id, song_id, position, custom_video) VALUES (?,?,?,?)"
    );
    const run2 = db2.transaction(() => {
      const songIds2 = steps.map((step) => {
        if (step.kind === "existing") {
          summary.reused++;
          if (step.differs) summary.differing.push(step.title);
          if (step.fillKey) fillKey.run(step.fillKey, step.songId);
          if (step.fillSheetStyle) fillSheetStyle.run(serializeSheetStyle(step.fillSheetStyle), step.songId);
          return step.songId;
        }
        const { song } = step;
        summary.created.push(song.title);
        if (!step.videoPath) summary.missingVideo.push(song.title);
        const r = insertSong.run(
          song.title,
          song.artist ?? null,
          song.song_key ?? null,
          serializeSheetStyle(song.sheet_style),
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
    const missingAudio = [...new Set(songIds)].filter((id2) => !ready.get(id2)).map((id2) => titles.get(id2));
    return { setlistId, ...summary, missingAudio };
  });
}
const SONG_FIELDS = [
  "title",
  "artist",
  "sections",
  "song_key",
  "video_file",
  "text_style",
  "sheet_style",
  "folder_uid"
];
const EMPTY_SONG = {
  title: "",
  artist: null,
  sections: [],
  song_key: null,
  video_file: null,
  text_style: null,
  sheet_style: null,
  folder_uid: null
};
const fileName = (p) => {
  const name = p ? p.split(/[\\/]/).pop().trim() : "";
  return name || null;
};
const json = (text, fallback) => {
  if (!text) return fallback;
  try {
    return JSON.parse(text);
  } catch {
    return fallback;
  }
};
function songRowToFields(r) {
  const style = json(r.text_style, null);
  return {
    ...EMPTY_SONG,
    title: r.title,
    artist: r.artist?.trim() ? r.artist : null,
    sections: json(r.sections, []),
    song_key: r.song_key || null,
    video_file: fileName(r.video_path),
    text_style: style && Object.keys(style).length ? style : null,
    sheet_style: json(r.sheet_style, null),
    folder_uid: r.folder_uid ?? null
  };
}
function readLocal(db2) {
  const songs = /* @__PURE__ */ new Map();
  for (const r of db2.prepare(
    `SELECT s.uid, s.title, s.artist, s.sections, s.video_path, s.text_style, s.sheet_style, s.song_key, f.uid AS folder_uid
     FROM songs s LEFT JOIN folders f ON f.id = s.folder_id`
  ).all()) {
    songs.set(r.uid, songRowToFields(r));
  }
  const folders = /* @__PURE__ */ new Map();
  for (const r of db2.prepare("SELECT uid, name FROM folders").all()) folders.set(r.uid, r.name);
  const setlists = /* @__PURE__ */ new Map();
  const items = db2.prepare(
    `SELECT si.setlist_id, s.uid AS song_uid, si.custom_video FROM setlist_items si JOIN songs s ON s.id = si.song_id
     ORDER BY si.setlist_id, si.position`
  ).all();
  for (const r of db2.prepare("SELECT id, uid, name, service_date, notes FROM setlists").all()) {
    setlists.set(r.uid, {
      name: r.name,
      service_date: r.service_date || null,
      notes: r.notes || null,
      items: items.filter((i) => i.setlist_id === r.id).map((i) => ({ song_uid: i.song_uid, custom_video_file: fileName(i.custom_video) }))
    });
  }
  return { songs, setlists, folders };
}
function inTransaction(db2, fn) {
  db2.exec("BEGIN");
  try {
    const out = fn();
    db2.exec("COMMIT");
    return out;
  } catch (e) {
    db2.exec("ROLLBACK");
    throw e;
  }
}
const same$2 = (a, b) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
function readSnapshot(db2, kind, uid) {
  const r = db2.prepare("SELECT data, versions, seq FROM sync_snapshot WHERE kind = ? AND uid = ?").get(kind, uid);
  return r ? { data: JSON.parse(r.data), versions: JSON.parse(r.versions), seq: r.seq } : null;
}
function writeSnapshot(db2, kind, uid, data, versions, seq) {
  db2.prepare("INSERT OR REPLACE INTO sync_snapshot (kind, uid, data, versions, seq) VALUES (?, ?, ?, ?, ?)").run(kind, uid, JSON.stringify(data), JSON.stringify(versions), seq);
}
const dropSnapshot = (db2, kind, uid) => db2.prepare("DELETE FROM sync_snapshot WHERE kind = ? AND uid = ?").run(kind, uid);
function locallyEdited(local, snapshot, remote) {
  const base = snapshot ?? remote;
  return SONG_FIELDS.filter((f) => !same$2(local[f], base[f]));
}
const id = (db2, table, uid) => {
  if (!uid) return null;
  const r = db2.prepare(`SELECT id FROM ${table} WHERE uid = ?`).get(uid);
  return r?.id ?? null;
};
function videoPath(name, currentPath, videosDir2) {
  if (!name || name !== path.basename(name) || /[\\/:]/.test(name) || name.startsWith(".")) return null;
  if (currentPath && fileName(currentPath) === name) return currentPath;
  return path.join(videosDir2, name);
}
function writeSongRow(db2, uid, f, row, videosDir2) {
  const values = [
    f.title,
    f.artist,
    JSON.stringify(f.sections),
    f.song_key,
    videoPath(f.video_file, row?.video_path ?? null, videosDir2),
    JSON.stringify(f.text_style ?? {}),
    f.sheet_style ? JSON.stringify(f.sheet_style) : null,
    id(db2, "folders", f.folder_uid)
  ];
  if (row) {
    db2.prepare("UPDATE songs SET title = ?, artist = ?, sections = ?, song_key = ?, video_path = ?, text_style = ?, sheet_style = ?, folder_id = ? WHERE id = ?").run(...values, row.id);
    return row.id;
  }
  return Number(db2.prepare("INSERT INTO songs (title, artist, sections, song_key, video_path, text_style, sheet_style, folder_id, uid) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)").run(...values, uid).lastInsertRowid);
}
function applyRemote(db2, pulled, opts) {
  const result = { changedSongs: 0, changedSetlists: 0, restored: [], keptLocal: [] };
  inTransaction(db2, () => {
    const local = readLocal(db2);
    for (const f of pulled.folders) {
      const folderId = id(db2, "folders", f.uid);
      if (f.deleted) {
        if (folderId) {
          db2.prepare("UPDATE songs SET folder_id = NULL WHERE folder_id = ?").run(folderId);
          db2.prepare("DELETE FROM folders WHERE id = ?").run(folderId);
        }
        dropSnapshot(db2, "folder", f.uid);
        continue;
      }
      const snap = readSnapshot(db2, "folder", f.uid);
      if (!folderId && snap && snap.data === f.name) continue;
      const localName = local.folders.get(f.uid);
      const editedHere = localName !== void 0 && snap && localName !== snap.data;
      if (folderId && !editedHere) db2.prepare("UPDATE folders SET name = ? WHERE id = ?").run(f.name, folderId);
      else if (!folderId) db2.prepare("INSERT INTO folders (name, uid) VALUES (?, ?)").run(f.name, f.uid);
      writeSnapshot(db2, "folder", f.uid, f.name, {}, f.seq);
    }
    for (const s of pulled.songs) {
      const row = db2.prepare("SELECT id, video_path FROM songs WHERE uid = ?").get(s.uid);
      if (s.deleted) {
        if (row) {
          const used = db2.prepare("SELECT 1 FROM setlist_items WHERE song_id = ? LIMIT 1").get(row.id);
          const snap2 = readSnapshot(db2, "song", s.uid);
          const localFields2 = local.songs.get(s.uid);
          const editedHere = !snap2 || localFields2 && locallyEdited(localFields2, snap2.data, s.fields).length > 0;
          if (!used && !editedHere) db2.prepare("DELETE FROM songs WHERE id = ?").run(row.id);
        }
        dropSnapshot(db2, "song", s.uid);
        continue;
      }
      const localFields = local.songs.get(s.uid);
      const snap = readSnapshot(db2, "song", s.uid);
      if (!row && snap && same$2(s.fields, snap.data)) continue;
      const edited = localFields ? locallyEdited(localFields, snap?.data ?? null, s.fields) : [];
      const merged = { ...s.fields };
      for (const f of edited) merged[f] = localFields[f];
      if (edited.length && localFields) result.keptLocal.push(merged.title);
      if (!row || !localFields || !same$2(merged, localFields)) {
        writeSongRow(db2, s.uid, merged, row ?? null, opts.videosDir);
        result.changedSongs++;
      }
      const versions = { ...s.versions };
      for (const f of edited) versions[f] = snap?.versions[f] ?? 0;
      writeSnapshot(db2, "song", s.uid, s.fields, versions, s.seq);
    }
    for (const l of pulled.setlists) {
      const setlistId = id(db2, "setlists", l.uid);
      if (l.deleted) {
        if (setlistId) {
          db2.prepare("DELETE FROM setlist_items WHERE setlist_id = ?").run(setlistId);
          db2.prepare("DELETE FROM setlists WHERE id = ?").run(setlistId);
          result.changedSetlists++;
        }
        dropSnapshot(db2, "setlist", l.uid);
        continue;
      }
      const remoteData = { name: l.name, service_date: l.service_date, notes: l.notes, items: l.items };
      const localData = local.setlists.get(l.uid);
      const snap = readSnapshot(db2, "setlist", l.uid);
      if (!setlistId && snap && same$2(remoteData, snap.data)) continue;
      const editedHere = localData && !same$2(localData, snap ? snap.data : remoteData);
      if (editedHere) {
        result.keptLocal.push(localData.name);
        writeSnapshot(db2, "setlist", l.uid, remoteData, {}, snap?.seq ?? 0);
        continue;
      }
      if (!localData || !same$2(localData, remoteData)) {
        let sid = setlistId;
        if (sid) {
          db2.prepare("UPDATE setlists SET name = ?, service_date = ?, notes = ? WHERE id = ?").run(l.name, l.service_date, l.notes, sid);
          db2.prepare("DELETE FROM setlist_items WHERE setlist_id = ?").run(sid);
        } else {
          sid = Number(db2.prepare("INSERT INTO setlists (name, service_date, notes, uid) VALUES (?, ?, ?, ?)").run(l.name, l.service_date, l.notes, l.uid).lastInsertRowid);
        }
        const insert = db2.prepare("INSERT INTO setlist_items (setlist_id, song_id, position, custom_video) VALUES (?, ?, ?, ?)");
        let position = 0;
        for (const item of l.items) {
          let songId = id(db2, "songs", item.song_uid);
          if (!songId) {
            const snapSong = readSnapshot(db2, "song", item.song_uid);
            if (snapSong) {
              songId = writeSongRow(db2, item.song_uid, snapSong.data, null, opts.videosDir);
              result.restored.push(snapSong.data.title);
            }
          }
          if (songId) insert.run(sid, songId, position++, videoPath(item.custom_video_file, null, opts.videosDir));
        }
        result.changedSetlists++;
      }
      writeSnapshot(db2, "setlist", l.uid, remoteData, {}, l.seq);
    }
  });
  return result;
}
const same$1 = (a, b) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
function readSnapshots(db2) {
  const out = { songs: /* @__PURE__ */ new Map(), setlists: /* @__PURE__ */ new Map(), folders: /* @__PURE__ */ new Map() };
  for (const r of db2.prepare("SELECT kind, uid, data, versions, seq FROM sync_snapshot").all()) {
    const data = JSON.parse(r.data);
    if (r.kind === "song") out.songs.set(r.uid, { data, versions: JSON.parse(r.versions), seq: r.seq });
    else if (r.kind === "setlist") out.setlists.set(r.uid, { data, seq: r.seq });
    else if (r.kind === "folder") out.folders.set(r.uid, { data, seq: r.seq });
  }
  return out;
}
function localChanges(local, snap) {
  const folders = [];
  const songs = [];
  const setlists = [];
  const setlistDeletes = [];
  const songDeletes = [];
  const folderDeletes = [];
  for (const [uid, name] of local.folders) {
    const s = snap.folders.get(uid);
    if (!s || s.data !== name) folders.push({ kind: "folder", uid, name });
  }
  for (const uid of snap.folders.keys()) if (!local.folders.has(uid)) folderDeletes.push({ kind: "folder-delete", uid });
  for (const [uid, fields] of local.songs) {
    const s = snap.songs.get(uid);
    if (!s) {
      songs.push({ kind: "song", uid, fields, seen: {} });
      continue;
    }
    const changed = SONG_FIELDS.filter((f) => !same$1(fields[f], s.data[f]));
    if (!changed.length) continue;
    const partial = {};
    const seen = {};
    for (const f of changed) {
      partial[f] = fields[f];
      seen[f] = s.versions[f] ?? 0;
    }
    songs.push({ kind: "song", uid, fields: partial, seen });
  }
  for (const uid of snap.songs.keys()) if (!local.songs.has(uid)) songDeletes.push({ kind: "song-delete", uid });
  for (const [uid, data] of local.setlists) {
    const s = snap.setlists.get(uid);
    if (!s || !same$1(s.data, data)) setlists.push({ kind: "setlist", uid, data, seenSeq: s?.seq ?? 0 });
  }
  for (const uid of snap.setlists.keys()) if (!local.setlists.has(uid)) setlistDeletes.push({ kind: "setlist-delete", uid });
  return [...folders, ...songs, ...setlists, ...setlistDeletes, ...songDeletes, ...folderDeletes];
}
const PUSH_CHUNK = 30;
const OFFLINE$1 = "No se pudo conectar con ALADO en la nube.";
class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}
function setting(db2, key) {
  const r = db2.prepare("SELECT value FROM app_settings WHERE key = ?").get(key);
  return r?.value ?? null;
}
function setSetting(db2, key, value) {
  db2.prepare("INSERT OR REPLACE INTO app_settings (key, value) VALUES (?, ?)").run(key, value);
}
class SyncEngine {
  constructor(deps) {
    this.deps = deps;
    this.status = {
      state: "off",
      lastOk: setting(deps.db, "sync_last_ok"),
      error: null,
      unauthorized: false,
      notices: [],
      applied: false
    };
  }
  status;
  /** Local changes not yet in the cloud. */
  pending() {
    return localChanges(readLocal(this.deps.db), readSnapshots(this.deps.db)).length;
  }
  get since() {
    return Number(setting(this.deps.db, "sync_seq") ?? 0) || 0;
  }
  async call(method, path2, body) {
    let res;
    try {
      res = await this.deps.api(method, path2, body);
    } catch {
      throw new ApiError(OFFLINE$1, 0);
    }
    if (res.status === 401) throw new ApiError("Esta compu ya no está vinculada a ALADO en la nube. Vuelve a vincularla.", 401);
    if (res.status >= 400) throw new ApiError(res.body?.error ?? `Error ${res.status} de la nube.`, res.status);
    return res.body;
  }
  async pullAndApply(notices) {
    const pulled = await this.call("POST", "/api/sync/pull", { since: this.since });
    notices.push(...pulled.notices.map((n) => n.message));
    const r = applyRemote(this.deps.db, pulled, { videosDir: this.deps.videosDir });
    notices.push(...r.restored.map((t) => `«${t}» no se borró: está en un servicio de la nube.`));
    setSetting(this.deps.db, "sync_seq", String(pulled.seq));
    return r.changedSongs + r.changedSetlists > 0 || pulled.folders.length > 0;
  }
  /** Uploads local changes; returns whether anything was sent. */
  async push(notices) {
    const changes = localChanges(readLocal(this.deps.db), readSnapshots(this.deps.db));
    for (let i = 0; i < changes.length; i += PUSH_CHUNK) {
      const chunk = changes.slice(i, i + PUSH_CHUNK);
      const res = await this.call("POST", "/api/sync/push", { changes: chunk });
      chunk.forEach((c, k) => this.afterPush(c, res.results[k], notices));
    }
    return changes.length > 0;
  }
  /** Records an accepted change in the snapshot so it isn't sent again; handles refusals. */
  afterPush(c, r, notices) {
    const db2 = this.deps.db;
    const snaps = readSnapshots(db2);
    if (r?.ok) {
      if (c.kind === "song") {
        const prev = snaps.songs.get(c.uid);
        writeSnapshot(db2, "song", c.uid, { ...EMPTY_SONG, ...prev?.data, ...c.fields }, prev?.versions ?? {}, prev?.seq ?? 0);
      } else if (c.kind === "setlist") {
        writeSnapshot(db2, "setlist", c.uid, c.data, {}, snaps.setlists.get(c.uid)?.seq ?? 0);
      } else if (c.kind === "folder") {
        writeSnapshot(db2, "folder", c.uid, c.name, {}, 0);
      } else {
        const kind = c.kind === "song-delete" ? "song" : c.kind === "setlist-delete" ? "setlist" : "folder";
        db2.prepare("DELETE FROM sync_snapshot WHERE kind = ? AND uid = ?").run(kind, c.uid);
      }
      return;
    }
    if (c.kind === "song-delete" && r?.error === "song-in-use") {
      const snap = snaps.songs.get(c.uid);
      if (snap) {
        db2.prepare("DELETE FROM sync_snapshot WHERE kind = ? AND uid = ?").run("song", c.uid);
        applyRemote(db2, {
          seq: 0,
          songs: [{ uid: c.uid, deleted: false, seq: snap.seq, fields: snap.data, versions: snap.versions }],
          folders: [],
          setlists: [],
          notices: []
        }, { videosDir: this.deps.videosDir });
        notices.push(`«${snap.data.title}» no se borró: está en un servicio de la nube.`);
      }
      return;
    }
    const what = c.kind === "song" ? `la canción «${c.fields.title ?? snaps.songs.get(c.uid)?.data.title ?? ""}»` : c.kind === "setlist" ? `el servicio «${c.data.name}»` : "un cambio";
    notices.push(`No se pudo subir ${what} (${r?.error ?? "sin respuesta"}).`);
  }
  async run(opts = {}) {
    const notices = [];
    this.status = { ...this.status, state: "syncing", notices: [], applied: false };
    try {
      let applied = false;
      let held = false;
      if (this.deps.isLive() && !opts.force) {
        const peek = await this.call("POST", "/api/sync/pull", { since: this.since });
        held = peek.songs.length + peek.setlists.length + peek.folders.length > 0;
        notices.push(...peek.notices.map((n) => n.message));
      } else {
        applied = await this.pullAndApply(notices);
      }
      const pushed = await this.push(notices);
      if (pushed && !held && !this.deps.isLive()) applied = await this.pullAndApply(notices) || applied;
      const lastOk = this.deps.now().toISOString();
      setSetting(this.deps.db, "sync_last_ok", lastOk);
      this.status = { state: held ? "held" : "ok", lastOk, error: null, unauthorized: false, notices, applied };
    } catch (e) {
      const err = e instanceof ApiError ? e : new ApiError(String(e?.message ?? e), 0);
      console.error("ALADO sync failed:", err.message);
      this.status = { ...this.status, state: "error", error: err.message, unauthorized: err.status === 401, notices, applied: false };
    }
    return this.status;
  }
  /** Uploads local changes only (frequent, cheap). Incoming changes wait for the next run(). */
  async pushOnly() {
    const notices = [];
    try {
      if (!this.pending()) return this.status;
      await this.push(notices);
      this.status = { ...this.status, notices, applied: notices.length > 0 };
    } catch (e) {
      const err = e instanceof ApiError ? e : new ApiError(String(e?.message ?? e), 0);
      this.status = { ...this.status, state: "error", error: err.message, unauthorized: err.status === 401, notices };
    }
    return this.status;
  }
}
const same = (a, b) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
function adoptOnLink(db2, pulled, opts) {
  if (db2.prepare("SELECT 1 FROM sync_snapshot LIMIT 1").get()) {
    throw new Error("Esta compu ya estuvo sincronizada; no se puede volver a empatar su catálogo.");
  }
  const local = readLocal(db2);
  const summary = { adopted: 0, replaced: [], backupFile: null, uploaded: 0 };
  const songMatches = [];
  const takenSongs = /* @__PURE__ */ new Set();
  for (const remote of pulled.songs.filter((s) => !s.deleted)) {
    const key = normalizeTitle(remote.fields.title);
    if (!key) continue;
    const candidates = [...local.songs].filter(([uid, f]) => !takenSongs.has(uid) && normalizeTitle(f.title) === key);
    const match = candidates.find(([, f]) => normalizeTitle(f.artist ?? "") === normalizeTitle(remote.fields.artist ?? "")) ?? candidates[0];
    if (!match) continue;
    takenSongs.add(match[0]);
    songMatches.push({ localUid: match[0], remoteUid: remote.uid, fields: match[1] });
    if (!same(match[1].sections, remote.fields.sections) || !same(match[1].song_key, remote.fields.song_key)) {
      summary.replaced.push({ title: match[1].title });
    }
  }
  summary.adopted = songMatches.length;
  summary.uploaded = [...local.songs.keys()].filter((uid) => !takenSongs.has(uid)).length;
  const setlistMatches = [];
  const takenSetlists = /* @__PURE__ */ new Set();
  for (const remote of pulled.setlists.filter((s) => !s.deleted)) {
    const match = [...local.setlists].find(([uid, l]) => !takenSetlists.has(uid) && normalizeTitle(l.name) !== "" && normalizeTitle(l.name) === normalizeTitle(remote.name) && (l.service_date ?? null) === (remote.service_date ?? null));
    if (!match) continue;
    takenSetlists.add(match[0]);
    setlistMatches.push([match[0], remote.uid, match[1]]);
  }
  const folderMatches = [];
  const takenFolders = /* @__PURE__ */ new Set();
  for (const remote of pulled.folders.filter((f) => !f.deleted)) {
    const match = [...local.folders].find(([uid, name]) => !takenFolders.has(uid) && normalizeTitle(name) !== "" && normalizeTitle(name) === normalizeTitle(remote.name));
    if (!match) continue;
    takenFolders.add(match[0]);
    folderMatches.push([match[0], remote.uid, match[1]]);
  }
  if (songMatches.length) {
    fs.mkdirSync(opts.backupDir, { recursive: true });
    const stamp = opts.now().toISOString().slice(0, 10);
    for (let n = 1; ; n++) {
      const file = path.join(opts.backupDir, n === 1 ? `vinculacion-${stamp}.json` : `vinculacion-${stamp}-${n}.json`);
      try {
        fs.writeFileSync(file, JSON.stringify({
          note: "Canciones de esta compu como estaban antes de vincularla; la versión de la nube las reemplazó.",
          songs: songMatches.map((m) => m.fields)
        }, null, 2), { flag: "wx" });
        summary.backupFile = file;
        break;
      } catch (e) {
        if (e.code !== "EEXIST") throw e;
      }
    }
  }
  inTransaction(db2, () => {
    for (const m of songMatches) db2.prepare("UPDATE songs SET uid = ? WHERE uid = ?").run(m.remoteUid, m.localUid);
    for (const [localUid, remoteUid] of setlistMatches) db2.prepare("UPDATE setlists SET uid = ? WHERE uid = ?").run(remoteUid, localUid);
    for (const [localUid, remoteUid] of folderMatches) db2.prepare("UPDATE folders SET uid = ? WHERE uid = ?").run(remoteUid, localUid);
    const now = readLocal(db2);
    for (const m of songMatches) writeSnapshot(db2, "song", m.remoteUid, now.songs.get(m.remoteUid), {}, 0);
    for (const [, remoteUid] of setlistMatches) writeSnapshot(db2, "setlist", remoteUid, now.setlists.get(remoteUid), {}, 0);
    for (const [, remoteUid] of folderMatches) writeSnapshot(db2, "folder", remoteUid, now.folders.get(remoteUid), {}, 0);
  });
  return summary;
}
const PUSH_EVERY_MS = 6e4;
const SYNC_EVERY_MS = 3 * 6e4;
const OFFLINE = "No se pudo conectar con ALADO en la nube. Revisa el internet e intenta de nuevo.";
class SyncService {
  constructor(deps) {
    this.deps = deps;
    this.engine = new SyncEngine({
      db: deps.db,
      api: this.api(() => this.token()),
      videosDir: deps.videosDir,
      backupDir: deps.backupDir,
      isLive: deps.isLive,
      now: deps.now
    });
  }
  engine;
  timers = [];
  running = null;
  get(key) {
    const r = this.deps.db.prepare("SELECT value FROM app_settings WHERE key = ?").get(key);
    return r?.value ?? null;
  }
  set(key, value) {
    if (value === null) this.deps.db.prepare("DELETE FROM app_settings WHERE key = ?").run(key);
    else this.deps.db.prepare("INSERT OR REPLACE INTO app_settings (key, value) VALUES (?, ?)").run(key, value);
  }
  token() {
    const stored = this.get("sync_token");
    if (!stored) return null;
    try {
      return this.deps.secret.decrypt(stored);
    } catch {
      return null;
    }
  }
  api(token) {
    return async (method, path2, body) => {
      const t = token();
      const res = await this.deps.fetch(`${this.deps.cloudUrl}${path2}`, {
        method,
        headers: { "Content-Type": "application/json", ...t ? { Authorization: `Bearer ${t}` } : {} },
        body: body === void 0 ? void 0 : JSON.stringify(body)
      });
      let parsed = null;
      try {
        parsed = await res.json();
      } catch {
      }
      return { status: res.status, body: parsed };
    };
  }
  info() {
    return { linked: !!this.token(), churchName: this.get("sync_church"), lastOk: this.get("sync_last_ok") };
  }
  status() {
    return this.info().linked ? this.engine.status : { ...this.engine.status, state: "off" };
  }
  emit(s) {
    this.deps.send("sync:status", s);
    if (s.applied) this.deps.send("sync:applied", null);
  }
  /** One full sync at a time; concurrent callers share it. */
  run(opts = {}) {
    if (!this.info().linked) {
      const off = this.status();
      this.emit(off);
      return Promise.resolve(off);
    }
    this.running ??= (async () => {
      this.deps.send("sync:status", { ...this.engine.status, state: "syncing", notices: [], applied: false });
      const s = await this.engine.run(opts);
      this.emit(s);
      return s;
    })().finally(() => {
      this.running = null;
    });
    return this.running;
  }
  async pushOnly() {
    if (!this.info().linked || this.running) return;
    const before = this.engine.status;
    const s = await this.engine.pushOnly();
    if (s !== before) this.emit(s);
  }
  start() {
    this.stop();
    void this.run();
    this.timers.push(setInterval(() => void this.pushOnly(), PUSH_EVERY_MS));
    this.timers.push(setInterval(() => void this.run(), SYNC_EVERY_MS));
  }
  stop() {
    this.timers.forEach(clearInterval);
    this.timers = [];
  }
  remember(token, churchName) {
    this.set("sync_token", this.deps.secret.encrypt(token));
    this.set("sync_church", churchName);
  }
  /** Creates the church from this computer (the trusted one) and uploads its catalog. */
  async setup(p) {
    let res;
    try {
      res = await this.api(() => null)("POST", "/api/setup", { ...p, deviceName: this.deps.deviceName });
    } catch {
      return { ok: false, error: OFFLINE };
    }
    if (res.status !== 200) return { ok: false, error: res.body?.error ?? `Error ${res.status}` };
    this.clearSyncState();
    this.remintUids();
    this.remember(res.body.deviceToken, res.body.churchName);
    this.start();
    const status = await this.run();
    return { ok: true, churchCode: res.body.churchCode, recoveryCode: res.body.recoveryCode, churchName: res.body.churchName, status };
  }
  /** Links this computer with a code from the leader's phone, adopting matching songs. */
  async link(p) {
    let res;
    try {
      res = await this.api(() => null)("POST", "/api/link", { code: p.code, deviceName: this.deps.deviceName });
    } catch {
      return { ok: false, error: OFFLINE };
    }
    if (res.status !== 200) return { ok: false, error: res.body?.error ?? `Error ${res.status}` };
    const token = res.body.deviceToken;
    let pulled;
    try {
      const r = await this.api(() => token)("POST", "/api/sync/pull", { since: 0 });
      if (r.status !== 200) return { ok: false, error: r.body?.error ?? `Error ${r.status}` };
      pulled = r.body;
    } catch {
      return { ok: false, error: OFFLINE };
    }
    this.clearSyncState();
    this.remintUids();
    let summary;
    try {
      summary = adoptOnLink(this.deps.db, pulled, { backupDir: this.deps.backupDir, now: this.deps.now });
    } catch (e) {
      return { ok: false, error: `No se pudo empatar el catálogo: ${e.message}` };
    }
    this.remember(token, res.body.churchName);
    this.start();
    const status = await this.run();
    return { ok: true, churchName: res.body.churchName, summary, status };
  }
  remintUids() {
    for (const t of ["songs", "setlists", "folders"]) this.deps.db.prepare(`UPDATE ${t} SET uid = lower(hex(randomblob(16)))`).run();
  }
  clearSyncState() {
    this.deps.db.prepare("DELETE FROM sync_snapshot").run();
    for (const k of ["sync_seq", "sync_last_ok"]) this.set(k, null);
  }
  /** Forgets the link on this computer (the cloud keeps the catalog). */
  async unlink() {
    const token = this.token();
    if (token) await this.api(() => token)("POST", "/api/logout").catch(() => {
    });
    this.stop();
    this.clearSyncState();
    this.set("sync_token", null);
    this.set("sync_church", null);
    this.emit(this.status());
  }
}
const CLOUD_URL = process.env.ALADO_CLOUD_URL || "https://alado.mj-cristhian.workers.dev";
let service = null;
const secret = {
  encrypt: (s) => electron.safeStorage.isEncryptionAvailable() ? `safe:${electron.safeStorage.encryptString(s).toString("base64")}` : `plain:${s}`,
  decrypt: (s) => s.startsWith("safe:") ? electron.safeStorage.decryptString(Buffer.from(s.slice(5), "base64")) : s.replace(/^plain:/, "")
};
const str = (v, max) => typeof v === "string" ? v.slice(0, max) : "";
function registerSyncHandlers(getMainWindow, isLive) {
  service = new SyncService({
    db: getDb(),
    cloudUrl: CLOUD_URL,
    fetch: globalThis.fetch,
    videosDir: path.join(electron.app.getPath("userData"), "videos"),
    backupDir: path.join(electron.app.getPath("userData"), "backups"),
    isLive,
    send: (channel, payload) => {
      const win = getMainWindow();
      if (win && !win.isDestroyed()) win.webContents.send(channel, payload);
    },
    secret,
    deviceName: os.hostname() || "Compu",
    now: () => /* @__PURE__ */ new Date()
  });
  const s = service;
  electron.ipcMain.handle("sync:get-status", () => s.status());
  electron.ipcMain.handle("sync:info", () => s.info());
  electron.ipcMain.handle("sync:run", () => s.run({ force: true }));
  electron.ipcMain.handle("sync:setup", (_e, p) => s.setup({
    churchName: str(p?.churchName, 200),
    leaderName: str(p?.leaderName, 100),
    pin: str(p?.pin, 8),
    setupKey: str(p?.setupKey, 64)
  }));
  electron.ipcMain.handle("sync:link", (_e, p) => s.link({ code: str(p?.code, 20) }));
  electron.ipcMain.handle("sync:unlink", () => s.unlink());
  return s;
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
let liveWindowed = false;
let sync = null;
electron.app.whenReady().then(() => {
  registerMediaProtocol();
  registerDbHandlers();
  registerLiveHandlers();
  registerSystemHandlers();
  registerLyricsHandlers();
  registerAudioHandlers(() => mainWindow);
  registerPackHandlers();
  registerSetlistHandlers();
  registerVideosHandlers();
  mainWindow = createMainWindow();
  sync = registerSyncHandlers(() => mainWindow, () => !!liveWindow && !liveWindow.isDestroyed());
  mainWindow.webContents.once("did-finish-load", () => sync?.start());
  electron.ipcMain.handle("live:open", async () => {
    if (!liveWindow || liveWindow.isDestroyed()) {
      const created = createLiveWindow();
      liveWindow = created.win;
      liveWindowed = created.windowed;
      setLiveWindow(liveWindow);
      liveWindow.on("closed", () => {
        liveWindow = null;
        setLiveWindow(null);
        clearLiveState();
        mainWindow?.webContents.send("live:closed");
        void sync?.run();
      });
      liveWindow.webContents.ipc.on("live:renderer-ready", replayLiveState);
      await new Promise((resolve) => {
        const timeout = setTimeout(resolve, 5e3);
        liveWindow.webContents.ipc.once("live:renderer-ready", () => {
          clearTimeout(timeout);
          resolve();
        });
      });
    }
    if (!liveWindow) return { windowed: liveWindowed };
    if (liveWindowed) {
      liveWindow.showInactive();
      mainWindow?.focus();
    } else {
      liveWindow.show();
    }
    return { windowed: liveWindowed };
  });
  electron.ipcMain.handle("live:close", () => {
    liveWindow?.close();
  });
  electron.ipcMain.on("live:escape", () => {
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
