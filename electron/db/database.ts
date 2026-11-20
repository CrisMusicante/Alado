import Database from 'better-sqlite3'
import { app } from 'electron'
import path from 'path'
import fs from 'fs'
import { SCHEMA, SONG_AUDIO_SQL } from './schemaSql'
import { migrateV6 } from '../sync/schema'

let db: Database.Database

// Inlined schema (electron/db/schemaSql.ts) — avoids electron-vite not copying .sql assets to out/main/

export function getDb(): Database.Database {
  if (!db) {
    const userDataPath = app.getPath('userData')
    const dbPath = path.join(userDataPath, 'worshipflow.db')
    const isFirstRun = !fs.existsSync(dbPath)
    if (isFirstRun) installSeed(userDataPath, dbPath)
    db = new Database(dbPath)
    db.pragma('journal_mode = WAL')
    db.pragma('foreign_keys = ON')
    db.exec(SCHEMA)
    runMigrations(db)
    scheduleBackup(userDataPath, dbPath)
  }
  return db
}

// Catálogo embebido en el instalador (resources/seed, ver scripts/make-seed.py).
// Solo se aplica cuando no existe DB: copia la DB y los videos a userData y
// reescribe video_path, que en la semilla apunta a la máquina de origen.
function installSeed(userDataPath: string, dbPath: string): void {
  const seedDir = path.join(process.resourcesPath, 'seed')
  const seedDb = path.join(seedDir, 'worshipflow.seed.db')
  if (!fs.existsSync(seedDb)) return

  const videosDest = path.join(userDataPath, 'videos')
  const videosSrc = path.join(seedDir, 'videos')
  if (fs.existsSync(videosSrc)) fs.cpSync(videosSrc, videosDest, { recursive: true })

  const tmp = dbPath + '.seeding'
  fs.copyFileSync(seedDb, tmp)
  const seeded = new Database(tmp)
  try {
    const rows = seeded.prepare("SELECT id, video_path FROM songs WHERE video_path IS NOT NULL AND video_path != ''").all() as { id: number; video_path: string }[]
    const update = seeded.prepare('UPDATE songs SET video_path = ? WHERE id = ?')
    seeded.transaction(() => {
      for (const r of rows) {
        const name = r.video_path.split(/[\\/]/).pop()!
        update.run(path.join(videosDest, name), r.id)
      }
    })()
    seeded.pragma('journal_mode = DELETE')
  } finally {
    seeded.close()
  }
  fs.renameSync(tmp, dbPath)
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

  if (version < 3) {
    database.transaction(() => {
      database.exec(SONG_AUDIO_SQL)
      database.pragma('user_version = 3')
    })()
  }

  if (version < 4) {
    database.transaction(() => {
      try {
        database.exec('ALTER TABLE songs ADD COLUMN song_key TEXT')
      } catch (e: any) {
        if (!String(e?.message).includes('duplicate column name')) throw e
      }
      database.pragma('user_version = 4')
    })()
  }

  if (version < 5) {
    database.transaction(() => {
      try {
        // JSON SongSheetStyle (electron/setlist/sheetStyle.ts); NULL = use the general setting.
        database.exec('ALTER TABLE songs ADD COLUMN sheet_style TEXT')
      } catch (e: any) {
        if (!String(e?.message).includes('duplicate column name')) throw e
      }
      database.pragma('user_version = 5')
    })()
  }

  if (version < 6) {
    database.transaction(() => {
      // Global ids + sync snapshot for ALADO conectado (electron/sync/schema.ts).
      migrateV6(database)
      database.pragma('user_version = 6')
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
