import type { Folder, FolderWithCount } from '@/types/document';

import { getDatabase } from './database';

interface FolderRow {
  id: string;
  name: string;
  created_at: number;
  updated_at: number;
  document_count?: number;
}

function fromRow(row: FolderRow): FolderWithCount {
  return {
    id: row.id,
    name: row.name,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    documentCount: row.document_count ?? 0,
  };
}

export async function listFolders(): Promise<FolderWithCount[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<FolderRow>(
    `SELECT f.*, (SELECT COUNT(*) FROM documents d WHERE d.folder_id = f.id) AS document_count
     FROM folders f ORDER BY f.name COLLATE NOCASE ASC`,
  );
  return rows.map(fromRow);
}

export async function getFolder(id: string): Promise<FolderWithCount | null> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<FolderRow>(
    `SELECT f.*, (SELECT COUNT(*) FROM documents d WHERE d.folder_id = f.id) AS document_count
     FROM folders f WHERE f.id = ?`,
    [id],
  );
  return row ? fromRow(row) : null;
}

export async function folderNameExists(name: string, excludeId?: string): Promise<boolean> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<{ n: number }>(
    'SELECT COUNT(*) AS n FROM folders WHERE name = ? COLLATE NOCASE AND id != ?',
    [name, excludeId ?? ''],
  );
  return (row?.n ?? 0) > 0;
}

export async function insertFolder(folder: Folder): Promise<void> {
  const db = await getDatabase();
  await db.runAsync('INSERT INTO folders (id, name, created_at, updated_at) VALUES (?, ?, ?, ?)', [
    folder.id,
    folder.name,
    folder.createdAt,
    folder.updatedAt,
  ]);
}

export async function renameFolderRow(id: string, name: string): Promise<void> {
  const db = await getDatabase();
  await db.runAsync('UPDATE folders SET name = ?, updated_at = ? WHERE id = ?', [name, Date.now(), id]);
}

/** Deletes the folder; its documents move back to the library root (FK ON DELETE SET NULL). */
export async function deleteFolderRow(id: string): Promise<void> {
  const db = await getDatabase();
  await db.withTransactionAsync(async () => {
    await db.runAsync('UPDATE documents SET folder_id = NULL WHERE folder_id = ?', [id]);
    await db.runAsync('DELETE FROM folders WHERE id = ?', [id]);
  });
}
