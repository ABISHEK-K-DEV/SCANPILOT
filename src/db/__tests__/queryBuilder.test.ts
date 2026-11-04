import { buildDocumentQuery, escapeLike, orderByClause } from '../queryBuilder';

describe('buildDocumentQuery', () => {
  it('defaults to newest first and hides locked folders', () => {
    const { sql, params } = buildDocumentQuery();
    expect(sql).toBe('SELECT * FROM documents WHERE (folder_id IS NULL OR folder_id NOT IN (SELECT id FROM folders WHERE is_locked = 1)) ORDER BY updated_at DESC');
    expect(params).toEqual([]);
  });

  it('combines search (name or OCR text), folder, favourites and limit with bound parameters', () => {
    const { sql, params } = buildDocumentQuery({ search: ' tax ', folderId: 'f1', favoritesOnly: true, limit: 5 });
    expect(sql).toContain('(name LIKE ? ESCAPE');
    expect(sql).toContain('document_text WHERE text LIKE ?');
    expect(sql).not.toContain('is_locked'); // explicit folder: shown once the user opened it
    expect(params).toEqual(['%tax%', '%tax%', 'f1', 5]);
  });

  it('filters root documents when folderId is null', () => {
    expect(buildDocumentQuery({ folderId: null }).sql).toContain('folder_id IS NULL');
  });

  it('escapes LIKE wildcards so "100%" matches literally', () => {
    expect(escapeLike('100%_a\\b')).toBe('100\\%\\_a\\\\b');
    expect(buildDocumentQuery({ search: '50%' }).params).toEqual(['%50\\%%', '%50\\%%']);
  });

  it('maps each sort option to a whitelisted clause', () => {
    expect(orderByClause({ field: 'name', direction: 'asc' })).toBe('name COLLATE NOCASE ASC');
    expect(orderByClause({ field: 'size', direction: 'desc' })).toBe('size_bytes DESC, updated_at DESC');
    expect(orderByClause({ field: 'opened', direction: 'desc' })).toBe('last_opened_at IS NULL, last_opened_at DESC, updated_at DESC');
    expect(orderByClause({ field: 'date', direction: 'asc' })).toBe('updated_at ASC');
  });
});
