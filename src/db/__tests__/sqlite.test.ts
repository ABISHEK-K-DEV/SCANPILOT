/// <reference types="node" />
/**
 * Runs the real migrations and generated queries against SQLite (via Python's
 * built-in sqlite3), so schema changes and query logic are checked by an
 * actual database engine rather than string comparison.
 */
import { execFileSync } from 'child_process';

import { MIGRATIONS } from '../migrations';
import { buildDocumentQuery } from '../queryBuilder';

const SCRIPT = String.raw`
import json, sqlite3, sys
spec = json.loads(sys.stdin.read())
db = sqlite3.connect(':memory:')
db.execute('PRAGMA foreign_keys = ON')
for m in spec['migrations']:
    db.executescript(m)
db.executescript(spec['seed'])
out = []
for q in spec['queries']:
    out.append([r[0] for r in db.execute(q['sql'], q['params']).fetchall()])
db.execute("DELETE FROM documents WHERE id = 'd2'")
out.append(db.execute('SELECT COUNT(*) FROM document_text').fetchone()[0])
print(json.dumps(out))
`;

function run(queries: { sql: string; params: (string | number)[] }[]) {
  const seed = `
    INSERT INTO folders (id, name, created_at, updated_at, is_locked) VALUES ('f1', 'Receipts', 1, 1, 0), ('lock', 'Private', 1, 1, 1);
    INSERT INTO documents (id, name, source, file_path, size_bytes, folder_id, created_at, updated_at) VALUES
      ('d1', 'Electricity bill', 'scan', 'a', 1, NULL, 1, 3),
      ('d2', 'IMG_0042', 'scan', 'b', 1, 'f1', 1, 2),
      ('d3', 'Passport', 'scan', 'c', 1, 'lock', 1, 1);
    INSERT INTO document_text (document_id, page, text) VALUES ('d2', 0, 'Grocery total 1,234 rupees'), ('d3', 0, 'Republic of India passport');
  `;
  try {
    const stdout = execFileSync('python3', ['-I', '-c', SCRIPT], { input: JSON.stringify({ migrations: MIGRATIONS, seed, queries }), encoding: 'utf8' });
    return JSON.parse(stdout) as unknown[];
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null;
    throw error;
  }
}

describe('SQLite schema and queries', () => {
  it('migrates, searches OCR text, hides locked folders and cascades deletes', () => {
    const result = run([
      buildDocumentQuery(),
      buildDocumentQuery({ search: 'grocery' }),
      buildDocumentQuery({ search: 'passport' }),
      buildDocumentQuery({ folderId: 'lock' }),
    ].map(({ sql, params }) => ({ sql: sql.replace('SELECT *', 'SELECT id'), params })));
    if (!result) return; // python3 unavailable
    expect(result[0]).toEqual(['d1', 'd2']); // locked d3 hidden
    expect(result[1]).toEqual(['d2']); // found by OCR text, not name
    expect(result[2]).toEqual([]); // locked document not leaked by search
    expect(result[3]).toEqual(['d3']); // visible inside its (unlocked) folder
    expect(result[4]).toBe(1); // deleting d2 removed its OCR text
  });
});
