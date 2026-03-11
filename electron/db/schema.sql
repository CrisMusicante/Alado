-- WorshipFlow Database Schema v1.0

CREATE TABLE IF NOT EXISTS songs (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  title       TEXT NOT NULL,
  artist      TEXT,
  sections    TEXT NOT NULL DEFAULT '[]',   -- JSON: Section[]
  video_path  TEXT,                          -- Absolute path to background video
  text_style  TEXT NOT NULL DEFAULT '{}',   -- JSON: TextStyle
  created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at  DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS setlists (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  name         TEXT NOT NULL,
  service_date TEXT,   -- ISO 8601 date string
  notes        TEXT,
  created_at   DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS setlist_items (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  setlist_id   INTEGER NOT NULL REFERENCES setlists(id) ON DELETE CASCADE,
  song_id      INTEGER NOT NULL REFERENCES songs(id) ON DELETE RESTRICT,
  position     INTEGER NOT NULL,   -- 0-indexed order
  custom_video TEXT                -- per-service video override
);

CREATE TABLE IF NOT EXISTS app_settings (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

-- Full-text search
CREATE INDEX IF NOT EXISTS idx_songs_title ON songs(title COLLATE NOCASE);
CREATE VIRTUAL TABLE IF NOT EXISTS songs_fts
  USING fts5(title, artist, sections, content='songs', content_rowid='id');

-- Auto-update updated_at
CREATE TRIGGER IF NOT EXISTS songs_updated_at
  AFTER UPDATE ON songs
  BEGIN
    UPDATE songs SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
  END;
