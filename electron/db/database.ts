import Database from 'better-sqlite3'
import { app } from 'electron'
import path from 'path'
import fs from 'fs'

let db: Database.Database

export function getDb(): Database.Database {
  if (!db) {
    const userDataPath = app.getPath('userData')
    const dbPath = path.join(userDataPath, 'worshipflow.db')
    db = new Database(dbPath)
    db.pragma('journal_mode = WAL')
    db.pragma('foreign_keys = ON')
    initSchema()
    scheduleBackup(userDataPath, dbPath)
  }
  return db
}

function initSchema(): void {
  const schemaPath = path.join(__dirname, 'schema.sql')
  const schema = fs.readFileSync(schemaPath, 'utf-8')
  db.exec(schema)
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
      // Keep only the 5 most recent backups
      const backups = fs.readdirSync(backupDir)
        .filter(f => f.startsWith('worshipflow_') && f.endsWith('.db'))
        .sort()
      backups.slice(0, -5).forEach(f => fs.unlinkSync(path.join(backupDir, f)))
    }).catch(console.error)
  }
}
