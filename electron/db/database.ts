import Database from 'better-sqlite3'
import { app } from 'electron'
import path from 'path'
import fs from 'fs'

let db: Database.Database

// Inlined schema — avoids electron-vite not copying .sql assets to out/main/
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
`

export function getDb(): Database.Database {
  if (!db) {
    const userDataPath = app.getPath('userData')
    const dbPath = path.join(userDataPath, 'worshipflow.db')
    db = new Database(dbPath)
    db.pragma('journal_mode = WAL')
    db.pragma('foreign_keys = ON')
    db.exec(SCHEMA)
    runMigrations(db)
    scheduleBackup(userDataPath, dbPath)
  }
  return db
}

function runMigrations(database: Database.Database): void {
  const version = database.pragma('user_version', { simple: true }) as number

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
        `)
      } catch (e: any) {
        // Column already exists (partial previous run) — safe to ignore
        if (!String(e?.message).includes('duplicate column name')) throw e
      }
      database.pragma('user_version = 2')
    })()
  }
}

function scheduleBackup(userDataPath: string, dbPath: string): void {
  const backupDir = path.join(userDataPath, 'backups')
  fs.mkdirSync(backupDir, { recursive: true })

  const settingsRow = db.prepare("SELECT value FROM app_settings WHERE key = 'last_backup'").get() as { value: string } | undefined
  const lastBackup = settingsRow ? new Date(settingsRow.value) : null
  const daysSince = lastBackup ? (Date.now() - lastBackup.getTime()) / 86_400_000 : 99

  if (daysSince >= 7) {
    const date = new Date().toISOString().slice(0, 10)
    const dest = path.join(backupDir, `worshipflow_${date}.db`)
    db.backup(dest).then(() => {
      db.prepare("INSERT OR REPLACE INTO app_settings (key, value) VALUES ('last_backup', ?)").run(new Date().toISOString())
      const backups = fs.readdirSync(backupDir)
        .filter(f => f.startsWith('worshipflow_') && f.endsWith('.db'))
        .sort()
      backups.slice(0, -5).forEach(f => fs.unlinkSync(path.join(backupDir, f)))
    }).catch(console.error)
  }
}
