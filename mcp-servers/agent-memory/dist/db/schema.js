export const SCHEMA_VERSION = 1;
export const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS memories (
  id            TEXT PRIMARY KEY,
  path          TEXT UNIQUE NOT NULL,
  type          TEXT NOT NULL,
  title         TEXT NOT NULL,
  content       TEXT NOT NULL,
  project       TEXT,
  confidence    TEXT NOT NULL DEFAULT 'medium',
  status        TEXT NOT NULL DEFAULT 'active',
  created_at    TEXT NOT NULL,
  updated_at    TEXT NOT NULL,
  source        TEXT,
  source_session TEXT,
  tags_json     TEXT NOT NULL DEFAULT '[]'
);

CREATE INDEX IF NOT EXISTS idx_memories_type     ON memories(type);
CREATE INDEX IF NOT EXISTS idx_memories_status   ON memories(status);
CREATE INDEX IF NOT EXISTS idx_memories_project  ON memories(project);
CREATE INDEX IF NOT EXISTS idx_memories_created  ON memories(created_at);

CREATE VIRTUAL TABLE IF NOT EXISTS memory_fts USING fts5(
  id UNINDEXED,
  type UNINDEXED,
  project UNINDEXED,
  title,
  content,
  tags,
  tokenize = 'unicode61'
);

CREATE TABLE IF NOT EXISTS memory_links (
  source_id TEXT NOT NULL,
  target_id TEXT NOT NULL,
  relation  TEXT NOT NULL DEFAULT 'related',
  PRIMARY KEY (source_id, target_id, relation)
);

CREATE INDEX IF NOT EXISTS idx_memory_links_target ON memory_links(target_id);

CREATE TABLE IF NOT EXISTS meta (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
`;
export const FTS_WEIGHTS = "bm25(memory_fts, 0, 0, 0, -6.0, -1.0, -3.0)";
//# sourceMappingURL=schema.js.map