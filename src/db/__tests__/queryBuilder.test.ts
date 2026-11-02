import { buildDocumentQuery, escapeLike, orderByClause } from '../queryBuilder';

describe('buildDocumentQuery', () => {
  it('defaults to newest first with no filters', () => {
    expect(buildDocumentQuery()).toEqual({ sql: 'SELECT * FROM documents ORDER BY updated_at DESC', params: [] });
  });

  it('combines search, folder, favourites and limit with bound parameters', () => {
    const { sql, params } = buildDocumentQuery({ search: ' tax ', folderId: 'f1', favoritesOnly: true, limit: 5 });
    expect(sql).toBe(
      "SELECT * FROM documents WHERE name LIKE ? ESCAPE '\\' AND folder_id = ? AND is_favorite = 1 ORDER BY updated_at DESC LIMIT ?",
    );
    expect(params).toEqual(['%tax%', 'f1', 5]);
  });

  it('filters root documents when folderId is null', () => {
    expect(buildDocumentQuery({ folderId: null }).sql).toContain('folder_id IS NULL');
  });

  it('escapes LIKE wildcards so "100%" matches literally', () => {
    expect(escapeLike('100%_a\\b')).toBe('100\\%\\_a\\\\b');
    expect(buildDocumentQuery({ search: '50%' }).params).toEqual(['%50\\%%']);
  });

  it('maps each sort option to a whitelisted clause', () => {
    expect(orderByClause({ field: 'name', direction: 'asc' })).toBe('name COLLATE NOCASE ASC');
    expect(orderByClause({ field: 'size', direction: 'desc' })).toBe('size_bytes DESC, updated_at DESC');
    expect(orderByClause({ field: 'opened', direction: 'desc' })).toBe('last_opened_at IS NULL, last_opened_at DESC, updated_at DESC');
    expect(orderByClause({ field: 'date', direction: 'asc' })).toBe('updated_at ASC');
  });
});
