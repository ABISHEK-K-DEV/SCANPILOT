/**
 * Schema migrations, applied in order and tracked with `PRAGMA user_version`.
 * Never edit a released migration; append a new one instead.
 */
export const MIGRATIONS: readonly string[] = [
  // v1 — Milestone 1: library metadata
  `
  CREATE TABLE IF NOT EXISTS folders (
    id TEXT PRIMARY KEY NOT NULL,
    name TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS documents (
    id TEXT PRIMARY KEY NOT NULL,
    name TEXT NOT NULL,
    kind TEXT NOT NULL DEFAULT 'pdf',
    source TEXT NOT NULL,
    file_path TEXT NOT NULL,
    thumbnail_path TEXT,
    page_count INTEGER,
    size_bytes INTEGER NOT NULL DEFAULT 0,
    folder_id TEXT REFERENCES folders(id) ON DELETE SET NULL,
    is_favorite INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    last_opened_at INTEGER
  );

  CREATE INDEX IF NOT EXISTS idx_documents_folder ON documents(folder_id);
  CREATE INDEX IF NOT EXISTS idx_documents_updated ON documents(updated_at);
  CREATE INDEX IF NOT EXISTS idx_documents_opened ON documents(last_opened_at);

  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY NOT NULL,
    value TEXT NOT NULL
  );
  `,
];
