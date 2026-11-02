import { fromLibraryPath, toLibraryPath } from '@/services/storage/paths';
import type { DocumentQuery, ScanDocument } from '@/types/document';

import { getDatabase } from './database';
import { buildDocumentQuery } from './queryBuilder';

interface DocumentRow {
  id: string;
  name: string;
  kind: string;
  source: string;
  /** Relative to the library root — see services/storage/paths. */
  file_path: string;
  thumbnail_path: string | null;
  page_count: number | null;
  size_bytes: number;
  folder_id: string | null;
  is_favorite: number;
  created_at: number;
  updated_at: number;
  last_opened_at: number | null;
}

function fromRow(row: DocumentRow): ScanDocument {
  return {
    id: row.id,
    name: row.name,
    kind: row.kind as ScanDocument['kind'],
    source: row.source as ScanDocument['source'],
    fileUri: fromLibraryPath(row.file_path),
    thumbnailUri: row.thumbnail_path ? fromLibraryPath(row.thumbnail_path) : null,
    pageCount: row.page_count,
    sizeBytes: row.size_bytes,
    folderId: row.folder_id,
    isFavorite: row.is_favorite === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    lastOpenedAt: row.last_opened_at,
  };
}

export async function listDocuments(query: DocumentQuery = {}): Promise<ScanDocument[]> {
  const db = await getDatabase();
  const { sql, params } = buildDocumentQuery(query);
  const rows = await db.getAllAsync<DocumentRow>(sql, params);
  return rows.map(fromRow);
}

export async function getDocument(id: string): Promise<ScanDocument | null> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<DocumentRow>('SELECT * FROM documents WHERE id = ?', [id]);
  return row ? fromRow(row) : null;
}

export async function documentNameExists(name: string, excludeId?: string): Promise<boolean> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<{ n: number }>(
    'SELECT COUNT(*) AS n FROM documents WHERE name = ? COLLATE NOCASE AND id != ?',
    [name, excludeId ?? ''],
  );
  return (row?.n ?? 0) > 0;
}

export async function allDocumentNames(): Promise<Set<string>> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<{ name: string }>('SELECT name FROM documents');
  return new Set(rows.map((row) => row.name.toLowerCase()));
}

export async function insertDocument(doc: ScanDocument): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    `INSERT INTO documents (id, name, kind, source, file_path, thumbnail_path, page_count, size_bytes,
       folder_id, is_favorite, created_at, updated_at, last_opened_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      doc.id,
      doc.name,
      doc.kind,
      doc.source,
      toLibraryPath(doc.fileUri),
      doc.thumbnailUri ? toLibraryPath(doc.thumbnailUri) : null,
      doc.pageCount,
      doc.sizeBytes,
      doc.folderId,
      doc.isFavorite ? 1 : 0,
      doc.createdAt,
      doc.updatedAt,
      doc.lastOpenedAt,
    ],
  );
}

type DocumentPatch = Partial<
  Pick<ScanDocument, 'name' | 'thumbnailUri' | 'pageCount' | 'sizeBytes' | 'folderId' | 'isFavorite' | 'lastOpenedAt' | 'fileUri'>
>;

const COLUMN: Record<keyof DocumentPatch, string> = {
  name: 'name',
  thumbnailUri: 'thumbnail_path',
  pageCount: 'page_count',
  sizeBytes: 'size_bytes',
  folderId: 'folder_id',
  isFavorite: 'is_favorite',
  lastOpenedAt: 'last_opened_at',
  fileUri: 'file_path',
};

/**
 * Updates the given fields. `touch` controls whether `updated_at` changes —
 * opening a file or regenerating a thumbnail should not count as modifying it.
 */
export async function updateDocument(id: string, patch: DocumentPatch, touch = true): Promise<void> {
  const db = await getDatabase();
  const sets: string[] = [];
  const params: (string | number | null)[] = [];
  (Object.keys(patch) as (keyof DocumentPatch)[]).forEach((key) => {
    const value = patch[key];
    if (value === undefined) return;
    sets.push(`${COLUMN[key]} = ?`);
    if (typeof value === 'boolean') params.push(value ? 1 : 0);
    else if ((key === 'fileUri' || key === 'thumbnailUri') && typeof value === 'string') params.push(toLibraryPath(value));
    else params.push(value);
  });
  if (touch) {
    sets.push('updated_at = ?');
    params.push(Date.now());
  }
  if (sets.length === 0) return;
  params.push(id);
  await db.runAsync(`UPDATE documents SET ${sets.join(', ')} WHERE id = ?`, params);
}

export async function deleteDocumentRow(id: string): Promise<void> {
  const db = await getDatabase();
  await db.runAsync('DELETE FROM documents WHERE id = ?', [id]);
}

export interface LibraryStats {
  documentCount: number;
  totalBytes: number;
  favoriteCount: number;
}

export async function getLibraryStats(): Promise<LibraryStats> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<{ n: number; bytes: number | null; favs: number | null }>(
    'SELECT COUNT(*) AS n, SUM(size_bytes) AS bytes, SUM(is_favorite) AS favs FROM documents',
  );
  return { documentCount: row?.n ?? 0, totalBytes: row?.bytes ?? 0, favoriteCount: row?.favs ?? 0 };
}
