import type { DocumentQuery, SortOption } from '@/types/document';

/** Builds a safe ORDER BY clause from a whitelisted sort option (never from user strings). */
export function orderByClause(sort: SortOption): string {
  const direction = sort.direction === 'asc' ? 'ASC' : 'DESC';
  switch (sort.field) {
    case 'name':
      return `name COLLATE NOCASE ${direction}`;
    case 'size':
      return `size_bytes ${direction}, updated_at DESC`;
    case 'opened':
      // Never-opened documents always sort last.
      return `last_opened_at IS NULL, last_opened_at ${direction}, updated_at DESC`;
    case 'date':
    default:
      return `updated_at ${direction}`;
  }
}

export function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (char) => `\\${char}`);
}

export interface SqlQuery {
  sql: string;
  params: (string | number)[];
}

export function buildDocumentQuery(query: DocumentQuery = {}): SqlQuery {
  const where: string[] = [];
  const params: (string | number)[] = [];
  const search = query.search?.trim();
  if (search) {
    // Matches the file name or any OCR'd text inside the document.
    where.push("(name LIKE ? ESCAPE '\\' OR id IN (SELECT document_id FROM document_text WHERE text LIKE ? ESCAPE '\\'))");
    const pattern = `%${escapeLike(search)}%`;
    params.push(pattern, pattern);
  }
  if (query.folderId === null) where.push('folder_id IS NULL');
  else if (typeof query.folderId === 'string') {
    where.push('folder_id = ?');
    params.push(query.folderId);
  }
  if (query.favoritesOnly) where.push('is_favorite = 1');
  // Documents in locked folders stay hidden everywhere except inside that folder once unlocked.
  if (!query.includeLocked && typeof query.folderId !== 'string') {
    where.push('(folder_id IS NULL OR folder_id NOT IN (SELECT id FROM folders WHERE is_locked = 1))');
  }
  let sql = 'SELECT * FROM documents';
  if (where.length > 0) sql += ` WHERE ${where.join(' AND ')}`;
  sql += ` ORDER BY ${orderByClause(query.sort ?? { field: 'date', direction: 'desc' })}`;
  if (query.limit !== undefined) {
    sql += ' LIMIT ?';
    params.push(Math.max(0, Math.floor(query.limit)));
  }
  return { sql, params };
}
