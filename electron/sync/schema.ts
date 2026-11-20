import type { LocalDb } from './localDb'

const SYNCED_TABLES = ['songs', 'setlists', 'folders'] as const
const NEW_UID = 'lower(hex(randomblob(16)))'

function hasColumn(db: LocalDb, table: string, column: string): boolean {
  return (db.prepare(`SELECT name FROM pragma_table_info('${table}')`).all() as { name: string }[]).some(c => c.name === column)
}

/**
 * user_version 6: every synced row gets a global id (`uid`), new rows get one from a trigger
 * (so every write path — editor, .alado, .wfpack — is covered), and `sync_snapshot` holds the
 * last state known to match the cloud. Safe to run twice.
 */
export function migrateV6(db: LocalDb): void {
  for (const table of SYNCED_TABLES) {
    if (!hasColumn(db, table, 'uid')) db.exec(`ALTER TABLE ${table} ADD COLUMN uid TEXT`)
    db.exec(`UPDATE ${table} SET uid = ${NEW_UID} WHERE uid IS NULL`)
    db.exec(`CREATE UNIQUE INDEX IF NOT EXISTS idx_${table}_uid ON ${table}(uid)`)
    db.exec(`
      CREATE TRIGGER IF NOT EXISTS ${table}_uid AFTER INSERT ON ${table}
      WHEN NEW.uid IS NULL
      BEGIN
        UPDATE ${table} SET uid = ${NEW_UID} WHERE id = NEW.id;
      END;
    `)
  }
  db.exec(`
    CREATE TABLE IF NOT EXISTS sync_snapshot (
      kind     TEXT NOT NULL,   -- 'song' | 'setlist' | 'folder'
      uid      TEXT NOT NULL,
      data     TEXT NOT NULL,   -- JSON, same shape as the local view
      versions TEXT NOT NULL DEFAULT '{}',
      seq      INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (kind, uid)
    );
  `)
}
