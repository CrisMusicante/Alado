-- ALADO cloud schema (D1). One row per church; every synced row carries church_id.

CREATE TABLE churches (
  id            TEXT PRIMARY KEY,
  name          TEXT NOT NULL,
  code          TEXT NOT NULL UNIQUE,      -- members' access code (8 chars, no dash)
  code_version  INTEGER NOT NULL DEFAULT 1, -- bumped when the code rotates
  recovery_hash TEXT NOT NULL,
  seq           INTEGER NOT NULL DEFAULT 0, -- last change number handed out
  created_at    TEXT NOT NULL
);

CREATE TABLE users (
  id         TEXT PRIMARY KEY,
  church_id  TEXT NOT NULL REFERENCES churches(id),
  name       TEXT NOT NULL,
  role       TEXT NOT NULL CHECK (role IN ('leader', 'editor')),
  pin_hash   TEXT NOT NULL,
  active     INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL
);
CREATE UNIQUE INDEX users_name ON users(church_id, name COLLATE NOCASE);

CREATE TABLE devices (
  id         TEXT PRIMARY KEY,
  church_id  TEXT NOT NULL REFERENCES churches(id),
  name       TEXT NOT NULL,
  created_at TEXT NOT NULL,
  revoked    INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE sessions (
  token_hash   TEXT PRIMARY KEY,
  church_id    TEXT NOT NULL REFERENCES churches(id),
  user_id      TEXT,
  device_id    TEXT,
  role         TEXT NOT NULL CHECK (role IN ('leader', 'editor', 'member', 'desktop')),
  code_version INTEGER,
  created_at   TEXT NOT NULL,
  revoked      INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE link_codes (
  code_hash  TEXT PRIMARY KEY,
  church_id  TEXT NOT NULL REFERENCES churches(id),
  expires_at TEXT NOT NULL,
  used       INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE attempts (
  key          TEXT PRIMARY KEY,
  count        INTEGER NOT NULL,
  window_start TEXT NOT NULL
);

CREATE TABLE songs (
  uid       TEXT PRIMARY KEY,
  church_id TEXT NOT NULL REFERENCES churches(id),
  fields    TEXT NOT NULL,  -- JSON SongFields
  versions  TEXT NOT NULL,  -- JSON { field: seq }
  authors   TEXT NOT NULL,  -- JSON { field: { id, name } }
  deleted   INTEGER NOT NULL DEFAULT 0,
  seq       INTEGER NOT NULL
);
CREATE INDEX songs_seq ON songs(church_id, seq);

CREATE TABLE folders (
  uid       TEXT PRIMARY KEY,
  church_id TEXT NOT NULL REFERENCES churches(id),
  name      TEXT NOT NULL,
  deleted   INTEGER NOT NULL DEFAULT 0,
  seq       INTEGER NOT NULL
);
CREATE INDEX folders_seq ON folders(church_id, seq);

CREATE TABLE setlists (
  uid          TEXT PRIMARY KEY,
  church_id    TEXT NOT NULL REFERENCES churches(id),
  name         TEXT NOT NULL,
  service_date TEXT,
  notes        TEXT,
  items        TEXT NOT NULL,  -- JSON SetlistItem[]
  deleted      INTEGER NOT NULL DEFAULT 0,
  seq          INTEGER NOT NULL,
  author       TEXT            -- JSON { id, name } of the last writer
);
CREATE INDEX setlists_seq ON setlists(church_id, seq);

CREATE TABLE proposals (
  id          TEXT PRIMARY KEY,
  church_id   TEXT NOT NULL REFERENCES churches(id),
  song_uid    TEXT,
  author_id   TEXT NOT NULL,
  author_name TEXT NOT NULL,
  seen        TEXT NOT NULL,  -- JSON FieldVersions at proposal time
  fields      TEXT NOT NULL,  -- JSON Partial<SongFields>
  status      TEXT NOT NULL DEFAULT 'pending',
  note        TEXT,
  created_at  TEXT NOT NULL,
  decided_at  TEXT,
  decided_by  TEXT
);
CREATE INDEX proposals_status ON proposals(church_id, status);

CREATE TABLE notices (
  id         TEXT PRIMARY KEY,
  church_id  TEXT NOT NULL REFERENCES churches(id),
  target     TEXT NOT NULL,  -- 'user:<id>' | 'device:<id>' | 'leaders'
  message    TEXT NOT NULL,
  created_at TEXT NOT NULL,
  delivered  TEXT NOT NULL DEFAULT '[]'  -- JSON list of session targets that already read it (for 'leaders')
);
CREATE INDEX notices_target ON notices(church_id, target);
